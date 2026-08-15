'use client';
/**
 * Botão de tema — a chave que destrava o Tactical (escuro, de plantão noturno).
 *
 * O store `userStore` já fazia tudo (persistir a escolha e aplicar no
 * `<html data-theme>`), mas NINGUÉM chamava `sincronizarTema`: o tema salvo no
 * navegador nunca era relido e o Tactical era inalcançável. Este componente
 * fecha os dois furos: sincroniza uma vez depois de montar e dá o botão de
 * alternar.
 *
 * POR QUE A SINCRONIZAÇÃO É NUM `useEffect` DEPOIS DE MONTAR:
 * o servidor não enxerga o localStorage (a gaveta do navegador), então o
 * primeiro desenho vem sempre no claro. O efeito roda só no navegador, lê a
 * escolha salva e corrige em seguida — sem divergência entre o HTML do
 * servidor e o do cliente, porque a mudança acontece DEPOIS da hidratação.
 *
 * Posição: fixo no canto superior direito, POR CIMA da `TopBar` (z-10) que
 * cada tela desenha. O layout monta o botão uma vez e ele vale para todas as
 * rotas; a tela que puser conteúdo no canto direito do próprio cabeçalho
 * reserva o espaço (ex.: `pr-14`).
 *
 * Cores: a `TopBar` é BRANCA (só o rail lateral é navy), então o botão usa os
 * tokens de superfície/texto do card — não os `chrome-*`, feitos pra escrever
 * sobre navy.
 */
import {Moon, Sun, type LucideIcon} from 'lucide-react';
import {useEffect} from 'react';

import {useAlternarTema, useSincronizarTema, useTemaEscuro} from '@/stores/userStore';

/**
 * Botão de ação genérico do topo. Porta de
 * `sasi-design-system/components/chrome/BotaoTema.jsx` (exporta `BotaoAcao`
 * junto com `BotaoTema` — a mesma forma, cor de card em vez de navy).
 */
export function BotaoAcao({
    Icone,
    children,
    onClick,
    className = '',
}: {
    Icone?: LucideIcon;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-borda-padrao bg-superficie-card px-4 font-mono text-xs font-semibold tracking-wide text-texto-corpo uppercase transition-colors duration-(--dur-fast) hover:bg-superficie-elevada hover:text-texto-titulo ${className}`}
        >
            {Icone && <Icone aria-hidden size={16} />}
            {children}
        </button>
    );
}

export function BotaoTema() {
    const sincronizarTema = useSincronizarTema();
    const alternarTema = useAlternarTema();
    const temaEscuro = useTemaEscuro();

    // Uma vez, pós-montagem: relê o localStorage e reaplica no <html>.
    useEffect(() => {
        sincronizarTema();
    }, [sincronizarTema]);

    return (
        <button
            type="button"
            onClick={alternarTema}
            // O rótulo diz o que o clique FAZ, não o estado atual — leitor de tela
            // anuncia a ação, como em qualquer interruptor.
            aria-label={temaEscuro ? 'Ativar tema claro (Clinical)' : 'Ativar tema escuro (Tactical)'}
            title={temaEscuro ? 'Tema claro (Clinical)' : 'Tema escuro (Tactical)'}
            className="fixed top-1.5 right-2 z-20 flex h-11 w-11 items-center justify-center rounded-md border border-borda-padrao bg-superficie-card text-texto-corpo shadow-card transition-colors duration-(--dur-fast) hover:bg-superficie-elevada hover:text-texto-titulo"
        >
            {/* Lua = "vá para o escuro", Sol = "vá para o claro": o ícone mostra o destino. */}
            {temaEscuro ? <Sun aria-hidden size={20} /> : <Moon aria-hidden size={20} />}
        </button>
    );
}
