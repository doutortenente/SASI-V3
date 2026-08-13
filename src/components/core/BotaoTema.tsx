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
 * Posição: fixo no canto superior direito, POR CIMA da barra de comando
 * (`sasi-chrome`, z-10) que cada tela desenha. O layout monta o botão uma vez
 * e ele vale para todas as rotas; a tela que puser conteúdo no canto direito
 * do próprio cabeçalho reserva o espaço (ex.: `pr-14`).
 *
 * Cores: só token do tema. A barra de comando é navy nos DOIS temas, então o
 * botão usa os tokens `chrome-*`, feitos para escrever sobre ela.
 */
import { Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';

import { useAlternarTema, useSincronizarTema, useTemaEscuro } from '@/stores/userStore';

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
      className="fixed top-1.5 right-2 z-20 flex h-11 w-11 items-center justify-center rounded-md text-chrome-texto transition-colors duration-(--dur-fast) hover:bg-(--chrome-borda)"
    >
      {/* Lua = "vá para o escuro", Sol = "vá para o claro": o ícone mostra o destino. */}
      {temaEscuro ? <Sun aria-hidden size={20} /> : <Moon aria-hidden size={20} />}
    </button>
  );
}
