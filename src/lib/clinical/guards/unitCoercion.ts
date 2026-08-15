// ============================================================================
// SASI — Adaptador entre `../unidades` (casa única, testada) e o contrato de
// nome que o pacote `sasi-motor-clinico-v2` espera (`../guards/unitCoercion`).
// ----------------------------------------------------------------------------
// A leitura de unidade NÃO é reimplementada aqui. `coerceFiO2` e
// `coercePlaquetas` já existem em `../unidades.ts`, testados. Este arquivo só
// troca o nome do campo de resultado: `../unidades` devolve `{valor}` (pt),
// o motor do operador lê `{value}` (en, ex.: sofa.ts:154 `const {value: fio2}
// = coerceFiO2Input(...)`). Mudar o shape do app inteiro para inglês quebraria
// `unidades.test.ts`; duplicar a lógica de coerção quebraria a regra de casa
// única. A saída é este adaptador fino.
// ============================================================================

import {coerceFiO2, coercePlaquetas as coercePlaquetasPt, parseNumeroBR} from '../unidades';
import {INFECTO} from '../constants';

export interface ValorCoagido {
    value: number | null;
    aviso?: string;
    original: string;
}

/** Ponte para `coerceFiO2` de `../unidades` — mesma leitura, campo `value` em vez de `valor`. */
export function coerceFiO2Input(bruto: string | number | null | undefined): ValorCoagido {
    const r = coerceFiO2(bruto);
    const out: ValorCoagido = {value: r.valor, original: r.original};
    if (r.aviso) out.aviso = r.aviso;
    return out;
}

export interface PlaquetasCoagidas {
    value: number | null;
    /** `'ambiguous_input'` quando `../unidades` avisou (sem unidade declarada, fora das faixas plausíveis). */
    warning?: 'ambiguous_input';
    /** Texto original digitado — sofa.ts:229 cita no aviso ao médico. */
    rawInput: string;
}

/**
 * Ponte para `coercePlaquetas` de `../unidades` — mesma leitura de faixa e
 * ordem de grandeza; só troca o shape: `../unidades` devolve `{valor, aviso,
 * original}` (pt), sofa.ts:207-231 do motor lê `{value, warning, rawInput}` (en).
 */
export function coercePlaquetas(
    bruto: string | number | null | undefined,
    unidadeDeclarada?: '×10³/µL' | '/µL',
): PlaquetasCoagidas {
    const r = coercePlaquetasPt(bruto, unidadeDeclarada);
    const out: PlaquetasCoagidas = {value: r.valor, rawInput: r.original};
    if (r.aviso) out.warning = 'ambiguous_input';
    return out;
}

export interface TemperaturaCoagida extends ValorCoagido {
    isFever: boolean;
    isHypothermia: boolean;
}

/**
 * Lê a temperatura axilar e classifica febre/hipotermia pelos limiares já
 * extraídos do código do operador — `INFECTO.TAX_FEBRE` (>38°C) e
 * `INFECTO.TAX_HIPOTERMIA` (≤36°C), ver `../constants/thresholds.ts`.
 * Ausente: `value: null`, `isFever`/`isHypothermia` ficam `false` — falta de
 * dado nunca vira febre nem hipotermia por omissão.
 */
export function coerceTAX(bruto: string | number | null | undefined): TemperaturaCoagida {
    const original = String(bruto ?? '');
    const n = parseNumeroBR(bruto);
    if (n === null) {
        return {value: null, original, isFever: false, isHypothermia: false};
    }
    return {
        value: n,
        original,
        isFever: n > INFECTO.TAX_FEBRE,
        isHypothermia: n <= INFECTO.TAX_HIPOTERMIA,
    };
}
