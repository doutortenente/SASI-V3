/**
 * Testes do serviço de alertas.
 *
 * Duas classes de teste, com pesos diferentes:
 *  1. funções puras (agregar, indexar, normalizar) — conta que aparece na tela;
 *  2. FORMATO DA CONSULTA — aqui o teste existe para travar armadilha conhecida,
 *     não para "cobrir linha". Cada um desses tem um comentário dizendo qual
 *     estrago ele impede. Se alguém apagar o `.eq('acked', false)` do ack em
 *     lote, o teste tem que ficar vermelho na hora.
 *
 * Fixture 100% SINTÉTICA: nomes e UUIDs inventados aqui. `_material/` tem dado
 * real de paciente e não entra em teste.
 */
import {describe, expect, it, vi} from 'vitest';

import {
    agregarAlertasAbertos,
    type ClienteSasi,
    FalhaAoReconhecerAlerta,
    indexarResumoPorPaciente,
    lerAlertasAbertosDoPaciente,
    lerResumoDeAlertasAbertos,
    normalizarResumo,
    reconhecerAlerta,
    reconhecerAlertasDoPaciente,
    type ResumoDeAlertasDoLeito,
} from './alertas';
import {FalhaDeLeitura} from '@/lib/data/erros';

// UUIDs sintéticos, no formato v4, sem relação com paciente nenhum.
const PAC_A = '11111111-1111-4111-8111-111111111111';
const PAC_B = '22222222-2222-4222-8222-222222222222';
const ALERTA_1 = '33333333-3333-4333-8333-333333333333';
const AGORA = '2026-08-08T22:00:00.000Z';

/**
 * Dublê do cliente Supabase.
 *
 * O construtor de consulta do supabase-js é "thenable": `await from().select()`
 * funciona porque o próprio construtor tem `then`. O dublê copia isso e vai
 * anotando cada elo da corrente, para o teste conferir a consulta MONTADA —
 * que é o contrato que interessa aqui.
 */
function clienteFalso(resposta: {data: unknown; error: {message: string} | null}) {
    const registro = {
        from: [] as string[],
        select: [] as string[],
        eq: [] as Array<[string, unknown]>,
        order: [] as Array<[string, unknown]>,
        update: [] as Array<Record<string, unknown>>,
    };
    const getUser = vi.fn();

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
        auth: {getUser},
    };

    return {supabase: supabase as unknown as ClienteSasi, registro, getUser};
}

const RESUMO: ResumoDeAlertasDoLeito[] = [
    {
        paciente_id: PAC_A,
        uti: 'UTI3',
        leito: 'UTI3-L07',
        nome: 'Paciente Sintético A',
        criticos: 2,
        warnings: 1,
        infos: 0,
        total: 3,
    },
    {
        paciente_id: PAC_B,
        uti: 'UTI2',
        leito: 'UTI2-L01',
        nome: 'Paciente Sintético B',
        criticos: 0,
        warnings: 4,
        infos: 1,
        total: 5,
    },
];

describe('normalizarResumo', () => {
    it('contagem nula da view vira 0 (count(*) no Postgres nunca é null)', () => {
        const pronto = normalizarResumo([
            {
                paciente_id: PAC_A,
                uti: 'UTI3',
                leito: 'UTI3-L07',
                nome: 'Paciente Sintético A',
                criticos: 1,
                warnings: null,
                infos: null,
                total: 1,
            },
        ]);
        expect(pronto).toEqual([
            {
                paciente_id: PAC_A,
                uti: 'UTI3',
                leito: 'UTI3-L07',
                nome: 'Paciente Sintético A',
                criticos: 1,
                warnings: 0,
                infos: 0,
                total: 1,
            },
        ]);
    });

    it('descarta a linha que não dá para atribuir a um leito', () => {
        // Alerta crítico sem dono na tela é pior do que alerta nenhum:
        // o médico vê "2 críticos" e não sabe em qual box entrar.
        const pronto = normalizarResumo([
            {
                paciente_id: null,
                uti: 'UTI3',
                leito: null,
                nome: null,
                criticos: 2,
                warnings: 0,
                infos: 0,
                total: 2,
            },
        ]);
        expect(pronto).toEqual([]);
    });
});

describe('agregarAlertasAbertos', () => {
    it('soma as linhas que a tela já tem, sem segunda consulta', () => {
        expect(agregarAlertasAbertos(RESUMO)).toEqual({
            criticos: 2,
            warnings: 5,
            infos: 1,
            total: 8,
            leitosComAlerta: 2,
        });
    });

    it('nenhum alerta aberto devolve zeros, não erro', () => {
        expect(agregarAlertasAbertos([])).toEqual({
            criticos: 0,
            warnings: 0,
            infos: 0,
            total: 0,
            leitosComAlerta: 0,
        });
    });
});

describe('indexarResumoPorPaciente', () => {
    it('mapeia paciente para contagem, no formato que o card consome', () => {
        expect(indexarResumoPorPaciente(RESUMO)).toEqual({
            [PAC_A]: {criticos: 2, warnings: 1, infos: 0},
            [PAC_B]: {criticos: 0, warnings: 4, infos: 1},
        });
    });

    it('paciente fora do mapa significa zero alerta aberto (a view só traz quem tem)', () => {
        expect(indexarResumoPorPaciente([])['paciente-inexistente']).toBeUndefined();
    });
});

