'use client';
/**
 * warRoomStore — o modo "sala de guerra" da tela.
 *
 * War Room = densidade máxima: cada leito vira uma linha com o essencial, para varrer
 * os 33 de um olhar só. Este store guarda só o CHAVEAMENTO e o que o modo precisa para
 * funcionar — nunca o dado clínico em si, que continua vindo do banco pelo TanStack Query.
 *
 * Uso em componente client:
 *   const warRoom = useWarRoom();
 *   const alternar = useAlternarWarRoom();
 */
import {create} from 'zustand';

import type {OpcoesAssinatura} from '@/lib/supabase/realtime';

/**
 * Por que o canal ao vivo caiu. O tipo é lido direto do contrato de `assinarTabela`
 * ("assinatura ao vivo" = o banco avisa quando uma linha muda, em vez de a tela
 * ficar perguntando). Amarrar assim impede que os dois lados divirjam sem ninguém ver.
 */
export type MotivoQueda = Parameters<
    NonNullable<OpcoesAssinatura<Record<string, unknown>>['aoPerderConexao']>
>[0];

export interface WarRoomState {
    /** Modo ligado? Padrão desligado: a grade normal é a tela de trabalho. */
    warRoom: boolean;
    /**
     * Leito em foco, no formato `UTI#-L##`, ou `null` quando nenhum está destacado.
     * É só o identificador — o card busca o resto pelo Query, não daqui.
     */
    leitoEmFoco: string | null;
    /**
     * A tela está mostrando dado que pode estar velho? Liga quando o canal ao vivo cai:
     * o número na tela continua sendo o último que chegou, mas o operador PRECISA saber
     * que ele parou de se atualizar. Silêncio aqui é o pior cenário — parece atual e não é.
     */
    desatualizado: boolean;
    /** Por que caiu. `null` enquanto está tudo conectado. */
    motivoQueda: MotivoQueda | null;

    setWarRoom: (warRoom: boolean) => void;
    alternarWarRoom: () => void;

    /** Destaca um leito, ou passa `null` para tirar o foco. */
    focarLeito: (leito: string | null) => void;

    /** Chamado pelo `aoPerderConexao` da assinatura ao vivo. */
    marcarDesatualizado: (motivo: MotivoQueda) => void;
    /** Chamado quando a assinatura volta a entregar mudança. Limpa o aviso. */
    marcarAtualizado: () => void;
}

export const useWarRoomStore = create<WarRoomState>((set) => ({
    warRoom: false,
    leitoEmFoco: null,
    desatualizado: false,
    motivoQueda: null,

    setWarRoom: (warRoom) => {
        // Sair do modo solta o foco: leito destacado em outra tela confunde mais do que ajuda.
        set(warRoom ? {warRoom} : {warRoom, leitoEmFoco: null});
    },
    alternarWarRoom: () => {
        set((s) => (s.warRoom ? {warRoom: false, leitoEmFoco: null} : {warRoom: true}));
    },

    focarLeito: (leito) => {
        set({leitoEmFoco: leito});
    },

    marcarDesatualizado: (motivo) => {
        set({desatualizado: true, motivoQueda: motivo});
    },
    marcarAtualizado: () => {
        set({desatualizado: false, motivoQueda: null});
    },
}));

// ---------------------------------------------------------------------------
// Seletores prontos.
// ---------------------------------------------------------------------------

export const useWarRoom = (): boolean => useWarRoomStore((s) => s.warRoom);
export const useLeitoEmFoco = (): string | null => useWarRoomStore((s) => s.leitoEmFoco);
export const useDesatualizado = (): boolean => useWarRoomStore((s) => s.desatualizado);
export const useMotivoQueda = (): MotivoQueda | null => useWarRoomStore((s) => s.motivoQueda);

export const useAlternarWarRoom = (): (() => void) => useWarRoomStore((s) => s.alternarWarRoom);
export const useSetWarRoom = (): WarRoomState['setWarRoom'] => useWarRoomStore((s) => s.setWarRoom);
export const useFocarLeito = (): WarRoomState['focarLeito'] => useWarRoomStore((s) => s.focarLeito);
export const useMarcarDesatualizado = (): WarRoomState['marcarDesatualizado'] =>
    useWarRoomStore((s) => s.marcarDesatualizado);
export const useMarcarAtualizado = (): (() => void) => useWarRoomStore((s) => s.marcarAtualizado);
