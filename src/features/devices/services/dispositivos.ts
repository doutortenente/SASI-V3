/**
 * Dispositivos invasivos ativos — SÓ LEITURA, de propósito.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE ARQUIVO NÃO ESCREVE NADA
 * ---------------------------------------------------------------------------
 * Decisão de produto de 10-ago (P0, `docs/ARQUITETURA.md`): dispositivo entra
 * e sai pela skill de ingestão, sem UI de edição manual. E há uma trava mais
 * funda: `pacientes.dispositivos` é coluna DERIVADA por
 * `fn_refresh_dispositivos` — escrever à mão é proibido pelo modelo de dados.
 * Este serviço lê a view `vw_dispositivos_ativos` e para por aí. Se um dia a
 * escrita for liberada, é feature nova, não emenda aqui.
 *
 * `dias_em_uso` é DERIVADO NO BANCO (data de hoje menos `data_inicio`,
 * calculada pelo relógio do servidor). Recalcular na tela é proibido: o
 * relógio do navegador pode divergir do banco e o mesmo cateter mostraria
 * dias diferentes em telas diferentes — e dias de cateter é dado de
 * vigilância de infecção, não enfeite.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O CLIENTE CHEGA POR PARÂMETRO E NÃO POR IMPORT
 * ---------------------------------------------------------------------------
 * Mesma doutrina de `features/alerts/services/alertas.ts`: `server.ts` e
 * `client.ts` são mutuamente exclusivos (`import 'server-only'` vs
 * `'use client'`), então quem chama decide de que lado está e passa o
 * cliente. Efeito colateral bom: o teste dispensa mock de módulo.
 *
 * Aviso medido (11-ago-2026): `dispositivo_episodios` está em 0 linhas — a
 * view responde vazia até a ingestão alimentar. Lista vazia aqui NÃO é
 * defeito de código.
 */
import type {SupabaseClient} from '@supabase/supabase-js';

import {exigirDado} from '@/lib/data/erros';
import type {Database} from '@/types/supabase';

/** O cliente Supabase tipado, venha ele do servidor ou do navegador. */
export type ClienteSasi = SupabaseClient<Database>;

/** Linha crua da view, como o gerador de tipos a entrega (tudo opcional). */
type LinhaCruaDeDispositivo = Database['public']['Views']['vw_dispositivos_ativos']['Row'];

/** Tipo de dispositivo, direto do enum do banco (iot, cvc, svd…). */
export type TipoDeDispositivo = Database['public']['Enums']['dispositivo_tipo_enum'];

/** Um dispositivo em uso agora, como a view o entrega. */
export interface DispositivoAtivo {
    paciente_id: string;
    internacao_id: string | null;
    episodio_id: string | null;
    tipo: TipoDeDispositivo;
    sitio: string | null;
    /** Início do uso. `null` = a ingestão não soube a data — a tela mostra travessão. */
    data_inicio: string | null;
    /**
     * Dias de uso, DERIVADO NO BANCO. `null` fica `null` (sem `data_inicio`
     * não há conta a fazer) — nunca vira 0: "zero dias" é um cateter passado
     * hoje, "não sei" é outra coisa. A tela mostra travessão.
     */
    dias_em_uso: number | null;
}

/**
 * Colunas da view, uma a uma, como string literal (não `[...].join(',')`)
 * para o cliente tipado inferir a linha de volta: errar nome de coluna vira
 * erro de compilação, não erro em produção com o paciente na tela.
 */
const COLUNAS =
    'paciente_id, internacao_id, episodio_id, tipo, sitio, data_inicio, dias_em_uso';

/**
 * Descarta a linha que não dá para atribuir: sem `paciente_id` não se sabe
 * de QUEM é o cateter; sem `tipo` não se sabe QUAL cateter é. Na prática a
 * view nunca os devolve nulos (vêm de colunas NOT NULL de
 * `dispositivo_episodios`), mas o gerador de tipos trata toda coluna de view
 * como opcional — mesmo tratamento que alertas e leitos dão às suas views.
 * `dias_em_uso` null NÃO descarta a linha: o dispositivo existe, só a conta
 * de dias é que falta.
 */
export function normalizarDispositivos(linhas: LinhaCruaDeDispositivo[]): DispositivoAtivo[] {
    const pronto: DispositivoAtivo[] = [];
    for (const l of linhas) {
        if (l.paciente_id == null || l.tipo == null) continue;
        pronto.push({
            paciente_id: l.paciente_id,
            internacao_id: l.internacao_id ?? null,
            episodio_id: l.episodio_id ?? null,
            tipo: l.tipo,
            sitio: l.sitio ?? null,
            data_inicio: l.data_inicio ?? null,
            dias_em_uso: l.dias_em_uso ?? null,
        });
    }
    return pronto;
}

/**
 * Todos os dispositivos ativos da unidade — uma consulta só, para a Tela 1
 * pintar todos os cards sem N idas ao banco.
 *
 * Lista vazia é resposta LEGÍTIMA (nenhum dispositivo registrado é um fato,
 * e é o estado atual do banco). Falha de leitura não vira lista vazia —
 * `exigirDado` lança e a exceção sobe até `app/error.tsx`.
 */
export async function lerDispositivosAtivos(supabase: ClienteSasi): Promise<DispositivoAtivo[]> {
    const resposta = await supabase.from('vw_dispositivos_ativos').select(COLUNAS);
    const linhas = exigirDado(resposta, 'vw_dispositivos_ativos (dispositivos em uso)');
    return normalizarDispositivos(linhas as unknown as LinhaCruaDeDispositivo[]);
}

/**
 * Os dispositivos ativos de UM paciente, o mais antigo primeiro.
 *
 * `data_inicio asc` põe no topo o dispositivo há mais tempo em uso — o que
 * mais importa rever primeiro (dias de cateter é o dado de vigilância).
 */
export async function lerDispositivosDoPaciente(
    supabase: ClienteSasi,
    pacienteId: string,
): Promise<DispositivoAtivo[]> {
    const resposta = await supabase
        .from('vw_dispositivos_ativos')
        .select(COLUNAS)
        .eq('paciente_id', pacienteId)
        .order('data_inicio', {ascending: true});
    const linhas = exigirDado(resposta, `vw_dispositivos_ativos do paciente ${pacienteId}`);
    return normalizarDispositivos(linhas as unknown as LinhaCruaDeDispositivo[]);
}

/**
 * Vira um mapa `paciente_id` → dispositivos, do jeito que o card consome.
 *
 * Sem isso cada card varreria a lista inteira. Paciente ausente do mapa =
 * nenhum dispositivo ativo registrado (a view só traz quem tem). Mesmo
 * padrão de `indexarResumoPorPaciente` em alertas.
 */
export function indexarDispositivosPorPaciente(
    lista: DispositivoAtivo[],
): Record<string, DispositivoAtivo[]> {
    const mapa: Record<string, DispositivoAtivo[]> = {};
    for (const d of lista) {
        (mapa[d.paciente_id] ??= []).push(d);
    }
    return mapa;
}
