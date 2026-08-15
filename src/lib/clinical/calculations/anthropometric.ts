// ============================================================================
// SASI — Antropometria: peso corporal PREVISTO
// ----------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO EXISTE, e o que ele NÃO faz.
//
// O operador pediu `calculations/anthropometric.ts`. O único número
// antropométrico que o pacote dele nomeia é o PESO PREVISTO, na conduta do
// alerta de SDRA grave: "VT 4-6 ml/kg (peso previsto)" — engine.ts:230.
//
// É uma distinção que mata: o volume corrente protetor se calcula sobre o peso
// PREVISTO PELA ALTURA, nunca sobre o peso real. Um paciente obeso de 120 kg com
// 1,65 m tem peso previsto de ~57 kg. Ventilar 6 mL/kg sobre 120 kg entrega 720
// mL onde cabem 342 — é barotrauma prescrito por conta errada.
//
// O IMC **não** mora aqui: já existe em `src/lib/clinical/sasi.ts:9`, com a
// mesma conta da coluna gerada no banco. Duplicá-lo seria o defeito.
//
// FONTE: The Acute Respiratory Distress Syndrome Network. Ventilation with lower
// tidal volumes as compared with traditional tidal volumes for acute lung injury
// and the acute respiratory distress syndrome. N Engl J Med. 2000;342(18):1301-1308.
// DOI: 10.1056/NEJM200005043421801 — fórmula de predicted body weight do ARMA.
// ============================================================================

import {parseNumeroBR} from '@/lib/clinical/unidades';

/**
 * Sexo biológico, que a fórmula do peso previsto exige.
 *
 * IMPORTANT — o `Patient` do motor NÃO tem este campo (conferido em
 * `getInitialState`, clinical-logic-compat.ts:43-171: há `peso` e `altura`, não
 * há sexo). Por isso o parâmetro entra pela porta, e não é lido da ficha. Está
 * na lista PARA O MEDICO DECIDIR: sem sexo no modelo, o peso previsto não pode
 * ser calculado automaticamente a partir do paciente.
 */
export type SexoBiologico = 'masculino' | 'feminino';

/** Constantes da fórmula do ARDSNet. Não são ajustáveis: são a definição. */
const BASE_MASCULINO = 50;
const BASE_FEMININO = 45.5;
const FATOR_POR_CM = 0.91;
const ALTURA_DE_REFERENCIA_CM = 152.4; // 60 polegadas

/**
 * Peso corporal previsto (PBW), em kg, a partir da altura.
 *
 *   masculino: 50   + 0,91 × (altura_cm − 152,4)
 *   feminino:  45,5 + 0,91 × (altura_cm − 152,4)
 *
 * Devolve `null` quando a altura não é legível ou é implausível. Altura não se
 * estima, e um peso previsto chutado vira um volume corrente chutado.
 *
 * @param alturaCm - altura em CENTÍMETROS. `Patient.altura` é digitada em metros
 *                   em alguns fluxos do operador (compat:330 imprime "m") — quem
 *                   chama converte antes; esta função não adivinha a unidade.
 */
export function pesoPrevisto(
    alturaCm: string | number | null | undefined,
    sexo: SexoBiologico,
): number | null {
    const h = parseNumeroBR(alturaCm);
    // Faixa de plausibilidade larga de propósito: barra o metro digitado como
    // "1,65" (viraria PBW negativo) e o erro de digitação grosseiro, sem opinar
    // sobre biotipo.
    if (h === null || h < 100 || h > 250) return null;

    const base = sexo === 'masculino' ? BASE_MASCULINO : BASE_FEMININO;
    const pbw = base + FATOR_POR_CM * (h - ALTURA_DE_REFERENCIA_CM);

    // Abaixo disso a fórmula perde sentido clínico; devolver um número negativo
    // ou perto de zero seria pior que devolver "não sei".
    if (pbw <= 0) return null;

    return Math.round(pbw * 10) / 10;
}
