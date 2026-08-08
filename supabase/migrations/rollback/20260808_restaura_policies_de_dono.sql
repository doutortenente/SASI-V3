-- ============================================================================
-- VOLTA ATRÁS de 20260808121730_remove_policies_de_dono_dormentes.sql
-- ----------------------------------------------------------------------------
-- Recria, ao pé da letra, as 12 policies de dono removidas em 08-ago-2026.
-- As definições abaixo foram lidas de pg_policies ANTES da remoção — não são
-- reconstrução de memória.
--
-- QUANDO RODAR ISTO: só se o escopo do SASI mudar e passar a existir login de
-- verdade (mais de um usuário). Enquanto o uso for solo e sem login, estas
-- policies voltam a ser peso morto: 180 avisos de desempenho e zero proteção.
--
-- ATENÇÃO: para elas voltarem a PROTEGER algo, não basta recriá-las. É preciso
-- também preencher pacientes.user_id — hoje os 15 pacientes têm esse campo null.
-- Policy de dono sobre linha sem dono não protege nada.
--
-- Rodar com o Supabase CLI:
--   supabase db execute -f supabase/migrations/rollback/20260808_restaura_policies_de_dono.sql
-- ============================================================================

-- pacientes: 4 policies, uma por comando
create policy pacientes_select_own on public.pacientes
  for select using ((select auth.uid()) = user_id);

create policy pacientes_insert_own on public.pacientes
  for insert with check ((select auth.uid()) = user_id);

create policy pacientes_update_own on public.pacientes
  for update using ((select auth.uid()) = user_id)
             with check ((select auth.uid()) = user_id);

create policy pacientes_delete_own on public.pacientes
  for delete using ((select auth.uid()) = user_id);

-- ingest_audit_log: dono direto pela própria coluna
create policy ingest_audit_own on public.ingest_audit_log
  for all using ((select auth.uid()) = user_id)
          with check ((select auth.uid()) = user_id);

-- Tabelas-filhas de paciente: dono herdado via pacientes.user_id
create policy alerts_all_own on public.alerts_log
  for all using (exists (select 1 from public.pacientes p
                          where p.id = alerts_log.paciente_id
                            and p.user_id = (select auth.uid())))
          with check (exists (select 1 from public.pacientes p
                          where p.id = alerts_log.paciente_id
                            and p.user_id = (select auth.uid())));

create policy atbs_all_own on public.atbs
  for all using (exists (select 1 from public.pacientes p
                          where p.id = atbs.paciente_id
                            and p.user_id = (select auth.uid())))
          with check (exists (select 1 from public.pacientes p
                          where p.id = atbs.paciente_id
                            and p.user_id = (select auth.uid())));

create policy culturas_all_own on public.culturas
  for all using (exists (select 1 from public.pacientes p
                          where p.id = culturas.paciente_id
                            and p.user_id = (select auth.uid())))
          with check (exists (select 1 from public.pacientes p
                          where p.id = culturas.paciente_id
                            and p.user_id = (select auth.uid())));

create policy eventos_all_own on public.eventos_clinicos
  for all using (exists (select 1 from public.pacientes p
                          where p.id = eventos_clinicos.paciente_id
                            and p.user_id = (select auth.uid())))
          with check (exists (select 1 from public.pacientes p
                          where p.id = eventos_clinicos.paciente_id
                            and p.user_id = (select auth.uid())));

create policy evolucoes_all_own on public.evolucoes
  for all using (exists (select 1 from public.pacientes p
                          where p.id = evolucoes.paciente_id
                            and p.user_id = (select auth.uid())))
          with check (exists (select 1 from public.pacientes p
                          where p.id = evolucoes.paciente_id
                            and p.user_id = (select auth.uid())));

create policy pendencias_all_own on public.pendencias
  for all using (exists (select 1 from public.pacientes p
                          where p.id = pendencias.paciente_id
                            and p.user_id = (select auth.uid())))
          with check (exists (select 1 from public.pacientes p
                          where p.id = pendencias.paciente_id
                            and p.user_id = (select auth.uid())));

-- antibiograma: dono herdado por dois saltos (cultura -> paciente)
create policy antibiograma_all_own on public.antibiograma
  for all using (exists (select 1 from public.culturas c
                          join public.pacientes p on p.id = c.paciente_id
                          where c.id = antibiograma.cultura_id
                            and p.user_id = (select auth.uid())))
          with check (exists (select 1 from public.culturas c
                          join public.pacientes p on p.id = c.paciente_id
                          where c.id = antibiograma.cultura_id
                            and p.user_id = (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Volta do índice duplicado (20260808121654), se por algum motivo for desejada:
--   create index idx_eventos_user on public.eventos_clinicos using btree (user_id);
-- (Não recomendado: era byte-a-byte igual a idx_eventos_clinicos_user_id.)
-- ----------------------------------------------------------------------------
