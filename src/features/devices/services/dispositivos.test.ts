/**
 * Testes do serviço de dispositivos ativos.
 *
 * O que estes testes travam:
 *  - o serviço lê a VIEW `vw_dispositivos_ativos` (dias derivados no banco),
 *    nunca a tabela crua — recalcular dias na tela é a armadilha proibida;
 *  - `dias_em_uso` null fica null (travessão na tela), jamais vira 0:
 *    "zero dias" é cateter passado hoje, "não sei" é outra coisa;
 *  - falha de leitura lança, nunca vira lista vazia.
 *
 * Fixture 100% SINTÉTICA: UUIDs inventados aqui. `_material/` tem dado real
 * de paciente e não entra em teste.
 */
import {describe, expect, it} from 'vitest';

import {
    type ClienteSasi,
    type DispositivoAtivo,
    indexarDispositivosPorPaciente,
    lerDispositivosAtivos,
    lerDispositivosDoPaciente,
    normalizarDispositivos,
} from './dispositivos';
import {FalhaDeLeitura} from '@/lib/data/erros';

// UUIDs sintéticos, no formato v4, sem relação com paciente nenhum.
const PAC_A = '11111111-1111-4111-8111-111111111111';
const PAC_B = '22222222-2222-4222-8222-222222222222';
const INT_1 = '44444444-4444-4444-8444-444444444444';
const EPI_1 = '55555555-5555-4555-8555-555555555555';

const COLUNAS_ESPERADAS =
    'paciente_id, internacao_id, episodio_id, tipo, sitio, data_inicio, dias_em_uso';

/**
 * Dublê do cliente Supabase — mesmo padrão thenable de `alertas.test.ts`:
 * anota cada elo da corrente para o teste conferir a consulta MONTADA.
 */
function clienteFalso(resposta: { data: unknown; error: { message: string } | null }) {
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

const CVC_A: DispositivoAtivo = {
    paciente_id: PAC_A,
    internacao_id: INT_1,
    episodio_id: EPI_1,
    tipo: 'cvc',
    sitio: 'jugular direita',
    data_inicio: '2026-08-05',
    dias_em_uso: 6,
};

describe('normalizarDispositivos', () => {
    it('mantém dias_em_uso null como null — nunca inventa 0', () => {
        // O banco deriva os dias; sem data_inicio não há conta a fazer.
        // Converter para 0 diria "cateter passado hoje", que é dado inventado.
        const pronto = normalizarDispositivos([
            {
                paciente_id: PAC_A,
                internacao_id: INT_1,
                episodio_id: EPI_1,
                tipo: 'svd',
                sitio: null,
                data_inicio: null,
                dias_em_uso: null,
            },
        ]);
        expect(pronto).toEqual([
            {
                paciente_id: PAC_A,
                internacao_id: INT_1,
                episodio_id: EPI_1,
                tipo: 'svd',
                sitio: null,
                data_inicio: null,
                dias_em_uso: null,
            },
        ]);
    });

    it('descarta a linha sem paciente ou sem tipo — dispositivo sem dono não vai à tela', () => {
        // "Tem um CVC em alguém" não é informação acionável; mostrar seria
        // pior do que omitir. Mesmo tratamento das views de alertas e leitos.
        const pronto = normalizarDispositivos([
            {
                paciente_id: null,
                internacao_id: null,
                episodio_id: null,
                tipo: 'cvc',
                sitio: null,
                data_inicio: '2026-08-05',
                dias_em_uso: 6,
            },
            {
                paciente_id: PAC_A,
                internacao_id: null,
                episodio_id: null,
                tipo: null,
                sitio: null,
                data_inicio: '2026-08-05',
                dias_em_uso: 6,
            },
        ]);
        expect(pronto).toEqual([]);
    });
});

describe('lerDispositivosAtivos', () => {
    it('lê a view derivada, com as colunas uma a uma', () => {
        // A view calcula dias_em_uso no relógio do SERVIDOR. Ler a tabela
        // crua e contar dias no navegador daria contagens divergentes por tela.
        const {supabase, registro} = clienteFalso({data: [], error: null});
        return lerDispositivosAtivos(supabase).then((linhas) => {
            expect(registro.from).toEqual(['vw_dispositivos_ativos']);
            expect(registro.select).toEqual([COLUNAS_ESPERADAS]);
            expect(registro.eq).toEqual([]);
            expect(linhas).toEqual([]);
        });
    });

    it('falha de leitura LANÇA, nunca vira lista vazia', async () => {
        // Lista vazia = "nenhum dispositivo registrado" (fato clínico, e o
        // estado atual do banco). Rede caída = "não sei". Opostos.
        const {supabase} = clienteFalso({data: null, error: {message: 'timeout'}});
        await expect(lerDispositivosAtivos(supabase)).rejects.toBeInstanceOf(FalhaDeLeitura);
    });
});

describe('lerDispositivosDoPaciente', () => {
    it('filtra o paciente e ordena o mais antigo primeiro', () => {
        // data_inicio asc: o dispositivo há mais tempo em uso no topo — é o
        // que a vigilância de infecção quer rever primeiro.
        const {supabase, registro} = clienteFalso({data: [], error: null});
        return lerDispositivosDoPaciente(supabase, PAC_A).then(() => {
            expect(registro.from).toEqual(['vw_dispositivos_ativos']);
            expect(registro.select).toEqual([COLUNAS_ESPERADAS]);
            expect(registro.eq).toEqual([['paciente_id', PAC_A]]);
            expect(registro.order).toEqual([['data_inicio', {ascending: true}]]);
        });
    });
});

describe('indexarDispositivosPorPaciente', () => {
    it('agrupa por paciente, preservando a ordem da lista', () => {
        const svdB: DispositivoAtivo = {
            paciente_id: PAC_B,
            internacao_id: null,
            episodio_id: null,
            tipo: 'svd',
            sitio: null,
            data_inicio: '2026-08-09',
            dias_em_uso: 2,
        };
        const iotA: DispositivoAtivo = {...CVC_A, tipo: 'iot', sitio: null};
        expect(indexarDispositivosPorPaciente([CVC_A, svdB, iotA])).toEqual({
            [PAC_A]: [CVC_A, iotA],
            [PAC_B]: [svdB],
        });
    });

    it('paciente fora do mapa significa nenhum dispositivo (a view só traz quem tem)', () => {
        expect(indexarDispositivosPorPaciente([])['paciente-inexistente']).toBeUndefined();
    });
});
