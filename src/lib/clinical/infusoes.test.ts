import {describe, expect, it} from 'vitest';

import {calcularDose, DVA, SEDACAO} from './infusoes';

describe('vasoativas — conversão de vazão em dose', () => {
    it('Noradrenalina padrão (64 mcg/mL), 15 mL/h, 77 kg', () => {
        // (15 × 64) / (77 × 60) = 960 / 4620
        const r = calcularDose('Noradrenalina', 0, 15, 77);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.dose.valor).toBeCloseTo(0.208, 3);
        expect(r.dose.unidade).toBe('mcg/kg/min');
        expect(r.dose.dentroDaFaixa).toBe(true);
    });

    it('IMPORTANT: dobrar a concentração dobra a dose na MESMA vazão', () => {
        // Erro clássico de beira-leito: trocar a bolsa e manter a bomba no mesmo mL/h.
        // 80 kg a 12 mL/h de propósito: dá divisão exata (0,160 e 0,320), então o
        // teste mede a conversão e não o arredondamento da terceira casa.
        const padrao = calcularDose('Noradrenalina', 0, 12, 80); // 64 mcg/mL
        const concentrada = calcularDose('Noradrenalina', 2, 12, 80); // 128 mcg/mL
        expect(padrao.ok && concentrada.ok).toBe(true);
        if (!padrao.ok || !concentrada.ok) return;
        expect(padrao.dose.valor).toBe(0.16);
        expect(concentrada.dose.valor).toBe(0.32);
    });

    it('Nitroglicerina é por minuto e NÃO por quilo — calcula sem peso', () => {
        // Caso real do banco: "Tridil 12 ml/h" -> (12 × 200) / 60 = 40 mcg/min
        const r = calcularDose('Nitroglicerina (Tridil)', 0, 12, null);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.dose.valor).toBeCloseTo(40, 3);
        expect(r.dose.unidade).toBe('mcg/min');
        expect(r.dose.dentroDaFaixa).toBe(true);
    });

    it('Dobutamina 5 mL/h em 70 kg fica ABAIXO da faixa usual — sinaliza, não corrige', () => {
        // Caso real do banco: "Dobutamina 5 ml/h". (5 × 1000) / (70 × 60) = 1,19
        const r = calcularDose('Dobutamina', 0, 5, 70);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.dose.valor).toBeCloseTo(1.19, 2);
        expect(r.dose.dentroDaFaixa).toBe(false); // faixa usual começa em 2,0
    });

    it('Vasopressina em U/min mantém resolução nas doses baixas', () => {
        // (6 × 0,2) / 60 = 0,02 U/min. Com 2 casas a faixa 0,01–0,04 achataria.
        const r = calcularDose('Vasopressina', 0, 6, 80);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.dose.valor).toBeCloseTo(0.02, 3);
        expect(r.dose.dentroDaFaixa).toBe(true);
    });
});

describe('sedação', () => {
    it('Propofol 1%, 20 mL/h, 70 kg', () => {
        const r = calcularDose('Propofol', 0, 20, 70, SEDACAO);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.dose.valor).toBeCloseTo(2.857, 3);
        expect(r.dose.unidade).toBe('mg/kg/h');
        expect(r.dose.dentroDaFaixa).toBe(true);
    });

    it('Propofol 2% na mesma vazão entrega o DOBRO da dose', () => {
        const um = calcularDose('Propofol', 0, 20, 70, SEDACAO);
        const dois = calcularDose('Propofol', 1, 20, 70, SEDACAO);
        expect(um.ok && dois.ok).toBe(true);
        if (!um.ok || !dois.ok) return;
        expect(dois.dose.valor).toBeCloseTo(um.dose.valor * 2, 3);
        expect(dois.dose.dentroDaFaixa).toBe(false); // 5,71 mg/kg/h passa de 4,0
    });

    it('Fentanil puro (50 mcg/mL) entrega 5x o da diluição padrão', () => {
        const padrao = calcularDose('Fentanil', 0, 10, 70, SEDACAO);
        const puro = calcularDose('Fentanil', 1, 10, 70, SEDACAO);
        expect(padrao.ok && puro.ok).toBe(true);
        if (!padrao.ok || !puro.ok) return;
        expect(puro.dose.valor / padrao.dose.valor).toBeCloseTo(5, 2);
    });
});

describe('sem peso a conta não existe — nunca estimar peso de paciente', () => {
    it('dose por quilo sem peso devolve o motivo, não um número', () => {
        for (const entrada of [null, undefined, '', '   ', 0, -5, 'abc']) {
            const r = calcularDose('Noradrenalina', 0, 10, entrada as never);
            expect(r.ok).toBe(false);
            if (r.ok) continue;
            expect(r.motivo).toBe('peso-necessario');
        }
    });

    it('NÃO existe peso padrão de 70 kg embutido', () => {
        const semPeso = calcularDose('Noradrenalina', 0, 10, null);
        const com70 = calcularDose('Noradrenalina', 0, 10, 70);
        expect(semPeso.ok).toBe(false);
        expect(com70.ok).toBe(true);
    });
});

describe('entrada suja não vira dose silenciosa', () => {
    it('vírgula decimal do teclado brasileiro é aceita', () => {
        const r = calcularDose('Noradrenalina', 0, '7,5', '77,5');
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.dose.valor).toBeGreaterThan(0);
    });

    it('vazão ausente e vazão inválida têm motivos DIFERENTES', () => {
        const ausente = calcularDose('Noradrenalina', 0, '', 70);
        const invalida = calcularDose('Noradrenalina', 0, 'abc', 70);
        expect(ausente.ok || invalida.ok).toBe(false);
        if (!ausente.ok) expect(ausente.motivo).toBe('vazao-ausente');
        if (!invalida.ok) expect(invalida.motivo).toBe('vazao-invalida');
    });

    it('fármaco e diluição fora da tabela não caem em diluição 0 por engano', () => {
        const semFarmaco = calcularDose('Nao Existe', 0, 10, 70);
        const semDiluicao = calcularDose('Noradrenalina', 99, 10, 70);
        expect(semFarmaco.ok).toBe(false);
        expect(semDiluicao.ok).toBe(false);
        if (!semFarmaco.ok) expect(semFarmaco.motivo).toBe('farmaco-desconhecido');
        if (!semDiluicao.ok) expect(semDiluicao.motivo).toBe('diluicao-desconhecida');
    });

    it('vazão zero é um VALOR (bomba parada), não ausência de dado', () => {
        const r = calcularDose('Noradrenalina', 0, 0, 70);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.dose.valor).toBe(0);
    });
});

describe('integridade das tabelas de diluição', () => {
    it('toda diluição tem concentração positiva e faixa coerente', () => {
        for (const tabela of [DVA, SEDACAO]) {
            for (const [nome, f] of Object.entries(tabela)) {
                expect(f.diluicoes.length, `${nome} sem diluição`).toBeGreaterThan(0);
                expect(f.faixaMin, `${nome} faixa invertida`).toBeLessThan(f.faixaMax);
                for (const d of f.diluicoes) {
                    expect(d.concentracaoPorMl, `${nome}/${d.rotulo}`).toBeGreaterThan(0);
                }
            }
        }
    });

    it('nenhum rótulo usa µ — só "mcg", que não tem gêmeo visual', () => {
        for (const tabela of [DVA, SEDACAO]) {
            for (const f of Object.values(tabela)) {
                for (const d of f.diluicoes) expect(d.rotulo).not.toMatch(/[µμΜ]/);
            }
        }
    });
});
