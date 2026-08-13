'use client';
/**
 * Dispositivos ativos (com dias de uso) para os cards do Meu plantão.
 *
 * Uma consulta só para a unidade (`lerDispositivosAtivos` sobre
 * `vw_dispositivos_ativos`), indexada por paciente. `dias_em_uso` vem DERIVADO
 * do banco — nunca recalculado na tela (doutrina no cabeçalho do serviço).
 *
 * SEM canal ao vivo, de propósito: dispositivo entra e sai pela skill de
 * ingestão (decisão de produto de 10-ago, sem UI de edição), então a cadência
 * de mudança é de horas, não de segundos — e `dispositivo_episodios` nem está
 * na lista de tabelas assinaláveis de `lib/supabase/realtime.ts`. O staleTime
 * curto + refetch ao focar a aba cobrem o caso real.
 *
 * Aviso medido (11-ago-2026): a tabela está em 0 linhas. Mapa vazio aqui é
 * FATO, não defeito — a tela mostra o estado vazio honesto.
 */
import {useQuery} from '@tanstack/react-query';

import {
    type DispositivoAtivo,
    indexarDispositivosPorPaciente,
    lerDispositivosAtivos,
} from '@/features/devices/services/dispositivos';
import {getSupabaseBrowser} from '@/lib/supabase/client';

/** Chave de cache, exportada para invalidação futura (ex.: pós-ingestão). */
export const CHAVE_DISPOSITIVOS = ['dispositivos'] as const;

export interface RetornoUseDispositivos {
    /**
     * Mapa paciente → dispositivos ativos (mais antigo primeiro).
     * `undefined` = consulta ainda sem resposta (ou falhou — ver `erro`).
     * Paciente ausente do mapa = nenhum episódio registrado, um fato medido.
     */
    dispositivosPorPaciente: Record<string, DispositivoAtivo[]> | undefined;
    carregando: boolean;
    /** Falha de LEITURA — não confundir com "nenhum dispositivo". */
    erro: Error | null;
}

export function useDispositivos(): RetornoUseDispositivos {
    const consulta = useQuery<DispositivoAtivo[], Error>({
        queryKey: CHAVE_DISPOSITIVOS,
        queryFn: () => lerDispositivosAtivos(getSupabaseBrowser()),
        staleTime: 60_000,
    });

    return {
        dispositivosPorPaciente: consulta.data
            ? indexarDispositivosPorPaciente(consulta.data)
            : undefined,
        carregando: consulta.isPending,
        erro: consulta.error,
    };
}
