# SASI V4

Painel de plantão de UTI. Next.js 16 · React 19 · TypeScript 6 · Tailwind 4 · Supabase.

Quem usa: **um** médico intensivista, sozinho, em plantão noturno. Iniciante em programação,
dislexia — todo termo de dev leva tradução de 1 linha na primeira vez que aparece.

Desenho completo, com o porquê de cada decisão: **`docs/ARQUITETURA.md`**. Leia antes de propor
estrutura nova.

## Por que o V4 existe

A dor não é "ver os leitos". É **escrever a evolução e passar o plantão** — hoje feito duas
vezes: rabiscado no papel à beira do leito, transcrito no fim do turno.

**O V4 existe para matar o papel.** Funcionalidade que não serve a isso é acessória e espera.

| #   | Tela            | O que faz                                                          | Onde                      |
| --- | --------------- | ------------------------------------------------------------------ | ------------------------- |
| 1   | **Meu plantão** | Seus pacientes: leito, o que tem, o que mudou, o que está pendente | Tela grande e celular     |
| 2   | **Captura**     | Registra vital, evento, conduta, pendência. Poucos toques, uma mão | Celular, andando          |
| 3   | **Fechamento**  | Monta a evolução e a passagem, para revisar e copiar               | Tela grande, fim do turno |

## Os dois números que mais confundem

|                        |                                                         |
| ---------------------- | ------------------------------------------------------- |
| O serviço tem          | **34 leitos** — UTI 2 com 13, UTI 3 com 13, UTI 4 com 8 |
| Ele assume por plantão | **6 a 12 pacientes**, nunca a unidade inteira           |

Toda contagem de tela e de passagem é do **plantão dele**, não do serviço. Tela que desenha os
34 leitos e pinta de "vago" o que não está no banco está mentindo: aquele leito não está vago,
está fora do sistema dele.

## Vetado — não propor de novo

| O quê                                            | Situação                                                 |
| ------------------------------------------------ | -------------------------------------------------------- |
| **SBAR** e formato de passagem importado de fora | vetado pelo operador                                     |
| **Login e RLS de produção**                      | riscado — uso solo, "só eu uso essa merda de aplicativo" |
| **OCR dentro do app**                            | riscado — a extração continua fora, por skill            |
| **FHIR**                                         | riscado                                                  |
| **`tailwind.config.ts`**                         | não existe no Tailwind 4 — o tema mora em `globals.css`  |

A `dev_bypass` fica ligada **de propósito**. Não reportar como falha, não propor remover.

## Comandos

```bash
pnpm dev        # sobe o app em desenvolvimento, porta 3000
pnpm check      # checagem de tipo + de estilo + testes — antes de todo commit
pnpm build      # monta o app como vai para produção — antes de considerar entrega pronta
pnpm gen:types  # regenera src/types/supabase.ts (só depois de aplicar migration)
pnpm db:diff <nome>  # escreve nova migration a partir do que mudou no banco local
pnpm db:push         # aplica as migrations pendentes no banco
```

Node 24 (`.nvmrc`). Gerenciador **pnpm** — o v2 usa npm, não confundir os dois repos.

Medido em 11-ago-2026: `pnpm test` = **126 testes em 6 arquivos**, todos passando (número de
09-ago confirmado). `pnpm typecheck` **falha**: 5 erros, todos em
`src/components/clinical/SystemPanel.tsx` — arquivo novo, ainda não commitado. Enquanto ele não
fechar, `pnpm check` para aí. Não é regressão do que já estava no repo.

## Onde mora o quê

| Pasta                                | Papel                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `src/app/`                           | rotas (App Router). Só a raiz existe — ver nota abaixo                  |
| `src/features/<dominio>/`            | um domínio por pasta: `components/`, `hooks/`, `services/`, `types.ts`  |
| `src/components/clinical/` · `core/` | peças de UI portadas do design system do v2                             |
| `src/components/ui/`                 | gerado pelo shadcn (`pnpm dlx shadcn@latest add <comp>`) — fora do lint |
| `src/lib/clinical/`                  | cálculo clínico: função pura, com teste, fonte no cabeçalho             |
| `src/lib/supabase/`                  | `client.ts` (navegador) · `server.ts` · `realtime.ts` (ao vivo)         |
| `src/lib/formatters/`                | texto clínico. Casa única — não redeclarar em componente                |
| `src/lib/ai/`                        | casa reservada da geração de texto do Fechamento — **ainda não existe** |
| `src/stores/`                        | estado de UI (Zustand). Dado vindo do banco NÃO mora aqui               |
| `src/types/`                         | `clinical.ts` (à mão) · `supabase.ts` (gerado — não editar)             |
| `src/styles/globals.css`             | o tema inteiro — Tailwind 4 é CSS-first                                 |
| `supabase/migrations/`               | migrations. **Não** é retrato do banco vivo                             |
| `tests/`                             | `unit/` (Vitest) · `e2e/` (Playwright, pasta ainda vazia)               |

