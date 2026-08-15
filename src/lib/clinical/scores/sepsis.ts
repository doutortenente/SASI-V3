// ============================================================================
// scores/sepsis.ts
// ----------------------------------------------------------------------------
// Bug #3 CORRIGIDO: Sepsis-3 exige ΔSOFA ≥ 2, não SOFA absoluto ≥ 2.
// Bug #4 CORRIGIDO: critérios de infecção estruturados e hipotermia incluída.
//
// Singer M et al., JAMA 2016:
//   Sepsis = suspected/confirmed infection + ΔSOFA ≥ 2 from baseline
//   Septic Shock = Sepsis + vasopressor to maintain MAP≥65 + lactate>2 mmol/L
// ============================================================================

import type {Infusao, SistemaHemoMotor as SistemaHemo, SistemaInfectoMotor as SistemaInfecto} from '../types';
import type {SepsisAssessment, SOFAResult} from '../types/clinical';
import {parseFloatBR} from '../calculations/parseBR';
import {coerceTAX} from '../guards/unitCoercion';
import {HEMO, INFECTO} from '../constants';

/**
 * Avalia critérios Sepsis-3 com ΔSOFA e evidências de infecção estruturadas.
 *
 * @param currentSOFA     - SOFAResult atual (de getSOFA)
 * @param baselineSOFA - SOFAResult de referência (admissão/24h atrás) ou null
 * @param infec           - sistema infeccioso do paciente
 * @param hemo            - sistema hemodinâmico (PAM, lactato)
 * @param dvas            - drogas vasoativas ativas
 */
export function assessSepsis(
    currentSOFA: SOFAResult,
    baselineSOFA: SOFAResult | null,
    infec: SistemaInfecto,
    hemo: SistemaHemo,
    dvas: Infusao[],
): SepsisAssessment {
    // ── 1. Evidências de Infecção ──────────────────────────────────────────────
    const {hasEvidence, evidences, warnings} = assessInfectionEvidence(infec, dvas);

    // ── 2. ΔSOFA ───────────────────────────────────────────────────────────────
    const delta = baselineSOFA !== null ? currentSOFA.total - baselineSOFA.total : null;

    const baselineTotal = baselineSOFA?.total ?? null;

    // ── 3. Sepsis: infecção + ΔSOFA ≥ 2 ───────────────────────────────────────
    let isSeptic = false;
    let reason: SepsisAssessment['reason'] = 'sem_infeccao_detectada';

    if (!hasEvidence) {
        reason = 'sem_infeccao_detectada';
        isSeptic = false;
    } else if (delta !== null) {
        // Critério oficial: ΔSOFA ≥ 2 (Bug #3 fix)
        isSeptic = delta >= 2;
        reason = isSeptic ? 'delta_sofa_ge_2_with_infection' : 'dados_insuficientes';
    } else {
        // Sem baseline → fallback conservador (informa a limitação)
        isSeptic = currentSOFA.total >= 2;
        reason = 'sofa_absoluto_fallback_sem_baseline';
        warnings.push(
            '⚠ Sem SOFA basal — usando score absoluto como proxy. ' +
                'Sepsis-3 oficial requer ΔSOFA ≥ 2. Estabelecer baseline na admissão.',
        );
    }
    // ── 4. Septic Shock: vasopressor + lactato > 2 mmol/L ─────────────────────
    const lactato = parseFloatBR(hemo.lactato ?? '');
    const temVasopressor = hasTherapeuticVasopressor(dvas, infec);
    const pamMin = parseFloatBR(hemo.pam1);

    const isSepticShock = isSeptic && temVasopressor && !isNaN(lactato) && lactato > HEMO.LACTATO_CHOQUE;

    if (isSeptic && temVasopressor && isNaN(lactato)) {
        warnings.push(
            'Vasopressor ativo + Sepsis: solicitar lactato para confirmar / descartar Septic Shock',
        );
    }

    if (!isNaN(pamMin) && pamMin < HEMO.PAM_SEPSE_TARGET && temVasopressor && isNaN(lactato)) {
        warnings.push(`PAM ${pamMin} mmHg + vasopressor → lactato é obrigatório para
Surviving Sepsis 2021`);
    }

    return {
        isSeptic,
        isSepticShock,
        reason,
        deltaSOFA: delta,
        baselineSOFA: baselineTotal,
        currentSOFA: currentSOFA.total,
        hasInfectionEvidence: hasEvidence,
        infectionEvidences: evidences,
        lactato: !isNaN(lactato) ? lactato : null,
        warnings,
    };
}

