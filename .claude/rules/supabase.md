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

**Projeto: `idswehsvvqczzkiatuzu`** (São Paulo). É o único projeto Supabase da conta — conferido pela API em
08-ago-2026. O `fpemjplgtyhztowwemfz` que aparecia aqui e em `docs/AUDITORIA-E-PLANO.md:81` **não existe**.

## O ponto que mais confundiu sessões anteriores

`supabase/migrations/20260807000000_schema_inicial_v3.sql` (757 linhas) descreve um **banco novo, do zero**.
O seu banco **vivo** é outra coisa: está em produção desde 30-jul, com pacientes reais, e vai à frente do arquivo.

**Ler a migration e concluir "o sistema não tem X" é o erro clássico deste repo.** Antes de chamar qualquer coisa
de defeito, consulte o banco. As três coisas abaixo já foram reportadas como buraco e nenhuma era:

| Reportado como defeito | O que o banco vivo tem, medido em 08-ago |
|---|---|
| "`vw_sofa_diario` é só um comentário, o motor não foi escrito" | A view **existe**, com 6.660 caracteres e os 6 sistemas. A migration a omite **de propósito** — está escrito na linha 752: *"mantido conforme banco vivo"*. Existe também `vw_sofa_trend_72h`, que não consta em documento nenhum |
| "`alert_rules` e `trend_rules` nascem vazias, zero alerta dispara" | **25 e 3 regras**, ativas |
| "`evento_tipo_ref` não tem a doutrina" | **56 códigos**, 56 com unidade, 37 com faixa fisiológica, 5 com LOINC |

## Estado real do banco (08-ago-2026, depois da F0)

Aplicado do `11_migracao_do_vivo.sql`: Seção A (já vinha de 30-jul), **Seção B** (16 colunas texto → enum
nativo), **Seção D** (`save_ficha` de produção) e **Decisão 5** (`pg_trgm` e `vector` movidos para `extensions`).

**A Seção C não foi aplicada, por ordem do operador.** Ele usa o app sozinho e não quer login — a `dev_bypass`
fica ativa nas 11 tabelas, de propósito. Não propor removê-la, não propor tela de login.

Duas armadilhas descobertas ao aplicar a Seção B, que o anexo não previa:

- **Índice parcial com predicado sobre coluna convertida.** `uq_pacientes_leito_ativo` tem
  `where status_leito = 'ativo'::text`; ao virar enum, o Postgres reconstrói o índice e o predicado quebra.
  Derrubar e recriar **na mesma transação** — assim a trava de "um paciente por leito" nunca fica ausente.
- **`match_memorias` tinha `search_path` sem `extensions`.** Mover o tipo `vector` sem corrigir isso quebra o
  operador `<=>` dentro da função, em silêncio, só na hora da chamada.

### Os defeitos que continuam de pé

| # | Defeito | Onde |
|---|---|---|
| 1 | **`user_id` null cegaria o app** se a `dev_bypass` saísse. As 17 policies de dono já existem no banco e hoje estão **dormentes**: `auth.uid()` é null, `user_id` é null, e null = null dá null, não `true`. Medido: 15 pacientes no banco, **0 visíveis** só pela regra de dono. É também a origem dos 180 avisos de `multiple_permissive_policies` | policies vivas |
| 2 | **`evolucoes` carrega dois modelos de conduta ao mesmo tempo**: `impressao`/`conduta` como `text[]` e `problemas_ativos`/`condutas_sistemas` como jsonb. Duplicação herdada do v2, não resolvida | migration 203-206 |
| 3 | **8 tabelas usam `FOR ALL`** em vez das 4 policies separadas (`evolucoes`, `eventos_clinicos`, `pendencias`, `atbs`, `culturas`, `antibiograma`, `alerts_log`, `ingest_audit_log`). Contraria a regra abaixo — mas com um usuário só, não separa nada na prática. **Não é prioridade** | policies vivas |
| 4 | **`11_migracao_do_vivo.sql` vive só em `_material/`**, fora do repo. O cabeçalho da migration o cita como se estivesse aqui | migration 21 |

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
| `src/lib/supabase/client.ts` | navegador | publicável — segura de expor |
| `src/lib/supabase/server.ts` | servidor. Começa com `import 'server-only'`: se alguém importar num Client Component, o build QUEBRA em vez de vazar cookie | publicável + cookie de sessão |
| `src/middleware.ts` | toda requisição | renova a sessão com `supabase.auth.getUser()` |

**A variável é `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, não `..._ANON_KEY`.** O Supabase renomeou a chave; os
três arquivos liam o nome velho e recebiam vazio. Corrigido em 08-ago. Os dois clientes são tipados com
`<Database>`, de `@/types/supabase` — regenerar com `pnpm gen:types` depois de toda migration.

**`SUPABASE_SERVICE_ROLE_KEY` ignora toda a RLS.** Nunca em arquivo com `'use client'`, nunca em variável
`NEXT_PUBLIC_*`, nunca em componente. Só em Route Handler ou Edge Function.

## Regra de dado clínico

Campo sem fonte legível é `null` — no banco, no tipo e na tela. Nenhum `coalesce` inventa valor clínico.
`confidence < 0.7` liga `requires_review` pelo gatilho `fn_autoflag_lowconf`, e o motor de alertas ignora
o registro de propósito: alerta em cima de dado não conferido é pior que alerta nenhum.
