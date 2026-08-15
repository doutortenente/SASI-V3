// ============================================================================
// alerts/engine.ts
// ----------------------------------------------------------------------------
// Motor central de alertas clínicos.
// Consome o Patient e retorna Alert[] ordenado por severidade.
// Cada alerta tem ID único, cooldown evitável e ação sugerida.
//
// Design principles:
//   - Alarmes devem ser ACIONÁVEIS, não informativos genéricos
//   - Alarm fatigue = iatrogenia — cada alerta precisa justificar sua existência
//   - Prioridade: Crítico > Warning > Info
// ============================================================================

import type {Patient} from '../types';
import type {AlertCategory, AlertLevel, ClinicalAlert} from '../types/clinical';
import {getSOFA} from '../scores/sofa';
import {getQSOFA} from '../scores/qsofa';
import {assessSepsis} from '../scores/sepsis';
import {calcDiureseEfetiva} from '../calculations/diurese';
import {calcPFRatio} from '../calculations/ratios';
import {calcDoseInfusao} from '../calculations/infusao';
import {coerceFiO2Input, coerceTAX} from '../guards/unitCoercion';
import {parseFloatBR} from '../calculations/parseBR';
import {DVA_DICT} from '../dictionaries';
import {HEMO, METABOL, RESP} from '../constants';

let alertSeq = 0;

function makeId() {
    return `alert-${Date.now()}-${++alertSeq}`;
}

function alert(
    level: AlertLevel,
    category: AlertCategory,
    title: string,
    message: string,
    triggeredBy: string[],
    patientId: string,
    action?: string,
): ClinicalAlert {
    return {
        id: makeId(),
        level,
        category,
        title,
        message,
        actionSuggested: action,
        triggeredBy,
        patientId,
        createdAt: new Date().toISOString(),
        acknowledged: false,
    };
}

// ============================================================================
// Função principal
// ============================================================================

export function runAllAlerts(
    patient: Patient,
    _history?: Patient[], // futuro: trend-based alerts com histórico
): ClinicalAlert[] {
    const alerts: ClinicalAlert[] = [];
    const pid = patient.id;

    // ── Hemodinâmico ────────────────────────────────────────────────────────────
    alerts.push(...checkHemodynamic(patient, pid));

    // ── Respiratório ────────────────────────────────────────────────────────────
    alerts.push(...checkRespiratory(patient, pid));

    // ── Renal ───────────────────────────────────────────────────────────────────
    alerts.push(...checkRenal(patient, pid));

    // ── Infeccioso ──────────────────────────────────────────────────────────────
    alerts.push(...checkInfectious(patient, pid));

    // ── Metabólico ──────────────────────────────────────────────────────────────
    alerts.push(...checkMetabolic(patient, pid));

    // ── Medicação (Segurança) ───────────────────────────────────────────────────
    alerts.push(...checkMedication(patient, pid));

    // ── Sepse ───────────────────────────────────────────────────────────────────
    alerts.push(...checkSepsis(patient, pid));

    // Ordenar: critical → warning → info
    return alerts.sort((a, b) => {
        const order = {critical: 0, warning: 1, info: 2};
        return order[a.level] - order[b.level];
    });
}

// ============================================================================
// Sub-engines por sistema
// ============================================================================

