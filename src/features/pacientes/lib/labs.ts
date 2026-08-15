/**
 * Catálogo do folhão de laboratório — uma linha por exame, uma coluna por dia,
 * agrupado por seção (a mesma forma do template `paciente-folhao` do pacote
 * de design). Só os códigos com categoria de EXAME em `evento_tipo_ref`
 * (conferido no banco vivo em 15-ago-2026, projeto `idswehsvvqczzkiatuzu`):
 * hemato, coag, renal (eletrólito/função, não balanço), hepato, gaso,
 * infecto, cardio, endocrino. Balanço hídrico e diurese ficam de fora — são
 * medida contínua, não exame pontual, e já têm casa própria (`janelas_24h`).
 */
export interface CodigoDeLab {
    codigo: string;
    categoria: string;
    rotulo: string;
    unidade: string;
}

export const CODIGOS_DE_LAB: CodigoDeLab[] = [
    {codigo: 'hb', categoria: 'hemato', rotulo: 'Hemoglobina', unidade: 'g/dL'},
    {codigo: 'ht', categoria: 'hemato', rotulo: 'Hematócrito', unidade: '%'},
    {codigo: 'plaq', categoria: 'hemato', rotulo: 'Plaquetas', unidade: '×10³/mm³'},
    {codigo: 'inr', categoria: 'hemato', rotulo: 'INR', unidade: ''},
    {codigo: 'tp', categoria: 'coag', rotulo: 'Tempo de protrombina', unidade: 's'},
    {codigo: 'ttpa', categoria: 'coag', rotulo: 'TTPA', unidade: 's'},
    {codigo: 'd_dimero', categoria: 'coag', rotulo: 'D-dímero', unidade: 'ng/mL'},
    {codigo: 'cr', categoria: 'renal', rotulo: 'Creatinina', unidade: 'mg/dL'},
    {codigo: 'ur', categoria: 'renal', rotulo: 'Ureia', unidade: 'mg/dL'},
    {codigo: 'na', categoria: 'renal', rotulo: 'Sódio', unidade: 'mEq/L'},
    {codigo: 'k', categoria: 'renal', rotulo: 'Potássio', unidade: 'mEq/L'},
    {codigo: 'mg', categoria: 'renal', rotulo: 'Magnésio', unidade: 'mg/dL'},
    {codigo: 'ca', categoria: 'renal', rotulo: 'Cálcio', unidade: 'mg/dL'},
    {codigo: 'p', categoria: 'renal', rotulo: 'Fósforo', unidade: 'mg/dL'},
    {codigo: 'tgo', categoria: 'hepato', rotulo: 'TGO / AST', unidade: 'U/L'},
    {codigo: 'tgp', categoria: 'hepato', rotulo: 'TGP / ALT', unidade: 'U/L'},
    {codigo: 'ggt', categoria: 'hepato', rotulo: 'GGT', unidade: 'U/L'},
    {codigo: 'fa', categoria: 'hepato', rotulo: 'Fosfatase alcalina', unidade: 'U/L'},
    {codigo: 'bd', categoria: 'hepato', rotulo: 'Bilirrubina direta', unidade: 'mg/dL'},
    {codigo: 'bi', categoria: 'hepato', rotulo: 'Bilirrubina indireta', unidade: 'mg/dL'},
    {codigo: 'amilase', categoria: 'hepato', rotulo: 'Amilase', unidade: 'U/L'},
    {codigo: 'lipase', categoria: 'hepato', rotulo: 'Lipase', unidade: 'U/L'},
    {codigo: 'dhl', categoria: 'hepato', rotulo: 'DHL / LDH', unidade: 'U/L'},
    {codigo: 'pf_ratio', categoria: 'gaso', rotulo: 'Relação PaO₂/FiO₂', unidade: ''},
    {codigo: 'lactato', categoria: 'gaso', rotulo: 'Lactato', unidade: 'mmol/L'},
    {codigo: 'ph', categoria: 'gaso', rotulo: 'pH arterial', unidade: ''},
    {codigo: 'pco2', categoria: 'gaso', rotulo: 'pCO₂', unidade: 'mmHg'},
    {codigo: 'po2', categoria: 'gaso', rotulo: 'pO₂', unidade: 'mmHg'},
    {codigo: 'hco3', categoria: 'gaso', rotulo: 'Bicarbonato', unidade: 'mEq/L'},
    {codigo: 'be', categoria: 'gaso', rotulo: 'Base excess', unidade: 'mEq/L'},
    {codigo: 'leuco', categoria: 'infecto', rotulo: 'Leucócitos', unidade: '×10³/mm³'},
    {codigo: 'vhs', categoria: 'infecto', rotulo: 'VHS', unidade: 'mm/h'},
    {codigo: 'bb', categoria: 'infecto', rotulo: 'Bilirrubina total', unidade: 'mg/dL'},
    {codigo: 'pcr', categoria: 'infecto', rotulo: 'Proteína C reativa', unidade: 'mg/L'},
    {codigo: 'procalcitonina', categoria: 'infecto', rotulo: 'Procalcitonina', unidade: 'ng/mL'},
    {codigo: 'troponina', categoria: 'cardio', rotulo: 'Troponina', unidade: 'ng/mL'},
    {codigo: 'probnp', categoria: 'cardio', rotulo: 'NT-proBNP', unidade: 'pg/mL'},
    {codigo: 'tsh', categoria: 'endocrino', rotulo: 'TSH', unidade: 'µUI/mL'},
    {codigo: 't4l', categoria: 'endocrino', rotulo: 'T4 livre', unidade: 'ng/dL'},
];

