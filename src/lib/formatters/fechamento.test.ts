/**
 * Testes que TRAVAM o esqueleto do Fechamento contra a especificação da skill
 * `sasi-ingest-export` (arquivos 04, 05 e 00). O esqueleto é IMUTÁVEL —
 * divergência é "bug clínico-legal" — então o teste principal é a ORDEM EXATA
 * das seções, não o conteúdo.
 *
 * Fixtures 100% SINTÉTICAS: nenhum nome, valor ou data veio de paciente real
 * (regra do CLAUDE.md — `_material/` e amostras nunca entram em teste).
 */
import {describe, expect, it} from 'vitest';

import {calcularSofa} from '@/lib/clinical/sofa';

import {
    checklistPendencias,
    linhaAtbAtivo,
    linhaDva,
    linhaSofa,
    linhaVital,
    montarEvolucao,
    montarPassagem,
} from './fechamento';

import type {InsumosEvolucao, InsumosPassagem, JanelaProntaParaNota} from './fechamento';

// ---------------------------------------------------------------------------
// Fixtures sintéticas
// ---------------------------------------------------------------------------

const RELOGIO_FIXO = new Date('2026-08-13T06:00:00Z');

/** SOFA com os 6 sistemas apuráveis (total 7): transparência tem que dizer 6/6. */
const SOFA_COMPLETO = calcularSofa(
    {
        pao2: 90,
        fio2: 40,
        ventilacaoInvasiva: true,
        plaquetas: 120,
        bilirrubina: '1,5',
        pamMinima: 62,
        dvas: [],
        pesoKg: 80,
        glasgow: 14,
        sobSedacao: false,
        creatinina: '1,8',
        diureseMl: 900,
        horasDeColeta: 24,
    },
    RELOGIO_FIXO,
);

/** SOFA com só 2 sistemas apuráveis: total null, e a nota NUNCA finge um total. */
const SOFA_PARCIAL = calcularSofa({plaquetas: 80, pamMinima: 70}, RELOGIO_FIXO);

/** Linhas prontas de `vw_janelas_24h_render` — o formatter exibe, nunca remonta. */
const JANELAS: JanelaProntaParaNota[] = [
    {tipo: 'pa_sys', render: 'PAS 130-84', valor_max: 130, valor_min: 84},
    {tipo: 'pam', render: 'PAM 90-56 (4/12 <65)', valor_max: 90, valor_min: 56},
    {tipo: 'fc', render: 'FC 132-88', valor_max: 132, valor_min: 88},
    {tipo: 'fr', render: 'FR 28-14', valor_max: 28, valor_min: 14},
    {tipo: 'spo2', render: 'SpO2 98-89 (2/12 <92)', valor_max: 98, valor_min: 89},
];

