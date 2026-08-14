/**
 * Testes dos eventos clínicos da Captura.
 *
 * Duas frentes, mesma doutrina de `pendencias.test.ts`:
 *  1. `avaliarFaixa` pura — sinaliza, nunca corrige nem bloqueia;
 *  2. FORMATO do insert — `fonte: 'manual'` explícita (a coluna NÃO tem
 *     default), `ts` do chamador, unidade da ref, e a prova de que valor
 *     fora da faixa AINDA É ENVIADO.
 *
 * Fixture 100% sintética; as refs espelham linhas reais de `evento_tipo_ref`
 * (migrations de 30-jul), sem nenhum dado de paciente.
 */
import {describe, expect, it} from 'vitest';

import {avaliarFaixa, FalhaAoGravarEvento, registrarEvento} from './eventos';

import type {ClienteSasi, TipoDeEvento} from '@/features/captura/types';

const PAC_A = '11111111-1111-4111-8111-111111111111';
const TS_COLETA = '2026-08-13T04:00:00.000Z';

/** SpO2 como está no banco: faixa 0–100 (absurdo fisiológico, não normalidade). */
const REF_SPO2: TipoDeEvento = {
    codigo: 'spo2',
    categoria: 'vital',
    rotulo: 'Saturação O₂',
    unidade_padrao: '%',
    faixa_min: 0,
    faixa_max: 100,
    ativo: true,
    ordem: 16,
};

/** Creatinina como está no banco: 0,1–20 mg/dL. */
const REF_CR: TipoDeEvento = {
    codigo: 'cr',
    categoria: 'renal',
    rotulo: 'Creatinina',
    unidade_padrao: 'mg/dL',
    faixa_min: 0.1,
    faixa_max: 20,
    ativo: true,
    ordem: 33,
};

/** Base excess: SEM faixa no banco (null dos dois lados) e unidade mEq/L. */
const REF_BE: TipoDeEvento = {
    codigo: 'be',
    categoria: 'gaso',
    rotulo: 'Base excess',
    unidade_padrao: 'mEq/L',
    faixa_min: null,
    faixa_max: null,
    ativo: true,
    ordem: 26,
};

/** pH: unidade VAZIA ('') no banco — número adimensional. */
const REF_PH: TipoDeEvento = {
    codigo: 'ph',
    categoria: 'gaso',
    rotulo: 'pH arterial',
    unidade_padrao: '',
    faixa_min: 6.8,
    faixa_max: 7.8,
    ativo: true,
    ordem: 22,
};

