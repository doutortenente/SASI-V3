/**
 * Alertas clínicos — leitura do painel e reconhecimento (ack).
 *
 * ---------------------------------------------------------------------------
 * QUEM PRODUZ O ALERTA NÃO É ESTE ARQUIVO
 * ---------------------------------------------------------------------------
 * O produtor mora no BANCO: os gatilhos `trg_eval_alert` e `trg_eval_trend`,
 * ambos `after insert on eventos_clinicos`
 * (`supabase/schema-referencia/10_schema_producao_v3.sql:596-597`).
 * Nenhuma função daqui faz `insert` em `alerts_log` — o app só LÊ e RECONHECE.
 * Escrever alerta pelo app criaria um segundo produtor, fora do gatilho, e o
 * mesmo evento passaria a gerar alerta em duplicidade.
 *
 * O débito herdado do v2 ("alerts_log = 0, o motor nunca dispara") está
 * OBSOLETO. Medido no banco vivo `idswehsvvqczzkiatuzu` em 08-ago-2026:
 *   alerts_log = 14 linhas · 9 abertas (acked=false) · 5 reconhecidas
 *   critical aberto 4 · critical reconhecido 3 · warning aberto 5 ·
 *   warning reconhecido 2 · info 0
 *   eventos_clinicos = 335 · alert_rules ativas = 25
 * O motor JÁ dispara. O que faltava era o consumidor — que é este arquivo.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O CLIENTE CHEGA POR PARÂMETRO E NÃO POR IMPORT
 * ---------------------------------------------------------------------------
 * A leitura roda no servidor (`getSupabaseServer`) e o ack roda no navegador
 * (`getSupabaseBrowser`). Os dois módulos são mutuamente exclusivos de
 * propósito: `server.ts` começa com `import 'server-only'` (importar no
 * navegador QUEBRA o build) e `client.ts` começa com `'use client'`.
 * Um arquivo só não pode importar os dois. Então o cliente entra como
 * argumento — quem chama decide de que lado está. Efeito colateral bom: dá
 * para testar sem mock de módulo.
 *
 * Este arquivo é SERVIÇO, não hook. Consumo esperado (v3):
 *   Server Component  -> `await lerResumoDeAlertasAbertos(await getSupabaseServer())`
 *   interação no card -> TanStack Query em `src/features/alerts/hooks/`,
 *                        passando `getSupabaseBrowser()`
 * Estado de servidor é TanStack Query, nunca Zustand.
 *
 * ---------------------------------------------------------------------------
 * DEDUPLICAÇÃO: NÃO FAZER AQUI
 * ---------------------------------------------------------------------------
 * `alerts_log` tem índice único `uq_alerts_hash (hash_key)` e os dois gatilhos
 * inserem com `on conflict (hash_key) do nothing`
 * (`10_schema_producao_v3.sql:338`). O alerta repetido já morre no banco.
 * Filtrar repetido no navegador só esconderia alerta legítimo.
 *
 * Fonte do contrato (arquivos deste repo, não memória):
 *   view  `vw_alertas_abertos` — `supabase/migrations/20260808102501_f0_secao_b_adocao_de_enums.sql:141-153`
 *   índices `uq_alerts_hash` e `idx_alerts_pac_ack` — `supabase/schema-referencia/10_schema_producao_v3.sql:338-339`
 * Não há constante clínica neste arquivo: severidade, limiar e mensagem vêm de
 * `alert_rules`/`trend_rules`, que são dado do banco.
 */
import type {SupabaseClient} from '@supabase/supabase-js';

import {exigirDado} from '@/lib/data/erros';
import type {AlertLog, Uti} from '@/types';
import type {Database} from '@/types/supabase';

/** O cliente Supabase tipado, venha ele do servidor ou do navegador. */
export type ClienteSasi = SupabaseClient<Database>;

/** Linha crua da view, como o gerador de tipos a entrega (tudo opcional). */
type LinhaCruaDoResumo = Database['public']['Views']['vw_alertas_abertos']['Row'];

/** Contagem por severidade. Mesmo formato que `PropsBedCard.alertasAbertos` espera. */
export interface ContagemDeAlertas {
    criticos: number;
    warnings: number;
    infos: number;
}

/** Uma linha de `vw_alertas_abertos`: um leito com pelo menos 1 alerta aberto. */
export interface ResumoDeAlertasDoLeito extends ContagemDeAlertas {
    paciente_id: string;
    uti: Uti;
    leito: string;
    nome: string;
    total: number;
}

/** O agregado do cabeçalho: quanto a UTI inteira tem em aberto agora. */
export interface TotalDeAlertasAbertos extends ContagemDeAlertas {
    total: number;
    /** Quantos leitos têm ao menos um alerta aberto. */
    leitosComAlerta: number;
}

