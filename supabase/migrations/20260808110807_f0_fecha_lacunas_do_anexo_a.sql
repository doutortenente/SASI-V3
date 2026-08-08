-- Duas peças declaradas em 10_schema_producao_v3.sql que faltavam no banco vivo.
-- Aplicada em 08-ago-2026 no projeto idswehsvvqczzkiatuzu.
--
-- Nenhuma pertence à seção 6 (RLS de produção), que segue fora por decisão do
-- operador. Verificado antes: 0 dos 335 eventos tinham confidence fora de [0,1].

-- Trava de integridade da nota de confiança: ela alimenta requires_review e a
-- porta anti-alucinação de fn_eval_alert/fn_eval_trend (só dispara com >= 0.7).
-- Sem esta restrição, um 5 ou um -1 entraria e passaria pela porta.
alter table public.eventos_clinicos
  add constraint eventos_confidence_check check (confidence between 0 and 1);

create index if not exists idx_eventos_user on public.eventos_clinicos (user_id);
