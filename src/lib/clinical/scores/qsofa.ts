// ============================================================================
// SASI — qSOFA (quick SOFA), triagem de sepse à beira do leito
// ----------------------------------------------------------------------------
// FONTE: Singer M et al. "The Third International Consensus Definitions for
// Sepsis and Septic Shock (Sepsis-3)". JAMA 2016;315(8):801-810.
// DOI: 10.1001/jama.2016.0287 — Box 3. Mesma fonte já citada em
// `../constants/thresholds.ts` (HEMO.LACTATO_CHOQUE) e em `sepsis.ts`.
//
// Os 3 critérios do artigo, 1 ponto cada, ≥2 = triagem positiva:
//   FR ≥ 22 irpm · PAS ≤ 100 mmHg · alteração aguda do estado mental (GCS < 15)
//
// Este arquivo nunca existiu no pacote do operador (README dele lista
// `../scores/qsofa` entre as dependências ausentes). Os limiares não são
// inferência: são os números do próprio artigo Sepsis-3, texto do Box 3.
// ============================================================================

import type {Patient, QSOFAResult} from '../types';
import {parseFloatBR} from '../calculations/parseBR';

const QSOFA_FR_MIN = 22; // irpm
const QSOFA_PAS_MAX = 100; // mmHg
const QSOFA_GCS_ALTERADO = 15; // GCS < 15 = alteração aguda do estado mental

export function getQSOFA(patient: Patient): QSOFAResult {
    const criteria: Record<string, boolean> = {};
    const missing: string[] = [];
    let total = 0;

    // FR: pior valor da janela é o maior (taquipneia é o risco) — fr1/fr2 são
    // os dois extremos, sem convenção MIN/MAX fixa documentada para este campo
    // (ver comentário em `../types.ts` sobre `SistemaRespMotor.fr1/fr2`), então
    // usa-se o maior dos dois valores lidos.
    const fr1 = parseFloatBR(patient.resp.fr1);
    const fr2 = parseFloatBR(patient.resp.fr2);
    const frPior = [fr1, fr2].filter((v) => !isNaN(v));
    if (frPior.length > 0) {
        const fr = Math.max(...frPior);
        criteria['FR ≥22 irpm'] = fr >= QSOFA_FR_MIN;
        if (criteria['FR ≥22 irpm']) total++;
    } else {
        missing.push('FR');
    }

    // PAS: pam1/pas1 seguem a convenção MIN = pior valor da janela (mesma do
    // SOFA cardiovascular, ver `sofa.ts` — "pam1 = valor MIN, pior PAM").
    const pas = parseFloatBR(patient.hemo.pas1);
    if (!isNaN(pas)) {
        criteria['PAS ≤100 mmHg'] = pas <= QSOFA_PAS_MAX;
        if (criteria['PAS ≤100 mmHg']) total++;
    } else {
        missing.push('PAS');
    }

    // Alteração do estado mental: GCS < 15. Mesma leitura de escala usada pelo
    // SOFA neurológico (`../scores/sofa.ts`, `escalas.find(e => e.nome ===
    // 'ECG (Glasgow)')`).
    const gcsEscala = patient.neuro.escalas.find((e) => e.nome === 'ECG (Glasgow)');
    const gcs = parseFloatBR(gcsEscala?.valor);
    if (!isNaN(gcs)) {
        criteria['Alteração do estado mental (GCS <15)'] = gcs < QSOFA_GCS_ALTERADO;
        if (criteria['Alteração do estado mental (GCS <15)']) total++;
    } else {
        missing.push('Glasgow');
    }

    return {
        total,
        isPositive: total >= 2,
        criteria,
        missing,
    };
}
