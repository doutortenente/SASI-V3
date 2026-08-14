// ============================================================================
// SASI v3 — Conversão de vazão (mL/h) para dose clínica, e faixa de segurança
// ----------------------------------------------------------------------------
// FONTE DAS DILUIÇÕES E FAIXAS: padronização institucional do operador,
// portada do app "Comando UTI" (dicionários DVA_DICT e SEDACAO_DICT), em uso
// em plantão. NÃO são valores de literatura genérica — são as diluições que a
// farmácia da casa prepara. Trocar a diluição sem trocar o fator aqui faz a
// dose exibida ficar errada por um múltiplo inteiro.
//
// Função pura, sem framework. Componente exibe, não calcula.
// ============================================================================

/** Como a dose final é expressa. Define qual fórmula de conversão se aplica. */
export type UnidadeDose = 'mcg/kg/min' | 'mcg/min' | 'U/min' | 'mcg/kg/h' | 'mg/kg/h';

export interface Diluicao {
    /** Rótulo como aparece na etiqueta da bolsa. */
    rotulo: string;
    /** Concentração da solução, na unidade de massa da dose, por mL. */
    concentracaoPorMl: number;
    unidade: UnidadeDose;
}

export interface Farmaco {
    diluicoes: Diluicao[];
    /** Faixa terapêutica usual. Fora dela NÃO é erro — é sinal para conferir. */
    faixaMin: number;
    faixaMax: number;
}

// ---------------------------------------------------------------------------
// Drogas vasoativas
// ---------------------------------------------------------------------------
export const DVA: Record<string, Farmaco> = {
    Noradrenalina: {
        diluicoes: [
            {rotulo: 'Padrão — 16 mg/250 mL', concentracaoPorMl: 64, unidade: 'mcg/kg/min'},
            {rotulo: 'Simples — 8 mg/250 mL', concentracaoPorMl: 32, unidade: 'mcg/kg/min'},
            {rotulo: 'Concentrada — 32 mg/250 mL', concentracaoPorMl: 128, unidade: 'mcg/kg/min'},
        ],
        faixaMin: 0.01,
        faixaMax: 2.0,
    },
    Adrenalina: {
        diluicoes: [{rotulo: 'Padrão — 16 mg/250 mL', concentracaoPorMl: 64, unidade: 'mcg/kg/min'}],
        faixaMin: 0.01,
        faixaMax: 2.0,
    },
    Dobutamina: {
        diluicoes: [{rotulo: 'Padrão — 250 mg/250 mL', concentracaoPorMl: 1000, unidade: 'mcg/kg/min'}],
        faixaMin: 2.0,
        faixaMax: 20.0,
    },
    Vasopressina: {
        diluicoes: [{rotulo: 'Padrão — 20 U/100 mL', concentracaoPorMl: 0.2, unidade: 'U/min'}],
        faixaMin: 0.01,
        faixaMax: 0.04,
    },
    'Nitroprussiato (Nipride)': {
        diluicoes: [{rotulo: 'Padrão — 50 mg/250 mL', concentracaoPorMl: 200, unidade: 'mcg/kg/min'}],
        faixaMin: 0.1,
        faixaMax: 10.0,
    },
    'Nitroglicerina (Tridil)': {
        diluicoes: [{rotulo: 'Padrão — 50 mg/250 mL', concentracaoPorMl: 200, unidade: 'mcg/min'}],
        faixaMin: 5.0,
        faixaMax: 200.0,
    },
    Esmolol: {
        diluicoes: [{rotulo: 'Padrão — 2500 mg/250 mL', concentracaoPorMl: 10_000, unidade: 'mcg/kg/min'}],
        faixaMin: 50.0,
        faixaMax: 300.0,
    },
};

// ---------------------------------------------------------------------------
// Sedação e analgesia
// ---------------------------------------------------------------------------
export const SEDACAO: Record<string, Farmaco> = {
    Fentanil: {
        diluicoes: [
            {rotulo: 'Padrão — 1000 mcg/100 mL', concentracaoPorMl: 10, unidade: 'mcg/kg/h'},
            {rotulo: 'Puro — 50 mcg/mL', concentracaoPorMl: 50, unidade: 'mcg/kg/h'},
        ],
        faixaMin: 0.5,
        faixaMax: 3.0,
    },
    Midazolam: {
        diluicoes: [
            {rotulo: 'Padrão — 150 mg/150 mL', concentracaoPorMl: 1, unidade: 'mg/kg/h'},
            {rotulo: 'Simples — 50 mg/100 mL', concentracaoPorMl: 0.5, unidade: 'mg/kg/h'},
        ],
        faixaMin: 0.05,
        faixaMax: 0.2,
    },
    Propofol: {
        diluicoes: [
            {rotulo: '1% — 10 mg/mL', concentracaoPorMl: 10, unidade: 'mg/kg/h'},
            {rotulo: '2% — 20 mg/mL', concentracaoPorMl: 20, unidade: 'mg/kg/h'},
        ],
        faixaMin: 0.5,
        faixaMax: 4.0,
    },
    'Dexmedetomidina (Precedex)': {
        diluicoes: [{rotulo: 'Padrão — 400 mcg/100 mL', concentracaoPorMl: 4, unidade: 'mcg/kg/h'}],
        faixaMin: 0.2,
        faixaMax: 1.5,
    },
};

