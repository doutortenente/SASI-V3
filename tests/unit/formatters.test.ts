// Testes dos formatadores portados do SASI v2 (br.ts, tempo.ts) e da constante de leitos.
// Cobertura mínima exigida pela missão de porte: null -> travessão, grafia segura de
// micro/Mu grego, e o padrão canônico de leito.
import {describe, expect, it} from 'vitest';
import {comUnidade, num, unidadeSegura} from '@/lib/formatters/br';
import {formatarLeito} from '@/lib/constants/leitos';

describe('num', () => {
    it('valor ausente (null) vira travessão, nunca 0 inventado', () => {
        expect(num(null)).toBe('—');
        expect(num(undefined)).toBe('—');
    });
    it('formata em pt-BR (vírgula decimal)', () => {
        expect(num(1.5)).toBe('1,5');
    });
});

describe('unidadeSegura', () => {
    it('µ latino (U+00B5) + g vira "mcg" — evita "µg" virar "Μg" (Mu grego) sob uppercase', () => {
        expect(unidadeSegura('µg/kg/min')).toBe('mcg/kg/min');
    });
    it('μ grego (U+03BC) + g também vira "mcg"', () => {
        expect(unidadeSegura('μg')).toBe('mcg');
    });
});

describe('comUnidade', () => {
    it('valor ausente (null) vira travessão, sem unidade solta', () => {
        expect(comUnidade(null, 'µg/kg/min')).toBe('—');
    });
    it('junta valor + unidade com grafia segura', () => {
        expect(comUnidade(0.04, 'µg/kg/min')).toBe('0.04 mcg/kg/min');
    });
});

describe('formatarLeito', () => {
    it('produz o padrão canônico UTI#-L## (UTI2, leito 1 -> UTI2-L01)', () => {
        expect(formatarLeito('UTI2', 1)).toBe('UTI2-L01');
    });
});
