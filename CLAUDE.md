# SASI V4

Painel de plantão de UTI. Next.js 16 · React 19 · TypeScript 6 · Tailwind 4 · Supabase.

Quem usa: **um** médico intensivista, sozinho, em plantão noturno. Iniciante em programação,
dislexia — todo termo de dev leva tradução de 1 linha na primeira vez que aparece.

Desenho completo, com o porquê de cada decisão: **`~/projetos/_material/docs/ARQUITETURA.md`**.
Leia antes de propor estrutura nova. **A pasta `docs/` saiu do repositório em 14-ago-2026** — os 5
arquivos do manual humano moraram aqui até então e agora vivem fora, junto do material do v1/v2.

## As regras em detalhe — `.claude/rules/`

Este arquivo é a constituição curta. O **como** de cada assunto mora numa regra própria, que carrega
sozinha quando é preciso. Elas são autossuficientes de propósito: nada aqui depende de outro
repositório estar aberto ou anexado.

| Regra                      | Vale quando                                                               |
| -------------------------- | ------------------------------------------------------------------------- |
| `communication.md`         | em toda resposta — tradução de jargão, formato, `[SEM_FONTE]`, escopo     |
| `repository-navigation.md` | ao procurar qualquer coisa aqui — buscar pelo índice da IDE, não varrer   |
| `git-workflow.md`          | ao terminar em mudança de arquivo — ramo, commit, push, PR, merge         |
| `security-and-secrets.md`  | ao tocar chave, `.env`, credencial ou dado de paciente                    |
| `supabase.md`              | ao abrir arquivo de banco (`supabase/**`, `*.sql`, `src/lib/supabase/**`) |

Um gatilho automático acompanha: `.claude/hooks/prefer-ide-tools.sh` empurra a busca para o MCP da
IDE em vez de `grep`, e barra troca em massa com `sed -i`. Ele avisa **uma vez por sessão e por
classe** — repetir a mesma chamada passa. Desligar: `IDE_HOOK=off`.

## O arsenal — `.claude/` e `EXTRACAO-CLINICA-SASI/`

Medido em 14-ago-2026: **108 KB em 14 arquivos** — 6 subagentes, 5 regras, 1 gatilho, 2 arquivos de
configuração. **Zero skill.** Chegou a ter 2,8 MB em 237 arquivos e foi cortado no mesmo dia; o porquê
está na seção seguinte, e não se desfaz.

**Leia `EXTRACAO-CLINICA-SASI/BRIEFING.md` antes de tocar em qualquer folha, lab ou prescrição.** É a
lei do formato: as 3 leis mais quebradas, a ordem fixa das 8 seções por leito, os limiares de flag e
o checklist final.

| Pasta             | O que tem                                                             |
| ----------------- | --------------------------------------------------------------------- |
| `.claude/agents/` | 6 subagentes, só a definição — nada mais, para não sujar a descoberta |
| `.claude/rules/`  | 5 regras, carregadas por `paths:` quando o assunto aparece            |
| `.claude/hooks/`  | 1 gatilho, `prefer-ide-tools.sh`                                      |

### Por que não existe `.claude/skills/` aqui — e não deve passar a existir

Skill tem **três casas**, e a do meio não depende de repositório nenhum:

| Casa    | Caminho                  | Carrega quando                |
| ------- | ------------------------ | ----------------------------- |
| Projeto | `<repo>/.claude/skills/` | só dentro deste repo          |
| Usuário | **`~/.claude/skills/`**  | **toda sessão, todo projeto** |
| Plugin  | `~/.claude/plugins/…`    | quando o plugin está ativo    |

As **38 skills** do operador moram na casa do usuário, e `~/.claude/skills` é **pasta real** — não é
atalho para `~/projetos/claude`. Elas ligam sozinhas em qualquer projeto, inclusive neste, e
sobrevivem se aquela pasta sair do disco.