/** Ajustes do reconhecimento. Ambos têm padrão — o caso comum não passa nada. */
export interface OpcoesDeAck {
    /**
     * Quem reconheceu. Padrão `null`, DE PROPÓSITO — ver `reconhecerAlerta`.
     */
    reconhecidoPor?: string | null;
    /** Momento do reconhecimento. Padrão: agora. Existe para o teste fixar a hora. */
    agoraISO?: string;
}

/**
 * Falha ao gravar o reconhecimento.
 *
 * Separada de `FalhaDeLeitura` porque o estrago é outro: numa leitura que
 * falha a tela fica sem dado e o médico percebe; num ack que falha em silêncio
 * o médico acha que limpou o alerta e ele CONTINUA ABERTO — ou pior, continua
 * aberto para o plantão seguinte sem ninguém saber. Quem chama tem que poder
 * distinguir os dois e dizer "o alerta NÃO foi reconhecido".
 */
export class FalhaAoReconhecerAlerta extends Error {
    readonly alvo: string;
    readonly causaOriginal: string | undefined;

    constructor(alvo: string, causaOriginal?: string) {
        super(
            `Falha ao reconhecer ${alvo}. O alerta CONTINUA ABERTO — ` +
                `não tratar como resolvido.` +
                (causaOriginal ? ` Causa: ${causaOriginal}` : ''),
        );
        this.name = 'FalhaAoReconhecerAlerta';
        this.alvo = alvo;
        this.causaOriginal = causaOriginal;
    }
}

/**
 * Colunas da view, uma a uma.
 *
 * String literal (não `[...].join(',')`) para o cliente tipado inferir a linha
 * de volta: errar nome de coluna vira erro de compilação, não erro em produção
 * com o paciente na tela.
 */
const COLUNAS_RESUMO = 'paciente_id, uti, leito, nome, criticos, warnings, infos, total';

/**
 * `count(*)` no Postgres devolve 0, nunca null — o `| null` do tipo é artefato
 * do gerador, que trata toda coluna de view como opcional. Converter para 0
 * aqui NÃO é inventar dado clínico: é contagem de linha, e a linha só existe
 * porque há alerta aberto.
 */
function contagem(valor: number | null): number {
    return valor ?? 0;
}

/**
 * Descarta a linha que não dá para atribuir a um leito.
 *
 * `paciente_id`, `uti`, `leito` e `nome` vêm do `group by` sobre um `join` com
 * `pacientes` — na prática nunca são nulos. Mas o tipo diz que podem ser, e
 * mostrar "alerta crítico" sem dizer de QUEM é pior do que não mostrar.
 * Mesmo tratamento que `features/beds/services/leitos.ts` dá à grade.
 */
export function normalizarResumo(linhas: LinhaCruaDoResumo[]): ResumoDeAlertasDoLeito[] {
    const pronto: ResumoDeAlertasDoLeito[] = [];
    for (const l of linhas) {
        if (l.paciente_id == null || l.uti == null || l.leito == null || l.nome == null) continue;
        pronto.push({
            paciente_id: l.paciente_id,
            uti: l.uti,
            leito: l.leito,
            nome: l.nome,
            criticos: contagem(l.criticos),
            warnings: contagem(l.warnings),
            infos: contagem(l.infos),
            total: contagem(l.total),
        });
    }
    return pronto;
}

/**
 * Todos os leitos com alerta aberto, um por linha.
 *
 * Lista vazia é resposta LEGÍTIMA: "nenhum alerta aberto" é um fato clínico.
 * Falha de leitura não vira lista vazia — `exigirDado` lança e a exceção sobe
 * até `app/error.tsx`.
 */
export async function lerResumoDeAlertasAbertos(supabase: ClienteSasi): Promise<ResumoDeAlertasDoLeito[]> {
    const resposta = await supabase.from('vw_alertas_abertos').select(COLUNAS_RESUMO);
    const linhas = exigirDado(resposta, 'vw_alertas_abertos (painel de alertas)');
    return normalizarResumo(linhas as unknown as LinhaCruaDoResumo[]);
}

/**
 * O número do cabeçalho, calculado sobre as linhas que a tela JÁ tem.
 *
 * De propósito NÃO é uma segunda consulta: duas consultas chegam em instantes
 * diferentes, e o cabeçalho passaria a discordar dos cards logo abaixo dele.
 */
