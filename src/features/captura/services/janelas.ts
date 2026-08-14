/**
 * Janelas de 24h — sinal vital como agregado Máx–Mín + excursões.
 *
 * ---------------------------------------------------------------------------
 * POR QUE JANELA, E NÃO AFERIÇÃO BRUTA
 * ---------------------------------------------------------------------------
 * Decisão de produto de 10-ago-2026 (P0, `CLAUDE.md`): excursão de vital só
 * se ingere como AGREGADO — "PAM 90-56 (4/12 <65)" — nunca as 12 aferições
 * soltas. A tabela `janelas_24h` nasceu para isso, com chave única
 * `paciente_id + tipo + janela_fim`: reprocessar a mesma folha SUBSTITUI a
 * janela (upsert), não duplica.
 *
 * ---------------------------------------------------------------------------
 * POR QUE VALIDAR ANTES DE ENVIAR (montarJanela)
 * ---------------------------------------------------------------------------
 * O banco tem 4 constraints (`20260810083510_janelas_24h.sql`): janela_fim >
 * janela_inicio · valor_max >= valor_min · n_fora_* <= n_total · n_fora_* > 0
 * exige o limiar junto. Mandar entrada que as viola só trocaria uma mensagem
 * em português por um erro de SQL ilegível na tela do plantão. Isto NÃO é a
 * malha de faixas fisiológicas (que sinaliza e deixa passar — ver
 * `eventos.ts`): constraint é contrato do banco, não juízo clínico.
 *
 * Exceção deliberada: mín > máx na digitação NÃO recusa — INVERTE e marca
 * '(revisar)'. Doutrina da skill `sasi-ingest-export`: o par de valores é
 * informação real com os rótulos trocados; descartar seria perder dado.
 *
 * Cliente por parâmetro, não por import — mesma doutrina de
 * `features/pendencias/services/pendencias.ts`.
 */
import {parseNumeroBR} from '@/lib/clinical/unidades';
import {exigirDado} from '@/lib/data/erros';

import type {
    ClienteSasi,
    EntradaDeJanela,
    Janela24h,
    JanelaRender,
    PayloadDeJanela,
    ResultadoMontarJanela,
} from '@/features/captura/types';

/**
 * Limiares de excursão padrão por tipo — o contrato P0 de 10-ago-2026
 * (doutrina da skill `sasi-ingest-export`, aprovada pelo operador; é o mesmo
 * conjunto que alimenta o render "PAM 90-56 (4/12 <65)" da nota).
 *
 * Servem UM propósito: quando a folha diz "4 aferições abaixo do limiar" sem
 * dizer qual limiar, o padrão do serviço preenche — porque a constraint
 * `janela_limiar_chk` exige o limiar junto de qualquer excursão. Tipo sem
 * limiar padrão E sem limiar informado é recusado, nunca inventado.
 */
export const LIMIARES_PADRAO: Readonly<Record<string, {baixo?: number; alto?: number}>> = {
    pa_sys: {baixo: 90},
    pa_dia: {baixo: 50},
    pam: {baixo: 65},
    fc: {alto: 100},
    fr: {alto: 20},
    spo2: {baixo: 92},
    temp: {baixo: 35.5, alto: 37.8},
    glicemia: {baixo: 70, alto: 180},
};

/**
 * O default de `n_total` no banco (migration `20260810083510`, linha 19).
 * Representa a folha COMPLETA: aferição de 2/2h em 24h = 12. Usado aqui só
 * para validar `n_fora_*` quando o chamador não informou o real — o valor em
 * si quem põe é o banco, não o app.
 */
export const N_TOTAL_FOLHA_COMPLETA = 12;

/** Falha ao gravar a janela — o banco NÃO registrou, não tratar como salva. */
export class FalhaAoGravarJanela extends Error {
    readonly causaOriginal: string | undefined;

    constructor(alvo: string, causaOriginal?: string) {
        super(
            `Falha ao gravar ${alvo}. O banco NÃO registrou a janela — ` +
                `não tratar como salva.` +
                (causaOriginal ? ` Causa: ${causaOriginal}` : ''),
        );
        this.name = 'FalhaAoGravarJanela';
        this.causaOriginal = causaOriginal;
    }
}

/**
 * Entrada recusada ANTES de tocar o banco: violaria uma constraint. Classe
 * separada de `FalhaAoGravarJanela` porque a conduta é outra — aqui o médico
 * corrige a digitação; lá ele tenta de novo (o banco que falhou).
 */
export class EntradaDeJanelaRecusada extends Error {
    readonly motivo: string;

    constructor(motivo: string) {
        super(`Janela recusada antes do envio: ${motivo}`);
        this.name = 'EntradaDeJanelaRecusada';
        this.motivo = motivo;
    }
}