Copiar skill para cá foi tentado em 14-ago-2026: 20 skills, 2,7 MB. Conferido depois por `diff -r`,
**20 de 20 eram idênticas** à gêmea global — duplicata pura, com o custo de existir uma segunda
versão para esquecer de atualizar. Apagadas no mesmo dia. Se faltar skill, o conserto é na casa do
usuário; não é aqui.

**Subagente é o caso oposto, e é por isso que 6 deles ficam.** `~/.claude/agents` é **atalho** para
`~/projetos/claude/agents` — some com aquela pasta do disco e a frota morre junto. A frota tem
**18 agentes**, contados em 14-ago-2026 pelo critério "pasta com `<nome>/<nome>.md` e frontmatter
`name:`" — um `ls` cru devolve 22 porque soma `CHANGELOG.md`, `CONTRIBUTING.md`, `README.md` e
`docs/`, que não são agente. A conta fecha assim:

| Onde                      | Quantos | Quais                                                                                                        |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| Copiados para cá, 24 KB   | **6**   | `residente`, `fiscal`, `deploy-sentinel`, `clinical-data-auditor`, `code-explainer`, `batedor`               |
| Fora — função não é daqui | **7**   | `testador`, `refatorador`, `segurador`, `otimizador`, `documentador`, `onboarder`, `pubmed-evidence-checker` |
| Fora — cuidam da máquina  | **5**   | `chefe`, `caco`, `zelador`, `secretaria`, `arquiteto`                                                        |

Detalhe medido que separa skill de agente: **subagente aceita subpasta** (a casa global usa
`agents/<nome>/<nome>.md` e os 18 aparecem na lista), **skill não** — ela precisa de
`skills/<nome>/SKILL.md`, um nível só, e subpasta de pacote a esconde em vez de organizá-la.

### `EXTRACAO-CLINICA-SASI/` — a porta de entrada humana

O `BRIEFING.md` mais **8 atalhos**: um por skill clínica (`admissao-uti`, `analise-ecott`,
`controles-vitais-janela`, `hemodinamica-calculada`, `plantao`, `sasi-ingest-export`) e um para cada
script que o briefing chama pelo nome (`build_passagem.py`, `calc_hemo.py`).

Os 8 apontam para `~/.claude/skills/…`, a casa do usuário. **Atalho não liga skill nenhuma** — quem
liga é a casa do usuário; o atalho serve para você abrir a pasta e ler o arquivo sem procurar. Eles
**quebram quando uma skill clínica é movida ou renomeada** — quebraram três vezes em 14-ago. Depois
de mexer, confira que os 8 resolvem:

```bash
for l in EXTRACAO-CLINICA-SASI/*; do [ -L "$l" ] && { [ -e "$l" ] && echo "OK $l" || echo "MORTO $l"; }; done
```

O código não copia as regras clínicas — ele as **implementa**. `references/00-estilo-texto-clinico.md`,
`04-export-evolucao-template.md` e `05-export-passagem-turno.md` de `sasi-ingest-export` são a fonte
do que `src/lib/formatters/fechamento.ts` monta, e o teste dele cita esses arquivos por número.
Citação em comentário, não leitura em tempo de execução — medido: **nenhum arquivo de `src/` ou
`tests/` abre caminho de skill**. Mudar o template sem mudar o teste, ou o contrário, é divergência
silenciosa.

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

Node 24. Gerenciador **pnpm** — o v2 usa npm, não confundir os dois repos.

Medido em 15-ago-2026: `pnpm test` = **402 testes em 23 arquivos**, todos passando. `pnpm typecheck`,
`pnpm lint` e `pnpm build` fecham **sem erro**.

## Onde mora o quê