export function agregarAlertasAbertos(linhas: ResumoDeAlertasDoLeito[]): TotalDeAlertasAbertos {
    return linhas.reduce<TotalDeAlertasAbertos>(
        (acc, l) => ({
            criticos: acc.criticos + l.criticos,
            warnings: acc.warnings + l.warnings,
            infos: acc.infos + l.infos,
            total: acc.total + l.total,
            leitosComAlerta: acc.leitosComAlerta + 1,
        }),
        {criticos: 0, warnings: 0, infos: 0, total: 0, leitosComAlerta: 0},
    );
}

/**
 * Vira um mapa `paciente_id` para contagem, do jeito que o card consome.
 *
 * Sem isso, cada card varreria a lista inteira: 33 leitos vezes 33 linhas.
 * Paciente ausente do mapa = zero alerta aberto (a view só traz quem tem).
 */
export function indexarResumoPorPaciente(
    linhas: ResumoDeAlertasDoLeito[],
): Record<string, ContagemDeAlertas> {
    const mapa: Record<string, ContagemDeAlertas> = {};
    for (const l of linhas) {
        mapa[l.paciente_id] = {criticos: l.criticos, warnings: l.warnings, infos: l.infos};
    }
    return mapa;
}

/**
 * Os alertas abertos de UM paciente, do mais novo para o mais antigo.
 *
 * A ordem não é gosto: `paciente_id` + `acked` + `created_at desc` é exatamente
 * o índice `idx_alerts_pac_ack` que já existe em produção
 * (`10_schema_producao_v3.sql:339`). Inverter a ordem ou trocar o filtro tira a
 * consulta do índice e ela passa a varrer a tabela.
 */
export async function lerAlertasAbertosDoPaciente(
    supabase: ClienteSasi,
    pacienteId: string,
): Promise<AlertLog[]> {
    const resposta = await supabase
        .from('alerts_log')
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('acked', false)
        .order('created_at', {ascending: false});
    const linhas = exigirDado(resposta, `alerts_log do paciente ${pacienteId}`);
    return linhas as unknown as AlertLog[];
}

/**
 * Reconhece UM alerta. Devolve quantas linhas mudaram (0 = o id não existe ou
 * já estava reconhecido).
 *
 * ARMADILHA PORTADA DO v2 — não reintroduzir:
 * o hook original chamava `supabase.auth.getUser()` para preencher `acked_by`.
 * No v3 o login está com escopo FECHADO (uso solo, `dev_bypass` ativa de
 * propósito), então essa chamada é uma ida ao servidor que sempre volta sem
 * usuário — e ainda pode lançar, travando o botão de reconhecer.
 * `acked_by: null` não é defeito, é o estado normal: das 14 linhas de
 * `alerts_log` em produção (08-ago-2026), 14 têm `acked_by` null e 14 têm
 * `user_id` null — INCLUSIVE as 5 que já foram reconhecidas com sucesso.
 *
 * Não existe "desfazer ack" no contrato. Se for preciso, é feature nova.
 */
export async function reconhecerAlerta(
    supabase: ClienteSasi,
    alertaId: string,
    opcoes: OpcoesDeAck = {},
): Promise<number> {
    const resposta = await supabase
        .from('alerts_log')
        .update({
            acked: true,
            acked_at: opcoes.agoraISO ?? new Date().toISOString(),
            acked_by: opcoes.reconhecidoPor ?? null,
        })
        .eq('id', alertaId)
        .select('id');

    if (resposta.error) {
        throw new FalhaAoReconhecerAlerta(`o alerta ${alertaId}`, resposta.error.message);
    }
    return resposta.data?.length ?? 0;
}

/**
 * Reconhece TODOS os alertas abertos de um paciente — o "limpar alertas deste
 * leito". Devolve quantos foram reconhecidos.
 *
 * O `.eq('acked', false)` é OBRIGATÓRIO e não é redundante: sem ele o update
 * pega também as linhas já reconhecidas e sobrescreve o `acked_at` delas,
 * apagando a hora real do reconhecimento anterior. Perde-se a trilha de quando
 * o alerta foi visto pela primeira vez — que é justamente o que se audita
 * depois de um evento adverso.
 */
export async function reconhecerAlertasDoPaciente(
    supabase: ClienteSasi,
    pacienteId: string,
    opcoes: OpcoesDeAck = {},
): Promise<number> {
    const resposta = await supabase
        .from('alerts_log')
        .update({
            acked: true,
            acked_at: opcoes.agoraISO ?? new Date().toISOString(),
            acked_by: opcoes.reconhecidoPor ?? null,
        })
        .eq('paciente_id', pacienteId)
        .eq('acked', false)
        .select('id');

    if (resposta.error) {
        throw new FalhaAoReconhecerAlerta(`os alertas do paciente ${pacienteId}`, resposta.error.message);
    }
    return resposta.data?.length ?? 0;
}