/** Dublê thenable — padrão de `pendencias.test.ts`. */
function clienteFalso(resposta: {data: unknown; error: {message: string} | null}) {
    const registro = {
        from: [] as string[],
        select: [] as string[],
        insert: [] as Array<Record<string, unknown>>,
    };

    const construtor: any = {
        select(colunas: string) {
            registro.select.push(colunas);
            return construtor;
        },
        insert(payload: Record<string, unknown>) {
            registro.insert.push(payload);
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

function eventoGravado(extra: Record<string, unknown> = {}) {
    return {
        id: '44444444-4444-4444-8444-444444444444',
        paciente_id: PAC_A,
        evolucao_id: null,
        user_id: null,
        ts: TS_COLETA,
        tipo: 'spo2',
        valor_num: 95,
        valor_json: null,
        unidade: '%',
        fonte: 'manual',
        confidence: null,
        source_text: null,
        requires_review: false,
        created_at: '2026-08-13T06:00:00.000Z',
        ...extra,
    };
}

describe('avaliarFaixa', () => {
    it('dentro / fora_baixo / fora_alto contra a faixa da ref', () => {
        expect(avaliarFaixa(1.2, REF_CR)).toBe('dentro');
        expect(avaliarFaixa(0.05, REF_CR)).toBe('fora_baixo');
        expect(avaliarFaixa(25, REF_CR)).toBe('fora_alto');
    });

    it('o limite exato é dentro — a faixa é inclusiva, o absurdo começa depois', () => {
        expect(avaliarFaixa(0.1, REF_CR)).toBe('dentro');
        expect(avaliarFaixa(20, REF_CR)).toBe('dentro');
    });

    it('ref sem faixa (null) nunca sinaliza — faixa não declarada não se inventa', () => {
        expect(avaliarFaixa(-30, REF_BE)).toBe('dentro');
        expect(avaliarFaixa(9999, REF_BE)).toBe('dentro');
    });
});

describe('registrarEvento — formato do insert', () => {
    it('manda paciente_id, tipo da ref, ts da COLETA, fonte manual e unidade da ref', async () => {
        const {supabase, registro} = clienteFalso({data: [eventoGravado()], error: null});
        const {evento, posicao} = await registrarEvento(supabase, {
            paciente_id: PAC_A,
            ref: REF_SPO2,
            tsISO: TS_COLETA,
            valor: 95,
        });

        expect(registro.from).toEqual(['eventos_clinicos']);
        expect(registro.insert).toEqual([
            {
                paciente_id: PAC_A,
                tipo: 'spo2',
                ts: TS_COLETA, // hora da coleta, do chamador — nunca now() calado
                fonte: 'manual', // obrigatória: a coluna NÃO tem default no banco
                valor_num: 95,
                unidade: '%', // a unidade_padrao da ref, nunca digitada solta
            },
        ]);
        expect(registro.insert[0]).not.toHaveProperty('internacao_id');
        expect(registro.insert[0]).not.toHaveProperty('requires_review');
        expect(evento).toEqual(eventoGravado());
        expect(posicao).toBe('dentro');
    });

    it('valor com vírgula decimal passa por parseNumeroBR ("1,7" → 1.7)', async () => {
        const {supabase, registro} = clienteFalso({
            data: [eventoGravado({tipo: 'cr', valor_num: 1.7, unidade: 'mg/dL'})],
            error: null,
        });
        await registrarEvento(supabase, {
            paciente_id: PAC_A,
            ref: REF_CR,
            tsISO: TS_COLETA,
            valor: '1,7',
        });
        expect(registro.insert[0]!['valor_num']).toBe(1.7);
    });

    it('valor vazio NÃO envia valor_num nem unidade — jamais vira 0', async () => {
        // Zero é um valor (glicemia 0 seria pânico); vazio é "não medido".
        const {supabase, registro} = clienteFalso({
            data: [eventoGravado({valor_num: null, unidade: null})],
            error: null,
        });
        const {posicao} = await registrarEvento(supabase, {
            paciente_id: PAC_A,
            ref: REF_SPO2,
            tsISO: TS_COLETA,
            valor: '',
        });
        expect(registro.insert[0]).not.toHaveProperty('valor_num');
        expect(registro.insert[0]).not.toHaveProperty('unidade');
        expect(posicao).toBeNull();
    });

    it('ref com unidade vazia ("") não manda a coluna — pH é adimensional', async () => {
        const {supabase, registro} = clienteFalso({
            data: [eventoGravado({tipo: 'ph', valor_num: 7.31, unidade: null})],
            error: null,
        });
        await registrarEvento(supabase, {
            paciente_id: PAC_A,
            ref: REF_PH,
            tsISO: TS_COLETA,
            valor: '7,31',
        });
        expect(registro.insert[0]!['valor_num']).toBe(7.31);
        expect(registro.insert[0]).not.toHaveProperty('unidade');
    });
});

describe('registrarEvento — a faixa sinaliza, NUNCA bloqueia', () => {
    it('SpO2 145% é ENVIADO e volta posicao fora_alto para a tela marcar (revisar)', async () => {
        // "Corrigir SpO2 145% para 95% é iatrogenia computacional": o app não
        // sabe se é dedo trocado ou transdutor ruim — quem decide é o médico.
        const {supabase, registro} = clienteFalso({
            data: [eventoGravado({valor_num: 145})],
            error: null,
        });
        const {posicao} = await registrarEvento(supabase, {
            paciente_id: PAC_A,
            ref: REF_SPO2,
            tsISO: TS_COLETA,
            valor: 145,
        });
        expect(registro.insert).toHaveLength(1); // o envio aconteceu
        expect(registro.insert[0]!['valor_num']).toBe(145); // com o valor ORIGINAL
        expect(posicao).toBe('fora_alto');
    });
});

describe('registrarEvento — falha de escrita', () => {
    it('lança erro que diz que NÃO foi salvo', async () => {
        const {supabase} = clienteFalso({data: null, error: {message: 'conexão perdida'}});
        const entrada = {paciente_id: PAC_A, ref: REF_SPO2, tsISO: TS_COLETA, valor: 95};
        await expect(registrarEvento(supabase, entrada)).rejects.toBeInstanceOf(FalhaAoGravarEvento);
        await expect(registrarEvento(supabase, entrada)).rejects.toThrow(/NÃO registrou/);
    });

    it('insert sem erro e sem linha de volta também é falha, não sucesso calado', async () => {
        const {supabase} = clienteFalso({data: [], error: null});
        await expect(
            registrarEvento(supabase, {paciente_id: PAC_A, ref: REF_SPO2, tsISO: TS_COLETA}),
        ).rejects.toBeInstanceOf(FalhaAoGravarEvento);
    });
});
