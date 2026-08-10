'use client';
/**
 * Assinatura de mudanças ao vivo no banco (Supabase Realtime).
 *
 * O que é: em vez de o navegador ficar perguntando "mudou alguma coisa?" de tempo em
 * tempo, o banco AVISA quando uma linha muda. É o que faz o card do leito atualizar
 * sozinho quando alguém grava a evolução em outro computador.
 *
 * Só roda no navegador. Server Component não assina nada — ele renderiza uma vez.
 *
 * TRAVA: a assinatura respeita a RLS (Row Level Security — o banco filtra linha a linha
 * pelo usuário logado). Se `pacientes.user_id` estiver null, a RLS não deixa passar nada
 * e o canal fica mudo sem erro. Sintoma: tela não atualiza e o console não acusa.
 */
import type {RealtimeChannel, RealtimePostgresChangesPayload} from '@supabase/supabase-js';

import {getSupabaseBrowser} from './client';

/** Tabelas que valem assinatura ao vivo. Assinar tudo custa banda e não serve pra nada. */
export type TabelaAoVivo = 'pacientes' | 'evolucoes' | 'eventos_clinicos' | 'alerts_log' | 'pendencias';

export interface OpcoesAssinatura<T extends Record<string, unknown>> {
    tabela: TabelaAoVivo;
    /** Filtro no formato do PostgREST, ex.: `paciente_id=eq.<uuid>`. Sem filtro, vem tudo o que a RLS deixar. */
    filtro?: string;
    aoMudar: (evento: RealtimePostgresChangesPayload<T>) => void;
    /** Chamado quando o canal cai ou estoura o tempo — a tela precisa avisar que está desatualizada. */
    aoPerderConexao?: (motivo: 'erro' | 'timeout' | 'fechado') => void;
}

/**
 * Assina INSERT/UPDATE/DELETE de uma tabela e devolve a função que cancela.
 * Chame o cancelamento no cleanup do `useEffect` — canal não fechado vaza conexão
 * e o Supabase corta o projeto por excesso de canais abertos.
 */
export function assinarTabela<T extends Record<string, unknown>>(
    opcoes: OpcoesAssinatura<T>,
): () => void {
    const supabase = getSupabaseBrowser();
    const nomeCanal = `sasi:${opcoes.tabela}:${opcoes.filtro ?? 'tudo'}`;

    const canal: RealtimeChannel = supabase
        .channel(nomeCanal)
        .on(
            // @ts-expect-error — a tipagem de postgres_changes só fecha com o Database gerado
            // por `pnpm gen:types`. Remover esta linha quando src/types/supabase.ts existir.
            'postgres_changes',
            {event: '*', schema: 'public', table: opcoes.tabela, filter: opcoes.filtro},
            (payload: RealtimePostgresChangesPayload<T>) => opcoes.aoMudar(payload),
        )
        .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') opcoes.aoPerderConexao?.('erro');
            if (status === 'TIMED_OUT') opcoes.aoPerderConexao?.('timeout');
            if (status === 'CLOSED') opcoes.aoPerderConexao?.('fechado');
        });

    return () => {
        void supabase.removeChannel(canal);
    };
}