const evolucaoCompleta: InsumosEvolucao = {
    paciente: {
        nome: 'Paciente Sintético Alfa',
        idade: 63,
        peso: 82.5,
        uti: 'UTI2',
        leito: 'UTI2-L07',
        hd: 'Choque séptico de foco pulmonar',
        alergias: 'dipirona (rash cutâneo)',
    },
    problemas: [
        'Choque séptico de foco pulmonar — noradrenalina em desmame',
        'IRA KDIGO 2 em recuperação',
    ],
    admissao: {dataISO: '2026-08-01', texto: 'admitido em insuficiência respiratória aguda, IOT na chegada.'},
    diasInternacao: 12,
    dataPlantaoISO: '2026-08-13',
    turno: 'noturna',
    intercorrencias: [
        'pico febril 38,9 às 02h, colhidas hemoculturas',
        'reduzida noradrenalina após estabilidade pressórica',
    ],
    antecedentes: 'HAS, DM2, DPOC',
    medicamentosDomiciliares: ['losartana 50 mg 12/12h', 'metformina 850 mg 8/8h'],
    dispositivos: [
        {rotulo: 'IOT', sitio: 'TOT nº 8', diasEmUso: 12},
        {rotulo: 'CVC', sitio: 'subclávia direita', diasEmUso: 5},
    ],
    dvas: ['Noradrenalina 0,20 mcg/kg/min em desmame'],
    sedativos: [{droga: 'Fentanil', vazao_ml_h: 4}],
    atbs: [
        {
            droga: 'Meropenem',
            dose: '1g',
            via: 'EV',
            frequencia: '8/8h',
            foco: 'pulmonar',
            dataInicioISO: '2026-08-10',
            dataFimISO: null,
            diasTerapia: 3,
        },
        {
            droga: 'Ceftriaxona',
            dose: '2g',
            via: 'EV',
            frequencia: '1x/dia',
            foco: 'urinário',
            dataInicioISO: '2026-08-01',
            dataFimISO: '2026-08-05',
            diasTerapia: null,
        },
    ],
    nutricao: {tne: 'dieta enteral 60 mL/h'},
    sistemas: {
        neuro: {descricao: 'sedado, pupilas isofotorreagentes', rass: '-2'},
        hemo: {ritmo: 'ritmo sinusal'},
        resp: {suporte: 'VM PSV 12', obs: 'MV presente bilateral'},
        tgi: {dieta: 'dieta enteral plena', obs: 'abdome flácido, RHA presentes'},
        renal: {cr: '1,7 -> 2,0', ur: '88', descricao: 'KDIGO 2'},
        hemato: {hb: '8,7', ht: '27', plaq: '96'},
        infecto: {tmax: '38,9', leuco: '15,2'},
        gaso: 'pH 7,31 / pCO2 48 / HCO3 22 / SBE -3 / Lactato 2,1',
    },
    janelas: JANELAS,
    bh24h: 850,
    pf: '225',
    culturas: 'hemoculturas de 12/08 em andamento',
    imagens: ['RX tórax 12/08: consolidação em base direita, sem derrame'],
    sofa: SOFA_COMPLETO,
    deltaSofa24h: -1,
    qSofa: 2,
    impressao: [
        'Choque séptico em melhora — noradrenalina em desmame',
        'IRA KDIGO 2 em recuperação — Cr 1,7 -> 2,0',
    ],
    conduta: [
        'CV: manter desmame de noradrenalina; meta PAM ≥ 65 mmHg',
        'Renal: balanço hídrico alvo negativo de 500 mL em 24h',
    ],
    profilaxias: 'TEV com enoxaparina 40 mg SC 1x/dia, LAMG com omeprazol, cabeceira elevada',
    pendencias: [
        {tarefa: 'Conferir hemoculturas de 12/08', prioridade: 2},
        {tarefa: 'Gasometria de controle às 06h', prioridade: 1},
    ],
    autorNome: 'Dr. Exemplo Sintético',
};

/** O mínimo que o tipo exige — exercita TODOS os caminhos de omissão. */
const evolucaoMinima: InsumosEvolucao = {
    paciente: {nome: 'Paciente Sintético Beta', idade: null, peso: null, uti: 'UTI3', leito: 'UTI3-L02', alergias: null},
    problemas: [],
    diasInternacao: null,
    dataPlantaoISO: '2026-08-13',
    turno: 'noturna',
    intercorrencias: [],
    dispositivos: [],
    dvas: [],
    sedativos: [],
    atbs: [],
    sistemas: {},
    janelas: [],
    sofa: null,
    impressao: [],
    conduta: [],
    pendencias: [],
};

const passagemCompleta: InsumosPassagem = {
    paciente: {
        nome: 'Paciente Sintético Alfa',
        idade: 63,
        peso: 82.5,
        uti: 'UTI2',
        leito: 'UTI2-L07',
        hd: 'Choque séptico de foco pulmonar',
        alergias: 'dipirona (rash cutâneo)',
    },
    diasInternacao: 12,
    dataPlantaoISO: '2026-08-13',
    turno: 'noturna',
    gravidade: 'instavel',
    sofa: SOFA_COMPLETO,
    deltaSofa24h: 2,
    qSofa: 2,
    sistemas: {
        neuro: {descricao: 'sedado', rass: '-2'},
        resp: {suporte: 'VM PSV 12'},
        renal: {cr: '2,0', descricao: 'KDIGO 2'},
        hemato: {hb: '8,7', plaq: '96'},
    },
    janelas: JANELAS,
    dvas: ['Noradrenalina 0,20 mcg/kg/min em desmame', 'Vasopressina 2 ml/h'],
    sedativos: ['Fentanil 4 ml/h'],
    atbsAtivos: [
        {droga: 'Meropenem', diasTerapia: 3, foco: 'pulmonar'},
        {droga: 'Linezolida', diasTerapia: 5},
    ],
    culturasAtivas: 'hemoculturas em andamento',
    bh24h: -500,
    duMlKgH: 0.45,
    fio2: 40,
    pf: '225',
    alertas: [
        'Lactato 2,1 em queda lenta',
        'Plaquetas 96 em queda',
        'Febre recorrente apesar de ATB',
        'Quarto alerta que NÃO deve aparecer',
        'Quinto alerta que NÃO deve aparecer',
    ],
    pendencias: [
        {tarefa: 'Conferir hemoculturas de 12/08', prioridade: 2},
        {tarefa: 'Gasometria de controle às 06h', prioridade: 1},
        {tarefa: 'Revisar RX de tórax com a radiologia', prioridade: 3},
    ],
    sePiorar: [
        'PAM < 60: retomar noradrenalina 0,25 e avaliar cristaloide 500 mL',
        'SpO2 < 90: aprofundar sedação e elevar PEEP para 10',
    ],
};

