import 'server-only';
/**
 * Cliente Supabase para Server Components e Route Handlers.
 * `server-only` na primeira linha: se alguém importar isto num Client Component,
 * o build QUEBRA — em vez de vazar cookie/chave pro navegador em silêncio.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// TODO(gen:types): após aplicar a migration no banco, rodar `pnpm gen:types`
// e tipar com createServerClient<Database>.
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component não pode escrever cookie — o middleware cuida disso.
          }
        },
      },
    },
  );
}
