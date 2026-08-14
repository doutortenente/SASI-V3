import {describe, expect, it} from 'vitest';

import {UTIS} from '@/lib/constants/leitos';

import {
    direcao,
    foraDaNumeracao,
    LEITOS_POR_UTI,
    maxMin,
    num,
    numeroDoLeito,
    rotuloInfusao,
    SEM_DADO,
    txt,
    unidadeSegura,
} from './clinico';

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
        expect(rotuloInfusao({droga: 'Noradrenalina', dose: '0,3', unidade: 'Μg/kg/min'})).toBe(
            'Noradrenalina 0,3 mcg/kg/min',
        );
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
    // A regex abaixo é o ÚNICO lugar do src/ onde os glifos de seta podem
    // existir: é a guarda que prova que a saída nunca os contém.
    it('nunca devolve seta de subida nem de descida', () => {
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

describe('LEITOS_POR_UTI e foraDaNumeracao — capacidade vem da casa única', () => {
    it('UTI2 tem 13 leitos (palavra do operador, 08-ago-2026), UTI3 13, UTI4 8', () => {
        expect(LEITOS_POR_UTI.UTI2).toBe(13);
        expect(LEITOS_POR_UTI.UTI3).toBe(13);
        expect(LEITOS_POR_UTI.UTI4).toBe(8);
    });
    it('é DERIVADO de UTIS, não uma segunda cópia que pode apodrecer', () => {
        expect(LEITOS_POR_UTI.UTI2).toBe(UTIS.UTI2.length);
        expect(LEITOS_POR_UTI.UTI3).toBe(UTIS.UTI3.length);
        expect(LEITOS_POR_UTI.UTI4).toBe(UTIS.UTI4.length);
    });
    it('DEFEITO REAL guardado: UTI2-L13 tem paciente e NÃO é "fora da numeração"', () => {
        // A cópia à mão dizia UTI2=12 e o painel marcava esse leito como erro
        // de cadastro — o paciente era real, o número errado era o do código.
        expect(foraDaNumeracao('UTI2-L13', 'UTI2')).toBe(false);
    });
    it('leito além da capacidade ou ilegível continua sendo pego', () => {
        expect(foraDaNumeracao('UTI2-L14', 'UTI2')).toBe(true);
        expect(foraDaNumeracao('UTI4-L09', 'UTI4')).toBe(true);
        expect(foraDaNumeracao('UTI2-L00', 'UTI2')).toBe(true);
        expect(foraDaNumeracao('estranho', 'UTI2')).toBe(true);
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
