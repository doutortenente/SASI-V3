'use client';
/**
 * Janelas de 24h no navegador — leitura da lista e mutação de gravação.
 *
 * Segue o padrão de `features/alerts/hooks/useAlertasDoPaciente.ts`: o serviço
 * (`features/captura/services/janelas.ts`, de outra entrega) faz o trabalho;
 * aqui só se liga o TanStack Query ao cliente do navegador.
 *
 * A chave da lista é `[...CHAVE_JANELAS, 'paciente', id]`: o TanStack invalida
 * por PREFIXO, então a mutação abaixo derruba toda lista de janelas aberta de
 * uma vez — depois de gravar, a tela mostra o que o BANCO tem, não o que ela
 * acha que gravou.
 *
 * Sem canal realtime de propósito: quem escreve em `janelas_24h` durante o
 * plantão é esta própria tela (a skill de ingestão roda fora do app, em outra
 * cadência) — a invalidação pós-mutação já cobre o caso real.
 */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {lerJanelasDoPaciente, registrarJanela} from '@/features/captura/services/janelas';
import {getSupabaseBrowser} from '@/lib/supabase/client';
import type {EntradaDeJanela, JanelaRender} from '@/features/captura/types';

/** Chave de cache das janelas. Exportada: invalidar por constante, não por string solta. */
export const CHAVE_JANELAS = ['janelas'] as const;

/**
 * Janelas de UM paciente, com o campo `render` PRONTO do banco
 * ("PAM 90-56 (4/12 <65)") — exibir, nunca remontar.
 */
export function useJanelasDoPaciente(pacienteId: string) {
    return useQuery<JanelaRender[], Error>({
        queryKey: [...CHAVE_JANELAS, 'paciente', pacienteId],
        queryFn: () => lerJanelasDoPaciente(getSupabaseBrowser(), pacienteId),
        // A mutação invalida (e fura o staleTime); isto só evita refetch à toa
        // ao alternar de aba dentro da mesma captura.
        staleTime: 30_000,
    });
}

/**
 * Mutação de gravação de janela (upsert — reprocessar SUBSTITUI, não duplica).
 *
 * Falha lança `EntradaDeJanelaRecusada` (corrigir a digitação) ou
 * `FalhaAoGravarJanela` (o banco NÃO registrou) — quem consome MOSTRA a
 * mensagem real na tela, nunca a engole.
 *
 * `onSettled` (e não `onSuccess`): invalida também na falha, para a lista
 * reconciliar com o estado REAL do banco em vez de confiar no que ela acha.
 */
export function useRegistrarJanela() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (entrada: EntradaDeJanela) => registrarJanela(getSupabaseBrowser(), entrada),
        onSettled: () => queryClient.invalidateQueries({queryKey: CHAVE_JANELAS}),
    });
}
