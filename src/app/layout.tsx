import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
