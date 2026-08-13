'use client';
/**
 * Mutação de criação de pendência — a terceira ação da Captura.
 *
 * O serviço (`criarPendencia`) e a chave de cache (`CHAVE_PENDENCIAS`) moram
 * em `features/pendencias`, casa única do "falta fazer": a passagem de plantão
 * lê de lá, e criar pendência por outro caminho faria a passagem mentir.
 * Este hook só liga o serviço ao navegador — importar, não recriar.
 *
 * `onSettled` invalida `CHAVE_PENDENCIAS` inteira (por prefixo): a lista ao
 * vivo do Meu plantão E a lista aberta nesta tela reconciliam com o banco de
 * uma vez, em sucesso ou falha.
 */
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {CHAVE_PENDENCIAS} from '@/features/pendencias/hooks/usePendencias';
import {criarPendencia, type NovaPendencia} from '@/features/pendencias/services/pendencias';
import {getSupabaseBrowser} from '@/lib/supabase/client';

export function useCriarPendencia() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (nova: NovaPendencia) => criarPendencia(getSupabaseBrowser(), nova),
        onSettled: () => queryClient.invalidateQueries({queryKey: CHAVE_PENDENCIAS}),
    });
}
