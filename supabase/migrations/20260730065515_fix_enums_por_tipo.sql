-- APLICADA no banco vivo em 30-jul-2026. Recuperada de supabase_migrations.schema_migrations
-- em 11-ago-2026, com md5 conferido (aec92d1a94abba97bdafd74157d3f9cd). NAO EDITAR: migration aplicada nao se edita.
-- Ja consta como aplicada no banco, entao o `pnpm db:push` a pula.

-- Conserto: cada enum no seu proprio do-block (idempotente de verdade).
-- Os 2 pre-existentes (gravidade_enum, status_leito_enum) sao pulados; os 12 novos entram.
do $$ begin create type public.uti_enum as enum ('UTI2','UTI3','UTI4'); exception when duplicate_object then null; end $$;
do $$ begin create type public.gravidade_enum as enum ('estavel','moderado','grave','critico','obito'); exception when duplicate_object then null; end $$;
do $$ begin create type public.status_leito_enum as enum ('ativo','alta','obito','transferencia'); exception when duplicate_object then null; end $$;
do $$ begin create type public.isolamento_enum as enum ('none','contact','droplet','aerosol'); exception when duplicate_object then null; end $$;
do $$ begin create type public.severidade_visual_enum as enum ('red','yellow','green'); exception when duplicate_object then null; end $$;
do $$ begin create type public.plantao_enum as enum ('manha','tarde','noite','plantao_24h'); exception when duplicate_object then null; end $$;
do $$ begin create type public.via_atb_enum as enum ('EV','VO','IM','SC','SNE','SNG','IT','Tópico'); exception when duplicate_object then null; end $$;
do $$ begin create type public.intencao_atb_enum as enum ('empirica','dirigida','profilatica'); exception when duplicate_object then null; end $$;
do $$ begin create type public.material_cultura_enum as enum ('hemocultura','urocultura','aspirado_traqueal','lavado_bal','lcr','secrecao_ferida','liquido_peritoneal','liquido_pleural','outro'); exception when duplicate_object then null; end $$;
do $$ begin create type public.antibiograma_resultado_enum as enum ('S','I','R'); exception when duplicate_object then null; end $$;
do $$ begin create type public.severidade_alerta_enum as enum ('info','warning','critical'); exception when duplicate_object then null; end $$;
do $$ begin create type public.fonte_evento_enum as enum ('manual','gemini_ocr','claude_ocr','appsheet','auto_trigger','edge_function','api_import'); exception when duplicate_object then null; end $$;
do $$ begin create type public.comparador_enum as enum ('lt','lte','gt','gte'); exception when duplicate_object then null; end $$;
do $$ begin create type public.trend_modo_enum as enum ('subida_abs','subida_rel','queda_abs'); exception when duplicate_object then null; end $$;
