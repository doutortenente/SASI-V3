'use client';
/**
 * bedStore — como a grade de leitos está filtrada e ordenada AGORA.
 *
 * Aqui só mora a pergunta ("mostre a UTI3, os graves, ordenado por acuidade").
 * A resposta — a lista de leitos — vem do banco pelo TanStack Query e NÃO entra em store:
 * dado clínico guardado em duas casas envelhece numa delas e o médico lê o valor velho.
 *
 * Uso em componente client:
 *   const filtro = useFiltroLeitos();
 *   const definirFiltro = useDefinirFiltro();
 *   definirFiltro({ uti: 'UTI3' });        // liga o filtro
 *   definirFiltro({ uti: undefined });     // desliga esse campo
 */
import {create} from 'zustand';

import type {FiltroLeitos, OrdemDaGrade} from '@/features/beds/types';
import type {Uti} from '@/types';

// ---------------------------------------------------------------------------
// Filtro de UTI da barra superior (herdado do v2)
// ---------------------------------------------------------------------------

/** O que a barra superior oferece. "todas" = não filtra por UTI. */
export type OpcaoUti = 'todas' | Uti;

/** Opções na ordem em que aparecem na barra. */
export const OPCOES_UTI: readonly OpcaoUti[] = ['todas', 'UTI2', 'UTI3', 'UTI4'] as const;

/** Rótulo pt-BR de cada opção. */
export const ROTULO_UTI: Record<OpcaoUti, string> = {
    todas: 'Todas',
    UTI2: 'UTI2',
    UTI3: 'UTI3',
    UTI4: 'UTI4',
};

/**
 * Predicado puro para aplicar o filtro de UTI em qualquer linha que tenha `uti`.
 * No v3 "todas" é representado pela AUSÊNCIA do campo (`undefined`), não por uma string.
 * Ex.: `leitos.filter((l) => passaFiltroUti(filtro.uti, l.uti))`
 */
export const passaFiltroUti = (
    filtro: Uti | undefined,
    uti: string | null | undefined,
): boolean => filtro === undefined || uti === filtro;

/** Traduz a opção da barra ("todas") para o campo do filtro (`undefined`). */
export const utiDaOpcao = (opcao: OpcaoUti): Uti | undefined =>
    opcao === 'todas' ? undefined : opcao;

/** Traduz o campo do filtro de volta para a opção que a barra precisa marcar. */
export const opcaoDaUti = (uti: Uti | undefined): OpcaoUti => uti ?? 'todas';

// ---------------------------------------------------------------------------
// Remendo de filtro
// ---------------------------------------------------------------------------

/**
 * Um "remendo" (patch) = só os campos que vão mudar; o resto do filtro fica como está.
 * Campo enviado como `undefined` é REMOVIDO, ou seja, deixa de filtrar.
 *
 * O `| undefined` explícito é necessário: com `exactOptionalPropertyTypes`, um campo
 * apenas opcional NÃO aceita receber `undefined` de propósito — e é exatamente assim
 * que a tela pede "desliga esse critério".
 */
export type RemendoFiltro = {
    [K in keyof FiltroLeitos]?: FiltroLeitos[K] | undefined;
};

/** Filtro vazio = a grade inteira, os 33 leitos. */
export const FILTRO_VAZIO: FiltroLeitos = {};

/**
 * Aplica o remendo campo a campo.
 * O `delete` é obrigatório e não é frescura: com `exactOptionalPropertyTypes` ligado,
 * "campo ausente" e "campo valendo undefined" são coisas DIFERENTES para o TypeScript,
 * e quem consome o filtro (consulta ao Supabase) trata os dois de forma diferente também.
 * Texto em branco também apaga o campo — busca vazia não é busca por nada.
 */
