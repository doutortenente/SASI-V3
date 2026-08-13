/**
 * Os campos editáveis de cada um dos 7 sistemas da ficha — o mapa da tela.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISTO É DADO, E NÃO JSX ESPALHADO
 * ---------------------------------------------------------------------------
 * O esquema canônico dos sistemas mora em `src/types/clinical.ts` (Máx–Mín, a
 * fonte única). Se cada painel da tela escrevesse os seus próprios inputs à
 * mão, bastaria um `spo2_min` digitado errado num JSX para o campo virar chave
 * fantasma no jsonb: o banco aceita (é jsonb livre), a nota nunca lê e ninguém
 * descobre. Descrevendo os campos como DADO, a tela inteira é gerada de uma
 * lista só, o mesmo mapa alimenta a ida (`sistemaParaEdicao`) e a volta
 * (`sistemaLimpo`), e chave errada aparece no teste que compara este arquivo
 * com o tipo canônico.
 *
 * O que NÃO está aqui, de propósito: campo que o esquema canônico não tem.
 * Inventar campo novo na tela é criar dado clínico sem casa no contrato.
 */

/** As 7 chaves de sistema de `evolucoes`, na ordem em que a nota as escreve. */
export const CHAVES_SISTEMAS = [
    'neuro',
    'resp',
    'hemo',
    'tgi',
    'renal',
    'hemato',
    'infecto',
] as const;

export type ChaveSistema = (typeof CHAVES_SISTEMAS)[number];

/**
 * Como o campo é digitado.
 * - `numero`: teclado numérico no celular, mas o input é TEXTO — vírgula
 *   decimal é a entrada legítima aqui ("Cr 1,7"), e `type="number"` do HTML
 *   recusa vírgula em teclado pt-BR. A conversão fica com `parseNumeroBR`,
 *   lá no cálculo clínico.
 * - `area`: texto corrido de várias linhas (descrição, observação).
 * - `texto`: uma linha.
 */
export type TipoDeCampo = 'texto' | 'numero' | 'area';

export interface CampoDoSistema {
    /** A chave EXATA do jsonb (`src/types/clinical.ts`). Errar aqui cria campo órfão. */
    chave: string;
    rotulo: string;
    tipo: TipoDeCampo;
    /** Unidade mostrada ao lado do rótulo — nunca gravada junto do valor. */
    unidade?: string;
    /** Exemplo de preenchimento. Nunca vira valor: placeholder não é dado. */
    exemplo?: string;
}

export interface PainelDeSistema {
    chave: ChaveSistema;
    rotulo: string;
    /** Uma frase sobre o que a nota faz com estes campos. */
    nota?: string;
    campos: CampoDoSistema[];
}

/**
 * Os 7 painéis, campo a campo, conferidos contra `src/types/clinical.ts`.
 *
 * Máx e Mín andam SEMPRE em par e vizinhos — inclusive SpO2, que é a que mais
 * se perde ("SpO2 94%" esconde que caiu a 84% às 3h). A ordem dos campos é a
 * ordem visual da tela.
 */
