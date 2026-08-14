/**
 * Testes da gravação do Fechamento.
 *
 * As três travas que interessam (armadilhas documentadas, não "cobrir linha"):
 *  1. `salvarFicha` SEMPRE manda `hd` e `alergias` (e idade/peso/altura) —
 *     a RPC grava esses campos SEM coalesce; chave ausente APAGA o valor.
 *  2. O UPDATE complementar NÃO toca coluna que a RPC já gravou — duas
 *     escritas na mesma coluna seriam duas verdades concorrentes.
 *  3. SOFA incompleto grava `sofa_total` null (travessão), nunca a soma
 *     parcial vestida de total — e o snapshot leva a transparência inteira.
 *
 * Fixture 100% SINTÉTICA: nomes, drogas e UUIDs inventados aqui.
 */
import {describe, expect, it} from 'vitest';

import type {ResultadoSofa} from '@/lib/clinical/sofa';

import type {
    ClienteSasi,
    EntradaDeFicha,
    EvolucaoDaFicha,
    PacienteDaFicha,
} from '@/features/fechamento/types';

import {
    CAMPOS_DA_RPC,
    complementarEvolucao,
    derivarPlantaoLegado,
    derivarRelogiosDaNota,
    EntradaDeFichaRecusada,
    FalhaAoGravarFicha,
    salvarFicha,
} from './ficha';

// UUIDs sintéticos, formato v4, sem relação com paciente nenhum.
const PAC = '11111111-1111-4111-8111-111111111111';
const EVOL = '22222222-2222-4222-8222-222222222222';
const AGORA = '2026-08-13T21:00:00.000Z';

/**
 * Dublê thenable — mesmo padrão de `pendencias.test.ts`, acrescido de `rpc`
 * (que no supabase-js também devolve um construtor com `then` próprio).
 */