/**
 * Lê um campo numérico da entrada. Vazio ('' / null / undefined) devolve
 * `null` = o campo NÃO entra no payload. Jamais vira 0: zero é um valor
 * medido, vazio é ausência — confundir os dois inventaria dado clínico.
 */
function lerCampo(bruto: number | string | null | undefined): number | null {
    if (bruto === undefined || bruto === null) return null;
    return parseNumeroBR(bruto);
}

/** Contagem tem que ser inteiro >= 0 — "4,5 aferições fora" não existe. */
function contagemInvalida(n: number): boolean {
    return !Number.isInteger(n) || n < 0;
}

/**
 * Validação PURA da janela: {ok, payload, avisos} ou {ok: false, motivo}.
 *
 * Espelha as 4 constraints do banco (ver cabeçalho) para que a recusa chegue
 * à tela em português, antes do envio. A única "correção" permitida é a
 * inversão mín/máx com aviso '(revisar)' — todo o resto ou passa como veio,
 * ou volta recusado. Nenhum valor é estimado.
 */
export function montarJanela(entrada: EntradaDeJanela): ResultadoMontarJanela {
    const avisos: string[] = [];

    if (entrada.paciente_id.trim() === '') return {ok: false, motivo: 'paciente_id vazio'};
    if (entrada.tipo.trim() === '') return {ok: false, motivo: 'tipo (código do vocabulário) vazio'};

    const inicioMs = Date.parse(entrada.janelaInicioISO);
    const fimMs = Date.parse(entrada.janelaFimISO);
    if (Number.isNaN(inicioMs) || Number.isNaN(fimMs)) {
        return {ok: false, motivo: 'janela_inicio ou janela_fim não é data válida'};
    }
    // Constraint janela_ordem_chk: janela_fim > janela_inicio (estrito).
    if (fimMs <= inicioMs) {
        return {
            ok: false,
            motivo: 'janela_fim tem que ser DEPOIS de janela_inicio — janela de duração zero ou negativa não existe',
        };
    }

    let valorMax = lerCampo(entrada.valor_max);
    let valorMin = lerCampo(entrada.valor_min);
    // Doutrina da skill: mín > máx na digitação INVERTE e marca — o par de
    // valores é real, só os rótulos vieram trocados. Descartar perderia dado.
    if (valorMax !== null && valorMin !== null && valorMin > valorMax) {
        [valorMax, valorMin] = [valorMin, valorMax];
        avisos.push('máx e mín vieram invertidos e foram trocados (revisar)');
    }

    const nTotal = lerCampo(entrada.n_total);
    if (nTotal !== null && (contagemInvalida(nTotal) || nTotal === 0)) {
        return {
            ok: false,
            motivo: `n_total "${String(entrada.n_total)}" não é contagem válida (inteiro > 0)`,
        };
    }
    // Sem n_total informado, o banco aplica 12 (folha completa) — a validação
    // de n_fora_* compara contra o que o banco vai de fato usar.
    const nTotalEfetivo = nTotal ?? N_TOTAL_FOLHA_COMPLETA;

    const nForaAlto = lerCampo(entrada.n_fora_alto);
    const nForaBaixo = lerCampo(entrada.n_fora_baixo);
    for (const [nome, n] of [
        ['n_fora_alto', nForaAlto],
        ['n_fora_baixo', nForaBaixo],
    ] as const) {
        if (n === null) continue;
        if (contagemInvalida(n)) {
            return {ok: false, motivo: `${nome} não é contagem válida (inteiro >= 0)`};
        }
        // Constraint janela_n_chk: excursão não pode exceder o total de aferições.
        if (n > nTotalEfetivo) {
            return {
                ok: false,
                motivo: `${nome} (${n}) maior que o total de aferições (${nTotalEfetivo}) — impossível`,
            };
        }
    }

    // Constraint janela_limiar_chk: excursão > 0 exige o limiar junto — "4
    // abaixo" de QUANTO? Sem limiar informado, vale o padrão do tipo; sem
    // padrão, recusa. Limiar nunca é inventado.
    const padrao = LIMIARES_PADRAO[entrada.tipo];
    let limiarAlto = lerCampo(entrada.limiar_alto);
    let limiarBaixo = lerCampo(entrada.limiar_baixo);
    if (nForaAlto !== null && nForaAlto > 0 && limiarAlto === null) {
        limiarAlto = padrao?.alto ?? null;
        if (limiarAlto === null) {
            return {
                ok: false,
                motivo: `n_fora_alto > 0 sem limiar_alto, e o tipo "${entrada.tipo}" não tem limiar alto padrão`,
            };
        }
    }
    if (nForaBaixo !== null && nForaBaixo > 0 && limiarBaixo === null) {
        limiarBaixo = padrao?.baixo ?? null;
        if (limiarBaixo === null) {
            return {
                ok: false,
                motivo: `n_fora_baixo > 0 sem limiar_baixo, e o tipo "${entrada.tipo}" não tem limiar baixo padrão`,
            };
        }
    }

    // Montagem campo a campo: o que é null NÃO entra (campo vazio não envia).
    const payload: PayloadDeJanela = {
        paciente_id: entrada.paciente_id,
        tipo: entrada.tipo,
        janela_inicio: entrada.janelaInicioISO,
        janela_fim: entrada.janelaFimISO,
        fonte: 'manual',
    };
    if (valorMax !== null) payload.valor_max = valorMax;
    if (valorMin !== null) payload.valor_min = valorMin;
    if (nTotal !== null) payload.n_total = nTotal;
    if (nForaAlto !== null) payload.n_fora_alto = nForaAlto;
    if (nForaBaixo !== null) payload.n_fora_baixo = nForaBaixo;
    if (limiarAlto !== null) payload.limiar_alto = limiarAlto;
    if (limiarBaixo !== null) payload.limiar_baixo = limiarBaixo;
    if (entrada.source_text !== undefined && entrada.source_text.trim() !== '') {
        payload.source_text = entrada.source_text;
    }

    return {ok: true, payload, avisos};
}

