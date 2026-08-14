/**
 * Testes do vocabulário da Captura.
 *
 * Mesma doutrina de `pendencias.test.ts`: testar o FORMATO DA CONSULTA (a
 * trava de armadilha — filtro `ativo`, ordem do banco, colunas sem
 * `loinc_code`) e as funções puras. Fixture 100% sintética; os códigos e
 * categorias espelham os INSERTs reais das migrations
 * `20260730065335_modelo_dados_v3_formalizacao.sql` e
 * `20260810083446_evento_tipo_ref_expansao.sql`, mas nenhum dado de paciente.
 */
import {describe, expect, it} from 'vitest';

import {agruparPorCategoria, lerTiposDeEvento} from './vocabulario';
import {FalhaDeLeitura} from '@/lib/data/erros';

import type {ClienteSasi, TipoDeEvento} from '@/features/captura/types';

const COLUNAS_ESPERADAS = 'codigo, rotulo, categoria, unidade_padrao, faixa_min, faixa_max, ordem, ativo';

/** Dublê thenable — o mesmo padrão de `pendencias.test.ts`. */
function clienteFalso(resposta: {data: unknown; error: {message: string} | null}) {
    const registro = {
        from: [] as string[],
        select: [] as string[],
        eq: [] as Array<[string, unknown]>,
        order: [] as Array<[string, unknown]>,
    };

    const construtor: any = {
        select(colunas: string) {
            registro.select.push(colunas);
            return construtor;
        },
        eq(coluna: string, valor: unknown) {
            registro.eq.push([coluna, valor]);
            return construtor;
        },
        order(coluna: string, opcoes: unknown) {
            registro.order.push([coluna, opcoes]);
            return construtor;
        },
        then(aceita: (r: unknown) => unknown, rejeita?: (e: unknown) => unknown) {
            return Promise.resolve(resposta).then(aceita, rejeita);
        },
    };

    const supabase = {
        from(tabela: string) {
            registro.from.push(tabela);
            return construtor;
        },
    };

    return {supabase: supabase as unknown as ClienteSasi, registro};
}

function tipoSintetico(extra: Partial<TipoDeEvento>): TipoDeEvento {
    return {
        codigo: 'fc',
        categoria: 'vital',
        rotulo: 'Frequência cardíaca',
        unidade_padrao: 'bpm',
        faixa_min: 20,
        faixa_max: 250,
        ativo: true,
        ordem: 14,
        ...extra,
    };
}

describe('lerTiposDeEvento', () => {
    it('lê só os ativos, na ordem do banco, sem pedir loinc_code', () => {
        // `ordem asc` é a sequência clínica da folha, decidida no banco — a
        // tela não reordena. `loinc_code` fora: a Captura não fala FHIR.
        const {supabase, registro} = clienteFalso({data: [], error: null});
        return lerTiposDeEvento(supabase).then((linhas) => {
            expect(registro.from).toEqual(['evento_tipo_ref']);
            expect(registro.select).toEqual([COLUNAS_ESPERADAS]);
            expect(registro.eq).toEqual([['ativo', true]]);
            expect(registro.order).toEqual([['ordem', {ascending: true}]]);
            expect(linhas).toEqual([]);
        });
    });

    it('falha de leitura LANÇA — vocabulário vazio e banco mudo são opostos', async () => {
        const {supabase} = clienteFalso({data: null, error: {message: 'timeout'}});
        await expect(lerTiposDeEvento(supabase)).rejects.toBeInstanceOf(FalhaDeLeitura);
    });
});

describe('agruparPorCategoria', () => {
    it('agrupa por categoria preservando a ordem vinda do banco', () => {
        // Categorias reais das migrations: vital, gaso, renal (entre as 13).
        const fc = tipoSintetico({codigo: 'fc', categoria: 'vital', ordem: 14});
        const lactato = tipoSintetico({
            codigo: 'lactato',
            categoria: 'gaso',
            rotulo: 'Lactato',
            unidade_padrao: 'mmol/L',
            faixa_min: 0.5,
            faixa_max: 25,
            ordem: 21,
        });
        const spo2 = tipoSintetico({
            codigo: 'spo2',
            categoria: 'vital',
            rotulo: 'Saturação O₂',
            unidade_padrao: '%',
            faixa_min: 0,
            faixa_max: 100,
            ordem: 16,
        });

        // A lista chega ordenada por `ordem` (spo2 16 antes de fc? não: 14 < 16)
        // — o agrupador só reparte, sem reordenar nada.
        expect(agruparPorCategoria([fc, spo2, lactato])).toEqual({
            vital: [fc, spo2],
            gaso: [lactato],
        });
    });

    it('lista vazia devolve mapa vazio — categoria ausente não é inventada', () => {
        expect(agruparPorCategoria([])).toEqual({});
    });
});
