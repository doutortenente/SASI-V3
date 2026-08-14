'use client';
/**
 * Gravação da ficha do Fechamento, do lado do navegador.
 *
 * Os dois passos (RPC `save_ficha` + UPDATE complementar) já existem em
 * `features/fechamento/services/ficha.ts` — este hook só os liga ao navegador,
 * na ordem obrigatória: primeiro a transação, que devolve o id da evolução;
 * depois o complemento, que precisa desse id como alvo. Importar, não recriar.
 *
 * FALHA NO SEGUNDO PASSO NÃO É "SALVOU PELA METADE" EM SILÊNCIO: a exceção
 * sobe com a mensagem real do serviço, e quem chama mostra o erro na tela.
 * O primeiro passo já gravou os 7 sistemas — por isso a mensagem de erro do
 * chamador diz o que foi e o que não foi, em vez de "erro ao salvar".
 *
 * Estado de servidor é TanStack Query (regra do `CLAUDE.md`) — nunca Zustand.
 */
import {useMutation} from '@tanstack/react-query';

import {complementarEvolucao, salvarFicha} from '@/features/fechamento/services/ficha';
import type {CamposComplementares, EntradaDeFicha} from '@/features/fechamento/types';
import {getSupabaseBrowser} from '@/lib/supabase/client';

export interface EntradaDeSalvamento {
    entrada: EntradaDeFicha;
    /**
     * O que a RPC não cobre (relógios, tipo, gravidade da nota,
     * intercorrências, SOFA e o carimbo de fechamento). Campo omitido aqui
     * não é tocado no banco.
     */
    complemento: CamposComplementares;
}

export interface ResultadoDoSalvamento {
    /** O id da evolução gravada — vira o alvo das próximas gravações da sessão. */
    evolucaoId: string;
    /** Quantas linhas o complemento mudou (0 = id sumiu entre os dois passos). */
    linhasComplementadas: number;
}

export function useSalvarFicha() {
    return useMutation<ResultadoDoSalvamento, Error, EntradaDeSalvamento>({
        mutationFn: async ({entrada, complemento}) => {
            const supabase = getSupabaseBrowser();
            const evolucaoId = await salvarFicha(supabase, entrada);
            const linhasComplementadas = await complementarEvolucao(supabase, evolucaoId, complemento);
            return {evolucaoId, linhasComplementadas};
        },
    });
}
