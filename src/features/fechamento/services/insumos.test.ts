/**
 * Testes da leitura do Fechamento.
 *
 * Duas classes, mesma doutrina de `pendencias.test.ts`:
 *  1. funções puras (`maisRecentePorTipo`, `normalizarAtbsAtivos`);
 *  2. FORMATO DAS CONSULTAS — trava de armadilha, não "cobrir linha". Se
 *     alguém tirar o `limit(1)` da nota corrente ou trocar a ordem do ATB,
 *     o teste fica vermelho na hora.
 *
 * O dublê aqui é POR TABELA (evolução do thenable de `pendencias.test.ts`):
 * `lerInsumosDoFechamento` dispara 8 consultas em paralelo, e um dublê de
 * resposta única não saberia dizer qual `.eq()` pertence a qual fonte.
 *
 * Fixture 100% SINTÉTICA: nomes e UUIDs inventados aqui. `_material/` tem
 * dado real de paciente e não entra em teste.
 */
import {describe, expect, it} from 'vitest';

import {FalhaDeLeitura} from '@/lib/data/erros';

import type {JanelaRender} from '@/features/captura/types';
import type {ClienteSasi} from '@/features/fechamento/types';

import {
    lerAtbsAtivosDoPaciente,
    lerAtbsDoPaciente,
    lerBhAcumulado,
    lerEvolucaoCorrente,
    lerInsumosDoFechamento,
    lerSofaDiarioMaisRecente,
    maisRecentePorTipo,
    normalizarAtbsAtivos,
} from './insumos';

// UUIDs sintéticos, formato v4, sem relação com paciente nenhum.
const PAC = '11111111-1111-4111-8111-111111111111';
const EVOL = '22222222-2222-4222-8222-222222222222';
const ATB_1 = '33333333-3333-4333-8333-333333333333';

const COLUNAS_EVOLUCAO_ESPERADAS =
    'id, neuro, resp, hemo, tgi, renal, hemato, infecto, dvas, sedativos, ' +
    'impressao, conduta, intercorrencias, problemas_ativos, riscos, ' +
    'sofa_snapshot, sofa_total, data_plantao, turno, tipo_nota, ' +
    'illness_severity, autor_crm, autor_nome, finalizada_em';

type Resposta = { data: unknown; error: { message: string } | null };

interface RegistroDeTabela {
    select: string[];
    eq: Array<[string, unknown]>;
    order: Array<[string, unknown]>;
    limit: number[];
}

/**
 * Dublê POR TABELA: cada `from(tabela)` responde com a resposta configurada
 * para aquela tabela (padrão: lista vazia) e anota a corrente montada num
 * registro próprio — assim dá para conferir a consulta de cada uma das 8
 * fontes paralelas sem as anotações se misturarem.
 */
function clienteFalso(respostas: Record<string, Resposta> = {}) {
    const registro: Record<string, RegistroDeTabela> = {};

    const supabase = {
        from(tabela: string) {
            const reg = (registro[tabela] ??= {select: [], eq: [], order: [], limit: []});
            const construtor: any = {
                select(colunas: string) {
                    reg.select.push(colunas);
                    return construtor;
                },
                eq(coluna: string, valor: unknown) {
                    reg.eq.push([coluna, valor]);
                    return construtor;
                },
                order(coluna: string, opcoes: unknown) {
                    reg.order.push([coluna, opcoes]);
                    return construtor;
                },
                limit(n: number) {
                    reg.limit.push(n);
                    return construtor;
                },
                then(aceita: (r: unknown) => unknown, rejeita?: (e: unknown) => unknown) {
                    const resposta = respostas[tabela] ?? {data: [], error: null};
                    return Promise.resolve(resposta).then(aceita, rejeita);
                },
            };
            return construtor;
        },
    };

    return {supabase: supabase as unknown as ClienteSasi, registro};
}

/** O registro da tabela consultada — lançar se ninguém a consultou é melhor que índice cego. */
function regDe(registro: Record<string, RegistroDeTabela>, tabela: string): RegistroDeTabela {
    const reg = registro[tabela];
    if (!reg) throw new Error(`a tabela ${tabela} nunca foi consultada`);
    return reg;
}

/** Janela sintética de render — só os campos que o teste olha. */
function janelaSintetica(extra: Partial<JanelaRender>): JanelaRender {
    return {
        id: null,
        paciente_id: PAC,
        tipo: 'pam',
        rotulo: 'PAM',
        unidade_padrao: 'mmHg',
        janela_inicio: '2026-08-12T22:00:00+00:00',
        janela_fim: '2026-08-13T22:00:00+00:00',
        valor_max: 90,
        valor_min: 56,
        n_total: 12,
        n_fora_alto: null,
        n_fora_baixo: 4,
        limiar_alto: null,
        limiar_baixo: 65,
        faixa_txt: '90-56',
        excursoes_txt: '(4/12 <65)',
        render: 'PAM 90-56 (4/12 <65)',
        requires_review: false,
        created_at: null,
        ...extra,
    };
}

