import 'server-only';
/**
 * Cliente Supabase para Server Components e Route Handlers.
 * `server-only` na primeira linha: se alguém importar isto num Client Component,
 * o build QUEBRA — em vez de vazar cookie/chave pro navegador em silêncio.
 */
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';

import {SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL} from '@/lib/supabase/config';
import type {Database} from '@/types/supabase';

// `<Database>` = o cliente passa a conhecer tabelas, colunas e enums do banco.
export async function getSupabaseServer() {
    const cookieStore = await cookies();
    return createServerClient<Database>(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: (list) => {
                    try {
                        list.forEach(({name, value, options}) => cookieStore.set(name, value, options));
                    } catch {
                        // Server Component não pode escrever cookie — e sem login (vetado,
                        // uso solo) não há sessão a renovar; ignorar é o comportamento certo.
                    }
                },
            },
        },
    );
}