const passagemMinima: InsumosPassagem = {
    paciente: {nome: 'Paciente Sintético Beta', idade: null, peso: null, uti: 'UTI4', leito: 'UTI4-L03', hd: null, alergias: null},
    diasInternacao: null,
    dataPlantaoISO: '2026-08-13',
    turno: 'diurna',
    gravidade: null,
    sofa: null,
    sistemas: {},
    janelas: [],
    dvas: [],
    sedativos: [],
    atbsAtivos: [],
    alertas: [],
    pendencias: [],
};

/** Confere que cada marcador aparece, e na ordem dada — o esqueleto travado. */
function esperarOrdem(saida: string, marcadores: string[]): void {
    let cursor = -1;
    for (const m of marcadores) {
        const pos = saida.indexOf(m, cursor + 1);
        expect(pos, `seção "${m}" ausente ou fora de ordem`).toBeGreaterThan(cursor);
        cursor = pos;
    }
}

// ---------------------------------------------------------------------------
// EVOLUÇÃO — TEMPLATE-BASE v2
// ---------------------------------------------------------------------------

describe('montarEvolucao — esqueleto IMUTÁVEL do TEMPLATE-BASE v2', () => {
    const saida = montarEvolucao(evolucaoCompleta);

    it('seções na ORDEM EXATA do arquivo 04 da skill', () => {
        esperarOrdem(saida, [
            'Paciente Sintético Alfa, 63a, 82,5 kg — UTI2 Leito 07 — DH 12º DIA — 13/08/2026 noturna',
            'HD / Problemas ativos:',
            '1. Choque séptico de foco pulmonar — noradrenalina em desmame',
            '⚠️ ALERGIA: dipirona (rash cutâneo)',
            'Admissão (01/08/26):',
            'Intercorrências 24h:',
            'Antecedentes:',
            'Medicamentos de uso domiciliar:',
            'ALERGIAS:',
            'Dispositivos:',
            'Uso:',
            'Drogas Vasoativas:',
            'Sedação:',
            'Antibióticos:',
            'TNE:',
            'Exame físico por sistemas:',
            'Neurológico:',
            'Cardiovascular:',
            'Respiratório:',
            'TGI:',
            'Renal:',
            'Hematológico:',
            'Infeccioso:',
            'Metabólico/Gaso:',
            'Exames de imagem relevantes:',
            'Scores:',
            'SOFA 7',
            'Impressão:',
            'Conduta estruturada por Sistemas:',
            'Profilaxias:',
            'Pendências:',
            'Assinatura: Dr. Exemplo Sintético — Intensivista',
            'Gerado por SASI — Sistema de Auditoria e Síntese Intensiva — TEMPLATE-BASE v2.0',
        ]);
    });

    it('vitais entram pela linha PRONTA do render — Máx–Mín, SpO2 incluso, nunca remontado', () => {
        expect(saida).toContain('PAM 90-56 (4/12 <65)');
        expect(saida).toContain('SpO2 98-89 (2/12 <92)');
        // A ordem invertida (mín primeiro) não pode existir em lugar nenhum.
        expect(saida).not.toContain('89-98');
        expect(saida).not.toContain('56-90');
    });

    it('Intercorrências 24h renderiza o array `evolucoes.intercorrencias`', () => {
        expect(saida).toContain('Intercorrências 24h: pico febril 38,9 às 02h, colhidas hemoculturas; ' +
            'reduzida noradrenalina após estabilidade pressórica.');
    });

    it('ATB é o histórico COMPLETO: curso aberto com D[n] do banco E curso fechado com período', () => {
        expect(saida).toContain('Meropenem 1g EV 8/8h D3 — foco pulmonar');
        expect(saida).toContain('Ceftriaxona 2g EV 1x/dia (01/08/2026 a 05/08/2026) — foco urinário');
    });

    it('SOFA sai com a transparência obrigatória: componentes capturados X/6', () => {
        expect(saida).toContain('componentes capturados: 6/6 · faltando: nenhum');
    });

    it('vírgula decimal na saída (peso 82,5, nunca 82.5)', () => {
        expect(saida).toContain('82,5 kg');
        expect(saida).not.toContain('82.5');
    });

    it('série da MESMA variável com "->" sobrevive (é notação do operador)', () => {
        expect(saida).toContain('Cr 1,7 -> 2,0');
    });
});