function checkHemodynamic(p: Patient, pid: string): ClinicalAlert[] {
    const alerts: ClinicalAlert[] = [];

    const pam1 = parseFloatBR(p.hemo.pam1); // pam MIN (pior)
    const pas1 = parseFloatBR(p.hemo.pas1);
    const fc1 = parseFloatBR(p.hemo.fc1);
    const lactato = parseFloatBR(p.hemo.lactato ?? '');

    // PAM crítica
    if (!isNaN(pam1) && pam1 < 55) {
        alerts.push(
            alert(
                'critical',
                'hemodynamic',
                '    PAM CRÍTICA',
                `PAM mínima ${pam1} mmHg — abaixo de 55 mmHg aumenta risco de lesão de órgão-alvo.`,
                [`PAM ${pam1} mmHg < 55`],
                pid,
                'Avaliar volemia, titular vasopressor, considerar USG POCUS. Bundle SSC 2021.',
            ),
        );
    } else if (!isNaN(pam1) && pam1 < HEMO.PAM_SEPSE_TARGET) {
        alerts.push(
            alert(
                'warning',
                'hemodynamic',
                '⚠ PAM ABAIXO DO ALVO',
                `PAM mínima ${pam1} mmHg — abaixo de ${HEMO.PAM_SEPSE_TARGET} mmHg (alvo Surviving Sepsis).`,
                [`PAM ${pam1} mmHg`],
                pid,
                'Verificar se em desmame de vasopressor. Se não, titular.',
            ),
        );
    }

    // Hipotensão sem vasopressor
    if (!isNaN(pas1) && pas1 < HEMO.PAS_HIPOTENSAO && p.dvas.length === 0) {
        alerts.push(
            alert(
                'warning',
                'hemodynamic',
                '⚠ HIPOTENSÃO SEM DVA',
                `PAS mínima ${pas1} mmHg sem vasopressor ativo.`,
                [`PAS ${pas1} mmHg`, 'Sem DVA'],
                pid,
                'Considerar causa (hipovolemia, cardiogênica, anafilaxia). Fluido 500ml cautela.',
            ),
        );
    }

    // Lactato elevado
    if (!isNaN(lactato)) {
        if (lactato > 4) {
            alerts.push(
                alert(
                    'critical',
                    'hemodynamic',
                    '    LACTATO CRÍTICO',
                    `Lactato ${lactato} mmol/L — hipoperfusão grave. Mortalidade >30% lactato >4.`,
                    [`Lactato ${lactato} mmol/L`],
                    pid,
                    'Bundle 1h: fluido 30ml/kg, hemoculturas, ATB, vasopressor. Repetir em 2h.',
                ),
            );
        } else if (lactato > HEMO.LACTATO_NORMAL) {
            alerts.push(
                alert(
                    'warning',
                    'hemodynamic',
                    '⚠ LACTATO ELEVADO',
                    `Lactato ${lactato} mmol/L (normal <2). Hipoperfusão ou clearance reduzido.`,
                    [`Lactato ${lactato} mmol/L`],
                    pid,
                    'Clearance alvo >10% em 3h. Investigar causa.',
                ),
            );
        }
    } else if (p.dvas.length > 0) {
        alerts.push(
            alert(
                'info',
                'hemodynamic',
                'ℹ LACTATO NÃO DOSADO',
                'Paciente com vasopressor ativo sem lactato documentado.',
                ['DVA ativa', 'Sem lactato'],
                pid,
                'Solicitar lactato arterial. Surviving Sepsis 2021 — obrigatório em hipotensão.',
            ),
        );
    }

    // Taquicardia
    if (!isNaN(fc1) && fc1 > 130) {
        alerts.push(
            alert(
                'warning',
                'hemodynamic',
                '⚠ TAQUICARDIA IMPORTANTE',
                `FC máxima ${fc1} bpm. Taquicardia compromete débito cardíaco se FC > 120-130.`,
                [`FC ${fc1} bpm`],
                pid,
                'Investigar causa: dor, febre, hipovolemia, TEP, SCA. Tratar a etiologia.',
            ),
        );
    }

    return alerts;
}

