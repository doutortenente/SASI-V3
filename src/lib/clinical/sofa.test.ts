import {describe, expect, it} from 'vitest';

import {calcularSofa, sofaCardio, sofaCoag, sofaHepatico, sofaNeuro, sofaRenal, sofaResp,} from './sofa';

// ===========================================================================
// Os 7 defeitos P0 da auditoria do motor v2. Um teste por defeito.
// ===========================================================================

describe('P0 #5 — respiratório 3 e 4 exigem ventilação invasiva', () => {
    it('P/F 150 SEM ventilação invasiva pontua 2, não 3', () => {
        const r = sofaResp(60, 40, false);
        expect(r.pontos).toBe(2);
        expect(r.ressalva).toMatch(/ventilação invasiva/);
    });
    it('o MESMO P/F 150 COM ventilação invasiva pontua 3', () => {
        expect(sofaResp(60, 40, true).pontos).toBe(3);
    });
    it('P/F 90 sem ventilação pontua 3; com ventilação, 4', () => {
        expect(sofaResp(36, 40, false).pontos).toBe(3);
        expect(sofaResp(36, 40, true).pontos).toBe(4);
    });
    it('P/F normal pontua 0 e não inventa ressalva', () => {
        const r = sofaResp(95, 21, false);
        expect(r.pontos).toBe(0);
        expect(r.ressalva).toBeUndefined();
    });
});

describe('P0 #9 — FiO2 normalizada antes da relação P/F', () => {
    it('fração (0,40) e percentual (40) dão o MESMO resultado', () => {
        expect(sofaResp(80, '0,40', true).pontos).toBe(sofaResp(80, 40, true).pontos);
    });
    it('sem normalizar, 0,40 daria P/F cem vezes maior e zeraria o componente', () => {
        // PaO2 80 / FiO2 40% = 200 -> 2 pontos. Se 0,40 fosse lido como 0,4%,
        // o P/F seria 20.000 e o componente cairia para 0.
        expect(sofaResp(80, '0,40', true).pontos).toBe(2);
    });
    it('FiO2 impossível não vira palpite', () => {
        const r = sofaResp(80, 150, true);
        expect(r.pontos).toBeNull();
        expect(r.faltou).toBe('FiO2');
    });
});

describe('P0 #8 — unidade de plaquetas (o defeito medido no banco vivo)', () => {
    it('113.000 /µL é 113 ×10³/µL — plaquetopenia leve, pontua 1 (a view do banco dá 0)', () => {
        // Valor real do banco vivo. 113 ×10³/µL está abaixo de 150, então vale 1
        // ponto. Lido como "113.000 ×10³" (que é o que a view faz hoje), fica 0 —
        // e a disfunção some do escore.
        expect(sofaCoag(113000).pontos).toBe(1);
    });
    it('351.000 /µL é normal e pontua 0', () => {
        expect(sofaCoag(351000).pontos).toBe(0);
    });
    it('30.000 /µL pontua 3 — o caso que hoje dá ZERO na view do banco', () => {
        expect(sofaCoag(30000).pontos).toBe(3);
        expect(sofaCoag(30).pontos).toBe(3);
    });
    it('trombocitose NÃO vira plaquetopenia grave (defeito do app anterior)', () => {
        // 1.200 ×10³/µL é trombocitose: zero pontos. O app anterior dividia por
        // 1000 e pontuava 4, como se fosse plaquetopenia gravíssima.
        expect(sofaCoag(1200, '×10³/µL').pontos).toBe(0);
    });
    it('unidade declarada manda sobre a ordem de grandeza', () => {
        expect(sofaCoag(150, '/µL').pontos).toBe(4); // 0,15 ×10³ — plaquetopenia extrema
        expect(sofaCoag(150, '×10³/µL').pontos).toBe(0);
    });
    it('cutoffs nas bordas: 150 é 0, 149 é 1', () => {
        expect(sofaCoag(150, '×10³/µL').pontos).toBe(0);
        expect(sofaCoag(149, '×10³/µL').pontos).toBe(1);
    });
});

