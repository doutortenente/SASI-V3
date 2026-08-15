// ============================================================================
// SASI — Modelo de domínio do MOTOR CLÍNICO do operador
// ----------------------------------------------------------------------------
// Este arquivo é o `../types` + `../types/clinical` que o pacote
// `sasi-motor-clinico-v2` importa e que NUNCA existiu em arquivo nenhum.
// Ele não foi inventado: cada campo abaixo está PROVADO por uso no código do
// operador, e a prova está anotada no comentário de cada bloco (arquivo:linha
// do pacote original).
//
// POR QUE NÃO MORA EM `src/types/clinical.ts`
// -------------------------------------------
// `src/types/clinical.ts` modela o BANCO (`pacientes`, `evolucoes`,
// `SistemaHemo.pam_min`, `SistemaInfecto.atb: string`). O motor do operador
// modela a FICHA que ele preenche à beira do leito (`hemo.pam1`,
// `infecto.atbs: AtbMotor[]`). São dois domínios diferentes com três nomes
// colididos — `Infusao`, `SistemaHemo`, `SistemaInfecto` — e significados
// incompatíveis. Fundir os dois num arquivo só faria `SistemaHemo` querer dizer
// duas coisas, e a próxima pessoa a ler escolheria a errada.
//
// A ponte entre os dois mundos é `scores/sofa.ts` (adaptador), não este arquivo.
//
// O sufixo `Motor` marca os tipos que colidiriam de nome com `@/types`.
// ============================================================================

import type {SeveridadeAlerta} from '@/types/clinical';

// ---------------------------------------------------------------------------
// Vocabulários fechados
// ---------------------------------------------------------------------------

/**
 * Rótulo de UTI como o motor o escreve — com espaço, diferente do enum do banco
 * (`UTI2`). Provado em clinical-logic-compat.ts:43 (`getInitialState(uti = 'UTI 2')`).
 */
export type UtiMotor = 'UTI 2' | 'UTI 3' | 'UTI 4';

/**
 * Intenção do antibiótico.
 *
 * DIVERGÊNCIA MEDIDA: `IntencaoAtb` de `@/types/clinical` tem 3 valores
 * (`empirica | dirigida | profilatica`). O motor testa um QUARTO,
 * `descolonizacao`, em sepsis.ts:153 — e o trata igual a profilaxia, isto é,
 * NÃO conta como evidência de infecção ativa. Sem o quarto valor aqui, aquele
 * ramo do código dele vira inalcançável e um paciente em descolonização passa a
 * pontuar como infectado.
 */
export type IntencaoAtbMotor = 'empirica' | 'dirigida' | 'profilatica' | 'descolonizacao';

/**
 * Status da cultura.
 *
 * Só os valores PROVADOS entram: `Positiva` e `Parcial positiva` são testados em
 * sepsis.ts:180 e clinical-logic-compat.ts:301; `Negativa` e `Contaminada` estão
 * nomeados no cabeçalho de sepsis.ts:116 ("Culturas negativas ou contaminadas
 * NÃO contam"). A string vazia é o estado inicial (compat imprime
 * `c.status || '___'`). Nenhum outro valor foi inventado.
 */
export type StatusCultura = 'Positiva' | 'Parcial positiva' | 'Negativa' | 'Contaminada' | '';

// ---------------------------------------------------------------------------
// Peças da ficha
// ---------------------------------------------------------------------------

/**
 * Uma infusão contínua da ficha (droga vasoativa ou sedação).
 *
 * `vazao` é STRING porque é o que o operador digita e porque o código dele a
 * compara com o literal `'0'` (sepsis.ts:206). Convertê-la para número aqui
 * mudaria aquela comparação.
 */
export interface Infusao {
    id?: string;
    /** Chave em `DVA_DICT` / `SEDACAO_DICT`. */
    droga: string;
    /** Vazão da bomba em mL/h, como digitada. */
    vazao: string;
    /**
     * Índice da diluição escolhida dentro de `Farmaco.diluicoes[]`.
     *
     * INFERIDO — confirmar. Nenhuma linha do pacote lê este campo: `calcDoseInfusao`
     * recebe o objeto inteiro e o dicionário, e o pacote nunca mostra como ele
     * escolhe entre as 3 diluições de noradrenalina. Ausente = índice 0 (a
     * diluição "Padrão" de `infusoes.ts`), que é o comportamento conservador.
     */
    diluicao?: number;
}