// ============================================================================
// Helpers privados
// ============================================================================

/**
 * Bug #4 CORRIGIDO: avalia evidência de infecção de forma estruturada.
 *
 * Corrigido:
 *    - ATBs profiláticos NÃO contam como evidência de infecção
 *    - Hipotermia (≤ 36°C) AGORA é critério de alarme infeccioso
 *    - Leucopenia (< 4000) AGORA é detectada
 *    - Culturas negativas ou contaminadas NÃO contam como evidência positiva
 */
function assessInfectionEvidence(
    infec: SistemaInfecto,
    _dvas: Infusao[],
): {hasEvidence: boolean; evidences: string[]; warnings: string[]} {
    const evidences: string[] = [];
    const warnings: string[] = [];

    // ─ Temperatura (Bug #4 fix: hipotermia incluída)
    const tax = coerceTAX(infec.tmax ?? '');
    if (tax.isFever) {
        evidences.push(`Febre ${tax.value}°C (>${INFECTO.TAX_FEBRE}°C)`);
    }
    if (tax.isHypothermia && tax.value !== null) {
        evidences.push(`Hipotermia ${tax.value}°C (≤${INFECTO.TAX_HIPOTERMIA}°C) ←
critério infeccioso grave`);
    }
    const tmin = coerceTAX(infec.tmin ?? '');
    if (tmin.isHypothermia && tmin.value !== null) {
        evidences.push(`Temperatura mínima ${tmin.value}°C ← hipotermia confirmada`);
    }

    // ─ Leucócitos (Bug #4 fix: leucopenia agora detectada)
    const leuco = parseFloatBR(infec.leuco1);
    if (!isNaN(leuco)) {
        if (leuco > INFECTO.LEUCO_LEUCOCITOSE) {
            evidences.push(`Leucocitose: ${leuco.toLocaleString('pt-BR')} /µL`);
        } else if (leuco < INFECTO.LEUCO_LEUCOPENIA) {
            evidences.push(`Leucopenia: ${leuco.toLocaleString('pt-BR')} /µL ← critério
infeccioso`);
        }
    }

    // ─ Antibióticos TERAPÊUTICOS (Bug #4 fix: profilaxia excluída)
    const atbsTerapeuticos = infec.atbs.filter((atb) => {
        // Se intenção explicitamente profilática/descolonização → não contar
        if (atb.intencao === 'profilatica' || atb.intencao === 'descolonizacao') {
            warnings.push(
                `ATB ${atb.nome || atb.nomePersonalizado} marcado como '${atb.intencao}' — não
conta como evidência de infecção ativa`,
            );
            return false;
        }
        return true;
    });

    if (atbsTerapeuticos.length > 0) {
        const nomes = atbsTerapeuticos
            .map((a) => (a.nome === 'Outro' ? (a.nomePersonalizado ?? 'ATB') : a.nome))
            .join(', ');
        evidences.push(`ATB terapêutico: ${nomes}`);
    } else if (infec.atbs.length > 0) {
        warnings.push(
            'ATBs presentes mas todos marcados como profilaxia/descolonização — sem evidência de infecção ativa',
        );
    }

    // ─ Culturas positivas (Bug #4 fix: só conta positivas)
    const culturasPositivas = infec.culturas.filter(
        (c) => c.status === 'Positiva' || c.status === 'Parcial positiva',
    );
    if (culturasPositivas.length > 0) {
        const desc = culturasPositivas
            .map((c) => `${c.tipo} positiva${c.detalhe ? ` (${c.detalhe})` : ''}`)
            .join('; ');
        evidences.push(`Cultura positiva: ${desc}`);
    }

    // ─ Foco suspeito documentado
    if (infec.focoSuspeito) {
        evidences.push(`Foco suspeito: ${infec.focoSuspeito}`);
    }

    const hasEvidence = evidences.length > 0;

    return {hasEvidence, evidences, warnings};
}

/**
 * Verifica se há vasopressor com intenção terapêutica (não só antihipertensivo).
 * Vasopressores = Noradrenalina, Adrenalina, Dopamina, Vasopressina.
 * Nipride/Tridil/Esmolol são vasodilatadores/antihipertensivos — NÃO contam.
 */
function hasTherapeuticVasopressor(dvas: Infusao[], _infec: SistemaInfecto): boolean {
    const vasopressores = ['Noradrenalina', 'Adrenalina', 'Dopamina', 'Vasopressina'];
    return dvas.some((d) => vasopressores.includes(d.droga) && d.vazao && d.vazao !== '0');
}
