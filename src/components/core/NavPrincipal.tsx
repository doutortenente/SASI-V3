'use client';
/**
 * Navegação principal — as 3 telas do app, sempre a um toque.
 *
 * | Destino      | Rota          | Quando se usa                          |
 * | ------------ | ------------- | -------------------------------------- |
 * | Meu plantão  | `/`           | visão dos pacientes assumidos          |
 * | Captura      | `/captura`    | registrar à beira do leito, uma mão    |
 * | Fechamento   | `/fechamento` | montar evolução e passagem, fim de turno |
 *
 * FORMA: barra FIXA no rodapé. No celular ela ocupa a largura toda, com alvo
 * de toque de no mínimo 44px (o polegar de quem anda pelo corredor com o
 * celular numa mão não acerta alvo menor — recomendação de acessibilidade da
 * Apple/WCAG). No desktop ela encolhe para uma pílula discreta centralizada:
 * continua no rodapé de propósito, porque o TOPO já pertence à barra de
 * comando (`sasi-chrome`) que cada tela desenha grudada em `top-0` — pôr a
 * navegação lá em cima brigaria com ela.
 *
 * ROTA ATIVA por `usePathname`: comparação exata para `/` (senão `/` casaria
 * com tudo) e por prefixo para as outras (assim `/captura/abc123` continua
 * acendendo "Captura").
 *
 * Cores: só token do tema. A barra usa `sasi-chrome` (navy nos dois temas —
 * é a marca, a mesma da barra de comando), texto em `chrome-*` e o item ativo
 * marcado por peso + brilho de texto, não só por cor: daltonismo e telas com
 * brilho baixo no plantão noturno.
 */
import { FileText, LayoutGrid, PenLine } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Destino {
  href: string;
  rotulo: string;
  Icone: typeof LayoutGrid;
  /** `true` = só acende com a rota exata (caso da raiz `/`). */
  exato: boolean;
}

const DESTINOS: Destino[] = [
  { href: '/', rotulo: 'Meu plantão', Icone: LayoutGrid, exato: true },
  { href: '/captura', rotulo: 'Captura', Icone: PenLine, exato: false },
  { href: '/fechamento', rotulo: 'Fechamento', Icone: FileText, exato: false },
];

function estaAtivo(pathname: string, destino: Destino): boolean {
  if (destino.exato) return pathname === destino.href;
  return pathname === destino.href || pathname.startsWith(`${destino.href}/`);
}

export function NavPrincipal() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      // Celular: colada no rodapé, largura toda. Desktop (md+): pílula flutuante
      // centralizada. A folga inferior usa a área segura do aparelho, o
      // env(safe-area-inset-bottom) do iPhone — sem isso o alvo de toque fica
      // embaixo da barra de gesto do sistema. (Não escrever a classe Tailwind
      // por extenso neste comentário: o scanner do Tailwind lê comentário e
      // gera CSS inválido, poluindo todo build com warning.)
      className="sasi-chrome fixed inset-x-0 bottom-0 z-20 border-t border-t-(--chrome-borda) pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:rounded-full md:border md:border-(--chrome-borda) md:px-2 md:pb-0 md:shadow-elevada"
    >
      <ul className="flex items-stretch justify-around md:justify-center md:gap-1">
        {DESTINOS.map((destino) => {
          const ativo = estaAtivo(pathname, destino);
          return (
            <li key={destino.href} className="flex-1 md:flex-none">
              <Link
                href={destino.href}
                aria-current={ativo ? 'page' : undefined}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-colors duration-(--dur-fast) md:min-h-0 md:flex-row md:gap-1.5 md:py-2 ${
                  ativo
                    ? 'font-semibold text-chrome-texto'
                    : 'font-medium text-chrome-suave hover:text-chrome-texto'
                }`}
              >
                <destino.Icone aria-hidden size={20} strokeWidth={ativo ? 2.4 : 2} />
                <span className="text-2xs md:text-xs">{destino.rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