function checkRespiratory(p: Patient, pid: string): ClinicalAlert[] {
    const alerts: ClinicalAlert[] = [];
    const onVM = p.resp.suporte === 'IOT + VM';
    const onVNI = p.resp.suporte.includes('VNI');
    const onCNAF = p.resp.suporte.includes('CNAF');

    const spo2 = parseFloatBR(p.resp.spo2);
    const fr1 = parseFloatBR(p.resp.fr1);
    const fr2 = parseFloatBR(p.resp.fr2);
    const frMax = Math.max(isNaN(fr1) ? 0 : fr1, isNaN(fr2) ? 0 : fr2);

    // SpO2 crítica
    if (!isNaN(spo2) && spo2 < 88) {
        alerts.push(
            alert(
                'critical',
                'respiratory',
                '    HIPOXEMIA GRAVE',
                `SpO2 ${spo2}% — abaixo de 88%. Risco de hipóxia tecidual.`,
                [`SpO2 ${spo2}%`],
                pid,
                onVM
                    ? 'Titular FiO2/PEEP. Checar posição TOT/TQT. Gasometria imediata.'
                    : 'Aumentar suporte O2. Avaliar IOT se refratário.',
            ),
        );
    } else if (!isNaN(spo2) && spo2 < RESP.SPO2_MIN) {
        alerts.push(
            alert(
                'warning',
                'respiratory',
                '⚠ DESSATURAÇÃO',
                `SpO2 ${spo2}% (alvo ≥${RESP.SPO2_MIN}%).`,
                [`SpO2 ${spo2}%`],
                pid,
            ),
        );
    }

    // P/F ratio
    const fio2ForPF = p.resp.vmFio2 || p.resp.fio2O2 || '21';
    const pfResult = calcPFRatio(p.resp.pao2, fio2ForPF);
    if (pfResult.ratio !== null) {
        if (pfResult.ratio < RESP.PF_GRAVE && onVM) {
            alerts.push(
                alert(
                    'critical',
                    'respiratory',
                    '    SDRA GRAVE (P/F < 100)',
                    `P/F ratio ${pfResult.ratio} — SDRA grave pela Berlin. Mortalidade ~45%.`,
                    [`P/F ${pfResult.ratio}`, 'VM ativa'],
                    pid,
                    'Protocolo SDRA: PEEP alto, VT 4-6 ml/kg (peso previsto), prona se refratório.',
                ),
            );
        } else if (pfResult.ratio < RESP.PF_MODERADO) {
            alerts.push(
                alert(
                    'warning',
                    'respiratory',
                    '⚠ P/F BAIXO — SDRA MODERADA',
                    `P/F ratio ${pfResult.ratio} (normal >400). SDRA moderada.`,
                    [`P/F ${pfResult.ratio}`],
                    pid,
                    'Avaliar estratégia protetora. Conferir plateau <30 cmH2O.',
                ),
            );
        }
    }

    // FR elevada (taquipneia)
    if (frMax >= 30) {
        alerts.push(
            alert(
                'warning',
                'respiratory',
                '⚠ TAQUIPNEIA IMPORTANTE',
                `FR máxima ${frMax} irpm — trabalho respiratório elevado.`,
                [`FR ${frMax} irpm`],
                pid,
                onVNI || onCNAF
                    ? 'Monitorar falha de VNI/CNAF. Calcular ROX index (SpO2/FiO2/FR). ROX < 4.88 = risco intubação.'
                    : 'Investigar causa: dor, ansiedade, acidose, TEP, piora pulmonar.',
            ),
        );
    }

    // ROX index pra CNAF/VNI (alerta de falha)
    if (onCNAF || onVNI) {
        const fr = frMax || parseFloatBR(p.resp.fr1);
        const fio2 = coerceFiO2Input(p.resp.fio2O2 || '40').value;
        if (!isNaN(spo2) && !isNaN(fr) && fr > 0 && fio2 !== null) {
            const rox = spo2 / fio2 / fr;
            if (rox < 4.88) {
                alerts.push(
                    alert(
                        'critical',
                        'respiratory',
                        '   ROX INDEX < 4.88 — RISCO IOT',
                        `ROX ${rox.toFixed(2)} — limiar 4.88. Alto risco de falha de ${p.resp.suporte}.`,
                        [`ROX ${rox.toFixed(2)}`, `SpO2 ${spo2}%`, `FiO2 ${fio2}%`, `FR ${fr}`],
                        pid,
                        'Considerar antecipação de IOT. Discutir com staff. Roca 2019.',
                    ),
                );
            }
        }
    }

    return alerts;
}

