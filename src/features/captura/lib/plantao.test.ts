/**
 * Testes do relógio do plantão.
 *
 * São Paulo é UTC-3 desde 2019 (sem horário de verão): 07h de parede = 10h
 * UTC, 19h de parede = 22h UTC. Os casos abaixo cravam os instantes em UTC de
 * propósito — o teste tem que passar em qualquer máquina, em qualquer fuso.
 */
import {describe, expect, it} from 'vitest';

import {
    dataHoraCurtaEmSaoPaulo,
    datetimeLocalEmSaoPaulo,
    derivarJanelaDePlantao,
    isoDeDatetimeLocalSaoPaulo,
} from '@/features/captura/lib/plantao';

describe('derivarJanelaDePlantao', () => {
    it('meio-dia em SP cai no plantão diurno 07h–19h do mesmo dia', () => {
        // 15:00 UTC = 12:00 em São Paulo
        const j = derivarJanelaDePlantao(new Date('2026-08-13T15:00:00Z'));
        expect(j.turno).toBe('diurno');
        expect(j.inicioISO).toBe('2026-08-13T10:00:00.000Z'); // 07h SP
        expect(j.fimISO).toBe('2026-08-13T22:00:00.000Z'); // 19h SP
        expect(j.rotulo).toBe('Plantão diurno · 07h às 19h de 13/08');
    });

    it('20h em SP cai no noturno que termina às 07h do dia seguinte', () => {
        // 23:00 UTC = 20:00 em São Paulo
        const j = derivarJanelaDePlantao(new Date('2026-08-13T23:00:00Z'));
        expect(j.turno).toBe('noturno');
        expect(j.inicioISO).toBe('2026-08-13T22:00:00.000Z'); // 19h SP de 13/08
        expect(j.fimISO).toBe('2026-08-14T10:00:00.000Z'); // 07h SP de 14/08
        expect(j.rotulo).toBe('Plantão noturno · 19h de 13/08 às 07h');
    });

    it('madrugada (02h em SP) pertence ao noturno INICIADO NA VÉSPERA', () => {
        // 05:00 UTC de 14/08 = 02:00 em São Paulo de 14/08
        const j = derivarJanelaDePlantao(new Date('2026-08-14T05:00:00Z'));
        expect(j.turno).toBe('noturno');
        expect(j.inicioISO).toBe('2026-08-13T22:00:00.000Z'); // 19h SP de 13/08
        expect(j.fimISO).toBe('2026-08-14T10:00:00.000Z'); // 07h SP de 14/08
        // O rótulo carrega o dia do INÍCIO — regra dos dois relógios do banco.
        expect(j.rotulo).toBe('Plantão noturno · 19h de 13/08 às 07h');
    });

    it('07h em ponto já é diurno; 19h em ponto já é noturno (bordas)', () => {
        expect(derivarJanelaDePlantao(new Date('2026-08-13T10:00:00Z')).turno).toBe('diurno');
        expect(derivarJanelaDePlantao(new Date('2026-08-13T22:00:00Z')).turno).toBe('noturno');
    });

    it('noturno na virada de mês atravessa para o dia 1º sem quebrar', () => {
        // 31/08 23:30 SP = 01/09 02:30 UTC
        const j = derivarJanelaDePlantao(new Date('2026-09-01T02:30:00Z'));
        expect(j.turno).toBe('noturno');
        expect(j.inicioISO).toBe('2026-08-31T22:00:00.000Z'); // 19h SP de 31/08
        expect(j.fimISO).toBe('2026-09-01T10:00:00.000Z'); // 07h SP de 01/09
    });

    it('madrugada de 1º de janeiro volta para o noturno de 31/12 do ANO anterior', () => {
        // 01/01 03:00 SP = 06:00 UTC
        const j = derivarJanelaDePlantao(new Date('2027-01-01T06:00:00Z'));
        expect(j.inicioISO).toBe('2026-12-31T22:00:00.000Z');
        expect(j.fimISO).toBe('2027-01-01T10:00:00.000Z');
    });
});

describe('datetimeLocalEmSaoPaulo', () => {
    it('converte ISO UTC para o relógio de parede de São Paulo', () => {
        expect(datetimeLocalEmSaoPaulo('2026-08-13T15:04:00Z')).toBe('2026-08-13T12:04');
    });

    it('ISO inválido devolve vazio, nunca data inventada', () => {
        expect(datetimeLocalEmSaoPaulo('não é data')).toBe('');
    });
});

describe('isoDeDatetimeLocalSaoPaulo', () => {
    it('lê o valor do input como parede de SP e devolve o instante UTC', () => {
        expect(isoDeDatetimeLocalSaoPaulo('2026-08-13T12:04')).toBe('2026-08-13T15:04:00.000Z');
    });

    it('faz ida e volta sem perder o instante', () => {
        const iso = '2026-08-13T15:04:00.000Z';
        const local = datetimeLocalEmSaoPaulo(iso);
        expect(isoDeDatetimeLocalSaoPaulo(local)).toBe(iso);
    });

    it('recusa entrada que não é data/hora real', () => {
        expect(isoDeDatetimeLocalSaoPaulo('')).toBeNull();
        expect(isoDeDatetimeLocalSaoPaulo('abc')).toBeNull();
        expect(isoDeDatetimeLocalSaoPaulo('2026-13-01T10:00')).toBeNull(); // mês 13
        expect(isoDeDatetimeLocalSaoPaulo('2026-02-30T10:00')).toBeNull(); // 30/fev
        expect(isoDeDatetimeLocalSaoPaulo('2026-08-13T25:00')).toBeNull(); // hora 25
    });
});

describe('dataHoraCurtaEmSaoPaulo', () => {
    it('formata "dd/mm HHh" no relógio de SP, omitindo minuto zero', () => {
        expect(dataHoraCurtaEmSaoPaulo('2026-08-13T22:00:00Z')).toBe('13/08 19h');
        expect(dataHoraCurtaEmSaoPaulo('2026-08-13T22:30:00Z')).toBe('13/08 19h30');
    });

    it('ausente ou inválido devolve null (a tela mostra travessão)', () => {
        expect(dataHoraCurtaEmSaoPaulo(null)).toBeNull();
        expect(dataHoraCurtaEmSaoPaulo('lixo')).toBeNull();
    });
});
