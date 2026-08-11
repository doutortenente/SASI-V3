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

| O quê | Situação |
|---|---|
| **Login e RLS de produção** | **riscado** — não propor tela de login nem fluxo de autenticação |
| **OCR dentro do app** | **riscado** — a extração continua fora, por skill |
| **FHIR** | **riscado** — o mapa FHIR fica arquivado em `PLANO-SASI-v3.md §5` |

**Motivo do login estar riscado, nas palavras do operador (08-ago-2026): "só eu uso essa merda de aplicativo".**
Um usuário, uso solo. A `dev_bypass` fica ativa **de propósito**, e as policies de dono ficam dormentes.
Segurança multiusuário aqui é teatro — não reportar como defeito, não propor remover a `dev_bypass`.

⚠️ **Cuidado com o número da fase.** Dois documentos numeram diferente e se contradizem: aqui o login era "F3,
riscada", e `docs/AUDITORIA-E-PLANO.md:81` (mais recente) lista login dentro da **F1**, como fase ativa. Uma
sessão já travou o trabalho do operador três vezes citando a numeração errada. **Vale a decisão acima, não o
número.** Na dúvida, pergunte — não bloqueie.

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
| `supabase/migrations/` | só migration **realmente aplicada** no banco vivo, mesmo carimbo do banco (o schema do zero vive em `supabase/schema-referencia/`) |
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

### YOU MUST: a migration não é o sistema

`supabase/migrations/20260807000000_schema_inicial_v3.sql` descreve um banco **do zero**. O banco **vivo**
(`idswehsvvqczzkiatuzu`) está em produção desde 30-jul, com pacientes reais, e vai à frente do arquivo.

**Antes de chamar qualquer coisa de defeito, consulte o banco.** Já foram reportadas como buraco, e nenhuma era:
`vw_sofa_diario` "não escrita" (existe, 6.660 caracteres, omitida da migration de propósito), `alert_rules` e
`trend_rules` "vazias" (25 e 3 regras ativas), `evento_tipo_ref` "sem doutrina" (56 códigos, 37 com faixa
fisiológica, 5 com LOINC). Detalhe em `.claude/rules/supabase.md`.

### F0 concluída (08-ago-2026)

Esqueleto, lógica clínica base com 11 testes, e o modelo de dados aplicado no banco vivo: 16 colunas viraram
enum nativo, `save_ficha` na versão de produção, extensões fora do `public`. Critério de aceite provado nos dois
pontos — tipos gerados batendo com o schema, e `save_ficha` gravando (evolução, pendência, enums e array,
testado com paciente sintético e revertido). `pnpm check` verde e `pnpm build` compilando.

### Faxina do banco (08-ago-2026) — avisos de desempenho: 204 → 22

Duas migrations aplicadas no banco vivo, com volta atrás escrita em
`supabase/rollback/20260808_restaura_policies_de_dono.sql` (fora de `migrations/` de propósito — aquela pasta é
executada pelo `pnpm db:push`, e um script de volta atrás lá dentro recriaria o que acabou de sair):

- **12 policies de dono removidas** das 9 tabelas que têm `dev_bypass` (`20260808121730`). Estavam dormentes de
  fato, não por suposição: os 15 pacientes têm `user_id` null (15 de 15), então `auth.uid() = user_id` nunca era
  verdadeiro. Policy permissiva é aditiva (OR); com `dev_bypass` (`using true`) do outro lado, remover não muda
  o acesso. Resultado medido: `multiple_permissive_policies` 180 → **0**, acesso idêntico (9 leitos no painel,
  15 pacientes, 16 evoluções, 335 eventos, 55 pendências antes e depois).
  **Preservados:** as 4 policies de `memorias` (não tem `dev_bypass` — apagar trancaria a tabela),
  `evento_tipo_ref_read`, as 11 `dev_bypass` e a RLS ligada nas 13 tabelas.
- **Índice duplicado removido** (`20260808121654`): `idx_eventos_user` era idêntico a
  `idx_eventos_clinicos_user_id` — mesma tabela, mesma coluna, mesmo btree.

Os 22 avisos restantes são todos INFO e ficam de propósito: 20 são "índice nunca usado" (o app ainda não
existe para usá-los — apagar seria remover a estrada porque não passou carro) e 2 são "FK sem índice" em
tabelas de 25 e 3 linhas, onde o planejador varre tudo e ignora índice.

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

### Aberto

1. `evolucoes` tem as duas gavetas de conduta no schema (`text[]` e jsonb), mas **só uma está em uso**:
   7 evoluções usam `conduta` (`text[]`) e **zero** usam `condutas_sistemas` (jsonb). Medido em 08-ago.
   A duplicação é de molde, não de dado — o custo de unificar é menor do que a nota antiga sugeria.
2. **SOFA não é calculado em nenhuma evolução: 0 de 16 têm `sofa_total`.** O bloqueio é de dado a montante
   (bilirrubina e PaO2/FiO2 nunca capturadas), não de código. A tela mostra "—" e nunca inventa.
3. Motor de SOFA/Sepsis-3 em TypeScript e as regras de tendência — a peça existe no material
   (ver `docs/INVENTARIO-MATERIAL.md` §1).
4. 19 eventos na fila `vw_eventos_pendentes_revisao` (confiança abaixo de 0,7) aguardando revisão humana.
5. `repo_index.categorias` é uma view SECURITY DEFINER (único ERRO do advisor de segurança). Vem do script de
   índice do workspace, não do schema clínico — resolver no script que a cria, não aqui.