function checkRenal(p: Patient, pid: string): ClinicalAlert[] {
    const alerts: ClinicalAlert[] = [];

    const cr1 = parseFloatBR(p.renal.cr1);
    const cr2 = parseFloatBR(p.renal.cr2);
    const duResult = calcDiureseEfetiva(p.renal.diurese, p.peso, p.renal.diureseHoras);

    // Creatinina em ascensão
    if (!isNaN(cr1) && !isNaN(cr2) && cr1 > cr2) {
        const delta = cr1 - cr2;
        if (delta >= 0.3) {
            alerts.push(
                alert(
                    'warning',
                    'renal',
                    '⚠ CREATININA EM ASCENSÃO',
                    `Creatinina: ${cr2} → ${cr1} mg/dL (Δ+${delta.toFixed(1)}) — KDIGO critério
por delta 0.3 mg/dL/48h.`,
                    [`Cr: ${cr2}→${cr1}`, `Δ ${delta.toFixed(1)}`],
                    pid,
                    'Revisar nefrotóxicos, hidratação, balanço. Calcular KDIGO.',
                ),
            );
        }
    }

    // Oligúria
    if (duResult.mlPerKgPerHour !== null) {
        if (duResult.isAnuric) {
            alerts.push(
                alert(
                    'critical',
                    'renal',
                    '    ANÚRIA',
                    `Diurese ${duResult.formatted} ml/kg/h — anúria (<0.1 ml/kg/h).`,
                    [`DU ${duResult.formatted} ml/kg/h`],
                    pid,
                    'Verificar débito SVD, obstrução, volemia. Considerar TRRC se IRA estabelecida.',
                ),
            );
        } else if (duResult.isOliguric) {
            alerts.push(
                alert(
                    'warning',
                    'renal',
                    '⚠ OLIGÚRIA',
                    `Diurese ${duResult.formatted} ml/kg/h (KDIGO ${duResult.kdigoByDU} por DU).`,
                    [`DU ${duResult.formatted} ml/kg/h`],
                    pid,
                    'Avaliar pré-renal vs intrínseca. Cuidado com diurético em oliguría intrínseca.',
                ),
            );
        }
    }

    // Hipercalemia
    const k = parseFloatBR(p.renal.k);
    if (!isNaN(k) && k > 6.0) {
        alerts.push(
            alert(
                'critical',
                'renal',
                '   HIPERCALEMIA GRAVE',
                `K+ ${k} mEq/L — risco de arritmia fatal.`,
                [`K ${k} mEq/L`],
                pid,
                'ECG imediato. Gluconato Ca2+ IV se alteração ECG. Resina/TRRC se refratário.',
            ),
        );
    } else if (!isNaN(k) && k > 5.5) {
        alerts.push(
            alert(
                'warning',
                'renal',
                '⚠ HIPERCALEMIA',
                `K+ ${k} mEq/L.`,
                [`K ${k} mEq/L`],
                pid,
                'ECG, bicarbonato, insulina + glicose, considerar resina.',
            ),
        );
    }

    return alerts;
}

function checkInfectious(p: Patient, pid: string): ClinicalAlert[] {
    const alerts: ClinicalAlert[] = [];

    const tax = coerceTAX(p.infecto.tmax);

    // Hipotermia infecciosa
    if (tax.isHypothermia && tax.value !== null) {
        alerts.push(
            alert(
                'critical',
                'infectious',
                '    HIPOTERMIA — SINAL DE ALARME',
                `Temperatura mínima ${tax.value}°C — hipotermia em contexto infeccioso é sinal de sepse grave.`,
                [`TAX min ${tax.value}°C`],
                pid,
                'SOFA completo. Hemoculturas. Avaliar cobertura ATB. Hipotermia + choque = alta mortalidade.',
            ),
        );
    }

    // ATB há >7 dias sem revisão documentada
    const atbsLongos = p.infecto.atbs.filter((atb) => {
        const dias = parseInt(atb.dias ?? '0', 10);
        return !isNaN(dias) && dias > 7 && atb.intencao !== 'profilatica';
    });

    if (atbsLongos.length > 0) {
        const nomes = atbsLongos
            .map((a) => `${a.nome === 'Outro' ? a.nomePersonalizado : a.nome} (D${a.dias})`)
            .join(', ');
        alerts.push(
            alert(
                'warning',
                'infectious',
                '⚠ ATB >7 DIAS — REVISAR',
                `ATB terapêutico há >7 dias sem evidência de revisão: ${nomes}.`,
                atbsLongos.map((a) => `D-${a.dias}`),
                pid,
                'Antibiotic stewardship: culturas, deescalonamento, definir prazo. Evitar seleção MDR.',
            ),
        );
    }

    // Leucopenia em paciente com ATB (neutropenia febril?)
    const leuco = parseFloatBR(p.infecto.leuco1);
    if (!isNaN(leuco) && leuco < 1000 && tax.isFever) {
        alerts.push(
            alert(
                'critical',
                'infectious',
                '    NEUTROPENIA FEBRIL?',
                `Leucócitos ${leuco}/µL + febre ${tax.value}°C — avaliar neutropenia febril.`,
                [`Leuco ${leuco}`, `Febre ${tax.value}°C`],
                pid,
                'Hemograma completo urgente. Se neutrófilos < 500, cobertura anti-pseudomonas + antifúngico. Oncologia.',
            ),
        );
    }
    return alerts;
}

