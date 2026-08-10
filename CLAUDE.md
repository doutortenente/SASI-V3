# SASI v3

Painel de plantão de UTI. Next.js 16 · React 19 · TypeScript 6 · Tailwind 4 · Supabase.
Substitui o v2, hoje em produção em `sasi-uti.vercel.app`.

Quem usa: **um** médico intensivista, sozinho, em plantão noturno. Iniciante em programação,
dislexia — todo termo de dev leva tradução de 1 linha na primeira vez que aparece.

## Os dois números que mais confundem

| | |
|---|---|
| O serviço tem | **34 leitos** — UTI 2 com 13, UTI 3 com 13, UTI 4 com 8 |
| Ele assume por plantão | **6 a 12 pacientes**, nunca a unidade inteira |

Toda contagem de tela e de passagem é do **plantão dele**, não do serviço. Tela que desenha os
34 leitos e pinta de "vago" o que não está no banco está mentindo: aquele leito não está vago,
está fora do sistema dele.

## Vetado — não propor de novo

| O quê | Situação |
|---|---|
| **SBAR** e formato de passagem importado de fora | vetado pelo operador |
| **Login e RLS de produção** | riscado — uso solo, "só eu uso essa merda de aplicativo" |
| **OCR dentro do app** | riscado — a extração continua fora, por skill |
| **FHIR** | riscado |
| **`tailwind.config.ts`** | não existe no Tailwind 4 — o tema mora em `globals.css` |

A `dev_bypass` fica ligada **de propósito**. Não reportar como falha, não propor remover.

## Comandos

```bash
pnpm dev        # Next 16 + Turbopack, porta 3000
pnpm check      # typecheck + lint + teste — antes de todo commit
pnpm build      # antes de considerar entrega pronta
pnpm gen:types  # regenera src/types/supabase.ts (só depois de aplicar migration)
```

Node 24 (`.nvmrc`). Gerenciador **pnpm** — o v2 usa npm, não confundir os dois repos.

## Onde mora o quê

| Pasta | Papel |
|---|---|
| `src/app/` | rotas (App Router): `/` war-room, `beds/`, `patients/`, `rounds/`, `api/` |
| `src/features/<dominio>/` | um domínio por pasta: `components/`, `hooks/`, `services/`, `types.ts` |
| `src/components/clinical/` · `core/` | peças de UI portadas do design system do v2 |
| `src/components/ui/` | gerado pelo shadcn (`pnpm dlx shadcn@latest add <comp>`) — fora do lint |
| `src/lib/clinical/` | cálculo clínico: função pura, com teste, fonte no cabeçalho |
| `src/lib/supabase/` | `client.ts` (navegador) · `server.ts` · `realtime.ts` (ao vivo) |
| `src/lib/formatters/` | texto clínico. Casa única — não redeclarar em componente |
| `src/stores/` | estado de UI (Zustand). Dado vindo do banco NÃO mora aqui |
| `src/types/` | `clinical.ts` (à mão) · `supabase.ts` (gerado — não editar) |
| `src/styles/globals.css` | o tema inteiro — Tailwind 4 é CSS-first |
| `supabase/migrations/` | migrations. **Não** é retrato do banco vivo |
| `tests/` | `unit/` (Vitest) · `e2e/` (Playwright) |

## Regras que não se negociam

- **Dado clínico ausente é `null`, nunca estimado.** Não inferir lab, sinal vital, dose ou ID
  que não esteja na fonte. É segurança do paciente, não estilo.
- A tela mostra travessão para dado ausente. **Nunca zero** — zero é um valor.
- Cálculo clínico só em `src/lib/clinical/`, função pura, com teste. Componente exibe, não calcula.
- Constante clínica sem fonte (DOI/PMID/diretriz) no comentário **não entra**.
- **Seta de subida/descida é proibida em texto clínico.** A direção vai em palavra: "lactato em
  queda". Vale para código, comentário, doc e texto gerado pelo app.
- Falha de leitura do banco **lança exceção**, nunca vira lista vazia. "Nenhum alerta" e "não
  consegui perguntar" são clinicamente opostos.
- Sinal vital sempre Máx–Mín · leito no formato `UTI#-L##` · granularidade de tempo é o plantão.
- Estado de servidor = TanStack Query · estado de UI = Zustand. Não misturar.
- `any` e `console.log` são erro de lint. Import interno por `@/`. Tipo por `import type`.

## Variáveis de ambiente

O código lê `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (formato novo
de chave — medido em 08-ago-2026, 3 usos). A `ANON_KEY` legada existe no `.env.local` mas o app
não a lê. Modelo completo com as 12 chaves: `.env.example`.

## Antes de criar arquivo, procure se ele já existe

`_material/` (fora do git) tem o v1/v2 inteiro. Já foi reescrito do zero, por ninguém conferir:
card de leito, tokens de cor, lógica de triagem e tipos do domínio. Índice em
`docs/INVENTARIO-MATERIAL.md`.

`_material/` e `**/amostras/` têm **dado real de paciente** e estão no `.gitignore` (o repo é
público). Não copiar de lá para `src/` nem para `tests/` — fixture de teste é sintética.

## O banco vivo vai à frente do repo

Projeto `idswehsvvqczzkiatuzu`, em produção desde 30-jul com pacientes reais.
**Antes de chamar qualquer coisa de defeito, consulte o banco.** Medido em 08-ago-2026:

|                             |                                                     |
| --------------------------- | --------------------------------------------------- |
| 13 tabelas · 8 views · 16   | policies de dono dormentes removidas na faxina      |
| policies15 pacientes · 16   | de 08-ago                                           |
| evoluções                   |                                                     |
| `sofa_total`                | **0 de 16** — falta bilirrubina e PaO2/FiO2 a       |
|                             | montante, não                                       |
| preenchido                  | é falha de código                                   |
| `alert_rules`               | 25 regras ativas (já foi reportada como "vazia", e  |
|                             | não era)                                            |

## Armadilhas de versão (medidas em 07-ago-2026 — não "atualizar" sem checar)

- **ESLint fica em 9.x** — `eslint-plugin-react` não roda no 10.
- **TypeScript fica em 6.0.x** — `typescript-eslint` exige `<6.1`. `baseUrl` não existe mais.
- **Tailwind 4 não tem arquivo de config** — árvore de pasta que pede um é de Tailwind 3.
- **Next 16** — Turbopack é padrão, e a opção `eslint` saiu do `next.config.ts`.