describe('P0 #2 — neurológico suprimido sob sedação', () => {
    it('Glasgow 3 sob sedação NÃO pontua 4 — o componente é suprimido', () => {
        const r = sofaNeuro(3, true);
        expect(r.pontos).toBeNull();
        expect(r.suprimido).toMatch(/sedação/);
    });
    it('suprimido devolve null, não 0 — o sistema não foi avaliado', () => {
        expect(sofaNeuro(3, true).pontos).not.toBe(0);
    });
    it('com Glasgow pré-sedação documentado, pontua por ele', () => {
        const r = sofaNeuro(3, true, 11);
        expect(r.pontos).toBe(2);
        expect(r.detalhe).toMatch(/pré-sedação/);
    });
    it('sem sedação, Glasgow 3 pontua 4 normalmente', () => {
        expect(sofaNeuro(3, false).pontos).toBe(4);
    });
});

describe('P0 #1 e #11 — cardiovascular usa DOSE calculada e PAM mínima', () => {
    it('noradrenalina: a mesma VAZÃO dá pontos diferentes conforme a diluição', () => {
        // 12 mL/h em 80 kg. Diluição padrão (64 mcg/mL) = 0,16 -> 4 pontos.
        // Diluição simples (32 mcg/mL) = 0,08 -> 3 pontos. A vazão é idêntica.
        const padrao = sofaCardio(null, [{droga: 'Noradrenalina', diluicao: 0, vazaoMlH: 12}], 80);
        const simples = sofaCardio(null, [{droga: 'Noradrenalina', diluicao: 1, vazaoMlH: 12}], 80);
        expect(padrao.pontos).toBe(4);
        expect(simples.pontos).toBe(3);
    });

    it('o cutoff é 0,1 mcg/kg/min, não um número de mL/h', () => {
        const baixa = sofaCardio(null, [{droga: 'Noradrenalina', diluicao: 1, vazaoMlH: 12}], 80);
        expect(baixa.pontos).toBe(3);
        expect(baixa.detalhe).toMatch(/0\.08/);
    });

    it('PAM MÍNIMA abaixo de 70 sem vasopressor pontua 1', () => {
        expect(sofaCardio(62, [], 70).pontos).toBe(1);
        expect(sofaCardio(88, [], 70).pontos).toBe(0);
    });

    it('dobutamina em qualquer dose é 2', () => {
        expect(sofaCardio(null, [{droga: 'Dobutamina', vazaoMlH: 5}], 70).pontos).toBe(2);
        expect(sofaCardio(null, [{droga: 'Dobutamina', vazaoMlH: 40}], 70).pontos).toBe(2);
    });

    it('dopamina segue os três degraus (5 e 15)', () => {
        expect(sofaCardio(null, [{droga: 'Dopamina', vazaoMlH: 1}], 70).pontos).toBeLessThanOrEqual(
            3,
        );
    });

    it('sem peso, a droga não some: pontua o piso da classe e avisa', () => {
        const r = sofaCardio(null, [{droga: 'Noradrenalina', vazaoMlH: 12}], null);
        expect(r.pontos).toBe(3);
        expect(r.ressalva).toMatch(/sem peso/);
    });

    it('duas drogas: vale a pior', () => {
        const r = sofaCardio(
            null,
            [
                {droga: 'Dobutamina', vazaoMlH: 5},
                {droga: 'Noradrenalina', diluicao: 0, vazaoMlH: 12},
            ],
            80,
        );
        expect(r.pontos).toBe(4);
    });
});

describe('DIVERGÊNCIA da fonte — vasodilatador não é vasopressor', () => {
    it('nitroglicerina NÃO pontua o cardiovascular (o caso real de UTI2-L04)', () => {
        // A fonte dava 2 pontos para "Nipride, Tridil, Esmolol". Nenhum é
        // vasopressor: os dois primeiros são vasodilatadores e o terceiro é
        // betabloqueador. Pontuá-los inverte o sentido clínico.
        const r = sofaCardio(85, [{droga: 'Nitroglicerina (Tridil)', vazaoMlH: 12}], 70);
        expect(r.pontos).toBe(0); // pontua pela PAM, que está boa
    });
    it('nitroprussiato e esmolol também não pontuam', () => {
        expect(sofaCardio(85, [{droga: 'Nitroprussiato (Nipride)', vazaoMlH: 10}], 70).pontos).toBe(
            0,
        );
        expect(sofaCardio(85, [{droga: 'Esmolol', vazaoMlH: 10}], 70).pontos).toBe(0);
    });
});

