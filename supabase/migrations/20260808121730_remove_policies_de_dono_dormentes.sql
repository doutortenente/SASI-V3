-- ============================================================================
-- Remove as 12 policies de dono DORMENTES das 9 tabelas que têm dev_bypass
-- Aplicado no banco vivo (idswehsvvqczzkiatuzu) em 08-ago-2026.
-- ----------------------------------------------------------------------------
-- POR QUE ESTAVAM DORMENTES (medido, não suposto):
--   * Uso solo, sem login — decisão do operador registrada em CLAUDE.md.
--     Sem sessão autenticada, auth.uid() é sempre null.
--   * Os 15 pacientes do banco têm user_id null (15 de 15, contado em 08-ago).
--   * Logo `auth.uid() = user_id` nunca é verdadeiro: as policies não casavam
--     com nenhuma linha, em nenhuma consulta, nunca. Zero proteção entregue.
--
-- POR QUE REMOVER NÃO MUDA O ACESSO:
--   Policies permissivas do Postgres são ADITIVAS (combinadas por OR).
--   dev_bypass (FOR ALL USING true WITH CHECK true) permanece nas 9 tabelas.
--   Remover uma parcela de um OR cujo outro lado é `true` não altera o resultado.
--
-- CUSTO DO QUE FOI REMOVIDO (advisor de desempenho do Supabase):
--   multiple_permissive_policies: 180 avisos -> 0.
--   Total de avisos de desempenho do projeto: 204 -> 22.
--   O Postgres avaliava as duas regras em toda linha de toda consulta.
--
-- NÃO TOCADO, DE PROPÓSITO:
--   * memorias — tem 4 policies de dono e NÃO tem dev_bypass. Apagar as dela
--     trancaria a tabela (RLS ligada + zero policy = nega tudo). Ficam.
--   * evento_tipo_ref_read — leitura pública proposital do vocabulário de eventos.
--   * As 11 dev_bypass — ativas de propósito (CLAUDE.md: uso solo).
--   * RLS continua LIGADA nas 13 tabelas.
--
-- VOLTA COMPLETA: supabase/rollback/20260808_restaura_policies_de_dono.sql
-- (fora de migrations/ de propósito: aquela pasta é executada por pnpm db:push)
-- ============================================================================

drop policy if exists alerts_all_own       on public.alerts_log;
drop policy if exists antibiograma_all_own on public.antibiograma;
drop policy if exists atbs_all_own         on public.atbs;
drop policy if exists culturas_all_own     on public.culturas;
drop policy if exists eventos_all_own      on public.eventos_clinicos;
drop policy if exists evolucoes_all_own    on public.evolucoes;
drop policy if exists ingest_audit_own     on public.ingest_audit_log;
drop policy if exists pendencias_all_own   on public.pendencias;

drop policy if exists pacientes_select_own on public.pacientes;
drop policy if exists pacientes_insert_own on public.pacientes;
drop policy if exists pacientes_update_own on public.pacientes;
drop policy if exists pacientes_delete_own on public.pacientes;
