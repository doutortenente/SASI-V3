-- APLICADA no banco vivo em 30-jul-2026. Recuperada de supabase_migrations.schema_migrations
-- em 11-ago-2026, com md5 conferido (0987e92386a9e256b3544cc23e9ddeeb). NAO EDITAR: migration aplicada nao se edita.
-- Ja consta como aplicada no banco, entao o `pnpm db:push` a pula.

-- Correcao: evento_tipo_ref estava legivel so pelo papel `authenticated`, mas o app
-- roda hoje sem login (chave anon). Efeito: rotulo/unidade/faixa vinham vazios e as
-- telas de labs/sinais caiam em modo degradado (mostravam o codigo cru).
--
-- evento_tipo_ref e VOCABULARIO CLINICO, nao PHI: nome do exame, unidade padrao e
-- faixa de plausibilidade fisiologica. Nao ha nenhum dado de paciente aqui.
-- Por isso a leitura pode ser liberada para anon; a ESCRITA continua so service_role.
drop policy if exists evento_tipo_ref_read on public.evento_tipo_ref;
create policy evento_tipo_ref_read on public.evento_tipo_ref
  for select to anon, authenticated using (true);
