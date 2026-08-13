'use client';
/**
 * Cliente Supabase para Client Components (código que roda no NAVEGADOR).
 * Usa a anon key — segura de expor porque toda tabela tem RLS
 * (Row Level Security: o banco filtra linha a linha pelo usuário logado).
 * Uso: realtime (leito atualizando ao vivo) e mutação interativa.
 */
import {createBrowserClient} from '@supabase/ssr';

import {SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL} from '@/lib/supabase/config';
import type {Database} from '@/types/supabase';

// `<Database>` = o cliente passa a conhecer tabelas, colunas e enums do banco.
// Errar nome de coluna ou escrever "gravissimo" vira erro antes de rodar.
export function getSupabaseBrowser() {
    return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
