'use client';
/**
 * userStore — quem está operando e como ele quer ver a tela.
 *
 * "Store" = uma caixinha de memória que vive fora dos componentes: qualquer tela lê e
 * escreve nela, e todas se redesenham juntas quando o valor muda. Aqui só entra estado
 * de INTERFACE (tema) e identidade (usuário). Dado de paciente NÃO mora em store —
 * dado do banco é papel do TanStack Query, que sabe recarregar e expirar sozinho.
 *
 * Uso em componente client:
 *   const tema = useTema();
 *   const alternarTema = useAlternarTema();
 */
import {create} from 'zustand';

/** Tema visual: "clinical" = claro (`:root`) · "tactical" = escuro (`[data-theme='tactical']`). */
export type Tema = 'clinical' | 'tactical';

/** Chave usada no localStorage — a gaveta do navegador que sobrevive ao fechar a aba. */
export const CHAVE_TEMA = 'sasi.theme';

/**
 * Usuário logado. Enquanto a fase de login (F3) segue riscada do roadmap, este campo é
 * SEMPRE `null` — existe para a barra superior ter onde ler sem precisar mudar depois.
 * `email` vem `null` quando o provedor não devolve e-mail: campo ausente é null, nunca "".
 */
export interface UsuarioLogado {
    id: string;
    email: string | null;
}

// ---------------------------------------------------------------------------
// Efeitos de DOM e de persistência.
// Todos são no-op (não fazem nada) no servidor: Server Component roda no Node, onde
// não existem `document` nem `window`. Sem essa guarda, a página quebra na renderização.
// ---------------------------------------------------------------------------

/** Escreve o tema no `<html data-theme>`, que é de onde o CSS decide claro ou escuro. */
function aplicarNoDom(tema: Tema): void {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    if (tema === 'tactical') {
        html.dataset.theme = 'tactical';
        return;
    }
    // Claro é o padrão do CSS (`:root`): o atributo some em vez de virar string vazia,
    // senão um seletor futuro do tipo `[data-theme]` casaria com o tema claro sem querer.
    delete html.dataset.theme;
}

/** Guarda a escolha no navegador para o próximo plantão abrir já no tema certo. */
function persistir(tema: Tema): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(CHAVE_TEMA, tema);
    } catch {
        // Aba anônima ou storage bloqueado pela política do hospital: o tema continua
        // valendo nesta sessão, só não sobrevive ao fechar. Não é motivo para quebrar a tela.
    }
}

/** Lê a escolha guardada. Qualquer coisa diferente de "tactical" cai no claro. */
function lerPersistido(): Tema {
    if (typeof window === 'undefined') return 'clinical';
    try {
        return window.localStorage.getItem(CHAVE_TEMA) === 'tactical' ? 'tactical' : 'clinical';
    } catch {
        return 'clinical';
    }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface UserState {
    /** Tema em vigor. Padrão "clinical", o mesmo que o CSS assume sem atributo nenhum. */
    tema: Tema;
    /** Operador logado. `null` até haver sessão — F3 (login) está riscada do roadmap. */
    usuario: UsuarioLogado | null;

    setTema: (tema: Tema) => void;
    alternarTema: () => void;
    /**
     * Lê o localStorage e reaplica no `<html>`. Chamar UMA vez depois que a tela montou.
     * O servidor não tem como saber a preferência salva, então o primeiro desenho vem
     * claro e esta função corrige logo em seguida.
     */
    sincronizarTema: () => void;

    setUsuario: (usuario: UsuarioLogado | null) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
    tema: 'clinical',
    usuario: null,

    setTema: (tema) => {
        aplicarNoDom(tema);
        persistir(tema);
        set({tema});
    },
    alternarTema: () => {
        get().setTema(get().tema === 'tactical' ? 'clinical' : 'tactical');
    },
    sincronizarTema: () => {
        const tema = lerPersistido();
        aplicarNoDom(tema);
        // Só avisa as telas se mudou de fato: `set` com o mesmo valor redesenha à toa.
        if (tema !== get().tema) set({tema});
    },

    setUsuario: (usuario) => {
        set({usuario});
    },
}));

// ---------------------------------------------------------------------------
// Seletores prontos.
// Um seletor pega UM pedaço da caixinha. Quem lê só o tema não se redesenha quando o
// usuário muda — é o que evita a grade de 33 leitos piscar por causa de outra coisa.
// ---------------------------------------------------------------------------

export const useTema = (): Tema => useUserStore((s) => s.tema);
export const useTemaEscuro = (): boolean => useUserStore((s) => s.tema === 'tactical');
export const useAlternarTema = (): (() => void) => useUserStore((s) => s.alternarTema);
export const useSincronizarTema = (): (() => void) => useUserStore((s) => s.sincronizarTema);

export const useUsuario = (): UsuarioLogado | null => useUserStore((s) => s.usuario);
export const useUsuarioId = (): string | null => useUserStore((s) => s.usuario?.id ?? null);