function clienteFalso(resposta: {data: unknown; error: {message: string} | null}) {
    const registro = {
        rpc: [] as Array<[string, Record<string, unknown>]>,
        from: [] as string[],
        update: [] as Array<Record<string, unknown>>,
        eq: [] as Array<[string, unknown]>,
        select: [] as string[],
    };

    const construtor: any = {
        update(patch: Record<string, unknown>) {
            registro.update.push(patch);
            return construtor;
        },
        eq(coluna: string, valor: unknown) {
            registro.eq.push([coluna, valor]);
            return construtor;
        },
        select(colunas: string) {
            registro.select.push(colunas);
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
        rpc(nome: string, args: Record<string, unknown>) {
            registro.rpc.push([nome, args]);
            return construtor;
        },
    };

    return {supabase: supabase as unknown as ClienteSasi, registro};
}

/** A 1ª chamada de RPC anotada — lançar se não houve é melhor que índice cego. */
function primeiraChamadaRpc(registro: {
    rpc: Array<[string, Record<string, unknown>]>;
}): [string, Record<string, unknown>] {
    const chamada = registro.rpc[0];
    if (!chamada) throw new Error('a RPC nunca foi chamada');
    return chamada;
}

/** O 1º patch de UPDATE anotado — mesma doutrina. */
function primeiroPatch(registro: {update: Array<Record<string, unknown>>}): Record<string, unknown> {
    const patch = registro.update[0];
    if (!patch) throw new Error('o UPDATE nunca foi chamado');
    return patch;
}

function pacienteSintetico(extra?: Partial<PacienteDaFicha>): PacienteDaFicha {
    return {
        hd: 'choque séptico de foco pulmonar',
        alergias: 'dipirona',
        idade: 62,
        peso: 78,
        altura: 170,
        ...extra,
    };
}

function evolucaoSintetica(): EvolucaoDaFicha {
    return {
        neuro: {rass: -2},
        resp: {suporte: 'VM'},
        hemo: {ritmo: 'sinusal'},
        tgi: {dieta: 'enteral plena'},
        renal: {},
        hemato: {},
        infecto: {},
        dvas: ['Noradrenalina 12 ml/h'],
        sedativos: [],
        impressao: ['1. Choque séptico em desmame de droga vasoativa'],
        conduta: ['1. Reduzir noradrenalina mantendo PAM acima de 65 (meta PAM 65)'],
        problemas_ativos: [{texto: 'choque séptico'}],
        riscos: [],
    };
}

function entradaSintetica(extra?: Partial<EntradaDeFicha>): EntradaDeFicha {
    return {
        paciente_id: PAC,
        evolucao_id: EVOL,
        turno: 'noturna',
        paciente: pacienteSintetico(),
        evolucao: evolucaoSintetica(),
        ...extra,
    };
}

describe('derivarPlantaoLegado', () => {
    it('mapeia o turno real para o enum legado que a RPC exige', () => {
        expect(derivarPlantaoLegado('diurna')).toBe('manha');
        expect(derivarPlantaoLegado('noturna')).toBe('noite');
    });
});

describe('derivarRelogiosDaNota', () => {
    it('nota noturna iniciada de madrugada cai no DIA ANTERIOR', () => {
        // 08:00 UTC = 05:00 em São Paulo (UTC-3): plantão noturno que começou
        // ONTEM às 19h — mesma regra de fn_evolucao_relogios.
        expect(derivarRelogiosDaNota(new Date('2026-08-13T08:00:00Z'))).toEqual({
            dataPlantao: '2026-08-12',
            turno: 'noturna',
        });
    });

    it('nota diurna fica no próprio dia', () => {
        // 13:00 UTC = 10:00 em São Paulo.
        expect(derivarRelogiosDaNota(new Date('2026-08-13T13:00:00Z'))).toEqual({
            dataPlantao: '2026-08-13',
            turno: 'diurna',
        });
    });

    it('noturna iniciada antes da meia-noite fica no dia do início', () => {
        // 23:30 UTC = 20:30 em São Paulo: plantão noturno de 13/08.
        expect(derivarRelogiosDaNota(new Date('2026-08-13T23:30:00Z'))).toEqual({
            dataPlantao: '2026-08-13',
            turno: 'noturna',
        });
    });
});

describe('salvarFicha', () => {
    it('SEMPRE manda hd e alergias — mesmo quando são null', async () => {
        // ARMADILHA DOCUMENTADA: a RPC grava hd e alergias SEM coalesce.
        // Payload sem as chaves APAGA o valor no banco. O tipo obriga a
        // enviá-los; este teste trava que a função não os filtre no caminho.
        const {supabase, registro} = clienteFalso({data: EVOL, error: null});
        await salvarFicha(
            supabase,
            entradaSintetica({paciente: pacienteSintetico({hd: null, alergias: null})}),
        );

        const [nome, args] = primeiraChamadaRpc(registro);
        expect(nome).toBe('save_ficha');
        const pPac = args.p_pac as Record<string, unknown>;
        expect(Object.hasOwn(pPac, 'hd')).toBe(true);
        expect(Object.hasOwn(pPac, 'alergias')).toBe(true);
        expect(pPac.hd).toBeNull();
        expect(pPac.alergias).toBeNull();
        // idade/peso/altura têm a MESMA armadilha (nullif sem coalesce).
        expect(Object.hasOwn(pPac, 'idade')).toBe(true);
        expect(Object.hasOwn(pPac, 'peso')).toBe(true);
        expect(Object.hasOwn(pPac, 'altura')).toBe(true);
    });

    it('campo protegido por coalesce só vai se a tela o trouxe', async () => {
        const {supabase, registro} = clienteFalso({data: EVOL, error: null});
        await salvarFicha(supabase, entradaSintetica());

        const pPac = primeiraChamadaRpc(registro)[1].p_pac as Record<string, unknown>;
        // nome/leito/gravidade/data_adm ausentes: a RPC preserva o valor atual.
        expect(Object.keys(pPac).sort()).toEqual(['alergias', 'altura', 'hd', 'idade', 'peso']);
    });

    it('deriva p_plantao legado do turno real e repassa o alvo da nota', async () => {
        const {supabase, registro} = clienteFalso({data: EVOL, error: null});
        await salvarFicha(supabase, entradaSintetica({turno: 'noturna'}));

        const args = primeiraChamadaRpc(registro)[1];
        expect(args.p_plantao).toBe('noite');
        expect(args.p_paciente_id).toBe(PAC);
        expect(args.p_evolucao_id).toBe(EVOL);
    });

    it('nota nova manda p_evolucao_id null — o caminho de INSERT da RPC', async () => {
        const {supabase, registro} = clienteFalso({data: EVOL, error: null});
        await salvarFicha(supabase, entradaSintetica({evolucao_id: null, turno: 'diurna'}));

        const args = primeiraChamadaRpc(registro)[1];
        expect(args.p_evolucao_id).toBeNull();
        expect(args.p_plantao).toBe('manha');
    });

    it('p_evol leva exatamente o que a RPC grava — sem condutas_sistemas nem intercorrencias', async () => {
        // condutas_sistemas é modelo morto (decisão 8); intercorrencias é
        // assunto do UPDATE complementar. E jamais internacao_id.
        const {supabase, registro} = clienteFalso({data: EVOL, error: null});
        await salvarFicha(supabase, entradaSintetica());

        const pEvol = primeiraChamadaRpc(registro)[1].p_evol as Record<string, unknown>;
        expect(Object.keys(pEvol).sort()).toEqual([
            'conduta',
            'dvas',
            'hemato',
            'hemo',
            'impressao',
            'infecto',
            'neuro',
            'problemas_ativos',
            'renal',
            'resp',
            'riscos',
            'sedativos',
            'tgi',
        ]);
    });

    it('pendências omitidas viram lista vazia — a RPC não aceita a chave ausente', async () => {
        const {supabase, registro} = clienteFalso({data: EVOL, error: null});
        await salvarFicha(supabase, entradaSintetica());
        expect(primeiraChamadaRpc(registro)[1].p_pendencias).toEqual([]);
    });

    it('devolve o id da evolução gravada — o alvo do complementar', async () => {
        const {supabase} = clienteFalso({data: EVOL, error: null});
        expect(await salvarFicha(supabase, entradaSintetica())).toBe(EVOL);
    });

    it('falha da RPC lança erro que diz que a ficha NÃO foi salva', async () => {
        const {supabase} = clienteFalso({data: null, error: {message: 'conexão perdida'}});
        await expect(salvarFicha(supabase, entradaSintetica())).rejects.toBeInstanceOf(FalhaAoGravarFicha);
        await expect(salvarFicha(supabase, entradaSintetica())).rejects.toThrow(/NÃO registrou/);
    });

    it('resposta sem id também é falha — sucesso sem alvo não é sucesso', async () => {
        const {supabase} = clienteFalso({data: null, error: null});
        await expect(salvarFicha(supabase, entradaSintetica())).rejects.toBeInstanceOf(FalhaAoGravarFicha);
    });
});

/** Um SOFA sintético INCOMPLETO (4 de 6) — o caso que mais importa travar. */
function sofaSintetico(): ResultadoSofa {
    return {
        total: null,
        parcial: 5,
        apurados: 4,
        componentes: {
            resp: {pontos: 2},
            coag: {pontos: 1},
            hepatico: {pontos: null, faltou: 'bilirrubina'},
            cardio: {pontos: 2},
            neuro: {pontos: null, faltou: 'Glasgow'},
            renal: {pontos: 0},
        },
        faltando: ['bilirrubina', 'Glasgow'],
        suprimidos: [],
        ressalvas: [],
        calculadoEm: AGORA,
    };
}

describe('complementarEvolucao', () => {
    it('grava só o que a RPC não cobre — e NENHUM campo que ela já gravou', async () => {
        const {supabase, registro} = clienteFalso({data: [{id: EVOL}], error: null});
        const mudadas = await complementarEvolucao(supabase, EVOL, {
            dataPlantao: '2026-08-12',
            turno: 'noturna',
            tipoNota: 'seriada',
            autorCrm: '123456-SP',
            autorNome: 'Dr. Sintético',
            illnessSeverity: 'instavel',
            intercorrencias: ['Hipotensão transitória revertida com volume'],
            sofa: sofaSintetico(),
            finalizadaEm: AGORA,
        });

        expect(registro.from).toEqual(['evolucoes']);
        expect(registro.eq).toEqual([['id', EVOL]]);
        const patch = primeiroPatch(registro);
        expect(Object.keys(patch).sort()).toEqual([
            'autor_crm',
            'autor_nome',
            'data_plantao',
            'finalizada_em',
            'illness_severity',
            'intercorrencias',
            'sofa_snapshot',
            'sofa_total',
            'tipo_nota',
            'turno',
        ]);
        // A fronteira com a RPC: nenhuma coluna dela aparece no patch.
        for (const campo of CAMPOS_DA_RPC) {
            expect(patch).not.toHaveProperty(campo);
        }
        expect(mudadas).toBe(1);
    });

    it('é update PARCIAL: só fechar a nota não toca relógio, autor nem SOFA', async () => {
        const {supabase, registro} = clienteFalso({data: [{id: EVOL}], error: null});
        await complementarEvolucao(supabase, EVOL, {finalizadaEm: AGORA});
        expect(registro.update).toEqual([{finalizada_em: AGORA}]);
    });

    it('SOFA incompleto grava total null (travessão) e o snapshot com a transparência', async () => {
        // total null NUNCA vira a soma parcial: um "SOFA 5" apurado sobre 4/6
        // é número que parece medido e não é. O snapshot leva apurados e
        // faltando — é o que permite "componentes capturados: 4/6".
        const {supabase, registro} = clienteFalso({data: [{id: EVOL}], error: null});
        const sofa = sofaSintetico();
        await complementarEvolucao(supabase, EVOL, {sofa});

        const patch = primeiroPatch(registro);
        expect(patch.sofa_total).toBeNull();
        expect(patch.sofa_snapshot).toEqual(sofa);
        expect((patch.sofa_snapshot as ResultadoSofa).faltando).toEqual(['bilirrubina', 'Glasgow']);
    });

    it('sem campo nenhum é recusado ANTES de tocar o banco', async () => {
        const {supabase, registro} = clienteFalso({data: [], error: null});
        await expect(complementarEvolucao(supabase, EVOL, {})).rejects.toBeInstanceOf(EntradaDeFichaRecusada);
        expect(registro.from).toEqual([]);
    });

    it('devolve 0 quando o id não existe — o chamador decide o que fazer', async () => {
        const {supabase} = clienteFalso({data: [], error: null});
        expect(await complementarEvolucao(supabase, EVOL, {finalizadaEm: AGORA})).toBe(0);
    });

    it('falha de escrita lança — a nota NÃO está complementada', async () => {
        const {supabase} = clienteFalso({data: null, error: {message: 'timeout'}});
        await expect(complementarEvolucao(supabase, EVOL, {finalizadaEm: AGORA})).rejects.toBeInstanceOf(
            FalhaAoGravarFicha,
        );
    });
});
