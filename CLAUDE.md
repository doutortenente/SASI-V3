# SASI v3

Dashboard de UTI (33 leitos). Next.js 16 + TypeScript 6 + Tailwind 4 + Supabase.
Operador: médico, dev iniciante — termo de dev leva tradução de 1 linha.

## Comandos

```bash
pnpm dev          # Next 16 + Turbopack, porta 3000
pnpm check        # typecheck + lint + testes — antes de commit
pnpm build        # antes de considerar entrega pronta
pnpm gen:types    # regenera src/types/supabase.ts do banco (após migration)
```

Node 24 via nvm (`.nvmrc`). Gerenciador: pnpm.

## Mapa

| Pasta | Papel |
|---|---|
| `src/app/` | rotas (App Router): `/` war-room, `beds/`, `patients/`, `rounds/` |
| `src/features/` | 1 domínio clínico por pasta (sepsis, sofa, devices…), com components/hooks/services próprios |
| `src/lib/clinical/` | cálculo clínico — função pura, com teste, fonte no cabeçalho (DOI/PMID) |
| `src/lib/supabase/` | `client.ts` (navegador) · `server.ts` (server-only) · sessão renova no `src/middleware.ts` |
| `src/types/` | `clinical.ts` (manual) · `supabase.ts` (gerado — não editar) |
| `src/styles/globals.css` | tema inteiro (Tailwind 4 CSS-first, `@theme`) |
| `supabase/migrations/` | schema v3: 13 tabelas, 14 enums, 7 views, RLS |
| `docs/AUDITORIA-E-PLANO.md` | o que migra do v2, fases F0–F6 |

## Regras técnicas

- Dado clínico ausente = `null`, nunca valor estimado.
- Cálculo clínico só em `src/lib/clinical/`; componente exibe, não calcula.
- Tabela nova: RLS ligada, 4 policies separadas (não `FOR ALL`). Migration `YYYYMMDDHHmmss_desc.sql`, SQL lowercase.
- `_material/` está fora do git (tem dado real de paciente em `**/amostras/`) — não copiar de lá pra `src/` ou `tests/`.
- Import interno com alias `@/`; tipo importa `import type { X }`.
- `any` e `console.log` são erro de lint (passam só `warn`/`error`).
- Estado de servidor = TanStack Query · estado de UI = Zustand.
- shadcn/ui: `pnpm dlx shadcn@latest add <comp>` → `src/components/ui/` (gerado, não lintado).
- Sinais vitais Máx–Mín · leito = `UTI#-L##` · granularidade de tempo = plantão (`ts::date`).

## Armadilhas de versão (medidas em 07-ago-2026 — não "atualizar" sem checar)

- **ESLint fica em 9.x**: `eslint-plugin-react` (dep do eslint-config-next) não roda no ESLint 10.
- **TypeScript fica em 6.x**: `typescript-eslint` exige `<6.1`; TS 7 quebra o lint. `baseUrl` não existe mais.
- **Tailwind 4 não tem `tailwind.config.ts`** — tema em `globals.css`.
- **Next 16**: Turbopack é padrão (sem flag); opção `eslint` saiu do `next.config.ts`.

## Estado

F0 concluída (esqueleto + schema como migration + lógica base com 11 testes).
Próxima: F1 — aplicar migration no projeto Supabase `fpemjplgtyhztowwemfz` + `pnpm gen:types` + login.
