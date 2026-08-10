// ============================================================================
// SASI v3 — formatadores de TEMPO (fuso do plantão, calculados no SERVIDOR)
// ----------------------------------------------------------------------------
// Portado do SASI v2 (src/lib/formatters/tempo.ts).
// DOUTRINA: não existe conta de data no client. O servidor pode estar em UTC, o
// médico nunca está — então "há quanto tempo foi a última evolução" é sempre
// calculado aqui, no fuso America/Sao_Paulo, e entregue pronto (texto) à tela.
// Fonte única: telas de leito e de rounds usam este mesmo resumo (não duplicar a conta).
// ============================================================================

/** Fuso do plantão. */
const FUSO = 'America/Sao_Paulo';

/** Sem evolução há este tanto de horas => "atrasada" (o dado já pode não valer). */
export const HORAS_EVOLUCAO_ATRASADA = 24;

const TRAVESSAO = '—';

const fmtHora = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO,
});
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: FUSO,
});
const fmtDiaCheio = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: FUSO,
});

/** Estado da última evolução, já formatado no servidor. */
export interface EvolucaoResumo {
    /** Ex.: "hoje 06:12", "29/07 19:40" ou "—" quando não há evolução. */
    rotulo: string;
    /** true = sem evolução nas últimas 24 h (ou nenhuma evolução registrada). */
    atrasada: boolean;
}

/**
 * Quando foi a última evolução, em texto curto ("hoje 06:12" / "29/07 19:40").
 * Sem evolução (ou data ilegível) => "—" e conta como ATRASADA — que é
 * exatamente o que exige ação (dado velho não deve ser confundido com dado novo).
 */
export function resumoEvolucao(iso: string | null | undefined, agora: Date): EvolucaoResumo {
    if (!iso) return {rotulo: TRAVESSAO, atrasada: true};
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return {rotulo: TRAVESSAO, atrasada: true};

    const horas = (agora.getTime() - t.getTime()) / 3_600_000;
    const rotulo =
        fmtDiaCheio.format(t) === fmtDiaCheio.format(agora)
            ? `hoje ${fmtHora.format(t)}`
            : `${fmtDiaMes.format(t)} ${fmtHora.format(t)}`;
    return {rotulo, atrasada: horas >= HORAS_EVOLUCAO_ATRASADA};
}
