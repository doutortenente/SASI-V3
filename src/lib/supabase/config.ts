/**
 * Endereço e chave PUBLICÁVEL do projeto Supabase — casa única.
 *
 * A variável de ambiente manda quando existe; a constante abaixo é a reserva.
 * Por que uma reserva no código? O app publicado passou 12 dias caindo com 500
 * porque o projeto da Vercel estava sem as duas variáveis (medido nos logs de
 * runtime em 12-ago-2026, erro registrado desde 01-ago). Estes dois valores são
 * públicos POR DESENHO — a chave publicável vai para o navegador de qualquer
 * visitante e toda tabela tem RLS — então tê-los aqui não expõe nada que a
 * própria página não exponha.
 *
 * Se o projeto Supabase um dia mudar, muda AQUI e em .env.example — mais lugar
 * nenhum. Segredo de verdade (SUPABASE_SECRET_KEY etc.) continua proibido no
 * repositório: mora no cofre e nunca ganha reserva em código.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://idswehsvvqczzkiatuzu.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_9DVsZExR5QOIowCbpirhyw_dRuEVHsy';