describe('montarEvolucao — ausência segue a doutrina do TEXTO', () => {
    const saida = montarEvolucao(evolucaoMinima);

    it('sistema inteiro sem dado vira "não avaliado" — nunca linha sumida nem zero', () => {
        expect(saida).toContain('Neurológico: não avaliado.');
        expect(saida).toContain('Cardiovascular: não avaliado.');
        expect(saida).toContain('Respiratório: não avaliado.');
        expect(saida).toContain('TGI: não avaliado.');
        expect(saida).toContain('Renal: não avaliado.');
        expect(saida).toContain('Hematológico: não avaliado.');
        expect(saida).toContain('Infeccioso: não avaliado.');
    });

    it('campo isolado sem fonte tem a LINHA OMITIDA — nunca frase inventada', () => {
        expect(saida).not.toContain('Antecedentes:');
        expect(saida).not.toContain('Medicamentos de uso domiciliar:');
        expect(saida).not.toContain('ALERGIA');
        expect(saida).not.toContain('Admissão (');
        expect(saida).not.toContain('Intercorrências 24h:');
        expect(saida).not.toContain('Exames de imagem relevantes:');
        expect(saida).not.toContain('Metabólico/Gaso:');
        expect(saida).not.toContain('Assinatura:');
    });

    it('lista de DVA vazia NÃO vira "Não" — afirmar negativa sem registro é inventar dado', () => {
        expect(saida).not.toContain('Uso:');
        expect(saida).not.toContain('Drogas Vasoativas');
    });

    it('conduta sem fonte NÃO EXISTE: nem seção, nem genérico de preenchimento', () => {
        expect(saida).not.toContain('Conduta estruturada por Sistemas:');
        expect(saida).not.toContain('Impressão:');
        expect(saida).not.toContain('conforme protocolo');
        expect(saida).not.toContain('otimizada');
    });

    it('sem SOFA calculado, a transparência ainda existe: 0/6 e os 6 sistemas faltando', () => {
        expect(saida).toContain('componentes capturados: 0/6');
        expect(saida).not.toContain('SOFA null');
    });
});