describe('lerEvolucaoCorrente', () => {
    it('pede a nota mais recente: order data_evolucao desc + limit 1', async () => {
        const nota = {id: EVOL, intercorrencias: []};
        const {supabase, registro} = clienteFalso({evolucoes: {data: [nota], error: null}});
        const lida = await lerEvolucaoCorrente(supabase, PAC);

        const reg = regDe(registro, 'evolucoes');
        expect(reg.select).toEqual([COLUNAS_EVOLUCAO_ESPERADAS]);
        expect(reg.eq).toEqual([['paciente_id', PAC]]);
        expect(reg.order).toEqual([['data_evolucao', {ascending: false}]]);
        expect(reg.limit).toEqual([1]);
        expect(lida).toEqual(nota);
    });

    it('paciente sem nota devolve null — resposta LEGÍTIMA, não falha', async () => {
        // Recém-admitido sem evolução: o Fechamento cria a primeira nota
        // (caminho de INSERT da RPC). null aqui tem significado clínico.
        const {supabase} = clienteFalso({evolucoes: {data: [], error: null}});
        expect(await lerEvolucaoCorrente(supabase, PAC)).toBeNull();
    });

    it('falha de leitura LANÇA, nunca vira null silencioso', async () => {
        // "não existe nota" e "não consegui perguntar" são clinicamente
        // opostos — confundir os dois faria o app criar nota nova por cima
        // de uma que existe e a rede escondeu.
        const {supabase} = clienteFalso({evolucoes: {data: null, error: {message: 'timeout'}}});
        await expect(lerEvolucaoCorrente(supabase, PAC)).rejects.toBeInstanceOf(FalhaDeLeitura);
    });
});

describe('maisRecentePorTipo', () => {
    it('fica com a janela de janela_fim maior de cada tipo, mesmo fora de ordem', () => {
        const velha = janelaSintetica({janela_fim: '2026-08-12T22:00:00+00:00', render: 'velha'});
        const nova = janelaSintetica({janela_fim: '2026-08-13T22:00:00+00:00', render: 'nova'});
        const fc = janelaSintetica({tipo: 'fc', render: 'FC 110-72'});
        // A velha chega primeiro DE PROPÓSITO: a função não pode depender da
        // ordem da consulta.
        expect(maisRecentePorTipo([velha, fc, nova])).toEqual([nova, fc]);
    });

    it('descarta linha sem tipo; sem janela_fim perde para qualquer datada', () => {
        const semTipo = janelaSintetica({tipo: null});
        const semFim = janelaSintetica({janela_fim: null, render: 'sem fim'});
        const datada = janelaSintetica({render: 'datada'});
        expect(maisRecentePorTipo([semTipo, semFim, datada])).toEqual([datada]);
    });
});

describe('lerAtbsDoPaciente', () => {
    it('lê o histórico COMPLETO, mais recente primeiro', async () => {
        // Decisão de 10-ago: a evolução carrega o histórico completo; a
        // passagem só os ativos (que vêm da view, noutro serviço).
        const {supabase, registro} = clienteFalso();
        await lerAtbsDoPaciente(supabase, PAC);

        const reg = regDe(registro, 'atbs');
        expect(reg.eq).toEqual([['paciente_id', PAC]]);
        expect(reg.order).toEqual([['data_inicio', {ascending: false}]]);
        // internacao_id NUNCA entra na consulta — assunto do trigger.
        expect(reg.select[0]).not.toContain('internacao_id');
    });
});

