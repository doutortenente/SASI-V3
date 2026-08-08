import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import '@/styles/globals.css';

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
  robots: { index: false, follow: false }, // dado clínico: nunca indexar
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b1d35', // barra do navegador acompanha a barra de comando
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body className="bg-superficie-app text-texto-corpo min-h-dvh antialiased">{children}</body>
    </html>
  );
}
