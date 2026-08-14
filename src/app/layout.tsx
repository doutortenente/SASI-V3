import type {Metadata, Viewport} from 'next';
import {IBM_Plex_Mono, IBM_Plex_Sans} from 'next/font/google';
import '@/styles/globals.css';

import {Providers} from '@/app/providers';
import {BotaoTema} from '@/components/core/BotaoTema';
import {NavPrincipal} from '@/components/core/NavPrincipal';

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

          A ORDEM DAS CAMADAS:
          - `children` leva `pb-24` no invólucro: a barra de navegação é FIXA no
            rodapé e, sem essa folga, cobriria a última linha de conteúdo — no
            plantão isso seria o último leito da grade.
          - `BotaoTema` flutua no canto superior direito, por cima da barra de
            comando que cada tela desenha (z-20 > z-10 do header sticky). Tela
            que puser conteúdo nesse canto reserva o espaço (`pr-14`).
          - `NavPrincipal` por último no DOM, mas fixa no rodapé via CSS.
        */}
                <Providers>
                    <BotaoTema />
                    <div className="pb-24">{children}</div>
                    <NavPrincipal />
                </Providers>
            </body>
        </html>
    );
}