Medido em 11-ago-2026: `src/app/` tem só `page.tsx`, `layout.tsx` e `error.tsx` na raiz —
nenhuma das 3 telas tem rota ainda. As pastas `beds/`, `patients/`, `rounds/`, `war-room/` e
`api/` estão **vazias**: são nomes herdados do V3, não trabalho começado.

Teste não mora todo em `tests/`: dos 6 arquivos, 5 ficam **ao lado do código** em `src/`
(`sofa.test.ts` junto de `sofa.ts`). O Vitest varre `tests/unit/**` e `src/**/*.test.ts(x)` — os
dois valem, mas teste de cálculo clínico vai junto do cálculo.

`supabase/migrations/` tem 14 arquivos: 6 de 08-ago-2026 com prefixo `f0_` (a fase que adotou
enums, criou `save_ficha_producao` e tirou as extensões do schema `public`) e 8 de 10-ago-2026
(o P0 do modelo de dados — seção "P0" abaixo). Nome no padrão
`YYYYMMDDHHmmss_descricao.sql` — é o que `pnpm db:diff <nome>` gera.

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
- Texto gerado por IA é **rascunho revisável**. Nada vira registro definitivo sem o médico aprovar.
- Sinal vital sempre Máx–Mín · leito no formato `UTI#-L##` · granularidade de tempo é o plantão.
- Estado de servidor = TanStack Query · estado de UI = Zustand. Não misturar.
- `any` e `console.log` são erro de lint. Import interno por `@/`. Tipo por `import type`.

## Camada de IA — a fronteira (alvo, ainda não construído)

Medido em 11-ago-2026: **nenhuma** dessas bibliotecas está no `package.json` — nem LangChain,
nem LangGraph, nem AI SDK. A tabela abaixo é a divisão combinada para quando a camada nascer,
não o estado de hoje.

| Metade                  | Quem faz                                                    |
| ----------------------- | ----------------------------------------------------------- |
| Raciocínio, no servidor | LangChain / LangGraph                                       |
| Ponte                   | adaptador oficial do AI SDK                                 |
| Exibição, na tela       | AI SDK + AI Elements (`json-render` para a ficha revisável) |

Raciocínio não vai para o AI SDK; exibição não vai para o LangChain. Os dois fazendo a mesma
tarefa no mesmo arquivo é duplicação — o trabalho para e a fronteira é restabelecida.

## Variáveis de ambiente