describe('montarEvolucao — SOFA parcial nunca finge total', () => {
    it('total incompleto sai "SOFA parcial", com X/6 e a lista do que falta', () => {
        const saida = montarEvolucao({...evolucaoMinima, sofa: SOFA_PARCIAL});
        expect(saida).toContain('SOFA parcial 2');
        expect(saida).toContain('componentes capturados: 2/6');
        expect(saida).toContain('Hepático: Bilirrubina total');
        expect(saida).not.toMatch(/SOFA \d+ \(/); // nunca um total entre parênteses de componentes
    });
});

// ---------------------------------------------------------------------------
// PASSAGEM — Formato A do arquivo 05
// ---------------------------------------------------------------------------

describe('montarPassagem — esqueleto do Formato A, por paciente', () => {
    const saida = montarPassagem([passagemCompleta]);

    it('seções na ordem exata do arquivo 05', () => {
        esperarOrdem(saida, [
            'PASSAGEM — Leito 07 UTI2 — 13/08/2026 noturna',
            '🏷️',
            '⚠️  Alergias: dipirona (rash cutâneo)',
            '📊 SOFA 7',
            'STATUS POR SISTEMA (pior valor 24h)',
            '🧠 NEURO',
            '🫁 RESP',
            '🫀 HEMO',
            '💧 RENAL',
            '🩸 HEMATO',
            '🦠 INFEC',
            'PONTOS DE ATENÇÃO',
            '🚨',
            'TAREFAS PENDENTES PRÓXIMO TURNO',
            '☐ ',
            'SE PIORAR',
        ]);
    });

    it('pior valor 24h: PAM mínima, FC máxima, SpO2 mínima — extraídos da janela', () => {
        expect(saida).toContain('PAM 56');
        expect(saida).toContain('FC 132');
        expect(saida).toContain('SpO2 89%');
    });

    it('DVAs em linha única, tendência em palavra, sem seta', () => {
        expect(saida).toContain('Noradrenalina 0,20 mcg/kg/min em desmame · Vasopressina 2 ml/h');
    });

    it('ATB só ATIVOS, com D-X vindo de vw_dias_atb_ativo (nunca calculado)', () => {
        expect(saida).toContain('Meropenem D-3 (pulmonar)');
        expect(saida).toContain('Linezolida D-5');
    });

    it('pendências: RENDER do array, checkbox por item, ordenado por prioridade', () => {
        const linhas = saida.split('\n').filter((l) => l.startsWith('☐ '));
        expect(linhas).toEqual([
            '☐ Gasometria de controle às 06h',
            '☐ Conferir hemoculturas de 12/08',
            '☐ Revisar RX de tórax com a radiologia',
        ]);
    });

    it('alertas: máximo 3, mesmo com 5 abertos', () => {
        expect(saida.split('🚨').length - 1).toBe(3);
        expect(saida).not.toContain('Quarto alerta');
    });

    it('gravidade do enum sai com acentuação completa', () => {
        expect(saida).toContain('gravidade: instável');
    });

    it('ΔSOFA é numérico com sinal, nunca seta', () => {
        expect(saida).toContain('ΔSOFA 24h: +2');
    });

    it('nada de SBAR nem Formato B (painel da unidade) — vetados pelo operador', () => {
        expect(saida).not.toContain('SBAR');
        expect(saida).not.toContain('Painel');
        expect(saida).not.toContain('TOP 5');
    });
});

describe('montarPassagem — ausência e omissões', () => {
    const saida = montarPassagem([passagemMinima]);

    it('SE PIORAR sem fonte é OMITIDO inteiro — plano de resgate não se inventa', () => {
        expect(saida).not.toContain('SE PIORAR');
    });

    it('sem alertas e sem pendências, as seções nem aparecem', () => {
        expect(saida).not.toContain('PONTOS DE ATENÇÃO');
        expect(saida).not.toContain('TAREFAS PENDENTES');
    });

    it('alergia sem fonte tem a linha omitida — nunca "nega" inventado', () => {
        expect(saida).not.toContain('Alergias');
        expect(saida).not.toContain('nega');
    });

    it('sistema sem nenhum dado sai "não avaliado"', () => {
        expect(saida).toContain('🩸 HEMATO  não avaliado');
    });

    it('SOFA ausente ainda carrega a transparência 0/6', () => {
        expect(saida).toContain('componentes capturados: 0/6');
    });
});

describe('montarPassagem — ordem e flags', () => {
    it('preserva a ordem da lista: quem chama já mandou o mais grave primeiro', () => {
        const saida = montarPassagem([passagemCompleta, passagemMinima]);
        expect(saida.indexOf('Paciente Sintético Alfa')).toBeLessThan(saida.indexOf('Paciente Sintético Beta'));
        const invertida = montarPassagem([passagemMinima, passagemCompleta]);
        expect(invertida.indexOf('Paciente Sintético Beta')).toBeLessThan(invertida.indexOf('Paciente Sintético Alfa'));
    });

    it('valor absurdo que ESTE arquivo compõe ganha a flag (revisar) — sinaliza, não corrige', () => {
        const saida = montarPassagem([
            {
                ...passagemMinima,
                janelas: [{tipo: 'pam', render: 'PAM 90-25', valor_max: 90, valor_min: 25}],
            },
        ]);
        expect(saida).toContain('PAM 25 (revisar)');
    });
});

// ---------------------------------------------------------------------------
// Proibições que valem para TODA saída (doutrina 00-estilo §3)
// ---------------------------------------------------------------------------

describe('setas proibidas — a única sobrevivente é "->" de série', () => {
    // A regex abaixo é o único lugar deste par de arquivos onde os glifos de
    // seta podem existir: ela é a guarda que prova a ausência deles na saída.
    const PROIBIDOS = /[↑↓]/;

    it('evolução completa e mínima saem limpas', () => {
        expect(montarEvolucao(evolucaoCompleta)).not.toMatch(PROIBIDOS);
        expect(montarEvolucao(evolucaoMinima)).not.toMatch(PROIBIDOS);
    });

    it('passagem completa e mínima saem limpas', () => {
        expect(montarPassagem([passagemCompleta])).not.toMatch(PROIBIDOS);
        expect(montarPassagem([passagemMinima])).not.toMatch(PROIBIDOS);
    });
});

// ---------------------------------------------------------------------------
// Helpers puros
// ---------------------------------------------------------------------------

describe('linhaVital — exibe o render pronto, nunca remonta', () => {
    it('devolve a linha do tipo pedido', () => {
        expect(linhaVital(JANELAS, 'pam')).toBe('PAM 90-56 (4/12 <65)');
    });
    it('tipo sem janela devolve null (fragmento é omitido)', () => {
        expect(linhaVital(JANELAS, 'temp')).toBeNull();
        expect(linhaVital([], 'pam')).toBeNull();
    });
});

describe('linhaDva — trata as DUAS formas do banco vivo', () => {
    it('texto puro e objeto rico na mesma lista, linha única com "·"', () => {
        expect(linhaDva(['Tridil 12 ml/h', {droga: 'Noradrenalina', vazao_mcg_h: 480}]))
            .toBe('Tridil 12 ml/h · Noradrenalina 480 mcg/h');
    });
    it('lista vazia devolve null — a linha some, não vira "Não"', () => {
        expect(linhaDva([])).toBeNull();
        expect(linhaDva(null)).toBeNull();
    });
});

describe('linhaAtbAtivo — D-X vem do banco, nunca de conta local', () => {
    it('com dias e foco', () => {
        expect(linhaAtbAtivo({droga: 'Meropenem', diasTerapia: 3, foco: 'pulmonar'})).toBe('Meropenem D-3 (pulmonar)');
    });
    it('sem dias informados, o D-X é omitido — nunca chutado', () => {
        expect(linhaAtbAtivo({droga: 'Meropenem', diasTerapia: null})).toBe('Meropenem');
    });
});

describe('checklistPendencias — render do array, ordenado por prioridade', () => {
    it('ordena 1, 2, 3 mantendo a redação original de cada tarefa', () => {
        expect(
            checklistPendencias([
                {tarefa: 'terceira', prioridade: 3},
                {tarefa: 'primeira', prioridade: 1},
                {tarefa: 'segunda', prioridade: 2},
            ]),
        ).toEqual(['☐ primeira', '☐ segunda', '☐ terceira']);
    });
    it('não muta a lista original', () => {
        const original = [
            {tarefa: 'b', prioridade: 2 as const},
            {tarefa: 'a', prioridade: 1 as const},
        ];
        checklistPendencias(original);
        expect(original[0]?.tarefa).toBe('b');
    });
});

describe('linhaSofa — transparência em todo cenário', () => {
    it('sem resultado nenhum: 0/6 e os 6 sistemas na lista', () => {
        const linha = linhaSofa(null);
        expect(linha).toContain('componentes capturados: 0/6');
        expect(linha).toContain('Respiratório');
        expect(linha).toContain('Renal');
    });
    it('completo: total + tupla dos 6 componentes', () => {
        expect(linhaSofa(SOFA_COMPLETO)).toContain('SOFA 7 (2, 1, 1, 1, 1, 1)');
    });
    it('delta zero sai "0", nunca seta nem palavra inventada', () => {
        expect(linhaSofa(SOFA_COMPLETO, 0)).toContain('ΔSOFA 24h: 0');
    });
});
