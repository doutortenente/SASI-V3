/**
 * Testes do serviço de pendências.
 *
 * Duas classes de teste, mesma doutrina de `alertas.test.ts`:
 *  1. funções puras (indexar) — o que aparece no card;
 *  2. FORMATO DA CONSULTA — trava de armadilha conhecida, não "cobrir linha".
 *     Se alguém apagar o `.eq('concluida', false)` do concluir, ou mandar
 *     `internacao_id` no insert, o teste fica vermelho na hora.
 *
 * Fixture 100% SINTÉTICA: nomes e UUIDs inventados aqui. `_material/` tem
 * dado real de paciente e não entra em teste.
 */
import {describe, expect, it} from 'vitest';

import {
    type ClienteSasi,
    concluirPendencia,
    criarPendencia,
    FalhaAoGravarPendencia,
    indexarPendenciasPorPaciente,
    lerPendenciasAbertas,
    lerPendenciasDoPaciente,
    reabrirPendencia,
} from './pendencias';
import {FalhaDeLeitura} from '@/lib/data/erros';
import type {Pendencia} from '@/types';

// UUIDs sintéticos, no formato v4, sem relação com paciente nenhum.
const PAC_A = '11111111-1111-4111-8111-111111111111';
const PAC_B = '22222222-2222-4222-8222-222222222222';
const PEND_1 = '33333333-3333-4333-8333-333333333333';
const AGORA = '2026-08-11T22:00:00.000Z';

const COLUNAS_ESPERADAS =
    'id, paciente_id, evolucao_id, user_id, tarefa, prioridade, concluida, concluida_at, created_at';

/**
 * Dublê do cliente Supabase — mesmo padrão thenable de `alertas.test.ts`,
 * acrescido de `insert`. O construtor de consulta do supabase-js tem `then`
 * próprio; o dublê copia isso e anota cada elo da corrente, para o teste
 * conferir a consulta MONTADA — que é o contrato que interessa aqui.
 */
