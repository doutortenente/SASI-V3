# SASI v3 — War Room de UTI

> Rebuild do SASI — menos bagunça, mais código.

Sistema de Apoio à Situação Intensiva. Dashboard de plantão para UTI de 34 leitos:
grid de leitos por acuidade, evolução por sistemas, SOFA/Sepsis-3, stewardship de
antimicrobiano e passagem de plantão.

**Doutrina inegociável: ZERO ALUCINAÇÃO.** Campo sem fonte legível é `null` — o
sistema nunca estima lab, sinal vital, dose ou identificador.

## Stack

| Camada          | Ferramenta                           | Versão     |
| --------------- | ------------------------------------ | ---------- |
| Framework       | Next.js (App Router, Turbopack)      | 16.3       |
| UI              | React + Tailwind CSS 4 + shadcn/ui   | 19.2 / 4.3 |
| Linguagem       | TypeScript (strict)                  | 6.0        |
| Banco           | Supabase (Postgres + RLS + Realtime) | —          |
| Estado servidor | TanStack Query                       | 5          |
| Estado UI       | Zustand                              | 5          |
| Testes          | Vitest (unit) + Playwright (e2e)     | 4 / 1.62   |

## Rodar

```bash
nvm use            # Node 24 (.nvmrc)
pnpm install
cp .env.example .env.local   # e preencher
pnpm dev           # http://localhost:3000
```

## Qualidade (roda antes de todo commit)

```bash
pnpm check         # typecheck + lint + testes
pnpm build         # prova final
```

## Mapa do repositório

Cada pasta de nível superior tem um `README.md` de 1 linha dizendo o que mora nela.
Regra de ouro: **regra clínica só existe em `src/lib/clinical/`** — testada, com
fonte citada (ex.: SOFA → Singer 2016, JAMA). Componente exibe; não calcula.

## Banco

Schema v3 completo em `supabase/migrations/20260807000000_schema_inicial_v3.sql`
(13 tabelas, 14 enums, 7 views, RLS em tudo). Depois de aplicar:
`pnpm gen:types` regenera `src/types/supabase.ts`.