function aplicarRemendo(atual: FiltroLeitos, remendo: RemendoFiltro): FiltroLeitos {
    const proximo: FiltroLeitos = {...atual};

    if ('uti' in remendo) {
        if (remendo.uti === undefined) delete proximo.uti;
        else proximo.uti = remendo.uti;
    }
    if ('gravidade' in remendo) {
        if (remendo.gravidade === undefined) delete proximo.gravidade;
        else proximo.gravidade = remendo.gravidade;
    }
    if ('severidade' in remendo) {
        if (remendo.severidade === undefined) delete proximo.severidade;
        else proximo.severidade = remendo.severidade;
    }
    if ('isolamento' in remendo) {
        if (remendo.isolamento === undefined) delete proximo.isolamento;
        else proximo.isolamento = remendo.isolamento;
    }
    if ('status' in remendo) {
        if (remendo.status === undefined) delete proximo.status;
        else proximo.status = remendo.status;
    }
    if ('busca' in remendo) {
        const texto = remendo.busca?.trim();
        if (texto === undefined || texto === '') delete proximo.busca;
        else proximo.busca = texto;
    }
    if ('somenteComAlerta' in remendo) {
        // `false` é o mesmo que não filtrar: some do objeto para o seletor abaixo não
        // acusar "filtro ativo" por causa de uma caixinha desmarcada.
        if (remendo.somenteComAlerta !== true) delete proximo.somenteComAlerta;
        else proximo.somenteComAlerta = true;
    }

    return proximo;
}

/** Função pura: o filtro está mexido em algum campo? Serve fora de componente também. */
export const temFiltroAtivo = (filtro: FiltroLeitos): boolean =>
    Object.keys(filtro).length > 0;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface BedState {
    /** Filtro em vigor. Campo ausente = aquele critério não filtra. */
    filtro: FiltroLeitos;
    /** Ordenação da grade. Padrão "acuidade": o mais grave primeiro, sempre. */
    ordem: OrdemDaGrade;

    /** Muda um ou mais campos do filtro de uma vez. Campo `undefined` desliga o critério. */
    definirFiltro: (remendo: RemendoFiltro) => void;
    /** Atalho da barra superior, que fala em "todas" em vez de campo ausente. */
    definirOpcaoUti: (opcao: OpcaoUti) => void;
    /** Volta a grade para os 33 leitos. Não mexe na ordenação. */
    limparFiltros: () => void;

    definirOrdem: (ordem: OrdemDaGrade) => void;
}

export const useBedStore = create<BedState>((set) => ({
    filtro: FILTRO_VAZIO,
    ordem: 'acuidade',

    definirFiltro: (remendo) => {
        set((s) => ({filtro: aplicarRemendo(s.filtro, remendo)}));
    },
    definirOpcaoUti: (opcao) => {
        set((s) => ({filtro: aplicarRemendo(s.filtro, {uti: utiDaOpcao(opcao)})}));
    },
    limparFiltros: () => {
        set({filtro: FILTRO_VAZIO});
    },

    definirOrdem: (ordem) => {
        set({ordem});
    },
}));

// ---------------------------------------------------------------------------
// Seletores prontos.
// Cada tela lê só o pedaço que usa e não se redesenha quando o resto muda.
// ---------------------------------------------------------------------------

export const useFiltroLeitos = (): FiltroLeitos => useBedStore((s) => s.filtro);
export const useOrdemDaGrade = (): OrdemDaGrade => useBedStore((s) => s.ordem);

/** Opção que a barra superior deve mostrar marcada. */
export const useOpcaoUti = (): OpcaoUti => useBedStore((s) => opcaoDaUti(s.filtro.uti));

/** Verdadeiro quando a grade está mostrando um recorte, não o hospital inteiro. */
export const useTemFiltroAtivo = (): boolean => useBedStore((s) => temFiltroAtivo(s.filtro));

export const useDefinirFiltro = (): BedState['definirFiltro'] =>
    useBedStore((s) => s.definirFiltro);
export const useDefinirOpcaoUti = (): BedState['definirOpcaoUti'] =>
    useBedStore((s) => s.definirOpcaoUti);
export const useLimparFiltros = (): (() => void) => useBedStore((s) => s.limparFiltros);
export const useDefinirOrdem = (): BedState['definirOrdem'] => useBedStore((s) => s.definirOrdem);
