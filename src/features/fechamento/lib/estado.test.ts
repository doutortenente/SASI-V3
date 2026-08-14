/**
 * Testes do estado da ficha — a ida e a volta entre o banco e o formulário.
 *
 * Fixtures 100% SINTÉTICAS (nome, leito e valores inventados): `_material/` e
 * `amostras/` têm paciente real e não entram em teste, por decisão do
 * `CLAUDE.md`.
 *
 * O que estes testes travam:
 *  1. campo vazio na tela NÃO vira 0 nem '' no banco — some do jsonb;
 *  2. vírgula decimal sobrevive à ida e à volta;
 *  3. o que a tela não edita (`problemas_ativos`, `riscos`) volta INTACTO no
 *     payload — a armadilha de `save_ficha`, que apaga o que não é reenviado;
 *  4. nota de outro plantão não é tratada como nota deste.
 */
import {describe, expect, it} from 'vitest';

import {
    estadoInicialDaFicha,
    evolucaoDaFicha,
    fichaParaTexto,
    notaEDestePlantao,
} from '@/features/fechamento/lib/estado';
import {CHAVES_SISTEMAS, camposDoSistema} from '@/features/fechamento/lib/campos';
import type {EvolucaoCorrente} from '@/features/fechamento/types';

/** Nota sintética mínima — só o que cada teste precisa é sobrescrito. */
function notaSintetica(parcial: Partial<EvolucaoCorrente> = {}): EvolucaoCorrente {
    return {
        id: 'evo-0001',
        neuro: {descricao: 'sedado', rass: '-3'},
        resp: {suporte: 'VM A/C', spo2_min: '88', spo2_max: '99'},
        hemo: {pam_min: '58'},
        tgi: {},
        renal: {cr: '1,7'},
        hemato: {plaq: '90'},
        infecto: {},
        dvas: ['Noradrenalina 12 mL/h'],
        sedativos: [],
        impressao: ['Choque séptico em resolução'],
        conduta: ['Reduzir noradrenalina, meta PAM 65'],
        intercorrencias: ['Dessaturação às 03h20, revertida com aspiração'],
        problemas_ativos: [{texto: 'Choque séptico'}],
        riscos: [{texto: 'Risco de PAV'}],
        sofa_snapshot: null,
        sofa_total: null,
        data_plantao: '2026-08-12',
        turno: 'noturna',
        tipo_nota: 'seriada',
        illness_severity: 'instavel',
        autor_crm: null,
        autor_nome: 'Dra. Sintética',
        finalizada_em: null,
        ...parcial,
    };
}

describe('estadoInicialDaFicha', () => {
    it('sem nota, a ficha nasce vazia — nunca com frase de preenchimento', () => {
        const estado = estadoInicialDaFicha(null);
        for (const chave of CHAVES_SISTEMAS) {
            for (const campo of camposDoSistema(chave)) {
                expect(estado.sistemas[chave][campo]).toBe('');
            }
        }
        expect(estado.impressao).toEqual([]);
        expect(estado.conduta).toEqual([]);
        expect(estado.intercorrencias).toEqual([]);
        // Gravidade da nota NÃO ganha padrão: classificar por omissão seria
        // inventar julgamento clínico.
        expect(estado.illnessSeverity).toBeNull();
        expect(estado.tipoNota).toBe('seriada');
    });

    it('carrega os 7 sistemas e converte infusão em linha editável', () => {
        const estado = estadoInicialDaFicha(notaSintetica());
        expect(estado.sistemas.neuro.descricao).toBe('sedado');
        expect(estado.sistemas.resp.spo2_min).toBe('88');
        expect(estado.dvas).toEqual(['Noradrenalina 12 mL/h']);
        expect(estado.illnessSeverity).toBe('instavel');
    });

    it('vírgula decimal atravessa a ida e a volta sem virar ponto nem NaN', () => {
        const estado = estadoInicialDaFicha(notaSintetica());
        expect(estado.sistemas.renal.cr).toBe('1,7');
        expect(evolucaoDaFicha(estado).renal.cr).toBe('1,7');
    });
});

describe('evolucaoDaFicha (payload da RPC)', () => {
    it('campo vazio SOME do jsonb — não vira 0 nem string vazia', () => {
        const estado = estadoInicialDaFicha(notaSintetica());
        estado.sistemas.renal.cr = '';
        estado.sistemas.renal.ur = '   ';
        const payload = evolucaoDaFicha(estado);
        expect(payload.renal).not.toHaveProperty('cr');
        expect(payload.renal).not.toHaveProperty('ur');
    });

    it('reenvia intacto o que a tela não edita (armadilha do save_ficha)', () => {
        const estado = estadoInicialDaFicha(notaSintetica());
        const payload = evolucaoDaFicha(estado);
        expect(payload.problemas_ativos).toEqual([{texto: 'Choque séptico'}]);
        expect(payload.riscos).toEqual([{texto: 'Risco de PAV'}]);
    });

    it('NÃO leva intercorrencias — a RPC não conhece a coluna', () => {
        const estado = estadoInicialDaFicha(notaSintetica());
        expect(evolucaoDaFicha(estado)).not.toHaveProperty('intercorrencias');
    });

    it('linha em branco digitada por engano não vira item de lista', () => {
        const estado = estadoInicialDaFicha(notaSintetica());
        estado.impressao = ['Choque séptico', '   ', ''];
        expect(evolucaoDaFicha(estado).impressao).toEqual(['Choque séptico']);
    });
});

describe('fichaParaTexto', () => {
    it('entrega ao motor de texto a MESMA ficha que vai para a gravação', () => {
        const estado = estadoInicialDaFicha(notaSintetica());
        const texto = fichaParaTexto(estado);
        const payload = evolucaoDaFicha(estado);
        expect(texto.neuro).toEqual(payload.neuro);
        expect(texto.conduta).toEqual(payload.conduta);
        // A intercorrência só existe no lado do texto e do complemento.
        expect(texto.intercorrencias).toEqual(['Dessaturação às 03h20, revertida com aspiração']);
    });
});

describe('notaEDestePlantao', () => {
    it('mesma data e mesmo turno: é a nota deste plantão (atualiza)', () => {
        expect(notaEDestePlantao(notaSintetica(), '2026-08-12', 'noturna')).toBe(true);
    });

    it('mesma data, turno diferente: nota nova (não sobrescrever a do turno anterior)', () => {
        expect(notaEDestePlantao(notaSintetica(), '2026-08-12', 'diurna')).toBe(false);
    });

    it('outro dia: nota nova', () => {
        expect(notaEDestePlantao(notaSintetica(), '2026-08-13', 'noturna')).toBe(false);
    });

    it('sem nota nenhuma: nota nova', () => {
        expect(notaEDestePlantao(null, '2026-08-13', 'noturna')).toBe(false);
    });
});
