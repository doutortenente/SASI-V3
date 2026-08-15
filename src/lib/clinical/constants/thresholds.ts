// ============================================================================
// SASI — Limiares clínicos do motor  (o antigo `../constants`)
// ----------------------------------------------------------------------------
// COMO OS NÚMEROS DESTE ARQUIVO FORAM OBTIDOS
//
// Nenhum saiu de opinião clínica minha. Cada constante abaixo é lida DE VOLTA do
// próprio código do operador, por um de dois caminhos:
//
//   (a) ele imprime o valor na mensagem — `(>${INFECTO.TAX_FEBRE}°C)`,
//       `'SDRA GRAVE (P/F < 100)'`, `'(alvo UTI 140-180 mg/dL)'`. Aí o número é
//       dele, escrito por ele, e só voltou para o lugar de onde tinha saído;
//   (b) ele declara o valor no cabeçalho — `'Hipotermia (≤ 36°C)'`,
//       `'Leucopenia (< 4000) AGORA é detectada'`.
//
// Onde nenhum dos dois caminhos revelou o número, a constante está marcada
// `INFERIDO — confirmar` e aparece na lista PARA O MEDICO DECIDIR. Não existe
// aqui nenhum valor sem origem declarada.
//
// O COMPARADOR TAMBÉM É DELE. Onde ele escreveu `>` está `>`; onde escreveu `≤`
// está `≤`. Trocar `36` por `36,0` ou `<=` por `<` reprova a entrega.
//
// O QUE **NÃO** ESTÁ AQUI, e por quê: `engine.ts` crava vários limiares direto na
// linha (PAM 55, lactato 4, FC 130, SpO2 88, FR 30, ROX 4,88, ΔCr 0,3, K 6,0 e
// 5,5, glicemia 70, déficit calórico 60%, jejum 3 dias, ATB 7 dias, leuco 1000).
// Esses continuam onde ele os pôs. Puxá-los para cá seria reescrever o código
// dele, que é justamente o que não se faz.
// ============================================================================

/**
 * Hemodinâmico.
 *
 * Consumido por: engine.ts (PAM abaixo do alvo, lactato elevado, hipotensão sem
 * DVA) e sepsis.ts (choque séptico, cobrança de lactato).
 */
export const HEMO = {
    /**
     * PAM alvo, em mmHg.
     *
     * ORIGEM: engine.ts:120 imprime "abaixo de ${HEMO.PAM_SEPSE_TARGET} mmHg (alvo
     * Surviving Sepsis)" e engine.ts:553 escreve "vasopressor PAM≥65" na conduta.
     * O alvo da Surviving Sepsis Campaign 2021 (Evans L et al.) é 65 mmHg.
     *
     * ATENÇÃO, e está na lista PARA O MEDICO DECIDIR: o `sofa.ts` do PACOTE usa
     * esta mesma constante como corte do SOFA cardiovascular (sofa.ts:278). São
     * duas coisas diferentes — a Tabela 2 de Singer 2016 pontua PAM < 70, não
     * < 65. O `sofa.ts` DO APP usa 70 e está certo. Como o SOFA do app é o que
     * roda, o engano não chega ao paciente hoje.
     */
    PAM_SEPSE_TARGET: 65,

    /**
     * PAS abaixo da qual há hipotensão, em mmHg.
     *
     * INFERIDO — confirmar. É a única constante de HEMO que o código do operador
     * nunca imprime nem declara (engine.ts:129 só a compara). 90 mmHg é a
     * definição clássica de hipotensão arterial e é coerente com o alerta que ela
     * dispara ("HIPOTENSÃO SEM DVA", conduta de fluido). O outro candidato seria
     * 100 mmHg, que é o corte do qSOFA — mas o qSOFA já tem o seu próprio, em
     * `scores/qsofa.ts`, e não passa por aqui.
     */
    PAS_HIPOTENSAO: 90,

    /**
     * Limite superior do lactato normal, em mmol/L.
     * ORIGEM: engine.ts:156 imprime "(normal <2)".
     */
    LACTATO_NORMAL: 2,

    /**
     * Lactato acima do qual, com vasopressor e infecção, há choque séptico — mmol/L.
     * ORIGEM: cabeçalho de sepsis.ts:9 — "Septic Shock = Sepsis + vasopressor to
     * maintain MAP≥65 + lactate>2 mmol/L".
     * FONTE: Singer M et al., JAMA 2016;315(8):801-810. DOI: 10.1001/jama.2016.0287.
     *
     * Mesmo número de `LACTATO_NORMAL`, conceito diferente: um é o teto do normal,
     * o outro é critério diagnóstico. Ficam separados porque só um deles muda se a
     * definição de sepse mudar.
     */
    LACTATO_CHOQUE: 2,
} as const;

/**
 * Respiratório.
 * Consumido por: engine.ts (dessaturação, SDRA grave, SDRA moderada).
 */