/** Resultado do cálculo. `null` em qualquer campo significa: não dá para saber. */
export interface DoseCalculada {
    valor: number;
    unidade: UnidadeDose;
    faixaMin: number;
    faixaMax: number;
    /** Dentro da faixa usual. Fora NÃO quer dizer errado — quer dizer confira. */
    dentroDaFaixa: boolean;
}

/** Por que a dose não pôde ser calculada. A tela mostra o motivo, não um número. */
export type MotivoSemDose =
    'farmaco-desconhecido' | 'diluicao-desconhecida' | 'vazao-ausente' | 'vazao-invalida' | 'peso-necessario';

export type ResultadoDose = {ok: true; dose: DoseCalculada} | {ok: false; motivo: MotivoSemDose};

/** Doses por quilo: sem peso a conta não existe. Nunca chutar peso de paciente. */
const EXIGE_PESO: ReadonlySet<UnidadeDose> = new Set<UnidadeDose>(['mcg/kg/min', 'mcg/kg/h', 'mg/kg/h']);

/**
 * Converte vazão da bomba (mL/h) na dose clínica.
 *
 * As três fórmulas, e por que são diferentes:
 *   por kg e por MINUTO  → (mL/h × concentração) / (peso × 60)
 *   só por MINUTO        → (mL/h × concentração) / 60
 *   por kg e por HORA    → (mL/h × concentração) / peso
 *
 * IMPORTANT: sem peso, dose por quilo devolve `ok:false`. Não estima peso, não
 * usa "70 kg padrão": dose de vasoativa calculada sobre peso inventado é dose
 * errada com aparência de dose certa.
 */
export function calcularDose(
    farmaco: string,
    indiceDiluicao: number,
    vazaoMlH: number | string | null | undefined,
    pesoKg: number | string | null | undefined,
    tabela: Record<string, Farmaco> = DVA,
): ResultadoDose {
    const f = tabela[farmaco];
    if (!f) return {ok: false, motivo: 'farmaco-desconhecido'};

    const dil = f.diluicoes[indiceDiluicao];
    if (!dil) return {ok: false, motivo: 'diluicao-desconhecida'};

    if (vazaoMlH === null || vazaoMlH === undefined || String(vazaoMlH).trim() === '') {
        return {ok: false, motivo: 'vazao-ausente'};
    }
    // Vírgula decimal: o operador digita "0,3", e "0,3" vira NaN sem esta troca.
    const vazao = Number(String(vazaoMlH).replace(',', '.'));
    if (!Number.isFinite(vazao) || vazao < 0) return {ok: false, motivo: 'vazao-invalida'};

    let peso = Number.NaN;
    if (EXIGE_PESO.has(dil.unidade)) {
        if (pesoKg === null || pesoKg === undefined || String(pesoKg).trim() === '') {
            return {ok: false, motivo: 'peso-necessario'};
        }
        peso = Number(String(pesoKg).replace(',', '.'));
        if (!Number.isFinite(peso) || peso <= 0) return {ok: false, motivo: 'peso-necessario'};
    }

    let valor: number;
    switch (dil.unidade) {
        case 'mcg/kg/min':
            valor = (vazao * dil.concentracaoPorMl) / (peso * 60);
            break;
        case 'mcg/min':
        case 'U/min':
            valor = (vazao * dil.concentracaoPorMl) / 60;
            break;
        case 'mcg/kg/h':
        case 'mg/kg/h':
            valor = (vazao * dil.concentracaoPorMl) / peso;
            break;
    }

    // 3 casas: noradrenalina em 0,01 mcg/kg/min precisa de resolução fina; com 2
    // casas, doses baixas de vasopressina (faixa 0,01 a 0,04 U/min) achatariam.
    const arredondado = Math.round(valor * 1000) / 1000;

    return {
        ok: true,
        dose: {
            valor: arredondado,
            unidade: dil.unidade,
            faixaMin: f.faixaMin,
            faixaMax: f.faixaMax,
            dentroDaFaixa: arredondado >= f.faixaMin && arredondado <= f.faixaMax,
        },
    };
}

/** Frase pronta para a tela quando não há dose. Diz o que falta, não some. */
export const EXPLICACAO_SEM_DOSE: Record<MotivoSemDose, string> = {
    'farmaco-desconhecido': 'fármaco fora da tabela de diluições',
    'diluicao-desconhecida': 'diluição não cadastrada para este fármaco',
    'vazao-ausente': 'sem vazão lançada',
    'vazao-invalida': 'vazão não numérica — conferir',
    'peso-necessario': 'informe o peso para calcular a dose',
};