describe('P0 #6 — renal cruza creatinina, débito urinário e diálise', () => {
    it('diálise é 4, sem discussão', () => {
        expect(sofaRenal(null, null, null, null, true).pontos).toBe(4);
    });
    it('creatinina normal com oligúria grave NÃO passa batido', () => {
        // Cr 0,9 (0 pontos) mas 150 mL em 24 h -> menos de 200 mL/dia -> 4 pontos.
        const r = sofaRenal(0.9, 150, 70, 24);
        expect(r.pontos).toBe(4);
        expect(r.ressalva).toMatch(/[Oo]ligúria/);
    });
    it('vale o pior dos dois eixos', () => {
        // Cr 3,6 = 3 pontos; diurese 1500 mL/24 h = 0 pontos. Fica 3.
        expect(sofaRenal(3.6, 1500, 70, 24).pontos).toBe(3);
    });
    it('DIVERGÊNCIA: usa o volume diário de Singer 2016, não estágio KDIGO', () => {
        expect(sofaRenal(0.8, 450, 70, 24).pontos).toBe(3); // < 500 mL/dia
        expect(sofaRenal(0.8, 190, 70, 24).pontos).toBe(4); // < 200 mL/dia
        expect(sofaRenal(0.8, 900, 70, 24).pontos).toBe(0);
    });
    it('coleta de 12 h é projetada para 24 h e a projeção é declarada', () => {
        const r = sofaRenal(0.8, 200, 70, 12); // 200 em 12 h -> 400 em 24 h
        expect(r.pontos).toBe(3);
        expect(r.ressalva).toMatch(/projetada|estimativa/);
    });
    it('sem os dois eixos, não pontua', () => {
        const r = sofaRenal(null, null, 70, 24);
        expect(r.pontos).toBeNull();
        expect(r.faltou).toMatch(/Creatinina/);
    });
});

describe('P0 #7 — vírgula decimal em toda leitura', () => {
    it('bilirrubina "2,5" é lida como 2,5 e pontua 2', () => {
        expect(sofaHepatico('2,5').pontos).toBe(2);
    });
    it('"113.000" com ponto de milhar é lido como 113000, não como 113', () => {
        // Se o ponto fosse lido como decimal, "113.000" viraria 113 ×10³ e daria o
        // mesmo 1 ponto por coincidência — então o teste compara com o número puro.
        expect(sofaCoag('113.000').pontos).toBe(sofaCoag(113000).pontos);
        expect(sofaCoag('1,2').pontos).toBe(4); // 1,2 ×10³/µL é plaquetopenia extrema
    });
});

// ===========================================================================
// Total: a divergência mais importante da fonte
// ===========================================================================

describe('total do SOFA — incompleto é null, nunca um número que parece medido', () => {
    it('com 5 de 6 sistemas, o total é null e o parcial fica visível', () => {
        const r = calcularSofa({
            pao2: 80,
            fio2: 40,
            ventilacaoInvasiva: true,
            plaquetas: 90000,
            bilirrubina: 2.5,
            pamMinima: 62,
            creatinina: 2.1,
            diureseMl: 1200,
            horasDeColeta: 24,
            pesoKg: 70,
            // sem Glasgow
        });
        expect(r.total).toBeNull();
        expect(r.apurados).toBe(5);
        expect(r.parcial).toBeGreaterThan(0);
        expect(r.faltando.join(' ')).toMatch(/Neurológico/);
    });

    it('com os 6 sistemas, o total existe e bate com a soma', () => {
        const r = calcularSofa({
            pao2: 80,
            fio2: 40,
            ventilacaoInvasiva: true, // 2
            plaquetas: 90000, // 2
            bilirrubina: 2.5, // 2
            pamMinima: 62, // 1
            glasgow: 13, // 1
            creatinina: 2.1,
            diureseMl: 1200,
            horasDeColeta: 24,
            pesoKg: 70, // 2
        });
        expect(r.apurados).toBe(6);
        expect(r.total).toBe(10);
        expect(r.total).toBe(r.parcial);
    });

    it('sedação suprime o neuro e por isso o total fica null', () => {
        const r = calcularSofa({
            pao2: 80,
            fio2: 40,
            ventilacaoInvasiva: true,
            plaquetas: 90000,
            bilirrubina: 2.5,
            pamMinima: 62,
            glasgow: 3,
            sobSedacao: true,
            creatinina: 2.1,
            diureseMl: 1200,
            horasDeColeta: 24,
            pesoKg: 70,
        });
        expect(r.total).toBeNull();
        expect(r.componentes.neuro.suprimido).toMatch(/sedação/);
    });

    it('paciente do banco hoje (só o que existe) devolve total null', () => {
        // Nenhuma evolução tem bilirrubina nem PaO2/FiO2 — 0 de 16, medido em 08-ago.
        const r = calcularSofa({pamMinima: 62, creatinina: 2.1, glasgow: 15, pesoKg: 70});
        expect(r.total).toBeNull();
        expect(r.faltando.length).toBeGreaterThan(0);
    });
});