/**
 * Uma escala neurológica lançada na ficha.
 *
 * `preSedationValue` é o campo que destrava o DEFEITO P0 #2: sob sedação o
 * Glasgow mede a droga, não o cérebro — só um Glasgow pré-sedação documentado
 * autoriza pontuar o componente. Provado em sofa.ts:92 do pacote.
 */
export interface EscalaNeuro {
    /** Chave em `ESCALAS_NEURO_DICT`. Ex.: `'ECG (Glasgow)'`. */
    nome: string;
    valor: string;
    sobSedacao?: boolean;
    preSedationValue?: string;
}

/** Um antibiótico em curso. Campos provados em sepsis.ts:151-167 e engine.ts:378-389. */
export interface AtbMotor {
    /** Nome de catálogo, ou o sentinela `'Outro'`. */
    nome: string;
    /** Preenchido só quando `nome === 'Outro'`. */
    nomePersonalizado?: string;
    dose?: string;
    /** Dia de terapia (D-day), como texto. `parseInt` no consumo. */
    dias?: string;
    intencao?: IntencaoAtbMotor;
}

/** Uma cultura colhida. Campos provados em sepsis.ts:179-187 e compat:300-304. */
export interface CulturaMotor {
    tipo: string;
    data?: string;
    status: StatusCultura;
    /** Agente isolado / detalhe do laudo. Só é exibido quando o status é positivo. */
    detalhe?: string;
}

/** Linha da lista de pendências da ficha. Provado em compat:166-170 e 272-275. */
export interface PendenciaMotor {
    checked: boolean;
    text: string;
}

// ---------------------------------------------------------------------------
// Os 8 sistemas da ficha
// ---------------------------------------------------------------------------
// Sufixo `Motor` onde o nome colidiria com `@/types/clinical`.

export interface SistemaNeuroMotor {
    escalas: EscalaNeuro[];
    pupilas: string;
    analgesia: string;
    camIcu: string;
    notas: string;
}

export interface SistemaRespMotor {
    /**
     * Texto livre de propósito. O código dele compara com `'IOT + VM'` (igualdade)
     * mas usa `.includes('VNI')` e `.includes('CNAF')` (contém) — sinal de que o
     * rótulo carrega parâmetro junto. Fechar num enum quebraria o `.includes`.
     */
    suporte: string;
    dataIntubacao: string;
    vazaoO2: string;
    fio2O2: string;
    vmModo: string;
    vmPeep: string;
    vmFio2: string;
    vmVc: string;
    vmPinspPs: string;
    pao2: string;
    /** FR: `fr1` e `fr2` são os dois extremos da janela. Ver nota sobre Máx–Mín abaixo. */
    fr1: string;
    fr2: string;
    frX: string;
    spo2: string;
    spo2X: string;
    ausculta: string;
    notas: string;
}

/**
 * Hemodinâmico.
 *
 * IMPORTANT — a convenção de sufixo 1/2 NÃO é uniforme, e isso não é descuido
 * meu: é o que o código dele diz.
 *   `pam1` é o valor MÍNIMO (o pior), declarado no DEFEITO P0 #11 e comentado em
 *   sofa.ts:76 do pacote ("pam1 = valor MIN (pior PAM registrada)").
 *   `fc1` é o valor MÁXIMO, declarado em engine.ts:179 ("FC máxima ${fc1} bpm").
 * Trocar um pelo outro inverte o alarme. Os campos `X` são contadores de excursão
 * (`pamX65` = quantas vezes a PAM cruzou 65), pelo nome dos campos em compat:87-107.
 */
export interface SistemaHemoMotor {
    pas1: string;
    pas2: string;
    pasX180: string;
    pasX100: string;
    pad1: string;
    pad2: string;
    padX120: string;
    padX50: string;
    /** PAM MÍNIMA — o pior valor da janela. DEFEITO P0 #11. */
    pam1: string;
    pam2: string;
    pamX130: string;
    pamX65: string;
    /** FC MÁXIMA. */
    fc1: string;
    fc2: string;
    fcX100: string;
    lactato?: string;
    ausculta: string;
    pele: string;
    notas: string;
}

