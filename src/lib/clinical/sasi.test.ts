import {describe, expect, it} from 'vitest';
import {
    acuidadeDe,
    diasTerapia,
    imc,
    semaforoDe,
    semaforoDivergente,
    severidadeVisualDe,
    stewardshipFlag,
    triagem,
    triagemDeLeitos,
} from './sasi';

describe('imc', () => {
    it('calcula IMC igual à coluna gerada no banco (peso 80kg, 175cm → 26.1)', () => {
        expect(imc(80, 175)).toBe(26.1);
    });
    it('dado ausente → null, nunca inventado', () => {
        expect(imc(null, 175)).toBeNull();
        expect(imc(80, null)).toBeNull();
    });
});

describe('severidadeVisualDe (enum pós-P0: estavel|watcher|instavel|critico)', () => {
    it('critico e instavel → red', () => {
        expect(severidadeVisualDe('critico')).toBe('red');
        expect(severidadeVisualDe('instavel')).toBe('red');
    });
    it('watcher → yellow, estavel → green', () => {
        expect(severidadeVisualDe('watcher')).toBe('yellow');
        expect(severidadeVisualDe('estavel')).toBe('green');
    });
    it('BUG CLÍNICO guardado: watcher e instavel NUNCA caem em verde', () => {
        // A versão anterior chaveava o enum velho (grave/moderado) e os valores
        // novos caíam no default — paciente instável pintado de verde no painel.
        expect(severidadeVisualDe('watcher')).not.toBe('green');
        expect(severidadeVisualDe('instavel')).not.toBe('green');
    });
});

describe('acuidadeDe', () => {
    const base = {
        severidade_visual: 'green' as const,
        delta_sofa_24h: 0,
        out_of_range_count: 0,
        pendencias_abertas: 0,
    };
    it('semáforo red → CRITICO, independente do resto', () => {
        expect(acuidadeDe({...base, severidade_visual: 'red'})).toBe('CRITICO');
    });
    it('ΔSOFA≥2 → INSTAVEL (Sepsis-3: piora de 2 pontos define disfunção)', () => {
        expect(acuidadeDe({...base, delta_sofa_24h: 2})).toBe('INSTAVEL');
    });
    it('≥3 valores fora de faixa → INSTAVEL', () => {
        expect(acuidadeDe({...base, out_of_range_count: 3})).toBe('INSTAVEL');
    });
    it('tudo normal → ESTAVEL', () => {
        expect(acuidadeDe(base)).toBe('ESTAVEL');
    });
    it('status_leito=obito → OBITO, nunca ESTAVEL (óbito saiu do enum de gravidade)', () => {
        expect(acuidadeDe({...base, status_leito: 'obito'})).toBe('OBITO');
    });
});

describe('triagem', () => {
    it('ordena mais grave primeiro (base do War Room)', () => {
        const rows = [
            {severidade_visual: 'green', delta_sofa_24h: 0, out_of_range_count: 0, pendencias_abertas: 0},
            {severidade_visual: 'red', delta_sofa_24h: 0, out_of_range_count: 0, pendencias_abertas: 0},
            {severidade_visual: 'yellow', delta_sofa_24h: 0, out_of_range_count: 1, pendencias_abertas: 0},
        ] as const;
        const ordenado = triagem([...rows]);
        expect(ordenado.map((r) => r.acuidade)).toEqual(['CRITICO', 'VIGILANCIA', 'ESTAVEL']);
    });
});

