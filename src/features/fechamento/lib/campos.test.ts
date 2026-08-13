/**
 * Testes do mapa de campos da ficha.
 *
 * Estes testes existem porque o jsonb do banco NÃO reclama de chave errada:
 * `spo2_mim` digitado no descritor gravaria um campo que a nota nunca lê, e o
 * defeito só apareceria semanas depois, num texto sem SpO2. Aqui a doutrina
 * vira asserção: par Máx–Mín completo, SpO2 incluso, chave única.
 */
import {describe, expect, it} from 'vitest';

import {
    CHAVES_SISTEMAS,
    PAINEIS_DOS_SISTEMAS,
    camposDoSistema,
    painelDoSistema,
} from '@/features/fechamento/lib/campos';

describe('PAINEIS_DOS_SISTEMAS', () => {
    it('cobre os 7 sistemas de `evolucoes`, sem sobra nem falta', () => {
        expect(PAINEIS_DOS_SISTEMAS.map((p) => p.chave)).toEqual([...CHAVES_SISTEMAS]);
    });

    it('não repete chave dentro de um sistema (chave repetida some no mapa da edição)', () => {
        for (const painel of PAINEIS_DOS_SISTEMAS) {
            const chaves = painel.campos.map((c) => c.chave);
            expect(new Set(chaves).size).toBe(chaves.length);
        }
    });

    it('todo Máx tem o seu Mín, e vice-versa — a regra Máx–Mín da casa', () => {
        for (const painel of PAINEIS_DOS_SISTEMAS) {
            const chaves = new Set(painel.campos.map((c) => c.chave));
            for (const chave of chaves) {
                if (chave.endsWith('_max')) {
                    expect(chaves.has(chave.replace(/_max$/, '_min'))).toBe(true);
                }
                if (chave.endsWith('_min')) {
                    expect(chaves.has(chave.replace(/_min$/, '_max'))).toBe(true);
                }
            }
        }
    });

    it('SpO2 entra no par Máx–Mín (é a que mais se perde na nota)', () => {
        const resp = camposDoSistema('resp');
        expect(resp).toContain('spo2_max');
        expect(resp).toContain('spo2_min');
    });

    it('os campos que alimentam o SOFA existem na ficha', () => {
        // `sofaDaFicha` lê exatamente estes: plaquetas, PAM mínima, creatinina
        // e diurese. Sumindo daqui, o escore perde componente em silêncio.
        expect(camposDoSistema('hemato')).toContain('plaq');
        expect(camposDoSistema('hemo')).toContain('pam_min');
        expect(camposDoSistema('renal')).toContain('cr');
        expect(camposDoSistema('renal')).toContain('diurese_6_18h_ml');
    });

    it('painelDoSistema devolve o painel pedido', () => {
        expect(painelDoSistema('tgi').rotulo).toBe('TGI');
    });
});
