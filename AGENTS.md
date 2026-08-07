# SASI v3 — regras para agentes de código

## Doutrina

1. **ZERO ALUCINAÇÃO.** Dado clínico sem fonte = `null`. Nunca estimar lab, vital, dose ou ID.
2. **Regra clínica mora em `src/lib/clinical/`** — pura, testada, com fonte citada (DOI/PMID no cabeçalho). Componente React exibe, não calcula.
3. **RLS sempre ON.** Toda tabela nova nasce com 4 policies separadas (SELECT/INSERT/UPDATE/DELETE). Migration em `supabase/migrations/YYYYMMDDHHmmss_desc.sql`, SQL lowercase.
4. **`_material/` é só leitura** e está fora do git (contém PHI real em amostras). Nunca copiar amostra de paciente pra dentro de `src/` ou `tests/`.

## Fluxo obrigatório

```bash
pnpm check   # typecheck + lint + testes — TEM que passar antes de qualquer commit
pnpm build   # antes de considerar entrega pronta
```

## Convenções

- Import interno via alias `@/` (ex.: `import { cn } from '@/lib/utils'`).
- Tipo importa com `import type { X }` (verbatimModuleSyntax exige).
- `any` é erro de lint. Número clínico renderiza com `data-clinical-number` (fonte mono tabular).
- Estado de servidor = TanStack Query; estado de UI = Zustand. Não misturar.
- `src/types/supabase.ts` é GERADO (`pnpm gen:types`) — nunca editar na mão. `src/types/clinical.ts` é manual.
- shadcn/ui: `pnpm dlx shadcn@latest add <componente>` → cai em `src/components/ui/` (não lintado, não editar na mão sem motivo).

## Armadilhas conhecidas (aprendidas na criação do repo, 07-ago-2026)

- ESLint fica em **9.x**: `eslint-plugin-react` (dependência do eslint-config-next) não suporta ESLint 10.
- TypeScript fica em **6.x**: `typescript-eslint` exige `<6.1`; TS 7 quebra o lint. `baseUrl` foi removido (deprecated no TS 6).
- Tailwind 4 **não tem** `tailwind.config.ts` — tema inteiro em `src/styles/globals.css` (`@theme`).
- Next 16: Turbopack é padrão (sem flag), opção `eslint` não existe mais no `next.config.ts`.
