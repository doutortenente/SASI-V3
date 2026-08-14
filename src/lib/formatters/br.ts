// Portado do SASI v2 (src/lib/formatters/br.ts) sem alteração de comportamento.
// Números pt-BR (vírgula decimal). ZERO ALUCINAÇÃO: null -> travessão, nunca 0 inventado.
export const num = (v: number | null | undefined, casas = 1) =>
    v == null
        ? '—'
        : v.toLocaleString('pt-BR', {
              minimumFractionDigits: 0,
              maximumFractionDigits: casas,
          });
export const naoAvaliado = 'não avaliado';

// ─────────────────────────────────────────────────────────────────────────────
// SEGURANÇA DE MEDICAÇÃO — unidade de dose
//
// BUG REAL encontrado em 30-jul-2026 (chip de DVA no War Room):
//   o símbolo "µ" (micro, U+00B5) sob `text-transform: uppercase` vira "Μ"
//   (Mu grego, U+039C), visualmente IDÊNTICO a um "M" latino. Na tela lia-se
//   "NORADRENALINA 0,04 MG/KG/MIN" onde o banco tem 0,04 µg/kg/min.
//   Erro de leitura de MIL VEZES na dose de uma droga vasoativa.
//
// Correção: exibir "mcg" em vez de "µg". Não é conversão de valor — µg e mcg
// são a MESMA unidade, apenas a grafia segura. É a recomendação do ISMP
// (Institute for Safe Medication Practices), que lista "µg" como abreviação
// perigosa exatamente por ser confundida com "mg".
//
// O DADO NO BANCO NÃO MUDA. Isto é camada de apresentação.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza a grafia da unidade para leitura segura em qualquer caixa (maiúscula
 * ou minúscula). Cobre o micro latino (µ U+00B5) e o Mu grego (μ U+03BC).
 * Não converte valor, não inventa unidade: entrada vazia sai vazia.
 */
export function unidadeSegura(u: string | null | undefined): string {
    if (u == null) return '';
    return String(u)
        .replace(/[µμ]g/g, 'mcg') // µg / μg -> mcg
        .replace(/[µμ]/g, 'mc'); // micro isolado (raro) -> mc
}

/** Junta valor + unidade com a grafia segura. Valor ausente => travessão, sem unidade solta. */
export function comUnidade(valor: string | number | null | undefined, unidade?: string | null): string {
    if (valor == null || valor === '') return '—';
    const u = unidadeSegura(unidade);
    return u ? `${valor} ${u}` : String(valor);
}
