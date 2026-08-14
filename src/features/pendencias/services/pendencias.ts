/**
 * Pendências — a lista de "o que falta fazer" de cada paciente.
 *
 * ---------------------------------------------------------------------------
 * POR QUE PENDÊNCIA É A FONTE ÚNICA DO "FALTA FAZER"
 * ---------------------------------------------------------------------------
 * A passagem de plantão usa `pendencias` como fonte única do que ficou aberto
 * (decisão 5 de `docs/ARQUITETURA.md`). Se a Captura gravar pendência num
 * lugar e o Fechamento ler de outro, a passagem mente — e pendência esquecida
 * na troca de turno é exatamente o tipo de erro que o papel produzia.
 *
 * O contrato de escrita (Tela 2, `docs/ARQUITETURA.md`): `tarefa` +
 * `prioridade` 1/2/3, onde 1 = tempo-sensível. `internacao_id` NUNCA é
 * enviado — o trigger do banco carimba sozinho (P0 de 10-ago), e mandar o
 * campo por cima criaria uma segunda fonte que pode divergir do episódio real.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O CLIENTE CHEGA POR PARÂMETRO E NÃO POR IMPORT
 * ---------------------------------------------------------------------------
 * Mesma doutrina de `features/alerts/services/alertas.ts`: a leitura roda no
 * servidor (`getSupabaseServer`) e a escrita roda no navegador
 * (`getSupabaseBrowser`), e os dois módulos são mutuamente exclusivos de
 * propósito (`server.ts` abre com `import 'server-only'`). O cliente entra
 * como argumento — quem chama decide de que lado está — e de quebra o teste
 * dispensa mock de módulo.
 *
 * Este arquivo é SERVIÇO, não hook. Estado de servidor é TanStack Query
 * (em `src/features/pendencias/hooks/`), nunca Zustand.
 */
import type {SupabaseClient} from '@supabase/supabase-js';

import {exigirDado} from '@/lib/data/erros';
import type {Pendencia} from '@/types';
import type {Database} from '@/types/supabase';

/** O cliente Supabase tipado, venha ele do servidor ou do navegador. */
export type ClienteSasi = SupabaseClient<Database>;

/** 1 = tempo-sensível (fazer AGORA) · 2 = rotina do turno · 3 = pode esperar. */
export type PrioridadeDePendencia = 1 | 2 | 3;

/**
 * O que a Captura envia ao criar uma pendência.
 *
 * De propósito NÃO aceita `internacao_id` (trigger carimba), nem `concluida`
 * (pendência nasce aberta — criar já concluída é registro sem função), nem
 * `created_at` (relógio do banco). Tipo fechado: campo a mais nem compila.
 */
export interface NovaPendencia {
    paciente_id: string;
    tarefa: string;
    /** Padrão 2 (rotina). O 1 é escolha ativa do médico, nunca automática. */
    prioridade?: PrioridadeDePendencia;
}

/** Ajustes da conclusão. Existe para o teste fixar a hora — o caso comum não passa nada. */
export interface OpcoesDeConclusao {
    /** Momento da conclusão. Padrão: agora. */
    agoraISO?: string;
}

/**
 * Falha ao gravar (criar, concluir ou reabrir) uma pendência.
 *
 * Separada de `FalhaDeLeitura` porque o estrago é outro: leitura que falha
 * deixa a tela sem dado e o médico percebe; escrita que falha em silêncio
 * faz o médico achar que a tarefa está registrada (ou concluída) quando NÃO
 * está — e pendência fantasma atravessa a passagem de plantão sem dono.
 */
export class FalhaAoGravarPendencia extends Error {
    readonly alvo: string;
    readonly causaOriginal: string | undefined;

    constructor(alvo: string, causaOriginal?: string) {
        super(
            `Falha ao gravar ${alvo}. O banco NÃO registrou a mudança — ` +
                `não tratar como salva.` +
                (causaOriginal ? ` Causa: ${causaOriginal}` : ''),
        );
        this.name = 'FalhaAoGravarPendencia';
        this.alvo = alvo;
        this.causaOriginal = causaOriginal;
    }
}

/**
 * Colunas uma a uma, como string literal (não `[...].join(',')`), para o
 * cliente tipado inferir a linha de volta: errar nome de coluna vira erro de
 * compilação. `internacao_id` fica de fora de propósito — é assunto do
 * trigger, e a tela não o consome.
 */
const COLUNAS =
    'id, paciente_id, evolucao_id, user_id, tarefa, prioridade, concluida, concluida_at, created_at';

/**
 * Toda pendência ABERTA da unidade, a mais urgente primeiro.
 *
 * Ordem `prioridade asc` (1 = tempo-sensível vem antes) e, dentro da mesma
 * prioridade, `created_at asc`: a mais ANTIGA primeiro, porque pendência que
 * envelhece esquecida é a que mais machuca na troca de turno.
 *
 * Lista vazia é resposta LEGÍTIMA ("nada pendente" é um fato clínico).
 * Falha de leitura não vira lista vazia — `exigirDado` lança.
 */
