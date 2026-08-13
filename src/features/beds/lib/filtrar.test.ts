/**
 * Prova do filtro da grade (`filtrarLeitos`).
 *
 * Fixture SINTÉTICA — nada aqui veio de paciente real (`_material/` e
 * `amostras/` são proibidos como fonte de teste; o repo é público).
 */
import {describe, expect, it} from 'vitest';

import {filtrarLeitos} from '@/features/beds/lib/filtrar';
import type {LeitoNaGrade} from '@/features/beds/types';

/** Leito completo com padrões seguros; cada teste sobrescreve só o que importa. */
function leito(sobrescreve: Partial<LeitoNaGrade>): LeitoNaGrade {
    return {
        paciente_id: 'p-base',
        user_id: null,
        leito: 'UTI2-L01',
        uti: 'UTI2',
        nome: 'PACIENTE SINTETICO',
        idade: 60,
        peso: null,
        hd: null,
        gravidade: 'estavel',
        status_leito: 'ativo',
        data_adm: '2026-08-01',
        dias_internacao: 10,
        evolucao_id: null,
        ultima_evolucao: null,
        sofa_total: null,
        sofa_snapshot: null,
        dvas: null,
        sedativos: null,
        delta_sofa_24h: null,
        pendencias_abertas: 0,
        dispositivos: {},
        isolation: 'none',
        out_of_range_count: 0,
        severidade_visual: 'green',
        semaforo: 'green',
        divergenciaDeSemaforo: false,
        acuidade: 'ESTAVEL',
        ...sobrescreve,
    };
}

const GRADE: LeitoNaGrade[] = [
    leito({paciente_id: 'p1', leito: 'UTI2-L01', uti: 'UTI2', nome: 'JOÃO TESTE'}),
    leito({
        paciente_id: 'p2',
        leito: 'UTI3-L03',
        uti: 'UTI3',
        nome: 'JOSÉ FICTÍCIO',
        gravidade: 'instavel',
        semaforo: 'red',
        // Divergência de propósito: a coluna do banco mente 'green'.
        severidade_visual: 'green',
        divergenciaDeSemaforo: true,
        acuidade: 'CRITICO',
    }),
    leito({
        paciente_id: 'p3',
        leito: 'UTI4-L02',
        uti: 'UTI4',
        nome: 'MARIA EXEMPLO',
        gravidade: 'watcher',
        semaforo: 'yellow',
        severidade_visual: 'yellow',
        acuidade: 'VIGILANCIA',
        isolation: 'contact',
    }),
];

describe('filtrarLeitos', () => {
    it('filtro vazio devolve a grade inteira, na mesma ordem', () => {
        expect(filtrarLeitos(GRADE, {})).toEqual(GRADE);
    });

    it('filtra por UTI', () => {
        const so = filtrarLeitos(GRADE, {uti: 'UTI3'});
        expect(so.map((l) => l.paciente_id)).toEqual(['p2']);
    });

    it('busca por nome ignora acento e caixa', () => {
        expect(filtrarLeitos(GRADE, {busca: 'jose'}).map((l) => l.paciente_id)).toEqual(['p2']);
        expect(filtrarLeitos(GRADE, {busca: 'JOÃO'}).map((l) => l.paciente_id)).toEqual(['p1']);
    });

    it('busca acha pelo número do leito', () => {
        expect(filtrarLeitos(GRADE, {busca: 'l03'}).map((l) => l.paciente_id)).toEqual(['p2']);
    });

    it('filtra por gravidade (enum pós-P0)', () => {
        expect(filtrarLeitos(GRADE, {gravidade: 'watcher'}).map((l) => l.paciente_id)).toEqual([
            'p3',
        ]);
    });

    it('severidade filtra pelo semáforo DERIVADO, não pela coluna do banco', () => {
        // p2 tem severidade_visual 'green' (coluna mentindo) e semaforo 'red'
        // (derivado da gravidade). Filtrar por 'red' TEM que achá-lo: é o
        // paciente que a tela pinta de vermelho e marca como divergente.
        expect(filtrarLeitos(GRADE, {severidade: 'red'}).map((l) => l.paciente_id)).toEqual(['p2']);
        // E por 'green' ele NÃO pode aparecer — a coluna mentirosa não filtra.
        expect(filtrarLeitos(GRADE, {severidade: 'green'}).map((l) => l.paciente_id)).toEqual([
            'p1',
        ]);
    });

    it('filtra por isolamento', () => {
        expect(filtrarLeitos(GRADE, {isolamento: 'contact'}).map((l) => l.paciente_id)).toEqual([
            'p3',
        ]);
    });

    it('somenteComAlerta usa o conjunto de pacientes com alerta', () => {
        const comAlerta = new Set(['p2']);
        expect(
            filtrarLeitos(GRADE, {somenteComAlerta: true}, comAlerta).map((l) => l.paciente_id),
        ).toEqual(['p2']);
    });

    it('somenteComAlerta sem o conjunto carregado é IGNORADO, não esconde a grade', () => {
        // Sem resposta do banco, afirmar "ninguém tem alerta" seria inventar
        // dado — o critério não se aplica até a contagem chegar.
        expect(filtrarLeitos(GRADE, {somenteComAlerta: true}, undefined)).toHaveLength(3);
    });

    it('critérios combinam por E', () => {
        const comAlerta = new Set(['p2', 'p3']);
        expect(
            filtrarLeitos(GRADE, {uti: 'UTI4', somenteComAlerta: true}, comAlerta).map(
                (l) => l.paciente_id,
            ),
        ).toEqual(['p3']);
    });
});