export interface SistemaTgiMotor {
    dx: string;
    dxX180: string;
    abdome: string;
    bb: string;
    viaDieta: string;
    vazaoDieta: string;
    dietaOutra: string;
    aceitacao: string;
    evacuou: string;
    evacuacoesNum: string;
    evacuacoesAspecto: string;
    evacuacoesDataUltima: string;
    kcalMeta: string;
    kcalInfundido: string;
    notas: string;
}

export interface SistemaRenalMotor {
    ur1: string;
    ur2: string;
    ur3: string;
    cr1: string;
    cr2: string;
    cr3: string;
    tipoDiurese: string;
    diurese: string;
    /** Horas da coleta de diurese. `'24'` no estado inicial (compat:134). */
    diureseHoras: string;
    bh: string;
    /** Lido em compat:414, ausente em `getInitialState` — por isso opcional. */
    bhAcumulado?: string;
    mg: string;
    na: string;
    cai: string;
    k: string;
    /** Terapia de substituição renal contínua ativa. */
    trrc: boolean;
    notas: string;
}

export interface SistemaHematoMotor {
    hb1: string;
    ht1: string;
    plaq1: string;
    plaqUnit?: '×10³/µL' | '/µL';
    profilaxiaTvp: string;
    profilaxiaUlcera: string;
    notas: string;
}

export interface SistemaInfectoMotor {
    /** Temperatura MÁXIMA da janela. */
    tmax: string;
    tmaxX38: string;
    /** Temperatura MÍNIMA da janela. */
    tmin: string;
    atbs: AtbMotor[];
    culturas: CulturaMotor[];
    leuco1: string;
    leuco2: string;
    leuco3: string;
    focoSuspeito: string;
    notas: string;
}

// ---------------------------------------------------------------------------
// Patient — a ficha inteira
// ---------------------------------------------------------------------------

/**
 * O paciente como o motor do operador o enxerga: uma FICHA de plantão, com todo
 * campo em texto porque todo campo é digitado.
 *
 * A forma completa está provada por `getInitialState` em
 * clinical-logic-compat.ts:43-171, que constrói um `Patient` inteiro campo a campo.
 *
 * NÃO é a linha `pacientes` do banco — para isso existe `Paciente` em `@/types`.
 */
export interface Patient {
    id: string;
    uti: UtiMotor;
    nome: string;
    leito: string;
    /** Hipótese diagnóstica. */
    hd: string;
    /**
     * Data de admissão em pt-BR (`dd/mm/aaaa`), como `getInitialState` a escreve
     * (compat:54, `toLocaleDateString('pt-BR')`).
     *
     * ATENÇÃO: engine.ts:471 faz `new Date(p.adm)` sobre este campo. Ver a lista
     * PARA O MEDICO DECIDIR — o alerta de jejum prolongado nunca dispara por causa
     * disso. Nada aqui foi corrigido: o campo está tipado como o código o produz.
     */
    adm: string;
    peso: string;
    altura: string;
    alergias: string;
    gravidade: string;
    dvas: Infusao[];
    sedativos: Infusao[];
    neuro: SistemaNeuroMotor;
    resp: SistemaRespMotor;
    hemo: SistemaHemoMotor;
    tgi: SistemaTgiMotor;
    renal: SistemaRenalMotor;
    hemato: SistemaHematoMotor;
    infecto: SistemaInfectoMotor;
    impressao: string[];
    conduta: string[];
    pendencias: PendenciaMotor[];
}

// ---------------------------------------------------------------------------
// Contratos de saída dos escores  (o antigo `../types/clinical`)
// ---------------------------------------------------------------------------

export type SistemaSofaMotor = 'resp' | 'coag' | 'liver' | 'cardio' | 'neuro' | 'renal';

