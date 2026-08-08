-- ============================================================================
-- Remove índice duplicado em eventos_clinicos
-- Aplicado no banco vivo (idswehsvvqczzkiatuzu) em 08-ago-2026.
-- ----------------------------------------------------------------------------
-- idx_eventos_user e idx_eventos_clinicos_user_id eram IDÊNTICOS:
--   CREATE INDEX idx_eventos_user            ON eventos_clinicos USING btree (user_id)
--   CREATE INDEX idx_eventos_clinicos_user_id ON eventos_clinicos USING btree (user_id)
--
-- Dois índices iguais custam disco e tornam toda gravação mais lenta (o Postgres
-- mantém os dois atualizados), sem nenhum ganho de leitura.
--
-- Mantido idx_eventos_clinicos_user_id, que segue a convenção idx_<tabela>_<coluna>
-- usada no resto do schema (idx_pendencias_user_id, idx_atbs_user_id, ...).
--
-- VOLTA:
--   create index idx_eventos_user on public.eventos_clinicos using btree (user_id);
-- ============================================================================

drop index if exists public.idx_eventos_user;
