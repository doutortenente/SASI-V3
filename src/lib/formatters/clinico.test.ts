import {describe, expect, it} from 'vitest';

import {direcao, maxMin, num, numeroDoLeito, rotuloInfusao, SEM_DADO, txt, unidadeSegura,} from './clinico';

describe('txt — dado ausente é ausente', () => {
    it('null e undefined viram travessão, nunca 0 nem vazio', () => {
        expect(txt(null)).toBe(SEM_DADO);
        expect(txt(undefined)).toBe(SEM_DADO);
        expect(txt('')).toBe(SEM_DADO);
        expect(txt('   ')).toBe(SEM_DADO);
    });
    it('zero é um VALOR MEDIDO e é exibido — não confundir com ausente', () => {
        expect(txt(0)).toBe('0');
    });
    it('NaN não vira "NaN" na tela do médico', () => {
        expect(txt(Number.NaN)).toBe(SEM_DADO);
    });
});

describe('unidadeSegura — incidente real da noradrenalina 1000× maior', () => {
    it('Μ MAIÚSCULO (mi grego, U+039C) — o culpado do incidente — vira mcg', () => {
        expect(unidadeSegura('Μg/kg/min')).toBe('mcg/kg/min');
    });
    it('µ (micro, U+00B5) e μ (mi minúsculo, U+03BC) também viram mcg', () => {
        expect(unidadeSegura('µg/kg/min')).toBe('mcg/kg/min');
        expect(unidadeSegura('μg/kg/min')).toBe('mcg/kg/min');
    });
    it('"ug" digitado por quem não acha o µ no teclado vira mcg', () => {
        expect(unidadeSegura('ug')).toBe('mcg');
    });
    it('unidade que já está segura não é mexida', () => {
        expect(unidadeSegura('mg/h')).toBe('mg/h');
        expect(unidadeSegura('mcg/kg/min')).toBe('mcg/kg/min');
    });
    it('nenhum µ sobra na saída, em nenhuma variante', () => {
        for (const u of ['µg/h', 'μg/h', 'Μg/h', 'µ', 'Μ']) {
            expect(unidadeSegura(u)).not.toMatch(/[µμΜ]/);
        }
    });
});

describe('maxMin — sinal vital sempre Máx–Mín', () => {
    it('SpO2 na ordem certa: maior primeiro', () => {
        expect(maxMin(98, 89, '%')).toBe('98–89%');
    });
    it('um lado ausente ainda mostra o outro, com travessão no que falta', () => {
        expect(maxMin(120, null)).toBe(`120–${SEM_DADO}`);
    });
    it('os dois ausentes viram um travessão só, não "—–—"', () => {
        expect(maxMin(null, null)).toBe(SEM_DADO);
    });
});

describe('rotuloInfusao — a dose nunca desaparece', () => {
    it('vazão em mcg/h é mostrada', () => {
        expect(rotuloInfusao({droga: 'Noradrenalina', vazao_mcg_h: 480})).toBe('Noradrenalina 480 mcg/h');
    });
    it('forma simples com unidade insegura é normalizada', () => {
        expect(rotuloInfusao({droga: 'Noradrenalina', dose: '0,3', unidade: 'Μg/kg/min'}))
            .toBe('Noradrenalina 0,3 mcg/kg/min');
    });
    it('sem dose nenhuma, mostra travessão — não omite a droga nem inventa dose', () => {
        expect(rotuloInfusao({droga: 'Fentanil'})).toBe(`Fentanil ${SEM_DADO}`);
    });
});

describe('rotuloInfusao — forma TEXTO, que é o que o banco vivo tem', () => {
    // Valores reais lidos de vw_dashboard_uti em 08-ago-2026. Tipar dvas só como
    // objeto fez a tela descartar 100% das drogas vasoativas em silêncio.
    it('texto puro passa adiante inteiro, com a dose', () => {
        expect(rotuloInfusao('Tridil 12 ml/h')).toBe('Tridil 12 ml/h');
        expect(rotuloInfusao('Dobutamina 5 ml/h')).toBe('Dobutamina 5 ml/h');
    });
    it('droga suspensa não é convertida em droga ativa nem perde o "suspensa"', () => {
        expect(rotuloInfusao('Noradrenalina suspensa')).toBe('Noradrenalina suspensa');
        expect(rotuloInfusao('Noradrenalina suspensa ~02h')).toBe('Noradrenalina suspensa ~02h');
    });
    it('unidade insegura dentro do texto também é normalizada', () => {
        expect(rotuloInfusao('Noradrenalina 0,3 Μg/kg/min')).toBe('Noradrenalina 0,3 mcg/kg/min');
    });
    it('texto vazio vira travessão, não string vazia', () => {
        expect(rotuloInfusao('   ')).toBe(SEM_DADO);
    });
});

describe('direcao — palavra, nunca seta', () => {
    it('nunca devolve ↑ nem ↓', () => {
        for (const d of [3, -3, 0, null]) {
            expect(direcao(d)).not.toMatch(/[↑↓]/);
        }
    });
    it('sobe, desce e estável em palavra', () => {
        expect(direcao(2)).toBe('subindo');
        expect(direcao(-2)).toBe('em queda');
        expect(direcao(0)).toBe('estável');
    });
    it('sem medida não inventa direção', () => {
        expect(direcao(null)).toBe(SEM_DADO);
    });
});

describe('num e numeroDoLeito', () => {
    it('número usa vírgula decimal (pt-BR)', () => {
        expect(num(26.1, 1)).toBe('26,1');
    });
    it('leito UTI#-L## vira só o L##', () => {
        expect(numeroDoLeito('UTI2-L07')).toBe('L07');
        expect(numeroDoLeito('estranho')).toBe('estranho');
    });
});