function checkMetabolic(p: Patient, pid: string): ClinicalAlert[] {
    const alerts: ClinicalAlert[] = [];

    // Hipoglicemia
    const dx = parseFloatBR(p.tgi.dx);
    if (!isNaN(dx) && dx < 70) {
        alerts.push(
            alert(
                'critical',
                'metabolic',
                '    HIPOGLICEMIA',
                `Glicemia ${dx} mg/dL — hipoglicemia grave (<70). Risco de lesão neurológica.`,
                [`Dx ${dx} mg/dL`],
                pid,
                'Glicose 50% IV 50ml bolus. Repetir glicemia em 15min. Ajustar infusão insulina.',
            ),
        );
    } else if (!isNaN(dx) && dx > METABOL.GLICEMIA_ALTA) {
        alerts.push(
            alert(
                'info',
                'metabolic',
                'ℹ HIPERGLICEMIA',
                `Glicemia ${dx} mg/dL (alvo UTI 140-180 mg/dL).`,
                [`Dx ${dx} mg/dL`],
                pid,
                'Titular insulina. Alvo 140-180 mg/dL (NICE-SUGAR). Evitar hipoglicemia iatrogênica.',
            ),
        );
    }

    // Meta calórica vs infundida
    if (p.tgi.kcalMeta && p.tgi.kcalInfundido) {
        const meta = parseFloatBR(p.tgi.kcalMeta);
        const infundido = parseFloatBR(p.tgi.kcalInfundido);
        if (!isNaN(meta) && !isNaN(infundido) && meta > 0) {
            const pct = (infundido / meta) * 100;
            if (pct < 60) {
                alerts.push(
                    alert(
                        'warning',
                        'nutrition',
                        '⚠ DÉFICIT CALÓRICO IMPORTANTE',
                        `Recebendo ${Math.round(pct)}% da meta calórica (${infundido}/${meta} kcal).`,
                        [`${infundido} kcal vs meta ${meta}`],
                        pid,
                        'Otimizar dieta enteral. Verificar obstrução/intolerância. Considerar NPT complementar se > 3-5 dias.',
                    ),
                );
            }
        }
    }

    // Jejum prolongado sem NPT
    if (p.tgi.viaDieta === 'Jejum') {
        const adm = new Date(p.adm);
        const today = new Date();
        const diasInternado = Math.ceil((today.getTime() - adm.getTime()) / 86400000);
        if (diasInternado > 3) {
            alerts.push(
                alert(
                    'warning',
                    'nutrition',
                    '⚠ JEJUM PROLONGADO',
                    `Paciente em jejum com ${diasInternado} dias de internação.`,
                    ['Dieta: Jejum', `${diasInternado}d internação`],
                    pid,
                    'Avaliar indicação de NPT ou TNE. Diretriz ESPEN: iniciar NE em 24-48h se viável.',
                ),
            );
        }
    }
    return alerts;
}

