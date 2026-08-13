'use client';
/**
 * Pendências abertas, ao vivo — o "falta fazer" de cada card do Meu plantão.
 *
 * Segue o padrão de `features/alerts/hooks/useAlertas.ts`:
 * - UMA consulta para a unidade inteira (`lerPendenciasAbertas`), indexada por
 *   paciente — e não uma consulta por card, que seriam 33 idas ao banco.
 * - CANAL PRÓPRIO na tabela `pendencias` ("atomicidade > acoplamento"): uma
 *   pendência concluída não redesenha a grade de leitos, só marca ESTA query
 *   como suja e o TanStack Query refaz quando convém.
 * - Falha de leitura LANÇA (via `exigirDado` no serviço) e aparece em `erro`.
 *   "Nenhuma pendência" e "não consegui perguntar" são clinicamente opostos.
 *
 * O serviço (`features/pendencias/services/pendencias.ts`) é de outra entrega —
 * este arquivo só o liga ao navegador. Importar, não recriar.
 */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useEffect, useState} from 'react';

import {
    concluirPendencia,
    indexarPendenciasPorPaciente,
    lerPendenciasAbertas,
} from '@/features/pendencias/services/pendencias';
import {getSupabaseBrowser} from '@/lib/supabase/client';
import {assinarTabela} from '@/lib/supabase/realtime';
import type {Pendencia} from '@/types';

/**
 * Chave de cache. Exportada de propósito: quem gravar pendência (a Captura,
 * no bloco 2) invalida por esta constante, não por string solta.
 */
export const CHAVE_PENDENCIAS = ['pendencias'] as const;

export interface RetornoUsePendencias {
    /**
     * Mapa paciente → pendências ABERTAS, mais urgente primeiro.
     * `undefined` = a consulta ainda não respondeu (ou falhou — ver `erro`).
     * Paciente ausente do mapa = zero pendência aberta, um fato medido.
     */
    pendenciasPorPaciente: Record<string, Pendencia[]> | undefined;
    carregando: boolean;
    /** Falha de LEITURA. Não é "nada pendente" — a tela tem que dizer a diferença. */
    erro: Error | null;
    /** O canal ao vivo caiu: a lista pode estar velha e a tela precisa avisar. */
    desatualizado: boolean;
}

/** Pendências abertas da unidade, mantidas vivas por uma assinatura só. */
export function usePendencias(): RetornoUsePendencias {
    const queryClient = useQueryClient();
    const [desatualizado, setDesatualizado] = useState(false);

    const consulta = useQuery<Pendencia[], Error>({
        queryKey: CHAVE_PENDENCIAS,
        queryFn: () => lerPendenciasAbertas(getSupabaseBrowser()),
        // O canal ao vivo é quem manda buscar de novo (invalidate fura o staleTime).
        staleTime: 30_000,
    });

    useEffect(() => {
        const cancelar = assinarTabela({
            tabela: 'pendencias',
            aoMudar: () => {
                void queryClient.invalidateQueries({queryKey: CHAVE_PENDENCIAS});
                // Chegou evento = o canal está de pé de novo.
                setDesatualizado(false);
            },
            aoPerderConexao: () => setDesatualizado(true),
        });
        // Canal não fechado vaza conexão — o cleanup é obrigatório.
        return cancelar;
    }, [queryClient]);

    return {
        pendenciasPorPaciente: consulta.data
            ? indexarPendenciasPorPaciente(consulta.data)
            : undefined,
        carregando: consulta.isPending,
        erro: consulta.error,
        desatualizado,
    };
}

/**
 * Mutação de conclusão a um toque.
 *
 * Falha lança `FalhaAoGravarPendencia` — quem consome MOSTRA a mensagem
 * ("o banco NÃO registrou"), porque conclusão que falha em silêncio vira
 * pendência fantasma atravessando a passagem de plantão.
 *
 * Retorno 0 do serviço (id inexistente ou já concluída em outra tela) não é
 * erro: a invalidação abaixo reconcilia a lista com o estado real do banco.
 */
export function useConcluirPendencia() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (pendenciaId: string) =>
            concluirPendencia(getSupabaseBrowser(), pendenciaId),
        // `onSettled`: invalida também na falha, para reconciliar com o banco.
        onSettled: () => queryClient.invalidateQueries({queryKey: CHAVE_PENDENCIAS}),
    });
}