export async function lerPendenciasAbertas(supabase: ClienteSasi): Promise<Pendencia[]> {
    const resposta = await supabase
        .from('pendencias')
        .select(COLUNAS)
        .eq('concluida', false)
        .order('prioridade', {ascending: true})
        .order('created_at', {ascending: true});
    const linhas = exigirDado(resposta, 'pendencias abertas');
    return linhas as unknown as Pendencia[];
}

/**
 * Vira um mapa `paciente_id` → pendências, do jeito que o card consome.
 *
 * Sem isso cada card varreria a lista inteira: 33 leitos vezes N pendências.
 * Paciente ausente do mapa = zero pendência aberta (a consulta só traz quem
 * tem). Mesmo padrão de `indexarResumoPorPaciente` em alertas.
 */
export function indexarPendenciasPorPaciente(lista: Pendencia[]): Record<string, Pendencia[]> {
    const mapa: Record<string, Pendencia[]> = {};
    for (const p of lista) {
        (mapa[p.paciente_id] ??= []).push(p);
    }
    return mapa;
}

/**
 * TODAS as pendências de UM paciente — abertas primeiro, para o Fechamento
 * mostrar o que ficou por fazer antes do que já foi feito.
 *
 * `concluida asc` põe `false` antes de `true`; dentro de cada grupo vale a
 * mesma ordem clínica da lista geral (urgente primeiro, antiga primeiro).
 */
export async function lerPendenciasDoPaciente(
    supabase: ClienteSasi,
    pacienteId: string,
): Promise<Pendencia[]> {
    const resposta = await supabase
        .from('pendencias')
        .select(COLUNAS)
        .eq('paciente_id', pacienteId)
        .order('concluida', {ascending: true})
        .order('prioridade', {ascending: true})
        .order('created_at', {ascending: true});
    const linhas = exigirDado(resposta, `pendencias do paciente ${pacienteId}`);
    return linhas as unknown as Pendencia[];
}

/**
 * Cria uma pendência e devolve a linha gravada (com id e created_at do banco).
 *
 * O payload enviado é EXATAMENTE `paciente_id + tarefa + prioridade` — nada
 * de `internacao_id` (o trigger do banco carimba o episódio vigente; mandar
 * por cima abriria a porta para pendência presa a internação errada).
 *
 * Devolver a linha (e não `void`) permite à Captura mostrar a pendência
 * recém-criada sem uma segunda consulta.
 */
export async function criarPendencia(supabase: ClienteSasi, nova: NovaPendencia): Promise<Pendencia> {
    const resposta = await supabase
        .from('pendencias')
        .insert({
            paciente_id: nova.paciente_id,
            tarefa: nova.tarefa,
            prioridade: nova.prioridade ?? 2,
        })
        .select(COLUNAS);

    if (resposta.error) {
        throw new FalhaAoGravarPendencia(`a pendência "${nova.tarefa}"`, resposta.error.message);
    }
    const linha = resposta.data?.[0];
    if (!linha) {
        // Insert sem erro e sem linha de volta não existe no contrato do
        // supabase-js — se acontecer, é falha, não sucesso silencioso.
        throw new FalhaAoGravarPendencia(`a pendência "${nova.tarefa}"`);
    }
    return linha as unknown as Pendencia;
}

/**
 * Conclui UMA pendência. Devolve quantas linhas mudaram (0 = id inexistente
 * ou já concluída).
 *
 * O `.eq('concluida', false)` é OBRIGATÓRIO e não é redundante — mesma
 * doutrina do ack de alertas: sem ele, concluir de novo uma pendência já
 * concluída sobrescreveria o `concluida_at` original, apagando a hora real
 * em que a tarefa foi feita. É essa hora que a passagem de plantão relata.
 */
export async function concluirPendencia(
    supabase: ClienteSasi,
    pendenciaId: string,
    opcoes: OpcoesDeConclusao = {},
): Promise<number> {
    const resposta = await supabase
        .from('pendencias')
        .update({
            concluida: true,
            concluida_at: opcoes.agoraISO ?? new Date().toISOString(),
        })
        .eq('id', pendenciaId)
        .eq('concluida', false)
        .select('id');

    if (resposta.error) {
        throw new FalhaAoGravarPendencia(`a conclusão da pendência ${pendenciaId}`, resposta.error.message);
    }
    return resposta.data?.length ?? 0;
}

/**
 * Reabre uma pendência concluída por engano (dedo errado no celular, andando).
 * Devolve quantas linhas mudaram.
 *
 * `concluida_at` volta a `null` DE PROPÓSITO: a hora antiga era da conclusão
 * desfeita — mantê-la faria a próxima conclusão real herdar carimbo falso.
 * Aqui não há filtro por estado: reabrir já-aberta é no-op inofensivo (o
 * update grava os mesmos valores), diferente do concluir, onde o filtro
 * protege o carimbo de hora.
 */
export async function reabrirPendencia(supabase: ClienteSasi, pendenciaId: string): Promise<number> {
    const resposta = await supabase
        .from('pendencias')
        .update({
            concluida: false,
            concluida_at: null,
        })
        .eq('id', pendenciaId)
        .select('id');

    if (resposta.error) {
        throw new FalhaAoGravarPendencia(`a reabertura da pendência ${pendenciaId}`, resposta.error.message);
    }
    return resposta.data?.length ?? 0;
}
