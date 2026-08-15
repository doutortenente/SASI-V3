# SASI v3 — War Room de UTI

> Rebuild do SASI — menos bagunça, mais código.

Sistema de Apoio à Situação Intensiva. Painel de plantão para os 6–12 pacientes de UM médico
por turno — nunca a UTI de 34 leitos inteira: evolução por sistemas, SOFA/Sepsis-3, stewardship
de antimicrobiano e passagem de plantão.

**Doutrina inegociável: ZERO ALUCINAÇÃO.** Campo sem fonte legível é `null` — o
sistema nunca estima lab, sinal vital, dose ou identificador.

## Stack

| Camada          | Ferramenta                           | Versão     |
| --------------- | ------------------------------------ | ---------- |
| Framework       | Next.js (App Router, Webpack)        | 16.3       |
| UI              | React + Tailwind CSS 4               | 19.2 / 4.3 |
| Linguagem       | TypeScript (strict)                  | 6.0        |
| Banco           | Supabase (Postgres + RLS + Realtime) | —          |
| Estado servidor | TanStack Query                       | 5          |
| Estado UI       | Zustand                              | 5          |
| Testes          | Vitest (unit)                        | 4          |

## Rodar

```bash
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

`supabase/migrations/` — 28 arquivos, retrato fiel do banco vivo (17 tabelas, 10 views, RLS em
tudo). Depois de aplicar migration: `pnpm gen:types` regenera `src/types/supabase.ts`.
