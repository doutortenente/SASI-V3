import type {Metadata, Viewport} from 'next';
import {IBM_Plex_Mono, IBM_Plex_Sans} from 'next/font/google';
import '@/styles/globals.css';

import {Providers} from '@/app/providers';
import {BotaoTema} from '@/components/core/BotaoTema';
import {NavPrincipal} from '@/components/core/NavPrincipal';
import {Sidebar} from '@/components/core/Sidebar';

/**
 * IBM Plex — a fonte do design system.
 *
 * O tema já pedia 'IBM Plex Sans' desde o começo, mas ninguém carregava a
 * fonte: o navegador não achava, caía no `system-ui` e o painel inteiro ficava
 * com cara de formulário. `next/font` baixa a fonte no build e serve do nosso
 * próprio domínio — sem chamada ao Google quando o app roda, e sem o texto
 * "pulando" quando a fonte chega.
 *
 * Mono não é enfeite: dose e sinal vital em fonte de largura variável
 * desalinham a coluna, e é na coluna torta que o olho perde a diferença entre
 * 1,5 e 15.
 */
const plexSans = IBM_Plex_Sans({
    subsets: ['latin', 'latin-ext'], // latin-ext: acentuação portuguesa completa
    weight: ['400', '500', '600', '700'],
    variable: '--fonte-sans',
    display: 'swap',
});

const plexMono = IBM_Plex_Mono({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--fonte-mono',
    display: 'swap',
});

export const metadata: Metadata = {
    title: {
        default: 'SASI — War Room UTI',
        template: '%s · SASI',
    },
    description: 'Sistema de Apoio à Situação Intensiva. Dado sem fonte é null.',
    robots: {index: false, follow: false}, // dado clínico: nunca indexar
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    // ÚNICO hex permitido fora de globals.css: a meta tag theme-color não lê
    // var() do CSS, então o valor é copiado do fim do gradiente --chrome-bg do
    // tema clinical (globals.css). Mudou o token lá, muda aqui junto.
    themeColor: '#0b1d35',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
    return (
        <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
            <body className="min-h-dvh bg-superficie-app text-texto-corpo antialiased">
                {/*
          `Providers` liga o TanStack Query para o app inteiro (ver providers.tsx).

          FORMA: rail lateral (`Sidebar`) a partir do desktop, barra fixa no
          rodapé (`NavPrincipal`) no celular — as duas leem a mesma lista de
          3 destinos (`core/destinos.ts`) e nunca aparecem juntas (`md:` corta
          uma, liga a outra).

          A ORDEM DAS CAMADAS na coluna principal:
          - `children` leva `pb-24 md:pb-0`: no celular a barra de navegação é
            FIXA no rodapé e, sem essa folga, cobriria a última linha de
            conteúdo; no desktop quem navega é a `Sidebar`, sem folga a repor.
          - `BotaoTema` flutua no canto superior direito, por cima da barra de
            comando que cada tela desenha (z-20 > z-10 do header sticky). Tela
            que puser conteúdo nesse canto reserva o espaço (`pr-14`).
        */}
                <Providers>
                    <div className="flex min-h-dvh">
                        <Sidebar />
                        <div className="flex min-w-0 flex-1 flex-col">
                            <BotaoTema />
                            <div className="flex-1 pb-24 md:pb-0">{children}</div>
                            <NavPrincipal />
                        </div>
                    </div>
                </Providers>
            </body>
        </html>
    );
}
