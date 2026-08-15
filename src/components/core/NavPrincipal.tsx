'use client';
/**
 * Navegação principal — MOBILE. As 3 telas do app, sempre a um toque.
 * A lista de destinos mora em `./destinos` — a `Sidebar` (desktop) lê a mesma.
 *
 * FORMA: barra FIXA no rodapé, largura toda, alvo de toque de no mínimo 44px
 * (o polegar de quem anda pelo corredor com o celular numa mão não acerta
 * alvo menor — recomendação de acessibilidade da Apple/WCAG).
 *
 * `md:hidden`: a partir do desktop quem navega é a `Sidebar` lateral — as duas
 * juntas seriam navegação duplicada, e a pílula flutuante que existia aqui
 * antes cobria conteúdo do card por baixo dela (sem espaço reservado no meio
 * do scroll, só no fim da lista).
 *
 * Cores: só token do tema. A barra usa `sasi-chrome` (navy nos dois temas —
 * é a marca, a mesma da barra de comando), texto em `chrome-*` e o item ativo
 * marcado por peso + brilho de texto, não só por cor: daltonismo e telas com
 * brilho baixo no plantão noturno.
 */
import Link from 'next/link';
import {usePathname} from 'next/navigation';

import {DESTINOS, estaAtivo} from './destinos';

export function NavPrincipal() {
    const pathname = usePathname();

    return (
        <nav
            aria-label="Navegação principal"
            // A folga inferior usa a área segura do aparelho, o
            // env(safe-area-inset-bottom) do iPhone — sem isso o alvo de toque fica
            // embaixo da barra de gesto do sistema. (Não escrever a classe Tailwind
            // por extenso neste comentário: o scanner do Tailwind lê comentário e
            // gera CSS inválido, poluindo todo build com warning.)
            className="sasi-chrome fixed inset-x-0 bottom-0 z-20 border-t border-t-(--chrome-borda) pb-[env(safe-area-inset-bottom)] md:hidden"
        >
            <ul className="flex items-stretch justify-around">
                {DESTINOS.map((destino) => {
                    const ativo = estaAtivo(pathname, destino);
                    return (
                        <li key={destino.href} className="flex-1">
                            <Link
                                href={destino.href}
                                aria-current={ativo ? 'page' : undefined}
                                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-colors duration-(--dur-fast) ${
                                    ativo
                                        ? 'font-semibold text-chrome-texto'
                                        : 'font-medium text-chrome-suave hover:text-chrome-texto'
                                }`}
                            >
                                <destino.Icone aria-hidden size={20} strokeWidth={ativo ? 2.4 : 2} />
                                <span className="text-2xs">{destino.rotulo}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
