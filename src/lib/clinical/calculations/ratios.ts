// ============================================================================
// SASI — Razões respiratórias: P/F e ROX
// ----------------------------------------------------------------------------
// Substitui o `../calculations/ratios` que `engine.ts` importa (`calcPFRatio`).
//
// As duas contas usam os MESMOS primitivos do app — `parseNumeroBR` para ler o
// número e `coerceFiO2` para normalizar a FiO2 —, então a regra de leitura
// continua tendo uma casa só. O que existe aqui é a razão em si e o contrato de
// retorno que o motor espera.
// ============================================================================

import {coerceFiO2, parseNumeroBR} from '@/lib/clinical/unidades';

/** Por que a razão não saiu. `undefined` quando ela saiu. */
export type MotivoSemRatio = 'pao2' | 'fio2' | 'spo2' | 'fr';

export interface ResultadoPFRatio {
    /** PaO2/FiO2 arredondada. `null` quando falta insumo — nunca 0. */
    ratio: number | null;
    faltou?: MotivoSemRatio | undefined;
    /** Aviso da normalização de FiO2, quando houver. */
    aviso?: string | undefined;
}

/**
 * Relação PaO2/FiO2, em mmHg.
 *
 * A FiO2 entra normalizada em PERCENTUAL (21 a 100) por `coerceFiO2`, e é por
 * isso que a conta multiplica por 100: uma FiO2 digitada como fração (0,4) sem
 * normalização daria uma razão cem vezes maior e transformaria insuficiência
 * respiratória grave em pulmão normal. É o DEFEITO P0 #9.
 *
 * DUPLICATA DECLARADA: a mesma aritmética está em `src/lib/clinical/sofa.ts:115`,
 * escrita na linha. Não foi unificada porque o SOFA do app é o que roda hoje e a
 * ordem foi não editá-lo. É definição aritmética fixa, não limiar clínico —
 * ninguém vai "atualizar a fórmula da P/F" num lugar e esquecer do outro. Está
 * assim mesmo na lista PARA O MEDICO DECIDIR.
 */
export function calcPFRatio(
    pao2: string | number | null | undefined,
    fio2: string | number | null | undefined,
): ResultadoPFRatio {
    const p = parseNumeroBR(pao2);
    if (p === null || p <= 0) return {ratio: null, faltou: 'pao2'};

    const f = coerceFiO2(fio2);
    if (f.valor === null || f.valor <= 0) return {ratio: null, faltou: 'fio2', aviso: f.aviso};

    return {ratio: Math.round((p / f.valor) * 100), aviso: f.aviso};
}

export interface ResultadoROX {
    /** (SpO2/FiO2)/FR. `null` quando falta insumo. */
    rox: number | null;
    faltou?: MotivoSemRatio | undefined;
    aviso?: string | undefined;
}

/**
 * Índice ROX = (SpO2 / FiO2) / FR. Prediz falha de cânula nasal de alto fluxo.
 *
 * Abaixo de 4,88 o risco de intubação é alto — número e limiar são do próprio
 * operador, que o crava e o cita em engine.ts:269-276 ("ROX < 4.88 — RISCO IOT",
 * "Roca 2019").
 * FONTE: Roca O et al., J Crit Care 2016 (índice) e Roca O et al., Am J Respir
 * Crit Care Med 2019 (validação do corte 4,88), citada por ele.
 *
 * IMPORTANT — `engine.ts` NÃO chama esta função: ele calcula o ROX na própria
 * linha (engine.ts:268). Isso foi mantido de propósito, porque mexer ali seria
 * reescrever o código dele. Esta função existe para quem for consumir o ROX
 * daqui para a frente, e a divergência está declarada na lista PARA O MEDICO
 * DECIDIR.
 */
export function calcROX(
    spo2: string | number | null | undefined,
    fio2: string | number | null | undefined,
    fr: string | number | null | undefined,
): ResultadoROX {
    const s = parseNumeroBR(spo2);
    if (s === null || s <= 0) return {rox: null, faltou: 'spo2'};

    const f = coerceFiO2(fio2);
    if (f.valor === null || f.valor <= 0) return {rox: null, faltou: 'fio2', aviso: f.aviso};

    const r = parseNumeroBR(fr);
    if (r === null || r <= 0) return {rox: null, faltou: 'fr'};

    return {rox: Math.round((s / f.valor / r) * 100) / 100, aviso: f.aviso};
}
