import type {NextRequest} from 'next/server';

import {manterSessao} from '@/lib/supabase/sessao';

/**
 * Proxy = código que roda ANTES de cada página, na borda. (Era `middleware.ts`
 * até o Next 15; o Next 16 renomeou a convenção — mesma coisa, nome novo.)
 *
 * Tem um trabalho só: garantir que exista sessão válida antes de qualquer tela
 * pedir dado ao banco. Ver `lib/supabase/sessao.ts` para o porquê.
 */
export async function proxy(request: NextRequest) {
    return manterSessao(request);
}

export const config = {
    // Tudo, menos o que não fala com o banco: estático do Next, ícone e imagem.
    // Rodar em cada .png custaria uma verificação de sessão por asset, à toa.
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)',
    ],
};
