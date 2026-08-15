'use client';
/**
 * Rail lateral de comando — DESKTOP. Porta do `Chrome.jsx` do
 * `sasi-design-system` (Sidebar navy do pacote), adaptado: os 9 destinos
 * fictícios do mockup viraram os 3 reais do app (mesma lista de
 * `NavPrincipal`, lida de `./destinos` — casa única). O rodapé com
 * "Dr. Intensivista / Hospital São Lucas" do mockup foi removido: o app não
 * tem login, não existe identidade de operador pra mostrar, e inventar uma
 * seria dado fabricado numa peça de chrome que developer nenhum vai conferir.
 *
 * `hidden md:flex`: abaixo do desktop quem navega é `NavPrincipal` (barra do
 * celular) — as duas juntas seriam navegação duplicada, e um rail de 232px
 * fixo comeria a tela inteira num aparelho de 375px.
 */
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Activity} from 'lucide-react';

import {DESTINOS, estaAtivo} from './destinos';

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside
            aria-label="Navegação principal"
            className="sasi-chrome hidden md:flex md:w-(--sidebar-width) md:shrink-0 md:flex-col md:gap-2.5 md:border-r md:border-r-(--chrome-borda) md:p-3"
        >
            <div className="flex items-center gap-2.5 border-b border-b-(--chrome-borda) px-2 pb-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-acento text-(--texto-sobre-acento)">
                    <Activity aria-hidden size={19} strokeWidth={2.4} />
                </span>
                <div className="leading-tight">
                    <b className="block text-md font-bold tracking-wide text-chrome-texto">SASI</b>
                    <small className="block text-2xs text-chrome-suave">
                        Sistema de Apoio
                        <br />à Situação Intensiva
                    </small>
                </div>
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
                {DESTINOS.map((destino) => {
                    const ativo = estaAtivo(pathname, destino);
                    return (
                        <Link
                            key={destino.href}
                            href={destino.href}
                            aria-current={ativo ? 'page' : undefined}
                            className={`flex items-center gap-2.5 rounded-md border-l-2 py-2 pr-2.5 pl-2 text-sm transition-colors duration-(--dur-fast) ${
                                ativo
                                    ? 'border-l-(--chrome-active-bar) bg-(--chrome-active) font-semibold text-chrome-texto'
                                    : 'border-l-transparent font-medium text-chrome-suave hover:bg-white/5 hover:text-chrome-texto'
                            }`}
                        >
                            <destino.Icone aria-hidden size={17} strokeWidth={ativo ? 2.4 : 2} />
                            <span>{destino.rotulo}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