O código lê `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (formato novo
de chave). A `ANON_KEY` legada existe no `.env.local` mas o app não a lê. Modelo completo:
`.env.example`.

**Este repositório é público.** O `.mcp.json` é versionado e não pode conter credencial — o
conector do banco sobe por `~/projetos/scripts/sasi/mcp_supabase_wrapper.sh`, que carrega o cofre
em tempo de execução. Duas chaves diferentes, confundidas com frequência:

| Chave                   | O que é                      | Serve para                                    |
| ----------------------- | ---------------------------- | --------------------------------------------- |
| `SUPABASE_SECRET_KEY`   | chave do **projeto**         | o app ler e gravar no banco                   |
| `SUPABASE_ACCESS_TOKEN` | token da **conta** (`sbp_…`) | o conector listar tabelas e aplicar migration |

Só a primeira está no `.env.example`. O `SUPABASE_ACCESS_TOKEN` não aparece lá de propósito: ele
mora no cofre `~/projetos/.env`, que o wrapper carrega na hora de subir o conector.

## Antes de criar arquivo, procure se ele já existe

`_material/` (fora do git) tem o v1/v2 inteiro. Já foi reescrito do zero, por ninguém conferir:
card de leito, tokens de cor, lógica de triagem e tipos do domínio. Índice em
`docs/INVENTARIO-MATERIAL.md`.

`_material/` e `**/amostras/` têm **dado real de paciente** e estão no `.gitignore` (o repo é
público). Não copiar de lá para `src/` nem para `tests/` — fixture de teste é sintética.

## O banco vivo vai à frente do repo

Projeto `idswehsvvqczzkiatuzu`, em produção desde 30-jul com pacientes reais.
**Antes de chamar qualquer coisa de defeito, consulte o banco.** Medido em 09-ago-2026:

| Tabela             | Linhas |     | Tabela                                            | Linhas |
| ------------------ | ------ | --- | ------------------------------------------------- | ------ |
| `eventos_clinicos` | 335    |     | `ingest_audit_log`                                | 17     |
| `evento_tipo_ref`  | 56     |     | `evolucoes`                                       | 16     |
| `pendencias`       | 55     |     | `pacientes`                                       | 15     |
| `alert_rules`      | 25     |     | `alerts_log`                                      | 14     |
| `trend_rules`      | 3      |     | `atbs` · `culturas` · `antibiograma` · `memorias` | 0      |

13 tabelas, RLS ligada em todas. `alert_rules` tem 25 regras ativas — já foi reportada como
"vazia", e não era. `sofa_total` não preenchido é falta de bilirrubina e PaO2/FiO2 a montante,
não falha de código.

### P0 do modelo de dados v3 (10-ago-2026) — aplicado no banco vivo, testado em réplica antes

Sete migrations de schema (carimbos `20260810083301..084920`) mais o canal `avisos_agentes`
(`20260810202518`). O SQL delas está em `supabase/migrations/`, recuperado do próprio banco com conferência
de hash — **não editar** (migration aplicada não se edita).

- **gravidade** virou `estavel | watcher | instavel | critico` (moderado passou a watcher, grave a instavel).
  Óbito saiu do enum: desfecho vive em `status_leito` e `internacoes.desfecho`. `vw_dashboard_uti` recriada e
  os 2 triggers de semáforo reescritos.
- **`internacoes`**: episódio de internação com reinternação encadeada (`internacao_prev_id`) e destino de
  alta. `internacao_id` é carimbado por trigger em `evolucoes`, `atbs`, `culturas`, `eventos_clinicos` e
  `pendencias`; paciente e episódio sincronizam sozinhos. `pacientes.data_adm` virou legado.
- **`dispositivo_episodios`**: janela de uso + `motivo_fim`. `pacientes.dispositivos` agora é **DERIVADO**
  (`fn_refresh_dispositivos`) — **proibido escrever à mão**. Dias de uso saem de `vw_dispositivos_ativos`.
- **`evolucoes` com dois relógios**: `tipo_nota`, `data_plantao`, `turno` (diurna|noturna; noturna iniciada
  antes das 07h cai no dia anterior), `autor_crm`/`autor_nome`, `illness_severity` por nota, `finalizada_em`.
  `fn_evolucao_relogios` deriva tudo no INSERT. `plantao` = legado.
- **`janelas_24h`**: max/min + excursões, único por paciente+tipo+janela_fim. Render pronto em
  `vw_janelas_24h_render` — "PAM 90-56 (4/12 <65)". Substitui os eventos `pam_min`/`pas_min`.
- **`evento_tipo_ref`: 56 → 79 códigos** (18 labs, o órfão `pas_min` corrigido e 5 de folha: `pvc`,
  `diurese_24h`, `diurese_parcial`, `uf_dialise`, `debito_dreno`). LOINC NULL nos novos (zero alucinação).
  `custom` zerou: 14 reclassificados, 1 em `requires_review` (diurese 0 numa folha preenchida só das 23h às
  05h não é anúria).
- **Decisões de produto de 10-ago**: excursão só como agregado (não se ingere aferição bruta); chavinhas de
  dispositivos sem UI de edição manual; seta de tendência banida também no schema (`problemas_ativos` não
  ganha vetor); histórico de ATB — a evolução carrega o completo, a passagem de plantão só os ativos.

## Armadilhas de versão (medidas — não "atualizar" sem checar)

- **ESLint fica em 9.x** — `eslint-plugin-react` não roda no 10.
- **TypeScript fica em 6.0.x** — `typescript-eslint` exige `<6.1`. `baseUrl` não existe mais.
- **Tailwind 4 não tem arquivo de config** — árvore de pasta que pede um é de Tailwind 3.
- **Next 16** — a opção `eslint` saiu do `next.config.ts`; o nome `middleware` foi aposentado
  em favor de `proxy`.
- Os templates de referência em `~/projetos/_templates/` estão **uma geração atrás** (Tailwind 3,
  Next 15, React 18, TS 5). Deles vem a **forma**; as versões ficam nas que já sobem.