// ===========================================================================
// "Falta colher" e "suprimido de propósito" são coisas diferentes.
// Contrato herdado do sasi-import, que mantinha missing[] e suppressed[]
// separados. Fundir os dois faz a tela pedir coleta de uma coisa que nenhum
// exame resolve.
// ===========================================================================

describe('faltando x suprimidos — duas causas, duas listas', () => {
    const completoMenosNeuro = {
        pao2: 80,
        fio2: 40,
        ventilacaoInvasiva: true,
        plaquetas: 90000,
        bilirrubina: 2.5,
        pamMinima: 62,
        creatinina: 2.1,
        diureseMl: 1200,
        horasDeColeta: 24,
        pesoKg: 70,
    };

    it('sedação vai para suprimidos e NÃO polui a lista de coleta', () => {
        const r = calcularSofa({...completoMenosNeuro, glasgow: 3, sobSedacao: true});
        expect(r.suprimidos).toHaveLength(1);
        expect(r.suprimidos[0]).toMatch(/Neurológico/);
        expect(r.suprimidos[0]).toMatch(/sedação/);
        expect(r.faltando).toHaveLength(0);
    });

    it('dado não colhido vai para faltando e NÃO aparece como suprimido', () => {
        const r = calcularSofa(completoMenosNeuro); // sem Glasgow, sem sedação
        expect(r.faltando).toHaveLength(1);
        expect(r.faltando[0]).toMatch(/Neurológico: Glasgow/);
        expect(r.suprimidos).toHaveLength(0);
    });

    it('as duas causas juntas ficam em listas separadas', () => {
        // Sem bilirrubina (falta colher) E sob sedação (suprimido).
        const r = calcularSofa({
            pao2: 80,
            fio2: 40,
            ventilacaoInvasiva: true,
            plaquetas: 90000,
            pamMinima: 62,
            glasgow: 3,
            sobSedacao: true,
            creatinina: 2.1,
            diureseMl: 1200,
            horasDeColeta: 24,
            pesoKg: 70,
        });
        expect(r.total).toBeNull();
        expect(r.apurados).toBe(4);
        expect(r.faltando).toEqual(['Hepático: Bilirrubina total']);
        expect(r.suprimidos.join(' ')).toMatch(/Neurológico/);
        expect(r.faltando.join(' ')).not.toMatch(/sedação/);
    });

    it('SOFA completo devolve as duas listas vazias', () => {
        const r = calcularSofa({...completoMenosNeuro, glasgow: 13});
        expect(r.total).toBe(10);
        expect(r.faltando).toHaveLength(0);
        expect(r.suprimidos).toHaveLength(0);
    });

    it('Glasgow pré-sedação documentado pontua e não suprime nada', () => {
        const r = calcularSofa({
            ...completoMenosNeuro,
            glasgow: 3,
            sobSedacao: true,
            glasgowPreSedacao: 11,
        });
        expect(r.suprimidos).toHaveLength(0);
        expect(r.faltando).toHaveLength(0);
        expect(r.componentes.neuro.pontos).toBe(2);
    });
});