describe('lerAtbsAtivosDoPaciente + normalizarAtbsAtivos', () => {
    it('lê a view com o esquema há mais tempo rodando primeiro', async () => {
        const {supabase, registro} = clienteFalso();
        await lerAtbsAtivosDoPaciente(supabase, PAC);

        const reg = regDe(registro, 'vw_dias_atb_ativo');
        expect(reg.eq).toEqual([['paciente_id', PAC]]);
        expect(reg.order).toEqual([['data_inicio', {ascending: true}]]);
    });

    it('dias_terapia null fica null (travessão na tela) — a linha NÃO é descartada', () => {
        const linhas = [
            {
                atb_id: ATB_1,
                paciente_id: PAC,
                droga: 'meropenem',
                via: 'EV' as const,
                frequencia: '8/8h',
                data_inicio: null,
                dias_terapia: null,
                intencao: null,
                foco: null,
                agente_alvo: null,
                stewardship_flag: null,
            },
            // Sem droga não se sabe QUAL antibiótico é — descarta.
            {
                atb_id: ATB_1,
                paciente_id: PAC,
                droga: null,
                via: null,
                frequencia: null,
                data_inicio: null,
                dias_terapia: 3,
                intencao: null,
                foco: null,
                agente_alvo: null,
                stewardship_flag: null,
            },
        ];
        const pronto = normalizarAtbsAtivos(linhas);
        expect(pronto).toHaveLength(1);
        expect(pronto[0]?.dias_terapia).toBeNull();
    });
});

describe('lerBhAcumulado', () => {
    it('sem evento de BH devolve null — travessão, nunca "BH 0"', async () => {
        // Zero é um balanço MEDIDO e neutro; ausência é outra coisa.
        const {supabase, registro} = clienteFalso();
        expect(await lerBhAcumulado(supabase, PAC)).toBeNull();
        expect(regDe(registro, 'vw_bh_acumulado').eq).toEqual([['paciente_id', PAC]]);
    });

    it('devolve a linha única da view quando existe', async () => {
        const bh = {paciente_id: PAC, bh_24h: 850, bh_48h: 1200, bh_72h: null, eventos_24h: 4};
        const {supabase} = clienteFalso({vw_bh_acumulado: {data: [bh], error: null}});
        expect(await lerBhAcumulado(supabase, PAC)).toEqual(bh);
    });
});

describe('lerSofaDiarioMaisRecente', () => {
    it('pede só o último dia: order dia desc + limit 1', async () => {
        const {supabase, registro} = clienteFalso();
        expect(await lerSofaDiarioMaisRecente(supabase, PAC)).toBeNull();

        const reg = regDe(registro, 'vw_sofa_diario');
        expect(reg.eq).toEqual([['paciente_id', PAC]]);
        expect(reg.order).toEqual([['dia', {ascending: false}]]);
        expect(reg.limit).toEqual([1]);
        // As colunas de transparência (X/6 · faltando) têm que vir junto —
        // sem elas a tela não consegue dizer o que falta no escore.
        expect(reg.select[0]).toContain('componentes_presentes');
        expect(reg.select[0]).toContain('componentes_faltantes');
    });
});

describe('lerInsumosDoFechamento', () => {
    it('consulta as 8 fontes, todas filtradas pelo paciente', async () => {
        const {supabase, registro} = clienteFalso();
        const insumos = await lerInsumosDoFechamento(supabase, PAC);

        expect(Object.keys(registro).sort()).toEqual([
            'alerts_log',
            'atbs',
            'pendencias',
            'vw_bh_acumulado',
            'vw_dias_atb_ativo',
            'vw_dispositivos_ativos',
            'vw_janelas_24h_render',
            'vw_sofa_diario',
        ]);
        for (const tabela of Object.keys(registro)) {
            expect(regDe(registro, tabela).eq).toContainEqual(['paciente_id', PAC]);
        }
        // Banco sem insumo ainda (atbs/janelas em 0 linhas é o estado medido):
        // listas vazias e nulls são resposta legítima, não defeito.
        expect(insumos).toEqual({
            janelas: [],
            atbHistoricoCompleto: [],
            atbAtivos: [],
            bh: null,
            sofaDiario: null,
            dispositivos: [],
            pendencias: [],
            alertasAbertos: [],
        });
    });

    it('deduplica as janelas: uma linha por tipo, a mais recente', async () => {
        const velha = janelaSintetica({janela_fim: '2026-08-12T22:00:00+00:00', render: 'velha'});
        const nova = janelaSintetica({janela_fim: '2026-08-13T22:00:00+00:00', render: 'nova'});
        const {supabase} = clienteFalso({
            vw_janelas_24h_render: {data: [nova, velha], error: null},
        });
        const insumos = await lerInsumosDoFechamento(supabase, PAC);
        expect(insumos.janelas).toEqual([nova]);
    });

    it('falha em UMA fonte derruba o conjunto — nota sem seção é mentira', async () => {
        // Promise.all, não allSettled: com allSettled a evolução sairia sem
        // os ATB porque a rede caiu, em silêncio.
        const {supabase} = clienteFalso({atbs: {data: null, error: {message: 'timeout'}}});
        await expect(lerInsumosDoFechamento(supabase, PAC)).rejects.toBeInstanceOf(FalhaDeLeitura);
    });
});
