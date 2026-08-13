'use client';
/**
 * Alertas abertos de UM paciente + reconhecimento (ack) — o lado interativo do card.
 *
 * `useAlertas` (arquivo vizinho) responde "quantos alertas cada leito tem" e é
 * quem mantém o canal ao vivo. AQUI mora o detalhe: a lista de alertas de um
 * paciente (para o card expandido) e a mutação que reconhece um alerta.
 * Nenhuma assinatura de canal neste arquivo, de propósito — um canal por
 * tabela já existe em `useAlertas`; abrir outro por card seriam 33 conexões
 * para a mesma informação.
 *
 * A chave da lista é `[...CHAVE_ALERTAS, 'paciente', id]`: como o TanStack
 * Query invalida por PREFIXO, o `invalidateQueries({queryKey: CHAVE_ALERTAS})`
 * disparado pelo canal ao vivo (e pelo ack abaixo) derruba o resumo E cada
 * lista aberta de uma vez — ninguém fica mostrando alerta que já morreu.
 */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {CHAVE_ALERTAS} from '@/features/alerts/hooks/useAlertas';
import {lerAlertasAbertosDoPaciente, reconhecerAlerta} from '@/features/alerts/services/alertas';
import {getSupabaseBrowser} from '@/lib/supabase/client';
import type {AlertLog} from '@/types';

/** A lista de alertas abertos de um paciente, do mais novo para o mais antigo. */
export function useAlertasDoPaciente(pacienteId: string) {
    return useQuery<AlertLog[], Error>({
        queryKey: [...CHAVE_ALERTAS, 'paciente', pacienteId],
        queryFn: () => lerAlertasAbertosDoPaciente(getSupabaseBrowser(), pacienteId),
        // O canal ao vivo de `useAlertas` invalida o prefixo e fura o staleTime;
        // este valor só evita refetch à toa ao reabrir o mesmo card.
        staleTime: 30_000,
    });
}

/**
 * Mutação de reconhecimento de UM alerta.
 *
 * Em caso de falha o serviço lança `FalhaAoReconhecerAlerta`, cuja mensagem já
 * diz o essencial ("o alerta CONTINUA ABERTO"). Quem consome MOSTRA essa
 * mensagem — engolir o erro faria o médico achar que limpou um alerta que
 * segue aberto para o próximo plantão.
 *
 * `onSettled` (e não `onSuccess`): invalida também após falha, para a tela
 * reconciliar com o estado REAL do banco em vez de confiar no que ela acha.
 */
export function useReconhecerAlerta() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (alertaId: string) => reconhecerAlerta(getSupabaseBrowser(), alertaId),
        onSettled: () => queryClient.invalidateQueries({queryKey: CHAVE_ALERTAS}),
    });
}