function clienteFalso(resposta: { data: unknown; error: { message: string } | null }) {
    const registro = {
        from: [] as string[],
        select: [] as string[],
        eq: [] as Array<[string, unknown]>,
        order: [] as Array<[string, unknown]>,
        insert: [] as Array<Record<string, unknown>>,
        update: [] as Array<Record<string, unknown>>,
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
        insert(payload: Record<string, unknown>) {
            registro.insert.push(payload);
            return construtor;
        },
        update(patch: Record<string, unknown>) {
            registro.update.push(patch);
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

function pendenciaSintetica(extra: Partial<Pendencia>): Pendencia {
    return {
        id: PEND_1,
        paciente_id: PAC_A,
        evolucao_id: null,
        user_id: null,
        tarefa: 'colher gasometria de controle',
        prioridade: 2,
        concluida: false,
        concluida_at: null,
        created_at: AGORA,
        ...extra,
    };
}

describe('lerPendenciasAbertas', () => {
    it('filtra abertas e ordena urgente primeiro, antiga primeiro', () => {
        // prioridade asc (1 = tempo-sensível no topo) e created_at asc:
        // pendência que envelhece esquecida é a que mais machuca na passagem.
        const {supabase, registro} = clienteFalso({data: [], error: null});
        return lerPendenciasAbertas(supabase).then((linhas) => {
            expect(registro.from).toEqual(['pendencias']);
            expect(registro.select).toEqual([COLUNAS_ESPERADAS]);
            expect(registro.eq).toEqual([['concluida', false]]);
            expect(registro.order).toEqual([
                ['prioridade', {ascending: true}],
                ['created_at', {ascending: true}],
            ]);
            expect(linhas).toEqual([]);
        });
    });

    it('falha de leitura LANÇA, nunca vira lista vazia', async () => {
        // Lista vazia significa "nada pendente". Rede caída significa "não sei".
        // Confundir as duas é herdar pendência invisível no plantão seguinte.
        const {supabase} = clienteFalso({data: null, error: {message: 'timeout'}});
        await expect(lerPendenciasAbertas(supabase)).rejects.toBeInstanceOf(FalhaDeLeitura);
    });
});

describe('lerPendenciasDoPaciente', () => {
    it('traz todas do paciente, abertas primeiro', () => {
        // concluida asc põe false antes de true; dentro de cada grupo vale a
        // mesma ordem clínica da lista geral.
        const {supabase, registro} = clienteFalso({data: [], error: null});
        return lerPendenciasDoPaciente(supabase, PAC_A).then(() => {
            expect(registro.from).toEqual(['pendencias']);
            expect(registro.eq).toEqual([['paciente_id', PAC_A]]);
            expect(registro.order).toEqual([
                ['concluida', {ascending: true}],
                ['prioridade', {ascending: true}],
                ['created_at', {ascending: true}],
            ]);
        });
    });
});

describe('indexarPendenciasPorPaciente', () => {
    it('agrupa por paciente, preservando a ordem da lista', () => {
        const p1 = pendenciaSintetica({id: PEND_1, prioridade: 1});
        const p2 = pendenciaSintetica({id: PAC_B, paciente_id: PAC_B});
        const p3 = pendenciaSintetica({id: AGORA, prioridade: 3});
        expect(indexarPendenciasPorPaciente([p1, p2, p3])).toEqual({
            [PAC_A]: [p1, p3],
            [PAC_B]: [p2],
        });
    });

    it('paciente fora do mapa significa zero pendência (a consulta só traz quem tem)', () => {
        expect(indexarPendenciasPorPaciente([])['paciente-inexistente']).toBeUndefined();
    });
});

describe('criarPendencia', () => {
    it('envia SÓ paciente_id + tarefa + prioridade — jamais internacao_id', async () => {
        // O trigger do banco carimba o episódio vigente. Mandar internacao_id
        // por cima abriria pendência presa a internação errada.
        const gravada = pendenciaSintetica({prioridade: 1});
        const {supabase, registro} = clienteFalso({data: [gravada], error: null});
        const criada = await criarPendencia(supabase, {
            paciente_id: PAC_A,
            tarefa: 'colher gasometria de controle',
            prioridade: 1,
        });

        expect(registro.from).toEqual(['pendencias']);
        expect(registro.insert).toEqual([
            {paciente_id: PAC_A, tarefa: 'colher gasometria de controle', prioridade: 1},
        ]);
        expect(registro.insert[0]).not.toHaveProperty('internacao_id');
        // Devolve a linha do banco (com id e created_at reais), lida no mesmo
        // roundtrip — a Captura mostra a pendência sem segunda consulta.
        expect(registro.select).toEqual([COLUNAS_ESPERADAS]);
        expect(criada).toEqual(gravada);
    });

    it('prioridade omitida vira 2 (rotina) — o 1 é escolha ativa do médico', async () => {
        const {supabase, registro} = clienteFalso({
            data: [pendenciaSintetica({})],
            error: null,
        });
        await criarPendencia(supabase, {paciente_id: PAC_A, tarefa: 'revisar dieta'});
        expect(registro.insert).toEqual([
            {paciente_id: PAC_A, tarefa: 'revisar dieta', prioridade: 2},
        ]);
    });

    it('falha de escrita lança erro que diz que NÃO foi salva', async () => {
        const {supabase} = clienteFalso({data: null, error: {message: 'conexão perdida'}});
        await expect(
            criarPendencia(supabase, {paciente_id: PAC_A, tarefa: 'colher lactato'}),
        ).rejects.toBeInstanceOf(FalhaAoGravarPendencia);
        await expect(
            criarPendencia(supabase, {paciente_id: PAC_A, tarefa: 'colher lactato'}),
        ).rejects.toThrow(/NÃO registrou/);
    });
});

describe('concluirPendencia', () => {
    it('filtra concluida=false — sem isso o update apaga a hora da conclusão original', async () => {
        // Mesma doutrina do ack de alertas: concluir de novo uma pendência já
        // concluída sobrescreveria o concluida_at real — a hora que a
        // passagem de plantão relata.
        const {supabase, registro} = clienteFalso({data: [{id: PEND_1}], error: null});
        const mudadas = await concluirPendencia(supabase, PEND_1, {agoraISO: AGORA});

        expect(registro.update).toEqual([{concluida: true, concluida_at: AGORA}]);
        expect(registro.eq).toEqual([
            ['id', PEND_1],
            ['concluida', false],
        ]);
        expect(mudadas).toBe(1);
    });

    it('devolve 0 quando nada mudou (id inexistente ou já concluída)', async () => {
        const {supabase} = clienteFalso({data: [], error: null});
        expect(await concluirPendencia(supabase, PEND_1, {agoraISO: AGORA})).toBe(0);
    });

    it('falha de escrita lança — a pendência CONTINUA aberta', async () => {
        const {supabase} = clienteFalso({data: null, error: {message: 'timeout'}});
        await expect(
            concluirPendencia(supabase, PEND_1, {agoraISO: AGORA}),
        ).rejects.toBeInstanceOf(FalhaAoGravarPendencia);
    });
});

describe('reabrirPendencia', () => {
    it('zera concluida_at junto — carimbo velho não pode contaminar a próxima conclusão', async () => {
        const {supabase, registro} = clienteFalso({data: [{id: PEND_1}], error: null});
        const mudadas = await reabrirPendencia(supabase, PEND_1);

        expect(registro.update).toEqual([{concluida: false, concluida_at: null}]);
        expect(registro.eq).toEqual([['id', PEND_1]]);
        expect(mudadas).toBe(1);
    });

    it('falha de escrita lança FalhaAoGravarPendencia', async () => {
        const {supabase} = clienteFalso({data: null, error: {message: 'timeout'}});
        await expect(reabrirPendencia(supabase, PEND_1)).rejects.toBeInstanceOf(
            FalhaAoGravarPendencia,
        );
    });
});