function checkMedication(p: Patient, pid: string): ClinicalAlert[] {
    const alerts: ClinicalAlert[] = [];

    // DVA em dose absurda
    for (const dva of p.dvas) {
        if (!dva.droga || !dva.vazao) continue;
        const dict = DVA_DICT[dva.droga];
        if (!dict) continue;
        const doseResult = calcDoseInfusao(dva, dict, p.peso);
        if (doseResult.warning === 'absurd_high') {
            alerts.push(
                alert(
                    'critical',
                    'medication',
                    '    DOSE DVA ABSURDA',
                    `${dva.droga} com dose ${doseResult.value?.toFixed(3)} ${doseResult.unit} —
acima de 2× o máximo esperado. Verificar vazão/diluição.`,
                    [`${dva.droga} ${dva.vazao} ml/h`],
                    pid,
                    'Checar bomba, diluição, peso. Pode ser erro de digitação.',
                ),
            );
        }
    }

    // Profilaxia TVP ausente (se não há contraindicação documenada)
    if (!p.hemato.profilaxiaTvp) {
        alerts.push(
            alert(
                'info',
                'medication',
                'ℹ PROFILAXIA TVP NÃO DOCUMENTADA',
                'Profilaxia de TVP não registrada.',
                ['hemato.profilaxiaTvp vazio'],
                pid,
                'Enoxaparina 40mg SC 1×/dia (se ClCr > 30). Registrar contraindicação se houver.',
            ),
        );
    }

    // Profilaxia úlcera de stress ausente em paciente em VM
    if (p.resp.suporte === 'IOT + VM' && !p.hemato.profilaxiaUlcera) {
        alerts.push(
            alert(
                'info',
                'medication',
                'ℹ PROFILAXIA ÚLCERA AUSENTE EM VM',
                'Paciente em VM invasiva sem profilaxia de úlcera de stress documentada.',
                ['IOT + VM', 'hemato.profilaxiaUlcera vazio'],
                pid,
                'Omeprazol 40mg IV/VO. Indicação forte em VM > 48h (ASHP guidelines).',
            ),
        );
    }

    return alerts;
}

function checkSepsis(p: Patient, pid: string): ClinicalAlert[] {
    const alerts: ClinicalAlert[] = [];

    const sofaResult = getSOFA(p);
    const qsofaResult = getQSOFA(p);
    const sepsisResult = assessSepsis(sofaResult, null, p.infecto, p.hemo, p.dvas);

    if (sepsisResult.isSepticShock) {
        alerts.push(
            alert(
                'critical',
                'infectious',
                '    SEPTIC SHOCK — BUNDLE 1H',
                `Critérios de Choque Séptico: vasopressor + lactato ${sepsisResult.lactato}
mmol/L + infecção.`,
                sepsisResult.infectionEvidences,
                pid,
                'Bundle 1h SSC 2021: hemoculturas, ATB 1h, fluido 30ml/kg, vasopressor PAM≥65, lactato.',
            ),
        );
    } else if (sepsisResult.isSeptic) {
        alerts.push(
            alert(
                'critical',
                'infectious',
                '    SEPSIS DETECTADA',
                `SOFA ${sofaResult.total} + evidências:
${sepsisResult.infectionEvidences.slice(0, 2).join(', ')}.`,
                sepsisResult.infectionEvidences,
                pid,
                'Bundle SSC 2021. ATB em até 1h. Hemoculturas antes do ATB.',
            ),
        );
    }

    // qSOFA positivo (pré-UTI screening)
    if (qsofaResult.isPositive && !sepsisResult.isSeptic) {
        alerts.push(
            alert(
                'warning',
                'infectious',
                '⚠ qSOFA POSITIVO',
                `qSOFA ${qsofaResult.total}/3 — triagem positiva para sepsis.`,
                Object.entries(qsofaResult.criteria)
                    .filter(([, v]) => v)
                    .map(([k]) => k),
                pid,
                'Completar SOFA com lab. qSOFA não substitui SOFA para diagnóstico.',
            ),
        );
    }

    return alerts;
}