const ROTULO_SECAO = {
    hemato: 'Hematologia',
    coag: 'Coagulação',
    renal: 'Renal e eletrólitos',
    hepato: 'Hepático',
    gaso: 'Gasometria',
    infecto: 'Infeccioso',
    cardio: 'Cardíaco',
    endocrino: 'Endócrino',
};

/** Ordem de exibição — a mesma ordem em que as seções aparecem no catálogo acima. */
const ORDEM_SECOES: (keyof typeof ROTULO_SECAO)[] = [
    'hemato',
    'coag',
    'renal',
    'hepato',
    'gaso',
    'infecto',
    'cardio',
    'endocrino',
];

export interface EventoDeLab {
    tipo: string;
    /** `YYYY-MM-DD`, já recortado do timestamp. */
    dia: string;
    valor: number;
}

export interface LinhaDoFolhao {
    codigo: string;
    rotulo: string;
    unidade: string;
    /** Dia → valores lançados naquele dia (mais de um = mais de uma coleta). */
    porDia: Record<string, number[]>;
}

export interface SecaoDoFolhao {
    categoria: string;
    titulo: string;
    linhas: LinhaDoFolhao[];
}

export interface FolhaoDeLabs {
    /** Dias com pelo menos um exame, em ordem cronológica. */
    dias: string[];
    /** Só seções com pelo menos um exame com dado — seção sem dado não aparece. */
    secoes: SecaoDoFolhao[];
}

/** Função pura: agrupa os eventos já lidos do banco em grade dia × exame, por seção. */
export function montarFolhaoDeLabs(eventos: EventoDeLab[]): FolhaoDeLabs {
    const diasSet = new Set<string>();
    const porCodigo = new Map<string, Map<string, number[]>>();

    for (const ev of eventos) {
        diasSet.add(ev.dia);
        if (!porCodigo.has(ev.tipo)) porCodigo.set(ev.tipo, new Map());
        const porDia = porCodigo.get(ev.tipo)!;
        if (!porDia.has(ev.dia)) porDia.set(ev.dia, []);
        porDia.get(ev.dia)!.push(ev.valor);
    }

    const dias = [...diasSet].sort();

    const secoes: SecaoDoFolhao[] = ORDEM_SECOES.map((categoria) => {
        const linhas = CODIGOS_DE_LAB.filter((c) => c.categoria === categoria && porCodigo.has(c.codigo)).map(
            (c) => ({
                codigo: c.codigo,
                rotulo: c.rotulo,
                unidade: c.unidade,
                porDia: Object.fromEntries(porCodigo.get(c.codigo)!),
            }),
        );
        return {categoria, titulo: ROTULO_SECAO[categoria], linhas};
    }).filter((s) => s.linhas.length > 0);

    return {dias, secoes};
}