describe('semáforo exibido (a tela não confia na coluna severidade_visual)', () => {
    // Caso REAL do banco vivo, medido em 08-ago-2026: UTI2-L13, paciente crítico
    // com severidade_visual='green'. Sem esta regra, o War Room pinta ele de verde.
    const criticoPintadoDeVerde = {gravidade: 'critico', severidade_visual: 'green'} as const;

    it('deriva o semáforo da gravidade, ignorando a coluna em desacordo', () => {
        expect(semaforoDe(criticoPintadoDeVerde)).toBe('red');
    });

    it('sinaliza o desacordo em vez de escondê-lo', () => {
        expect(semaforoDivergente(criticoPintadoDeVerde)).toBe(true);
    });

    it('coluna de acordo com a gravidade não é sinalizada', () => {
        expect(semaforoDivergente({gravidade: 'instavel', severidade_visual: 'red'})).toBe(false);
        expect(semaforoDivergente({gravidade: 'estavel', severidade_visual: 'green'})).toBe(false);
    });
});

describe('triagemDeLeitos', () => {
    const linha = (
        leito: string,
        gravidade: 'critico' | 'instavel' | 'watcher' | 'estavel',
        severidade_visual: 'red' | 'yellow' | 'green',
    ) => ({
        leito,
        gravidade,
        severidade_visual,
        delta_sofa_24h: 0,
        out_of_range_count: 0,
        pendencias_abertas: 0,
    });

    it('o crítico pintado de verde no banco ranqueia como CRITICO, não como ESTAVEL', () => {
        const triados = triagemDeLeitos([linha('UTI2-L13', 'critico', 'green')]);
        expect(triados).toHaveLength(1);
        expect(triados[0]?.acuidade).toBe('CRITICO');
        expect(triados[0]?.semaforo).toBe('red');
        expect(triados[0]?.divergenciaDeSemaforo).toBe(true);
    });

    it('watcher e instavel do banco pós-P0 não viram verde nem ESTAVEL', () => {
        // O defeito real: o enum velho no código fazia esses dois caírem no
        // default e o paciente instável aparecia verde na tela de comando.
        const triados = triagemDeLeitos([
            linha('UTI3-L01', 'watcher', 'green'), // coluna mente; gravidade manda
            linha('UTI3-L02', 'instavel', 'green'),
        ]);
        const porLeito = Object.fromEntries(triados.map((t) => [t.leito, t]));
        expect(porLeito['UTI3-L01']?.semaforo).toBe('yellow');
        expect(porLeito['UTI3-L01']?.acuidade).toBe('VIGILANCIA');
        expect(porLeito['UTI3-L02']?.semaforo).toBe('red');
        expect(porLeito['UTI3-L02']?.acuidade).toBe('CRITICO');
    });

    it('ordena mais grave primeiro mesmo quando a coluna do banco mente', () => {
        const ordenado = triagemDeLeitos([
            linha('UTI2-L05', 'estavel', 'green'),
            linha('UTI2-L13', 'critico', 'green'), // coluna diz verde; gravidade diz crítico
            linha('UTI2-L01', 'watcher', 'yellow'),
        ]);
        expect(ordenado.map((r) => r.leito)).toEqual(['UTI2-L13', 'UTI2-L01', 'UTI2-L05']);
    });

    it('empate de acuidade desempata por leito, para a grade não dançar entre carregamentos', () => {
        const ordenado = triagemDeLeitos([
            linha('UTI2-L12', 'instavel', 'red'),
            linha('UTI2-L02', 'instavel', 'red'),
            linha('UTI2-L06', 'instavel', 'red'),
        ]);
        expect(ordenado.map((r) => r.leito)).toEqual(['UTI2-L02', 'UTI2-L06', 'UTI2-L12']);
    });
});

describe('stewardship de ATB', () => {
    it('D1 conta como dia 1 (não dia 0)', () => {
        expect(diasTerapia('2026-08-01', '2026-08-01')).toBe(1);
    });
    it('D7 → warning, D14 → critical (janela de revisão de antibiótico)', () => {
        expect(stewardshipFlag(diasTerapia('2026-08-01', '2026-08-07'))).toBe('warning');
        expect(stewardshipFlag(diasTerapia('2026-08-01', '2026-08-14'))).toBe('critical');
        expect(stewardshipFlag(3)).toBe('ok');
    });
});
