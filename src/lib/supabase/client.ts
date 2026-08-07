'use client';
/**
 * Cliente Supabase para Client Components (código que roda no NAVEGADOR).
 * Usa a anon key — segura de expor porque toda tabela tem RLS
 * (Row Level Security: o banco filtra linha a linha pelo usuário logado).
 * Uso: realtime (leito atualizando ao vivo) e mutação interativa.
 */
import { createBrowserClient } from '@supabase/ssr';

// TODO(gen:types): após aplicar a migration no banco, rodar `pnpm gen:types`
// e tipar com createBrowserClient<Database>.
export function getSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
