// ============================================================================
// SASI — `calcDiureseEfetiva`: débito urinário no contrato do motor + estágio KDIGO
// ----------------------------------------------------------------------------
// A CONTA já é do app: `calcularDebitoUrinario` em
// `src/lib/clinical/unidades.ts` faz mL/kg/h, projeta a janela para 24 h e avisa
// quando a projeção é estimativa. Nada disso é reescrito aqui.
//
// O QUE ESTE ARQUIVO ACRESCENTA é o que o motor do operador consome e o app não
// tinha: `isAnuric`, `isOliguric`, `formatted`, `kdigoByDU` e `kdigoLabel`
// (engine.ts:308-331, sofa.ts:454-461 e compat:239 do pacote).
//
// POR QUE O ESTAGIAMENTO PRECISA DA DURAÇÃO, e não só do valor: o KDIGO por
// débito urinário é um critério de VALOR × TEMPO. Menos de 0,5 mL/kg/h por 6 h é
// estágio 1; o MESMO 0,5 sustentado por 12 h é estágio 2. Estadiar uma coleta de
// 2 h como se fosse de 24 h transforma um plantão curto em lesão renal grave.
// Por isso janela menor que 6 h não estadia — devolve 0 e diz por quê.
//
// FONTE do critério: KDIGO 2012 Clinical Practice Guideline for Acute Kidney
// Injury — critério de débito urinário. Diretriz citada pelo próprio operador em
// sofa.ts:420 ("KDIGO 2012 + SOFA Singer 2016") e engine.ts:298.
// ============================================================================

import {calcularDebitoUrinario} from '@/lib/clinical/unidades';
import {RENAL} from '@/lib/clinical/constants/thresholds';
import {SEM_DADO} from '@/lib/formatters/clinico';

/** Estágio de lesão renal aguda pelo eixo do débito urinário. 0 = sem critério. */
export type EstagioKdigoDu = 0 | 1 | 2 | 3;

/** Horas mínimas de coleta para o KDIGO por débito urinário poder ser aplicado. */
const HORAS_MINIMAS_PARA_ESTADIAR = 6;
const HORAS_ESTAGIO_2 = 12;
const HORAS_ESTAGIO_3 = 24;
const HORAS_ANURIA_ESTAGIO_3 = 12;

export interface DiureseEfetiva {
    /** `null` quando falta peso ou volume. Nunca 0 por ausência. */
    mlPerKgPerHour: number | null;
    mlEm24h: number | null;
    /** Pronto para a tela: o número, ou travessão quando não há dado. Nunca "0". */
    formatted: string;
    kdigoByDU: EstagioKdigoDu;
    kdigoLabel: string;
    isOliguric: boolean;
    isAnuric: boolean;
    /** `true` quando o volume de 24 h veio de projeção, não de coleta completa. */
    extrapolado: boolean;
    aviso?: string | undefined;
}

/**
 * Débito urinário efetivo e estágio KDIGO pelo eixo do débito.
 *
 * @param diurese - volume urinado, em mL
 * @param peso    - peso do paciente, em kg. Sem ele não há mL/kg/h — peso não se estima.
 * @param horas   - duração da coleta, em horas
 */
export function calcDiureseEfetiva(
    diurese: string | number | null | undefined,
    peso: string | number | null | undefined,
    horas: string | number | null | undefined,
): DiureseEfetiva {
    const base = calcularDebitoUrinario(diurese, peso, horas);
    const du = base.mlPorKgPorHora;
    const h = Number(String(horas ?? '').replace(',', '.'));

    if (du === null) {
        return {
            mlPerKgPerHour: null,
            mlEm24h: base.mlEm24h,
            formatted: SEM_DADO,
            kdigoByDU: 0,
            kdigoLabel: 'KDIGO não estadiável por débito urinário',
            isOliguric: false,
            isAnuric: false,
            extrapolado: base.extrapolado,
            aviso: base.aviso ?? 'Sem débito urinário em mL/kg/h — KDIGO por débito não estadiado',
        };
    }

    const isAnuric = du < RENAL.DU_ANURIA;
    const isOliguric = du < RENAL.DU_OLIGURIA;

    let kdigoByDU: EstagioKdigoDu = 0;
    let avisoEstadio: string | undefined;

    if (!Number.isFinite(h) || h < HORAS_MINIMAS_PARA_ESTADIAR) {
        // Janela curta demais. O critério do KDIGO é valor E tempo — sem as 6 h,
        // nem o estágio 1 se sustenta. Devolver 0 aqui não é dizer "rim bom": é
        // dizer "esta coleta não estadia", e o aviso vai junto.
        avisoEstadio = `Coleta de ${Number.isFinite(h) ? h : '?'} h — o KDIGO por débito urinário exige pelo menos ${HORAS_MINIMAS_PARA_ESTADIAR} h. Estágio não atribuído.`;
    } else if (du < RENAL.DU_KDIGO3 && h >= HORAS_ESTAGIO_3) {
        kdigoByDU = 3;
    } else if (isAnuric && h >= HORAS_ANURIA_ESTAGIO_3) {
        kdigoByDU = 3;
    } else if (isOliguric && h >= HORAS_ESTAGIO_2) {
        kdigoByDU = 2;
    } else if (isOliguric) {
        kdigoByDU = 1;
    }

    const avisos = [base.aviso, avisoEstadio].filter((a): a is string => typeof a === 'string');

    return {
        mlPerKgPerHour: du,
        mlEm24h: base.mlEm24h,
        formatted: du.toFixed(2),
        kdigoByDU,
        kdigoLabel:
            kdigoByDU === 0 ? 'sem critério KDIGO por débito' : `KDIGO ${kdigoByDU} por débito urinário`,
        isOliguric,
        isAnuric,
        extrapolado: base.extrapolado,
        aviso: avisos.length > 0 ? avisos.join(' · ') : undefined,
    };
}
