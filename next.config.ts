import type {NextConfig} from 'next';

/**
 * Configuração do Next.js 16.
 * - Turbopack é o bundler PADRÃO no 16 (não precisa mais da flag --turbopack).
 * - `typedRoutes` faz o TypeScript reclamar de link para rota que não existe.
 *   Numa UTI, link quebrado é tempo perdido à beira-leito.
 */
const nextConfig: NextConfig = {
    reactStrictMode: true,

    // Rotas viram tipos: <Link href="/leito/999"> só compila se a rota existir.
    typedRoutes: true,

    typescript: {
        // Build QUEBRA se houver erro de tipo. Nunca ligar isso pra "destravar deploy".
        // (No Next 16 o lint saiu do build — roda separado via `pnpm lint`.)
        ignoreBuildErrors: false,
    },

    // Cabeçalhos de segurança: dado clínico não pode ser embutido em site de terceiro.
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {key: 'X-Frame-Options', value: 'DENY'},
                    {key: 'X-Content-Type-Options', value: 'nosniff'},
                    {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
                    {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
                ],
            },
        ];
    },
};

export default nextConfig;
