/**
 * Testes das janelas de 24h.
 *
 * Três frentes, mesma doutrina de `pendencias.test.ts`:
 *  1. `montarJanela` pura — espelho das 4 constraints do banco + a doutrina
 *     de inversão mín/máx com '(revisar)';
 *  2. FORMATO do upsert — provar o `onConflict` da chave única (reprocessar
 *     substitui, não duplica) e que `internacao_id`/`requires_review` nunca
 *     vão no payload;
 *  3. leitura da view de render — o campo `render` vem pronto, não se remonta.
 *
 * Fixture 100% sintética: UUIDs e valores inventados aqui.
 */
import {describe, expect, it} from 'vitest';

import {
    EntradaDeJanelaRecusada,
    FalhaAoGravarJanela,
    LIMIARES_PADRAO,
    lerJanelasDoPaciente,
    montarJanela,
    registrarJanela,
} from './janelas';
import {FalhaDeLeitura} from '@/lib/data/erros';

import type {ClienteSasi, EntradaDeJanela} from '@/features/captura/types';

const PAC_A = '11111111-1111-4111-8111-111111111111';
const INICIO = '2026-08-12T07:00:00.000Z';
const FIM = '2026-08-13T07:00:00.000Z';

/**
 * Dublê thenable — padrão de `pendencias.test.ts`, acrescido de `upsert`
 * (que anota payload E opções, para o teste provar o `onConflict`).
 */
function clienteFalso(resposta: {data: unknown; error: {message: string} | null}) {
    const registro = {
        from: [] as string[],
        select: [] as string[],
        eq: [] as Array<[string, unknown]>,
        order: [] as Array<[string, unknown]>,
        upsert: [] as Array<[Record<string, unknown>, unknown]>,
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
        upsert(payload: Record<string, unknown>, opcoes: unknown) {
            registro.upsert.push([payload, opcoes]);
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

function entradaBase(extra: Partial<EntradaDeJanela> = {}): EntradaDeJanela {
    return {
        paciente_id: PAC_A,
        tipo: 'pam',
        janelaInicioISO: INICIO,
        janelaFimISO: FIM,
        valor_max: 90,
        valor_min: 56,
        ...extra,
    };
}

describe('montarJanela — o caminho feliz', () => {
    it('monta o payload com fonte manual e SEM internacao_id/requires_review', () => {
        const r = montarJanela(entradaBase({n_total: 12, n_fora_baixo: 4, limiar_baixo: 65}));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.payload).toEqual({
            paciente_id: PAC_A,
            tipo: 'pam',
            janela_inicio: INICIO,
            janela_fim: FIM,
            fonte: 'manual',
            valor_max: 90,
            valor_min: 56,
            n_total: 12,
            n_fora_baixo: 4,
            limiar_baixo: 65,
        });
        expect(r.payload).not.toHaveProperty('internacao_id');
        expect(r.payload).not.toHaveProperty('requires_review');
        expect(r.avisos).toEqual([]);
    });

    it('campo vazio NÃO entra no payload — jamais vira 0', () => {
        // Zero é um valor medido; vazio é ausência. Um n_fora vazio que
        // virasse 0 afirmaria "zero excursões medidas" sem ninguém ter medido.
        const r = montarJanela(entradaBase({valor_min: '', n_fora_alto: null}));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.payload).not.toHaveProperty('valor_min');
        expect(r.payload).not.toHaveProperty('n_fora_alto');
        expect(r.payload).not.toHaveProperty('n_total');
    });

    it('lê vírgula decimal via parseNumeroBR ("37,9" → 37.9)', () => {
        const r = montarJanela(entradaBase({tipo: 'temp', valor_max: '37,9', valor_min: '35,8'}));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.payload.valor_max).toBe(37.9);
        expect(r.payload.valor_min).toBe(35.8);
    });

    it('n_fora_* = 0 explícito passa SEM exigir limiar (a constraint só cobra quando > 0)', () => {
        const r = montarJanela(entradaBase({tipo: 'be', n_fora_alto: 0}));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.payload.n_fora_alto).toBe(0);
        expect(r.payload).not.toHaveProperty('limiar_alto');
    });
});

describe('montarJanela — inversão máx/mín (doutrina da skill)', () => {
    it('mín > máx na digitação INVERTE e marca (revisar) — nunca descarta', () => {
        // O par de valores é real; só os rótulos vieram trocados. Recusar
        // perderia dado; aceitar calado esconderia o tropeço do médico revisor.
        const r = montarJanela(entradaBase({valor_max: 56, valor_min: 90}));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.payload.valor_max).toBe(90);
        expect(r.payload.valor_min).toBe(56);
        expect(r.avisos).toHaveLength(1);
        expect(r.avisos[0]).toContain('(revisar)');
    });
});

