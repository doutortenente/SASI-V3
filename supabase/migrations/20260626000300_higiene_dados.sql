-- APLICADA no banco vivo em 26-jun-2026. Recuperada de supabase_migrations.schema_migrations
-- em 11-ago-2026, com md5 conferido (377b2978e17fb085dd44f25091f58cd4). NAO EDITAR: migration aplicada nao se edita.
-- Ja consta como aplicada no banco, entao o `pnpm db:push` a pula.

-- higiene-S: invariantes e qualidade de dado (lote seguro).
-- Pulados conscientemente: checks-eventos (confidence/valor ja existem), dispositivos
-- (shape booleano lido pelo frontend -> mudanca coordenada), gaso (depende de liberar tipo_check).

-- 1) lowconf-autoreview: dado de baixa confianca SEMPRE cai na fila (invariante no banco).
--    BEFORE INSERT apenas (nao UPDATE) -> o medico ainda consegue limpar requires_review ao revisar.
create or replace function public.fn_autoflag_lowconf()
returns trigger
language plpgsql
volatile
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if new.confidence is null or new.confidence < 0.7 then
    new.requires_review := true;
  end if;
  return new;
end;
$function$;
drop trigger if exists trg_autoflag_lowconf on public.eventos_clinicos;
create trigger trg_autoflag_lowconf
  before insert on public.eventos_clinicos
  for each row execute function public.fn_autoflag_lowconf();
-- backfill (hoje = 0 linhas; todas lowconf ja estao requires_review). Idempotente.
update public.eventos_clinicos set requires_review = true
  where (confidence is null or confidence < 0.7) and not requires_review;
-- 2) review-queue (lite): fila de revisao visivel. security_invoker respeita RLS.
create or replace view public.vw_eventos_pendentes_revisao
  with (security_invoker = true) as
  select *
  from public.eventos_clinicos
  where requires_review or coalesce(confidence, 1) < 0.7;
-- 3) riscos-flags: flags de risco do cabecalho do leito (ortogonais ao isolamento).
alter table public.pacientes
  add column if not exists riscos_flags jsonb not null default '{}'::jsonb;
comment on column public.pacientes.riscos_flags is
  'Flags de risco binarias: {pav,broncoaspiracao,upp,queda,diabetico}. CONTATO/isolamento vive em pacientes.isolation (uma fonte da verdade).';
-- 4) patient-summary: default + backfill dos 15 null para {}.
alter table public.pacientes alter column patient_summary set default '{}'::jsonb;
update public.pacientes set patient_summary = '{}'::jsonb where patient_summary is null;
-- 5) atb-dday: meta de duracao do curso (decisao clinica; D-day ja e derivado em vw_dias_atb_ativo).
alter table public.atbs add column if not exists duracao_planejada_dias int;
comment on column public.atbs.duracao_planejada_dias is
  'Meta de duracao do curso ATB (ex: 7d). null = nao definida. D-day = current_date - data_inicio (ver vw_dias_atb_ativo).';