| Pasta                                | Papel                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `src/app/`                           | rotas (App Router). As 3 telas têm rota desde 13-ago — ver nota abaixo  |
| `src/features/<dominio>/`            | um domínio por pasta: `components/`, `hooks/`, `services/`, `types.ts`  |
| `src/components/clinical/` · `core/` | peças de UI portadas do design system do v2                             |
| `src/components/ui/`                 | gerado pelo shadcn (`pnpm dlx shadcn@latest add <comp>`) — fora do lint |
| `src/lib/clinical/`                  | cálculo clínico: função pura, com teste, fonte no cabeçalho             |
| `src/lib/supabase/`                  | `client.ts` (navegador) · `server.ts` · `realtime.ts` · `config.ts`     |
| `src/lib/formatters/`                | texto clínico. Casa única — não redeclarar em componente                |
| `src/lib/ai/`                        | casa reservada da geração de texto do Fechamento — **ainda não existe** |
| `src/stores/`                        | estado de UI (Zustand). Dado vindo do banco NÃO mora aqui               |
| `src/types/`                         | `clinical.ts` (à mão) · `supabase.ts` (gerado — não editar)             |
| `src/styles/globals.css`             | o tema inteiro — Tailwind 4 é CSS-first                                 |
| `supabase/migrations/`               | migrations. Desde 11-ago-2026 **é** retrato fiel do banco vivo          |
| `tests/`                             | `unit/` (Vitest)                                                        |
| `memory/`                            | índice de busca **gerado**, 31 MB, fora do git — ver nota abaixo        |

**Duas pastas que não são código e confundem quem abre o repo pela primeira vez:**

`memory/` **não é memória de projeto e não se edita à mão.** São dois arquivos gerados por
`~/projetos/scripts/indices/build_sasi_index.py`: `sasi_index.db` (SQLite, a fonte de verdade) e
`MAPA-SASI.md` (o inventário legível). Ficou no `.gitignore` em 14-ago-2026 — 31 MB de índice
derivado não versiona. Para regenerar, rode o script; não escreva nos dois arquivos.

`docs/` **não existe mais aqui.** Os 5 arquivos do manual humano — `ARQUITETURA.md`,
`AUDITORIA-E-PLANO.md`, `INVENTARIO-MATERIAL.md`, `MAPA-BANCO-TELAS.md` e `README.md` — foram
para `~/projetos/_material/docs/` em 14-ago-2026. Toda referência a `docs/<algo>` neste repositório
é resíduo: o arquivo está lá fora.

Recontado em 13-ago-2026, ao fim do bloco 3: `src/app/` tem **6 rotas** (6 `page.tsx`, mais
`layout.tsx` e `error.tsx` na raiz) — `/`, `/captura`, `/captura/[pacienteId]`, `/fechamento`,
`/fechamento/[pacienteId]` e `/fechamento/passagem`. As 3 telas do produto estão de pé, e o
`pnpm build` lista as 6 como dinâmicas (renderizadas a cada pedido, porque leem o banco). As pastas
`beds/`, `patients/`, `rounds/`, `war-room/` e `api/` continuam **vazias**: são nomes herdados do
V3, não trabalho começado — a Tela 1 mora na raiz, não em `beds/`.

Teste não mora todo em `tests/`: dos 23 arquivos de unidade, a maioria fica **ao lado do código** em
`src/` (`sofa.test.ts` junto de `sofa.ts`). O Vitest varre `tests/unit/**` e `src/**/*.test.ts(x)` —
teste de cálculo clínico vai junto do cálculo.

`supabase/migrations/` tem **28 arquivos** — 27 conferidos em 11-ago-2026 contra
`supabase_migrations.schema_migrations`, mais `20260813014857_evolucoes_intercorrencias.sql` do
bloco 3 (a coluna `evolucoes.intercorrencias text[] NOT NULL default '{}'`, que a seção
"Intercorrências 24h" do template exigia e não tinha casa no banco). São 12 de 26-jun a 30-jul
(recuperadas do banco em 11-ago, com md5 conferido uma a uma), 6 de 08-ago com prefixo `f0_` (a fase
que adotou enums, criou `save_ficha_producao` e tirou as extensões do schema `public`), 8 de 10-ago
(o P0 do modelo de dados — seção "P0" abaixo), 1 de 11-ago (conserto do `security_invoker`) e 1 de
13-ago. Nome no padrão `YYYYMMDDHHmmss_descricao.sql` — é o que `pnpm db:diff <nome>` gera.

