'use client';
/**
 * Mutação de evento clínico pontual (lab, escore, dose) — o lado navegador de
 * `features/captura/services/eventos.ts`.
 *
 * Sem invalidação de query, de propósito: nenhuma consulta desta tela lê
 * `eventos_clinicos` de volta (a Captura grava e segue; quem relê eventos é o
 * Fechamento, em outra tela). Os alertas que o INSERT pode disparar chegam
 * pelo canal ao vivo de `useAlertas` (gatilho `after insert` no banco →
 * `alerts_log` → realtime) — invalidar aqui seria um segundo caminho para a
 * mesma informação.
 *
 * O retorno da mutação traz `posicao` (dentro | fora_baixo | fora_alto): a
 * tela usa para marcar '(revisar)' DEPOIS do envio — a malha de faixas
 * sinaliza, nunca corrige nem bloqueia (contrato da Tela 2).
 */
import {useMutation} from '@tanstack/react-query';

import {registrarEvento} from '@/features/captura/services/eventos';
import {getSupabaseBrowser} from '@/lib/supabase/client';
import type {EntradaDeEvento} from '@/features/captura/types';

export function useRegistrarEvento() {
    return useMutation({
        mutationFn: (entrada: EntradaDeEvento) => registrarEvento(getSupabaseBrowser(), entrada),
    });
}