export const RESP = {
    /**
     * SpO2 alvo mínima, em %.
     *
     * INFERIDO — confirmar. engine.ts:214 imprime "alvo ≥${RESP.SPO2_MIN}%" sem
     * revelar o número. O que o código CRAVA é o piso: 88% já é o alerta crítico
     * na linha acima (engine.ts:201), então SPO2_MIN é obrigatoriamente maior que
     * 88. 92% é o alvo usual de UTI adulto.
     */
    SPO2_MIN: 92,

    /**
     * P/F abaixo do qual a SDRA é GRAVE.
     * ORIGEM: engine.ts:227 — o título do alerta é literalmente
     * "SDRA GRAVE (P/F < 100)".
     * FONTE: Berlin Definition — ARDS Definition Task Force, JAMA 2012;307(23):2526-2533.
     */
    PF_GRAVE: 100,

    /**
     * P/F abaixo do qual a SDRA é MODERADA.
     * ORIGEM: engine.ts:237 rotula o alerta "SDRA MODERADA"; pela Berlin, moderada
     * é 100 < P/F ≤ 200.
     * FONTE: Berlin Definition — ARDS Definition Task Force, JAMA 2012;307(23):2526-2533.
     */
    PF_MODERADO: 200,
} as const;

/**
 * Renal.
 *
 * Consumido por `calculations/diurese.ts`, que é código NOVO — por isso os
 * limiares dele moram aqui e não na linha. O `engine.ts` não importa RENAL.
 */
export const RENAL = {
    /**
     * Débito urinário abaixo do qual há ANÚRIA, em mL/kg/h.
     * ORIGEM: engine.ts:312 imprime "anúria (<0.1 ml/kg/h)". Número do operador.
     */
    DU_ANURIA: 0.1,

    /**
     * Débito urinário abaixo do qual há OLIGÚRIA, em mL/kg/h.
     * FONTE: KDIGO 2012 Clinical Practice Guideline for Acute Kidney Injury,
     * critério de débito urinário (estágios 1 e 2). Diretriz citada pelo próprio
     * operador em sofa.ts:420 e engine.ts:298.
     */
    DU_OLIGURIA: 0.5,

    /**
     * Débito urinário do estágio 3 do KDIGO, em mL/kg/h por ≥ 24 h.
     * FONTE: KDIGO 2012 AKI, critério de débito urinário.
     */
    DU_KDIGO3: 0.3,
} as const;

/**
 * Infeccioso.
 * Consumido por: sepsis.ts (evidência de infecção) e engine.ts (hipotermia, febre).
 */
export const INFECTO = {
    /**
     * Temperatura acima da qual há FEBRE, em °C. Comparador ESTRITO (`>`).
     * ORIGEM: sepsis.ts:128 imprime "(>${INFECTO.TAX_FEBRE}°C)"; e o campo
     * `tmaxX38` do modelo (compat:154) nomeia o corte 38.
     */
    TAX_FEBRE: 38,

    /**
     * Temperatura igual ou abaixo da qual há HIPOTERMIA, em °C.
     * Comparador COM IGUALDADE (`≤`) — é assim que ele escreve, em dois lugares.
     * ORIGEM: sepsis.ts:113 ("Hipotermia (≤ 36°C) AGORA é critério de alarme
     * infeccioso") e sepsis.ts:131 ("(≤${INFECTO.TAX_HIPOTERMIA}°C)").
     */
    TAX_HIPOTERMIA: 36,

    /**
     * Leucócitos acima dos quais há LEUCOCITOSE, em /µL.
     *
     * INFERIDO — confirmar. sepsis.ts:142 só compara. 12.000/µL é o critério de
     * SIRS, que é a família de onde vêm os outros itens da mesma função (febre,
     * hipotermia, leucopenia).
     * FONTE do critério: Bone RC et al., Chest 1992 (SIRS), mantido em
     * Levy MM et al., Crit Care Med 2003 (SCCM/ESICM/ACCP/ATS/SIS).
     */
    LEUCO_LEUCOCITOSE: 12_000,

    /**
     * Leucócitos abaixo dos quais há LEUCOPENIA, em /µL.
     * ORIGEM: sepsis.ts:115 declara em texto — "Leucopenia (< 4000) AGORA é
     * detectada". Número do operador, comparador estrito, dele também.
     */
    LEUCO_LEUCOPENIA: 4_000,
} as const;

/**
 * Metabólico.
 * Consumido por: engine.ts (hiperglicemia).
 */
export const METABOL = {
    /**
     * Glicemia acima da qual dispara o aviso de hiperglicemia, em mg/dL.
     * ORIGEM: engine.ts:435 imprime "(alvo UTI 140-180 mg/dL)" — o alerta nasce
     * ao passar do teto da própria faixa que ele escreveu. Ele cita NICE-SUGAR na
     * conduta (engine.ts:438).
     * FONTE: NICE-SUGAR Study Investigators, N Engl J Med 2009;360(13):1283-1297.
     */
    GLICEMIA_ALTA: 180,
} as const;

// ----------------------------------------------------------------------------
// NEURO não existe aqui, de propósito.
//
// O README do pacote lista `NEURO` entre as constantes que faltavam, mas NENHUM
// dos 4 arquivos o importa e NENHUM valor numérico neurológico aparece em
// mensagem ou cabeçalho dele. Criar um `NEURO = {}` seria inventar limiar
// clínico sem fonte, que é exatamente o que não se faz. Está na lista PARA O
// MEDICO DECIDIR: se ele quiser RASS alvo, corte de CAM-ICU ou de dor, os
// números têm de vir dele.
// ----------------------------------------------------------------------------