**Migration aplicada não se edita, e todas as 28 já foram aplicadas.** Mudança nova é arquivo novo.

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

`~/projetos/_material/` tem o v1/v2 inteiro. Já foi reescrito do zero, por ninguém conferir:
card de leito, tokens de cor, lógica de triagem e tipos do domínio. Índice em
`~/projetos/_material/docs/INVENTARIO-MATERIAL.md`.

**Atenção ao caminho: `_material/` não está dentro deste repositório.** Ele é irmão dele, em
`~/projetos/`. Escrever `_material/...` como caminho relativo à raiz do repo aponta para o vazio.

`~/projetos/_material/` e `**/amostras/` têm **dado real de paciente**. O `_material/` está fora
do repo e o `amostras/` no `.gitignore` — este repositório é público. Não copiar de lá para `src/`
nem para `tests/` — fixture de teste é sintética.

## O banco vivo vai à frente do repo

Projeto `idswehsvvqczzkiatuzu`, em produção desde 30-jul com pacientes reais.
**Antes de chamar qualquer coisa de defeito, consulte o banco.** Medido em 09-ago-2026:

| Tabela             | Linhas |     | Tabela                                            | Linhas |
| ------------------ | ------ | --- | ------------------------------------------------- | ------ |
| `eventos_clinicos` | 335    |     | `ingest_audit_log`                                | 17     |
| `evento_tipo_ref`  | 79     |     | `evolucoes`                                       | 16     |
| `pendencias`       | 55     |     | `pacientes` · `internacoes`                       | 15     |
| `alert_rules`      | 25     |     | `alerts_log`                                      | 14     |
| `trend_rules`      | 3      |     | `atbs` · `culturas` · `antibiograma` · `memorias` | 0      |

Recontado em 11-ago-2026: **17 tabelas e 10 views**, RLS ligada em todas as tabelas.
`dispositivo_episodios` e `janelas_24h` também estão em **0** — nasceram no P0 de 10-ago e nada
foi ingerido nelas desde então. `alert_rules` tem 25 regras ativas — já foi reportada como
"vazia", e não era. `sofa_total` não preenchido é falta de bilirrubina e PaO2/FiO2 a montante,
não falha de código.

**O app fala com 15 desses 27 objetos** desde o bloco 3 (13-ago-2026) — eram 9 após o bloco 2 —,
mais a rotina `save_ficha`, que não entra na conta dos 27. O que cada uma das 3 telas ainda precisa ligar está
medido, objeto por objeto, em `~/projetos/_material/docs/MAPA-BANCO-TELAS.md`.

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

**Sequela do P0, consertada em 11-ago** (`20260811074819`): ao derrubar e recriar `vw_dashboard_uti`, o P0
perdeu o `security_invoker = true` que ela tinha desde 08-ago; as 2 views novas nasceram sem ele. Ficaram 3
views respondendo com a permissão de quem as criou, e não de quem pergunta — ERROR no advisor do Supabase.
Nada vazou (a `dev_bypass` já libera tudo), mas a trava voltou. `drop view` + `create view` **perde toda
opção da view**: quem recria repete o `with (...)`, ou usa `create or replace view`.

## Armadilhas de versão (medidas — não "atualizar" sem checar)

- **ESLint fica em 9.x** — `eslint-plugin-react` não roda no 10.
- **TypeScript fica em 6.0.x** — `typescript-eslint` exige `<6.1`. `baseUrl` não existe mais.
- **Tailwind 4 não tem arquivo de config** — árvore de pasta que pede um é de Tailwind 3.
- **Next 16** — a opção `eslint` saiu do `next.config.ts`; o nome `middleware` foi aposentado
  em favor de `proxy`.
- Os templates de referência em `~/projetos/_templates/` estão **uma geração atrás** (Tailwind 3,
  Next 15, React 18, TS 5). Deles vem a **forma**; as versões ficam nas que já sobem.