/**
 * Pontos por sistema.
 *
 * CORREÇÃO 15-ago-2026: `getSOFA` (sofa.ts) FAZ aritmética sobre `components`
 * — `Object.values(comps).reduce((a, b) => a + b, 0)` para o total. Isso não
 * tinha sido visto quando este tipo foi escrito como `number | null`; com
 * `null` no union, `a + b` falha o typecheck (`exactOptionalPropertyTypes`).
 * Na prática, cada `sofaXxx()` sempre devolve `score: number` — ausência de
 * dado vira `missing`, nunca `null` no score. `null` nunca é atribuído a um
 * componente pelo código real, então `number` sozinho não muda comportamento
 * nenhum do código dele — só destrava o `total` que ele mesmo calcula.
 */
export type SOFAComponents = Record<SistemaSofaMotor, number>;

export interface SOFAResult {
    /**
     * Total do SOFA.
     *
     * IMPORTANT — leia antes de exibir este número. Ele é a soma do que FOI
     * apurado, não necessariamente dos 6 sistemas: o contrato do motor exige um
     * `number` (sepsis.ts:39 e :59 fazem aritmética direta sobre ele), e o SOFA
     * do app devolve `null` enquanto qualquer sistema faltar.
     *
     * A ponte não inventa e não esconde: `total` traz a soma parcial, `apurados`
     * diz sobre quantos dos 6 sistemas ela foi feita, `totalCompleto` é `null`
     * enquanto o escore não fecha, e `warnings` ganha uma linha explícita quando
     * isso acontece. Quem for pintar tela usa `totalCompleto`; `total` existe para
     * o código do operador continuar rodando sem ser reescrito.
     */
    total: number;
    /** `null` enquanto os 6 sistemas não fecharem. Este é o número honesto. */
    totalCompleto: number | null;
    /** Quantos dos 6 sistemas foram calculáveis. */
    apurados: number;
    components: SOFAComponents;
    detail: string[];
    /** O que falta COLHER — acionável por exame. */
    missing: string[];
    /** O que foi deliberadamente não pontuado (hoje: neuro sob sedação). */
    suppressed: string[];
    warnings: string[];
    /** ISO 8601. `null` quando o relógio recebido é inválido — carimbo não se chuta. */
    computedAt: string | null;
}

/** Motivo da conclusão de sepse. Valores provados em sepsis.ts:46-60 e compat:335. */
export type SepsisReason =
    | 'sem_infeccao_detectada'
    | 'delta_sofa_ge_2_with_infection'
    | 'dados_insuficientes'
    | 'sofa_absoluto_fallback_sem_baseline';

export interface SepsisAssessment {
    isSeptic: boolean;
    isSepticShock: boolean;
    reason: SepsisReason;
    deltaSOFA: number | null;
    baselineSOFA: number | null;
    currentSOFA: number;
    hasInfectionEvidence: boolean;
    infectionEvidences: string[];
    lactato: number | null;
    warnings: string[];
}

/** qSOFA. Critérios provados por engine.ts:570-579 (`total`, `isPositive`, `criteria`). */
export interface QSOFAResult {
    total: number;
    isPositive: boolean;
    criteria: Record<string, boolean>;
    /** O que não deu para avaliar. Critério ausente NÃO conta como negativo. */
    missing: string[];
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

/**
 * Severidade do alerta.
 *
 * Alias de `SeveridadeAlerta` de `@/types/clinical` — os três valores são os
 * mesmos (`info | warning | critical`, provados em engine.ts:90). Aliás e não
 * cópia, de propósito: um dia alguém acrescenta um nível no banco e os dois têm
 * de andar juntos.
 */
export type AlertLevel = SeveridadeAlerta;

/**
 * Categoria do alerta. Os 7 valores estão provados por uso em engine.ts —
 * `hemodynamic` (:109), `respiratory` (:202), `renal` (:296), `infectious`
 * (:364), `metabolic` (:422), `medication` (:500), `nutrition` (:452).
 */
export type AlertCategory =
    'hemodynamic' | 'respiratory' | 'renal' | 'infectious' | 'metabolic' | 'medication' | 'nutrition';

/** Um alerta calculado. Campos provados em engine.ts:42-53. */
export interface ClinicalAlert {
    id: string;
    level: AlertLevel;
    category: AlertCategory;
    title: string;
    message: string;
    actionSuggested?: string | undefined;
    /** O que disparou, em texto curto — a trilha de auditoria do alerta. */
    triggeredBy: string[];
    patientId: string;
    createdAt: string;
    acknowledged: boolean;
}