export const PAINEIS_DOS_SISTEMAS: readonly PainelDeSistema[] = [
    {
        chave: 'neuro',
        rotulo: 'Neurológico',
        campos: [
            {chave: 'descricao', rotulo: 'Descrição', tipo: 'area', exemplo: 'sedado, pupilas isocóricas'},
            {chave: 'rass', rotulo: 'RASS', tipo: 'texto', exemplo: '-3'},
        ],
    },
    {
        chave: 'resp',
        rotulo: 'Respiratório',
        nota:
            'FR e SpO2 do TEXTO saem da janela de 24h do banco (linha pronta). ' +
            'Os campos abaixo ficam gravados na ficha.',
        campos: [
            {chave: 'suporte', rotulo: 'Suporte', tipo: 'texto', exemplo: 'VM A/C VCV, PEEP 8, FiO2 40%'},
            {chave: 'fr_max', rotulo: 'FR Máx', tipo: 'numero', unidade: 'irpm'},
            {chave: 'fr_min', rotulo: 'FR Mín', tipo: 'numero', unidade: 'irpm'},
            {chave: 'spo2_max', rotulo: 'SpO2 Máx', tipo: 'numero', unidade: '%'},
            {chave: 'spo2_min', rotulo: 'SpO2 Mín', tipo: 'numero', unidade: '%'},
            {chave: 'obs', rotulo: 'Observação', tipo: 'area'},
        ],
    },
    {
        chave: 'hemo',
        rotulo: 'Cardiovascular',
        nota:
            'PAM mínima alimenta o componente cardiovascular do SOFA. ' +
            'As faixas do texto vêm da janela de 24h do banco.',
        campos: [
            {chave: 'pa_sys_max', rotulo: 'PAS Máx', tipo: 'numero', unidade: 'mmHg'},
            {chave: 'pa_sys_min', rotulo: 'PAS Mín', tipo: 'numero', unidade: 'mmHg'},
            {chave: 'pa_dia_max', rotulo: 'PAD Máx', tipo: 'numero', unidade: 'mmHg'},
            {chave: 'pa_dia_min', rotulo: 'PAD Mín', tipo: 'numero', unidade: 'mmHg'},
            {chave: 'pam_max', rotulo: 'PAM Máx', tipo: 'numero', unidade: 'mmHg'},
            {chave: 'pam_min', rotulo: 'PAM Mín', tipo: 'numero', unidade: 'mmHg'},
            {chave: 'fc_max', rotulo: 'FC Máx', tipo: 'numero', unidade: 'bpm'},
            {chave: 'fc_min', rotulo: 'FC Mín', tipo: 'numero', unidade: 'bpm'},
            {chave: 'ritmo', rotulo: 'Ritmo', tipo: 'texto', exemplo: 'sinusal'},
            {chave: 'obs', rotulo: 'Observação', tipo: 'area'},
        ],
    },
    {
        chave: 'tgi',
        rotulo: 'TGI',
        campos: [
            {chave: 'dieta', rotulo: 'Dieta', tipo: 'texto', exemplo: 'TNE 40 mL/h por SNE'},
            {chave: 'obs', rotulo: 'Observação', tipo: 'area'},
        ],
    },
    {
        chave: 'renal',
        rotulo: 'Renal',
        nota: 'Creatinina e diurese alimentam o componente renal do SOFA.',
        campos: [
            {chave: 'cr', rotulo: 'Creatinina', tipo: 'numero', unidade: 'mg/dL', exemplo: '1,7'},
            {chave: 'ur', rotulo: 'Ureia', tipo: 'numero', unidade: 'mg/dL'},
            {chave: 'diurese_6_18h_ml', rotulo: 'Diurese 06h–18h', tipo: 'numero', unidade: 'mL'},
            {chave: 'bh_6_18h_ml', rotulo: 'BH 06h–18h', tipo: 'numero', unidade: 'mL'},
            {chave: 'descricao', rotulo: 'Descrição', tipo: 'area'},
            {chave: 'obs', rotulo: 'Observação', tipo: 'area'},
        ],
    },
    {
        chave: 'hemato',
        rotulo: 'Hematológico',
        nota: 'Plaquetas alimentam o componente de coagulação do SOFA.',
        campos: [
            {chave: 'hb', rotulo: 'Hb', tipo: 'numero', unidade: 'g/dL'},
            {chave: 'ht', rotulo: 'Ht', tipo: 'numero', unidade: '%'},
            {chave: 'plaq', rotulo: 'Plaquetas', tipo: 'numero', unidade: '×10³/µL'},
            {chave: 'obs', rotulo: 'Observação', tipo: 'area'},
        ],
    },
    {
        chave: 'infecto',
        rotulo: 'Infeccioso',
        nota: 'O esquema de antibiótico do texto vem da tabela `atbs`, não deste campo.',
        campos: [
            {chave: 'atb', rotulo: 'Esquema (anotação livre)', tipo: 'texto'},
            {chave: 'tmax', rotulo: 'Tmáx', tipo: 'numero', unidade: '°C'},
            {chave: 'leuco', rotulo: 'Leucócitos', tipo: 'numero', unidade: '/mm³'},
            {chave: 'obs', rotulo: 'Observação', tipo: 'area'},
        ],
    },
];

/** Índice por chave — a tela pega o painel sem varrer a lista. */
const POR_CHAVE = new Map(PAINEIS_DOS_SISTEMAS.map((p) => [p.chave, p]));

export function painelDoSistema(chave: ChaveSistema): PainelDeSistema {
    const painel = POR_CHAVE.get(chave);
    // Chave fora do enum não existe em tempo de tipo; a guarda é a rede de
    // segurança de quem chamar com string vinda de fora do TypeScript.
    if (!painel) throw new Error(`Sistema desconhecido na ficha: ${chave}`);
    return painel;
}

/** As chaves de jsonb de um sistema — o mesmo mapa da ida e da volta da edição. */
export function camposDoSistema(chave: ChaveSistema): string[] {
    return painelDoSistema(chave).campos.map((c) => c.chave);
}