describe('lerResumoDeAlertasAbertos', () => {
    it('lê a view agregada, não a tabela crua', () => {
        // Ler `alerts_log` direto e agrupar no navegador traria as 14 linhas
        // inteiras (payload jsonb incluso) para exibir 3 números por card.
        const {supabase, registro} = clienteFalso({data: [], error: null});
        return lerResumoDeAlertasAbertos(supabase).then((linhas) => {
            expect(registro.from).toEqual(['vw_alertas_abertos']);
            expect(registro.select).toEqual([
                'paciente_id, uti, leito, nome, criticos, warnings, infos, total',
            ]);
            expect(linhas).toEqual([]);
        });
    });

    it('falha de leitura LANÇA, nunca vira lista vazia', async () => {
        // Lista vazia significa "nenhum alerta aberto". Rede caída significa
        // "não sei". Confundir as duas à beira do leito é o pior erro desta tela.
        const {supabase} = clienteFalso({data: null, error: {message: 'timeout'}});
        await expect(lerResumoDeAlertasAbertos(supabase)).rejects.toBeInstanceOf(FalhaDeLeitura);
    });
});

describe('lerAlertasAbertosDoPaciente', () => {
    it('filtro e ordem casam exatamente com o índice idx_alerts_pac_ack', () => {
        // (paciente_id, acked, created_at desc). Trocar para `ascending: true`
        // tira a consulta do índice e ela passa a varrer a tabela.
        const {supabase, registro} = clienteFalso({data: [], error: null});
        return lerAlertasAbertosDoPaciente(supabase, PAC_A).then(() => {
            expect(registro.from).toEqual(['alerts_log']);
            expect(registro.eq).toEqual([
                ['paciente_id', PAC_A],
                ['acked', false],
            ]);
            expect(registro.order).toEqual([['created_at', {ascending: false}]]);
        });
    });
});

describe('reconhecerAlerta', () => {
    it('grava acked_by null e NÃO consulta o usuário logado', async () => {
        // Armadilha do v2: o hook original chamava auth.getUser() para preencher
        // acked_by. Com o login fechado isso volta vazio e pode travar o botão.
        // Em produção, 14 de 14 linhas têm acked_by null — inclusive as 5 já
        // reconhecidas com sucesso.
        const {supabase, registro, getUser} = clienteFalso({data: [{id: ALERTA_1}], error: null});
        const mudadas = await reconhecerAlerta(supabase, ALERTA_1, {agoraISO: AGORA});

        expect(getUser).not.toHaveBeenCalled();
        expect(registro.update).toEqual([{acked: true, acked_at: AGORA, acked_by: null}]);
        expect(registro.eq).toEqual([['id', ALERTA_1]]);
        expect(mudadas).toBe(1);
    });

    it('aceita o id do operador quando ele existir', async () => {
        const {supabase, registro} = clienteFalso({data: [{id: ALERTA_1}], error: null});
        await reconhecerAlerta(supabase, ALERTA_1, {agoraISO: AGORA, reconhecidoPor: PAC_A});
        expect(registro.update).toEqual([{acked: true, acked_at: AGORA, acked_by: PAC_A}]);
    });

    it('devolve 0 quando nenhuma linha mudou (id inexistente ou já reconhecido)', async () => {
        const {supabase} = clienteFalso({data: [], error: null});
        expect(await reconhecerAlerta(supabase, ALERTA_1, {agoraISO: AGORA})).toBe(0);
    });
});

describe('reconhecerAlertasDoPaciente', () => {
    it('filtra acked=false — sem isso o update apaga a hora do ack anterior', async () => {
        // O segundo .eq não é redundante. Sem ele o update pega também as linhas
        // já reconhecidas e sobrescreve o acked_at delas, destruindo a trilha de
        // quando o alerta foi visto pela primeira vez.
        const {supabase, registro} = clienteFalso({
            data: [{id: ALERTA_1}, {id: PAC_B}],
            error: null,
        });
        const mudadas = await reconhecerAlertasDoPaciente(supabase, PAC_A, {agoraISO: AGORA});

        expect(registro.eq).toEqual([
            ['paciente_id', PAC_A],
            ['acked', false],
        ]);
        expect(registro.update).toEqual([{acked: true, acked_at: AGORA, acked_by: null}]);
        expect(mudadas).toBe(2);
    });

    it('falha de escrita lança erro que diz que o alerta CONTINUA ABERTO', async () => {
        const {supabase} = clienteFalso({data: null, error: {message: 'conexão perdida'}});
        await expect(reconhecerAlertasDoPaciente(supabase, PAC_A, {agoraISO: AGORA})).rejects.toBeInstanceOf(
            FalhaAoReconhecerAlerta,
        );
        await expect(reconhecerAlertasDoPaciente(supabase, PAC_A, {agoraISO: AGORA})).rejects.toThrow(
            /CONTINUA ABERTO/,
        );
    });
});
