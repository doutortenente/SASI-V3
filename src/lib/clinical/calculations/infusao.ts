// ============================================================================
// SASI — `calcDoseInfusao`: a tomada entre o motor e a calculadora de dose do app
// ----------------------------------------------------------------------------
// O app JÁ TEM a conta: `calcularDose` em `src/lib/clinical/infusoes.ts`, com as
// três fórmulas (por kg/min, por min, por kg/h), as diluições que a farmácia da
// casa prepara e a faixa terapêutica de cada droga. NADA disso é reescrito aqui.
//
// Este arquivo só traduz o CONTRATO, porque o motor do operador chama assim:
//     calcDoseInfusao(infusao, dict, peso)     -> {value, unit, min, max, isInRange, error?, warning?}
// e o app expõe assim:
//     calcularDose(nome, iDiluicao, vazao, peso, tabela) -> {ok, dose} | {ok:false, motivo}
//
// Duas peças de comportamento que o app não tinha e que o código dele exige:
//   `error: 'missing_weight'`  — sofa.ts:299 e compat:218 ramificam nisso.
//   `warning: 'absurd_high'`   — engine.ts:499 ramifica nisso.
// As duas são traduções de estado, não regra clínica nova. O corte do "absurdo"
// é o do próprio operador: engine.ts:503 escreve "acima de 2× o máximo esperado".
// ============================================================================

import {calcularDose, type Farmaco, type UnidadeDose} from '@/lib/clinical/infusoes';
import {SOFA_CUTOFFS} from '@/lib/clinical/constants/sofa-cutoffs';
import type {Infusao} from '@/lib/clinical/types';

/** Multiplicador do teto da faixa a partir do qual a dose é "absurda". */
const FATOR_DOSE_ABSURDA = 2;

/** Por que a dose não saiu. Os rótulos são os que o código do operador testa. */
export type ErroDose = 'missing_weight' | 'unknown_drug' | 'unknown_dilution' | 'invalid_flow';

/** Resultado no formato que `sofa.ts`, `engine.ts` e `clinical-logic-compat.ts` esperam. */
export interface ResultadoDoseInfusao {
    /** `undefined` quando não deu para calcular — nunca 0. */
    value?: number | undefined;
    unit?: UnidadeDose | undefined;
    min?: number | undefined;
    max?: number | undefined;
    isInRange?: boolean | undefined;
    error?: ErroDose | undefined;
    /** `'absurd_high'` = passou de 2× o teto da faixa. Suspeita de erro de digitação. */
    warning?: 'absurd_high' | undefined;
}

/**
 * Converte a vazão da bomba na dose clínica, no contrato do motor.
 *
 * @param infusao - a infusão da ficha (`droga`, `vazao`, `diluicao`)
 * @param dict    - o `Farmaco` já resolvido pelo chamador (`DVA_DICT[infusao.droga]`)
 * @param peso    - peso do paciente. Sem ele, dose por quilo NÃO é estimada.
 */
export function calcDoseInfusao(
    infusao: Infusao,
    dict: Farmaco | undefined,
    peso: string | number | null | undefined,
): ResultadoDoseInfusao {
    if (!dict) return {error: 'unknown_drug'};

    // A calculadora do app procura o fármaco por nome numa tabela. O motor já
    // trouxe o verbete pronto, então a tabela é de um item só — assim a conta
    // continua sendo a do app, sem uma segunda implementação.
    const r = calcularDose(infusao.droga, infusao.diluicao ?? 0, infusao.vazao, peso, {
        [infusao.droga]: dict,
    });

    if (!r.ok) {
        switch (r.motivo) {
            case 'peso-necessario':
                return {error: 'missing_weight'};
            case 'diluicao-desconhecida':
                return {error: 'unknown_dilution'};
            case 'farmaco-desconhecido':
                return {error: 'unknown_drug'};
            default:
                return {error: 'invalid_flow'};
        }
    }

    const {valor, unidade, faixaMin, faixaMax, dentroDaFaixa} = r.dose;

    return {
        value: valor,
        unit: unidade,
        min: faixaMin,
        max: faixaMax,
        isInRange: dentroDaFaixa,
        warning: valor > faixaMax * FATOR_DOSE_ABSURDA ? 'absurd_high' : undefined,
    };
}

/**
 * Noradrenalina ou adrenalina em ALTA dose, no sentido da Tabela 2 do SOFA:
 * acima de 0,1 mcg/kg/min o componente cardiovascular vale 4 em vez de 3.
 *
 * Só as duas drogas respondem `true`. Dobutamina, dopamina e vasopressina têm
 * regra própria e não passam por aqui — devolver `true` para elas inflaria o
 * SOFA cardiovascular de quem está só em inotrópico.
 *
 * Sem dose calculada, devolve `false`: "não sei" nunca vira "está alta".
 */
export function isVasopressorHighDose(resultado: ResultadoDoseInfusao, droga: string): boolean {
    if (droga !== 'Noradrenalina' && droga !== 'Adrenalina') return false;
    if (resultado.value === undefined || Number.isNaN(resultado.value)) return false;
    if (resultado.unit !== 'mcg/kg/min') return false;

    return resultado.value > SOFA_CUTOFFS.CARDIO_NOR_EPI_ALTA_DOSE;
}