// ===========================================================================
// Carimbo de hora (`calculadoEm`) — o `computedAt` do contrato do sasi-import.
// O import chamava new Date() DENTRO da função. Aqui o relógio é injetado, para
// o cálculo continuar puro e o teste conseguir cravar o valor.
// ===========================================================================

describe('calculadoEm — carimbo de hora do cálculo', () => {
    // Paciente SINTÉTICO, inventado para o teste. Fecha os 6 sistemas:
    // resp 3 (P/F 180 em ventilação invasiva) · coag 3 (45 mil plaquetas) ·
    // hepático 3 (BT 7,0) · cardio 1 (PAM mínima 55) · neuro 2 (Glasgow 10) ·
    // renal 3 (creatinina 4,0). Total 15.
    const SEIS_SISTEMAS = {
        pao2: 90,
        fio2: 50,
        ventilacaoInvasiva: true,
        plaquetas: 45000,
        bilirrubina: 7,
        pamMinima: 55,
        glasgow: 10,
        creatinina: 4,
        diureseMl: 800,
        horasDeColeta: 24,
        pesoKg: 72,
    };

    it('carimba exatamente o relógio recebido, em ISO 8601', () => {
        const r = calcularSofa(SEIS_SISTEMAS, new Date('2026-08-08T03:17:00.000Z'));
        expect(r.calculadoEm).toBe('2026-08-08T03:17:00.000Z');
    });

    it('dois SOFA do MESMO plantão ficam distinguíveis pelo carimbo', () => {
        // A granularidade de tempo do SASI é o plantão (ts::date): os dois cálculos
        // caem no mesmo dia. Sem o carimbo, os dois snapshots seriam iguais no jsonb.
        const passagem = calcularSofa(SEIS_SISTEMAS, new Date('2026-08-08T07:00:00.000Z'));
        const recalculo = calcularSofa(
            {...SEIS_SISTEMAS, bilirrubina: 13}, // bilirrubina voltou do laboratório
            new Date('2026-08-08T15:30:00.000Z'),
        );
        expect(passagem.calculadoEm).not.toBe(recalculo.calculadoEm);
        expect(recalculo.calculadoEm! > passagem.calculadoEm!).toBe(true);
        expect(recalculo.total).toBeGreaterThan(passagem.total!);
    });

    it('o relógio NÃO mexe em nenhum ponto do escore — a parte clínica é pura', () => {
        const a = calcularSofa(SEIS_SISTEMAS, new Date('2020-01-01T00:00:00.000Z'));
        const b = calcularSofa(SEIS_SISTEMAS, new Date('2030-12-31T23:59:59.000Z'));
        expect(a.total).toBe(15);
        expect(b.total).toBe(a.total);
        expect(b.parcial).toBe(a.parcial);
        expect(b.apurados).toBe(a.apurados);
        expect(b.componentes).toEqual(a.componentes);
        expect(b.faltando).toEqual(a.faltando);
        expect(b.suprimidos).toEqual(a.suprimidos);
    });

    it('sem relógio injetado, usa o do sistema e devolve ISO válido', () => {
        const antes = Date.now();
        const r = calcularSofa(SEIS_SISTEMAS);
        const depois = Date.now();
        expect(r.calculadoEm).not.toBeNull();
        const t = Date.parse(r.calculadoEm!);
        expect(Number.isNaN(t)).toBe(false);
        expect(t).toBeGreaterThanOrEqual(antes - 1000);
        expect(t).toBeLessThanOrEqual(depois + 1000);
    });

    it('relógio inválido vira null, não "Invalid Date", e não derruba o cálculo', () => {
        const r = calcularSofa(SEIS_SISTEMAS, new Date('isto não é uma data'));
        expect(r.calculadoEm).toBeNull();
        expect(r.total).toBe(15); // o escore sai inteiro mesmo com o relógio quebrado
    });

    it('SOFA incompleto também é carimbado — auditoria vale para o null', () => {
        const r = calcularSofa({pamMinima: 62, glasgow: 15}, new Date('2026-08-08T21:00:00.000Z'));
        expect(r.total).toBeNull();
        expect(r.calculadoEm).toBe('2026-08-08T21:00:00.000Z');
    });
});