describe('montarJanela — espelho das constraints do banco', () => {
    it('janela_fim <= janela_inicio recusa (janela_ordem_chk)', () => {
        const r = montarJanela(entradaBase({janelaInicioISO: FIM, janelaFimISO: INICIO}));
        expect(r).toEqual({ok: false, motivo: expect.stringContaining('DEPOIS')});
    });

    it('data ilegível recusa antes de virar SQL', () => {
        const r = montarJanela(entradaBase({janelaFimISO: 'ontem de manhã'}));
        expect(r.ok).toBe(false);
    });

    it('n_fora maior que n_total recusa (janela_n_chk)', () => {
        const r = montarJanela(entradaBase({n_total: 6, n_fora_baixo: 7, limiar_baixo: 65}));
        expect(r).toEqual({ok: false, motivo: expect.stringContaining('impossível')});
    });

    it('sem n_total informado, valida contra o default 12 do banco (folha completa)', () => {
        // O banco vai gravar n_total = 12; um n_fora de 13 estouraria a
        // constraint lá — melhor recusar aqui, em português.
        const r = montarJanela(entradaBase({n_fora_baixo: 13, limiar_baixo: 65}));
        expect(r.ok).toBe(false);
    });

    it('excursão sem limiar usa o limiar PADRÃO do tipo (contrato P0)', () => {
        // "4 aferições abaixo" de QUANTO? Para 'pam', o contrato P0 diz <65.
        const r = montarJanela(entradaBase({n_fora_baixo: 4}));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.payload.limiar_baixo).toBe(65);
    });

    it('excursão sem limiar num tipo SEM padrão recusa — limiar não se inventa', () => {
        // 'lactato' não está no contrato P0 de limiares de janela.
        const r = montarJanela(entradaBase({tipo: 'lactato', n_fora_alto: 2}));
        expect(r).toEqual({ok: false, motivo: expect.stringContaining('lactato')});
    });

    it('limiar informado pelo médico VENCE o padrão', () => {
        const r = montarJanela(entradaBase({n_fora_baixo: 4, limiar_baixo: 70}));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.payload.limiar_baixo).toBe(70);
    });

    it('contagem fracionada recusa — "4,5 aferições fora" não existe', () => {
        const r = montarJanela(entradaBase({n_fora_baixo: '4,5'}));
        expect(r.ok).toBe(false);
    });
});

describe('LIMIARES_PADRAO — o contrato P0, tipo a tipo', () => {
    it('cobre os 8 tipos de janela com os limiares combinados', () => {
        expect(LIMIARES_PADRAO).toEqual({
            pa_sys: {baixo: 90},
            pa_dia: {baixo: 50},
            pam: {baixo: 65},
            fc: {alto: 100},
            fr: {alto: 20},
            spo2: {baixo: 92},
            temp: {baixo: 35.5, alto: 37.8},
            glicemia: {baixo: 70, alto: 180},
        });
    });
});

describe('registrarJanela', () => {
    const linhaGravada = {
        id: '33333333-3333-4333-8333-333333333333',
        paciente_id: PAC_A,
        tipo: 'pam',
        janela_inicio: INICIO,
        janela_fim: FIM,
        valor_max: 90,
        valor_min: 56,
        n_total: 12,
        n_fora_alto: null,
        n_fora_baixo: 4,
        limiar_alto: null,
        limiar_baixo: 65,
        fonte: 'manual',
        source_text: null,
        requires_review: false,
        created_at: '2026-08-13T07:01:00.000Z',
    };

    it('faz UPSERT com onConflict paciente_id,tipo,janela_fim — reprocessar substitui', async () => {
        const {supabase, registro} = clienteFalso({data: [linhaGravada], error: null});
        const {janela, avisos} = await registrarJanela(supabase, entradaBase({n_fora_baixo: 4}));

        expect(registro.from).toEqual(['janelas_24h']);
        expect(registro.upsert).toHaveLength(1);
        const [payload, opcoes] = registro.upsert[0]!;
        expect(opcoes).toEqual({onConflict: 'paciente_id,tipo,janela_fim'});
        expect(payload).not.toHaveProperty('internacao_id');
        expect(payload).not.toHaveProperty('requires_review');
        expect(payload['fonte']).toBe('manual');
        expect(janela).toEqual(linhaGravada);
        expect(avisos).toEqual([]);
    });

    it('entrada recusada lança EntradaDeJanelaRecusada SEM tocar o banco', async () => {
        const {supabase, registro} = clienteFalso({data: [], error: null});
        await expect(
            registrarJanela(supabase, entradaBase({janelaFimISO: INICIO, janelaInicioISO: FIM})),
        ).rejects.toBeInstanceOf(EntradaDeJanelaRecusada);
        expect(registro.from).toEqual([]);
    });

    it('propaga o aviso (revisar) da inversão junto da linha gravada', async () => {
        const {supabase} = clienteFalso({data: [linhaGravada], error: null});
        const {avisos} = await registrarJanela(supabase, entradaBase({valor_max: 56, valor_min: 90}));
        expect(avisos[0]).toContain('(revisar)');
    });

    it('falha de escrita lança erro que diz que NÃO foi salva', async () => {
        const {supabase} = clienteFalso({data: null, error: {message: 'conexão perdida'}});
        await expect(registrarJanela(supabase, entradaBase())).rejects.toBeInstanceOf(FalhaAoGravarJanela);
        await expect(registrarJanela(supabase, entradaBase())).rejects.toThrow(/NÃO registrou/);
    });
});

describe('lerJanelasDoPaciente', () => {
    it('lê a VIEW de render (o campo render vem pronto), mais recente primeiro', () => {
        const {supabase, registro} = clienteFalso({data: [], error: null});
        return lerJanelasDoPaciente(supabase, PAC_A).then(() => {
            expect(registro.from).toEqual(['vw_janelas_24h_render']);
            expect(registro.select[0]).toContain('render');
            expect(registro.eq).toEqual([['paciente_id', PAC_A]]);
            expect(registro.order).toEqual([['janela_fim', {ascending: false}]]);
        });
    });

    it('falha de leitura LANÇA, nunca vira lista vazia', async () => {
        // Tabela vazia é fato ("nada ingerido ainda"); banco mudo é outra coisa.
        const {supabase} = clienteFalso({data: null, error: {message: 'timeout'}});
        await expect(lerJanelasDoPaciente(supabase, PAC_A)).rejects.toBeInstanceOf(FalhaDeLeitura);
    });
});
