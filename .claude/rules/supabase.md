---
paths:
  - "supabase/**"
  - "src/lib/supabase/**"
  - "src/types/supabase.ts"
  - "**/*.sql"
---

# Supabase — regras do banco do SASI v3

Carrega só quando você abre um arquivo de banco. **Some depois de um `/compact`** até você abrir outro —
por isso o que não pode ser esquecido nunca (dado ausente é `null`) mora no `CLAUDE.md` da raiz, não aqui.

Projeto: `fpemjplgtyhztowwemfz`. Schema em `supabase/migrations/20260807000000_schema_inicial_v3.sql`
(757 linhas: 13 tabelas, 14 enums, 7 views, 41 policies).

## Os 6 defeitos conhecidos do schema (medidos em 07-ago-2026)

Não são suposição. Cada um tem linha. Não "consertar" sem ordem — estão aqui para não serem redescobertos.

| # | Defeito | Linha |
|---|---|---|
| 1 | **`user_id` null cega o app inteiro.** A policy é `auth.uid() = user_id`; com `null` o resultado é `null`, não `true`. E `fn_owns_paciente` devolve `false`, derrubando as 12 tabelas-filhas junto. Sintoma: tudo vazio, nenhum erro | 604-607, 624 |
| 2 | **`save_ficha` e a RLS discordam.** A função aceita `user_id is null`; a policy rejeita. A escrita entra e a leitura não enxerga | 542 × 624 |
| 3 | **`alert_rules` e `trend_rules` nascem vazias** — não há seed em lugar nenhum. `fn_eval_alert` e `fn_eval_trend` iteram sobre tabela sem linha: **zero alerta dispara**. As 25 regras com DOI estão em `docs/INVENTARIO-MATERIAL.md` §1 | 377-404, 459 |
| 4 | **`evolucoes` carrega dois modelos de conduta ao mesmo tempo**: `impressao`/`conduta` como `text[]` e `problemas_ativos`/`condutas_sistemas` como jsonb. Duplicação herdada do v2, não resolvida | 203-206 |
| 5 | **Duas referências quebradas no cabeçalho**: cita `.claude/rules/supabase.md` (este arquivo, que só passou a existir agora) e `11_migracao_do_vivo.sql`, que vive só dentro de `_material/`, fora do repo | 14, 21, 601 |
| 6 | **`vw_sofa_diario` está só como comentário** — o motor de SOFA/dia não foi escrito. A view v0.2 existe no material (`INVENTARIO-MATERIAL.md` §1) | 752 |

## Ao criar ou alterar tabela

- **RLS ligada sempre**, em toda tabela, sem exceção.
- **4 policies separadas por comando** (`select`/`insert`/`update`/`delete`), **nunca `FOR ALL`**.
  `select` usa só `using` · `insert` usa só `with check` · `update` usa os dois · `delete` usa só `using`.
- Escopo de dono: `pacientes` compara `(select auth.uid()) = user_id` direto; tabela-filha usa o helper
  `public.fn_owns_paciente(paciente_id)`, que evita repetir o JOIN.
- `(select auth.uid())` entre parênteses, não `auth.uid()` solto — o planner avalia uma vez em vez de por linha.
- **Sem `dev_bypass`, sem `using (true)`** em tabela com dado de paciente.

**Exceções deliberadas ao "4 policies"** — não são buraco, não reportar como defeito:

| Tabela | Policies | Por quê |
|---|---|---|
| `ingest_audit_log` | só `select` + `insert` | Trilha de auditoria é append-only: registro que pode ser editado ou apagado não serve de auditoria |
| `alert_rules` · `trend_rules` · `evento_tipo_ref` | só `select`, `using (true)` | Configuração, não é dado de paciente. Escrita só por `service_role` |

## Ao escrever função

- `set search_path to 'public','extensions','pg_catalog'` **sempre**. Sem isso a função quebra em silêncio
  quando o schema de quem chama é diferente.
- Volatilidade correta: `stable` para quem só lê, `immutable` para cálculo puro. O padrão é `volatile` e ele
  impede o planner de otimizar.
- Extensão com schema explícito: `extensions.digest()`, `extensions.vector`. Nunca o nome solto.
- `security definer` só quando precisa furar a RLS de propósito (é o caso de `fn_owns_paciente` e `save_ficha`) —
  e sempre com `search_path` fixado na mesma linha, senão vira porta de escalada de privilégio.

## Ao escrever view

`with (security_invoker = true)` **sempre**. Sem isso a view roda com a permissão de quem a criou e vaza dado
de todos os pacientes para qualquer usuário logado. As 7 views do schema já têm.

## Migration

- Nome `YYYYMMDDHHmmss_descricao.sql`, SQL em minúsculas, idempotente (`if not exists`).
- Comando destrutivo (`drop`, `delete`, `alter ... drop column`) vai **comentado**, com o motivo na linha de cima.
- Depois de aplicar: `pnpm gen:types` para regenerar `src/types/supabase.ts`. Schema novo com tipo velho compila
  e quebra em runtime, com o paciente na tela.
- **Nunca editar migration já aplicada** — crie a próxima.

## Cliente

| Arquivo | Onde roda | Chave |
|---|---|---|
| `src/lib/supabase/client.ts` | navegador | `anon` — segura de expor porque a RLS filtra por linha |
| `src/lib/supabase/server.ts` | servidor. Começa com `import 'server-only'`: se alguém importar num Client Component, o build QUEBRA em vez de vazar cookie | `anon` + cookie de sessão |
| `src/middleware.ts` | toda requisição | renova a sessão com `supabase.auth.getUser()` |

**`SUPABASE_SERVICE_ROLE_KEY` ignora toda a RLS.** Nunca em arquivo com `'use client'`, nunca em variável
`NEXT_PUBLIC_*`, nunca em componente. Só em Route Handler ou Edge Function.

## Regra de dado clínico

Campo sem fonte legível é `null` — no banco, no tipo e na tela. Nenhum `coalesce` inventa valor clínico.
`confidence < 0.7` liga `requires_review` pelo gatilho `fn_autoflag_lowconf`, e o motor de alertas ignora
o registro de propósito: alerta em cima de dado não conferido é pior que alerta nenhum.