/**
 * Colunas do retorno, como string literal. `internacao_id` fica de fora de
 * propósito (assunto do trigger); `requires_review` VOLTA na leitura (a tela
 * mostra a bandeira) mas nunca vai no payload de escrita.
 */
const COLUNAS_JANELA =
    'id, paciente_id, tipo, janela_inicio, janela_fim, valor_max, valor_min, ' +
    'n_total, n_fora_alto, n_fora_baixo, limiar_alto, limiar_baixo, fonte, ' +
    'source_text, requires_review, created_at';

/**
 * Grava (ou substitui) a janela e devolve a linha do banco + avisos da
 * validação.
 *
 * UPSERT com `onConflict: 'paciente_id,tipo,janela_fim'` — a chave única
 * `janela_unica` do banco. Reprocessar a mesma folha SUBSTITUI a janela em
 * vez de duplicar: duas linhas "PAM das últimas 24h" para o mesmo paciente e
 * a mesma janela seriam duas verdades concorrentes na nota.
 */
export async function registrarJanela(
    supabase: ClienteSasi,
    entrada: EntradaDeJanela,
): Promise<{janela: Janela24h; avisos: string[]}> {
    const montada = montarJanela(entrada);
    if (!montada.ok) throw new EntradaDeJanelaRecusada(montada.motivo);

    const resposta = await supabase
        .from('janelas_24h')
        .upsert(montada.payload, {onConflict: 'paciente_id,tipo,janela_fim'})
        .select(COLUNAS_JANELA);

    const alvo = `a janela de "${entrada.tipo}" do paciente ${entrada.paciente_id}`;
    if (resposta.error) throw new FalhaAoGravarJanela(alvo, resposta.error.message);
    const linha = resposta.data?.[0];
    if (!linha) {
        // Upsert sem erro e sem linha de volta não existe no contrato do
        // supabase-js — se acontecer, é falha, não sucesso silencioso.
        throw new FalhaAoGravarJanela(alvo);
    }
    return {janela: linha as unknown as Janela24h, avisos: montada.avisos};
}

/** Colunas da view de render — `render` já vem pronto do banco. */
const COLUNAS_RENDER =
    'id, paciente_id, tipo, rotulo, unidade_padrao, janela_inicio, janela_fim, ' +
    'valor_max, valor_min, n_total, n_fora_alto, n_fora_baixo, limiar_alto, ' +
    'limiar_baixo, faixa_txt, excursoes_txt, render, requires_review, created_at';

/**
 * Janelas de UM paciente, a mais recente primeiro, com o texto PRONTO.
 *
 * Lê `vw_janelas_24h_render`: o campo `render` ("PAM 90-56 (4/12 <65)") é
 * montado NO BANCO, casa única do formato da nota — exibir, nunca remontar
 * (remontar no app criaria um segundo formato que diverge do Fechamento).
 *
 * Lista vazia é resposta legítima (tabela nasceu em 10-ago e enche conforme
 * a ingestão); falha de leitura LANÇA via `exigirDado`.
 */
export async function lerJanelasDoPaciente(
    supabase: ClienteSasi,
    pacienteId: string,
): Promise<JanelaRender[]> {
    const resposta = await supabase
        .from('vw_janelas_24h_render')
        .select(COLUNAS_RENDER)
        .eq('paciente_id', pacienteId)
        .order('janela_fim', {ascending: false});
    const linhas = exigirDado(resposta, `janelas de 24h do paciente ${pacienteId}`);
    return linhas as unknown as JanelaRender[];
}
