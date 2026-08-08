# SASI v3

Dashboard de UTI, 33 leitos (UTI2 12 · UTI3 13 · UTI4 8). Next.js 16 + TypeScript 6 + Tailwind 4 + Supabase.
Substitui o SASI v2, que está em produção em `sasi-uti.vercel.app`.
Operador: médico intensivista, iniciante em programação, dislexia — todo termo de dev leva tradução de 1 linha.

## Antes de escrever qualquer arquivo, procure se ele já existe

Este projeto tem 1,9 GB de material anterior em `_material/dados-sasi-para-analise/` (fora do git). **YOU MUST**
consultar `docs/INVENTARIO-MATERIAL.md` antes de criar componente, tipo, regra clínica, cálculo ou migration.
Já foi reescrito do zero, por não conferir: card de leito, tokens de cor, lógica de triagem e tipos do domínio.

Regra prática: se a peça é clínica ou visual, **presuma que ela já existe** e prove o contrário antes de digitar.

## Comandos

```bash
pnpm dev          # Next 16 + Turbopack, porta 3000
pnpm check        # typecheck + lint + testes — rodar antes de todo commit
pnpm build        # antes de considerar uma entrega pronta
pnpm gen:types    # regenera src/types/supabase.ts a partir do banco (só após aplicar migration)
```

Node 24 via nvm (`.nvmrc`). Gerenciador: **pnpm** (o v2 usa npm — não confundir os dois repos).

## Escopo fechado — não reabrir

O operador riscou do roadmap, em `plano-sasi-V3.2` (linhas 42-56 e 297-314):

| Fase | O quê | Situação |
|---|---|---|
| F3 | login e RLS de produção | **riscada** — não propor tela de login nem fluxo de autenticação |
| F4 | OCR dentro do app | **riscada** — a extração continua fora, por skill |
| F5 | FHIR | **riscada** — o mapa FHIR fica arquivado em `PLANO-SASI-v3.md §5` |

Proposta de reabrir fase riscada é retrabalho: a decisão já foi tomada e está registrada.

## Mapa

| Pasta | Papel |
|---|---|
| `src/app/` | rotas (App Router): `/` war-room, `beds/`, `patients/`, `rounds/`, `api/` |
| `src/features/<dominio>/` | 1 domínio clínico por pasta, com `components/`, `hooks/`, `services/`, `types.ts` |
| `src/lib/clinical/` | cálculo clínico — função pura, com teste, fonte no cabeçalho (DOI/PMID) |
| `src/lib/supabase/` | `client.ts` (navegador) · `server.ts` (server-only) · `realtime.ts` (ao vivo) |
| `src/stores/` | estado de UI (Zustand). Estado vindo do banco NÃO mora aqui |
| `src/types/` | `clinical.ts` (à mão, dono dos contratos JSONB) · `supabase.ts` (gerado) · `index.ts` (porta) |
| `src/styles/globals.css` | o tema inteiro (Tailwind 4 é CSS-first, via `@theme`) |
| `supabase/migrations/` | schema v3: 13 tabelas, 14 enums, 7 views, 41 policies |
| `docs/` | `INVENTARIO-MATERIAL.md` (o que já existe) · `AUDITORIA-E-PLANO.md` (fases) |

## Regras técnicas

- **IMPORTANT: dado clínico ausente é `null`, nunca valor estimado.** Não inferir lab, sinal vital, dose ou ID
  que não esteja na fonte. Isto é regra de segurança do paciente, não preferência de estilo.
- Cálculo clínico só em `src/lib/clinical/`, como função pura com teste. Componente exibe, não calcula.
- Toda constante clínica (cutoff, limiar, faixa) carrega a fonte no comentário. Sem fonte, não entra.
- Import interno pelo alias `@/`. Tipo importa com `import type`.
- `any` e `console.log` são erro de lint.
- Estado de servidor = TanStack Query · estado de UI = Zustand. Não misturar.
- shadcn/ui: `pnpm dlx shadcn@latest add <comp>` → `src/components/ui/` (gerado, fora do lint).
- Sinais vitais sempre Máx–Mín · leito no formato `UTI#-L##` · granularidade de tempo = o plantão (`ts::date`).
- **Seta ↑ ↓ é proibida em texto clínico.** A direção vai em palavra: "lactato em queda",
  "creatinina subindo", "PAM estável". Vale para código, comentário, doc e qualquer texto gerado pelo app.
- `_material/` e `**/amostras/` têm dado real de paciente e estão fora do git. Não copiar de lá para `src/`
  nem para `tests/` — fixture de teste é sintética.

## Armadilhas de versão (medidas em 07-ago-2026 — não "atualizar" sem checar)

- **ESLint fica em 9.x**: `eslint-plugin-react` (dependência do `eslint-config-next`) não roda no ESLint 10.
- **TypeScript fica em 6.x**: `typescript-eslint` exige `<6.1`. `baseUrl` não existe mais no `tsconfig`.
- **Tailwind 4 não tem `tailwind.config.ts`** — o tema vive em `globals.css`. Árvore de pasta que pede esse
  arquivo é de Tailwind 3.
- **Next 16**: Turbopack é padrão (sem flag) e a opção `eslint` saiu do `next.config.ts`.

## Estado

F0 concluída: esqueleto, schema como migration e lógica clínica base com 11 testes passando.

Aberto, com a peça já existente no material (ver `docs/INVENTARIO-MATERIAL.md`):

1. `vw_sofa_diario` está só como comentário na migration (linha 752) — o motor de SOFA/dia não foi escrito.
2. `alert_rules` e `trend_rules` nascem vazias: **nenhum alerta dispara**. As 25 regras com DOI existem no material.
3. `evolucoes` carrega os dois modelos de conduta ao mesmo tempo (`text[]` e jsonb) — duplicação herdada do v2.
