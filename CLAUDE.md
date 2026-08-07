# SASI v3 — CLAUDE.md do repo

Dashboard de UTI (33 leitos). Rebuild do SASI — menos bagunça, mais código.
Operador: médico intensivista, dev iniciante — termo de dev leva tradução de 1 linha.

## Doutrina (inegociável)

1. **ZERO ALUCINAÇÃO.** Dado clínico sem fonte legível = `null`. Nunca estimar lab, vital, dose ou ID.
2. **Regra clínica só existe em `src/lib/clinical/`** — função pura, testada, fonte citada no cabeçalho (DOI/PMID; ex.: SOFA → Singer 2016, JAMA). Componente React exibe, não calcula.
3. **RLS sempre ON.** Tabela nova nasce com 4 policies separadas (SELECT/INSERT/UPDATE/DELETE), nunca `FOR ALL`. Função PG: `set search_path to 'public','extensions','pg_catalog'`.
4. **`_material/` é só leitura e está fora do git** — contém PHI real em `**/amostras/`. Nunca copiar amostra pra `src/` ou `tests/`.
5. Migration: `supabase/migrations/YYYYMMDDHHmmss_desc.sql`, SQL lowercase, comando destrutivo comentado.

## Comandos

```bash
pnpm dev          # Vite não: é Next 16 + Turbopack, porta 3000
pnpm check        # typecheck + lint + testes — obrigatório antes de commit
pnpm build        # prova final antes de considerar entrega pronta
pnpm gen:types    # regenera src/types/supabase.ts do banco (após migration)
```

Node 24 via nvm (`.nvmrc`). Gerenciador: pnpm.

## Mapa

| Pasta | Papel |
|---|---|
| `src/app/` | rotas (App Router): `/` war-room, `beds/`, `patients/`, `rounds/` |
| `src/features/` | 1 domínio clínico por pasta (sepsis, sofa, devices…), com components/hooks/services próprios |
| `src/lib/clinical/` | TODA regra clínica — pura, testada |
| `src/lib/supabase/` | `client.ts` (navegador) · `server.ts` (server-only) · sessão renova no `src/middleware.ts` |
| `src/types/` | `clinical.ts` (manual) · `supabase.ts` (GERADO — não editar) |
| `src/styles/globals.css` | tema INTEIRO (Tailwind 4 CSS-first, `@theme`): tokens de gravidade, 7 sistemas, temas Clinical/Tactical |
| `supabase/migrations/` | schema v3: 13 tabelas, 14 enums, 7 views, RLS |
| `docs/AUDITORIA-E-PLANO.md` | o que migra do v2, fases F0–F6, faxina pendente |

## Convenções

- Import interno com alias `@/`. Tipo importa `import type { X }` (verbatimModuleSyntax).
- `any` é erro de lint. `console.log` é erro (só `warn`/`error`).
- Estado de servidor = TanStack Query · estado de UI = Zustand. Não misturar.
- Número clínico renderiza com `data-clinical-number` (mono tabular).
- shadcn/ui: `pnpm dlx shadcn@latest add <comp>` → `src/components/ui/` (gerado, não lintado).
- Sinais vitais sempre Máx–Mín · leito = `UTI#-L##` · granularidade de tempo = plantão (`ts::date`).

## Armadilhas de versão (medidas em 07-ago-2026 — não "atualizar" sem checar)

- **ESLint fica em 9.x**: `eslint-plugin-react` (dep do eslint-config-next) não roda no ESLint 10.
- **TypeScript fica em 6.x**: `typescript-eslint` exige `<6.1`; TS 7 quebra o lint. `baseUrl` não existe mais.
- **Tailwind 4 não tem `tailwind.config.ts`** — tema em `globals.css`.
- **Next 16**: Turbopack é padrão (sem flag `--turbopack`); opção `eslint` saiu do `next.config.ts`.

## Estado

F0 concluída (esqueleto + schema como migration + lógica base com 11 testes).
Próxima: F1 — aplicar migration no projeto Supabase `fpemjplgtyhztowwemfz` + `pnpm gen:types` + login.
