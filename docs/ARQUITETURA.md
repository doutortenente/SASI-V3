# Arquitetura do SASI V4 — as 3 telas

Desenhado em 11-ago-2026 sobre reconhecimento medido de 4 fontes: a skill `sasi-ingest-export` (a
especificação viva dos formatos), o inventário do v2, o `src/` atual e o contrato do banco
(`src/types/supabase.ts` + migrations). Aprovado pelo operador em 11-ago-2026.

**Missão (do `CLAUDE.md`): matar o papel.** A dor é escrever a evolução e passar o plantão duas
vezes — rabiscado à beira do leito, transcrito no fim do turno. Tudo abaixo serve a isso; o que
não serve, espera.

## As decisões e o porquê

| # | Decisão | Porquê |
| --- | --- | --- |
| 1 | O formato da nota **não é do app** — é o TEMPLATE-BASE v2 da skill `sasi-ingest-export` (`references/04-export-evolucao-template.md`), renderizado por formatter puro e testado contra o esqueleto | O template é declarado imutável e idêntico ao da `admissao-uti`; divergência é "bug clínico-legal". O app é o terceiro renderizador, nunca um formato rival |
| 2 | Fechamento **com edição por sistemas** (a ficha do v2 renascida), gravando via RPC `save_ficha` | Sem edição, correção vira papel de novo. `save_ficha` existe exatamente porque o v2 fazia 3 escritas soltas e falha no meio deixava estado parcial |
| 3 | `evolucoes` ganha `intercorrencias text[]` por migration nova | A seção "Intercorrências 24h" do template não tinha coluna — só existia na prosa da skill. Sem casa no banco, o campo digitado se perdia |
| 4 | Montagem do texto 100% **determinística**; `src/lib/ai/` segue reservada e vazia | Aritmética e contagem nunca são de LLM (doutrina da skill). IA entra depois, como rascunho revisável — e é outra entrega |
| 5 | Passagem = Formato A da skill por paciente, **só os pacientes do plantão** | O Formato B desenha a unidade inteira (33 leitos) e o rótulo "SBAR" — os dois contrariam vetos do operador. Porta-se a mecânica (pior valor 24h, pendências como fonte única, plano de resgate), não o rótulo |
| 6 | Captura grava só: janela de vital, evento com valor, pendência | "Vital, evento, conduta, pendência" é o escopo do `CLAUDE.md`. Dispositivo e ATB seguem pela skill de ingestão; aferição bruta não se ingere (decisão 10-ago) |
| 7 | Entrega em 3 blocos, 1 PR cada, preview da Vercel por bloco | Erro de rumo custa um bloco, não o projeto |
| 8 | `conduta text[]` é o modelo de conduta; `condutas_sistemas` fica morto e documentado | Medido: 7 evoluções usam o primeiro, 0 usam o segundo. Escolher o que tem uso real |

## Rotas

| Rota | Tela | Renderização |
| --- | --- | --- |
| `/` | Meu plantão | Server Component, `force-dynamic` (padrão do War Room atual) |
| `/captura` | seleção de paciente | Server Component |
| `/captura/[pacienteId]` | captura | Client (mutations TanStack) |
| `/fechamento` | seleção + atalho da passagem | Server Component |
| `/fechamento/[pacienteId]` | ficha por sistemas + preview + copiar | Client sobre carga server |
| `/fechamento/passagem` | passagem do plantão inteira | Server Component + botão copiar |

Navegação: barra fixa no rodapé no celular, discreta no desktop; 3 destinos. Botão de tema no
cabeçalho destrava o Tactical (o store existia e ninguém chamava `sincronizarTema`).

## Contrato por tela (o banco vai à frente do app)

Regra que atravessa tudo: **`internacao_id` nunca é enviado** (trigger carimba); falha de leitura
lança via `exigirDado`; dado ausente é `null` no banco e travessão na tela, nunca zero.

### Tela 1 — Meu plantão

| Ação | Objeto |
| --- | --- |
| Lê | `vw_dashboard_uti` (já ligado), `vw_alertas_abertos`, `pendencias`, `vw_dispositivos_ativos` (dias de uso derivados — nunca digitados) |
| Escreve | `alerts_log` só UPDATE de ack (produtor é trigger — **nunca** INSERT); `pendencias` UPDATE de conclusão |

ΔSOFA em palavra (`SofaBadge` já faz). Contagem é do plantão; leito não assumido não é "vago".

### Tela 2 — Captura

| Ação | Objeto | Contrato |
| --- | --- | --- |
| Lê | `evento_tipo_ref` | 79 códigos, read-only, faixas fisiológicas → **aviso amarelo, nunca corrige** ("corrigir SpO2 145% para 95% é iatrogenia computacional") |
| Escreve | `janelas_24h` | upsert `onConflict: paciente_id,tipo,janela_fim`; `valor_max >= valor_min` (constraint); `n_fora_*` só com o limiar junto (constraint); n_total real, nunca chutado |
| Escreve | `eventos_clinicos` | obrigatórios `paciente_id, tipo, ts, fonte='manual'` — `fonte` **não tem default** aqui; `ts` é a hora da COLETA, editável, nunca `now()` calado |
| Escreve | `pendencias` | `tarefa` + `prioridade` 1/2/3 (1 = tempo-sensível) |

Campo vazio não envia — jamais vira 0. `confidence < 0.7` liga `requires_review` sozinho e o motor
de alertas ignora o registro, por desenho.

### Tela 3 — Fechamento

| Ação | Objeto |
| --- | --- |
| Lê | `evolucoes` (nota corrente), `vw_janelas_24h_render.render` (linha pronta — remontar é proibido), `atbs` completo (evolução) vs `vw_dias_atb_ativo` (passagem), `vw_bh_acumulado`, `vw_sofa_diario`, `vw_dispositivos_ativos`, `pendencias`, alertas abertos |
| Escreve | `save_ficha` (bloco transacional) + UPDATE complementar em `evolucoes`: `tipo_nota`, `autor_crm/autor_nome`, `illness_severity`, `sofa_total`/`sofa_snapshot` (via `calcularSofa`, transparência X/6), `finalizada_em` ao fechar |

**Armadilha documentada de `save_ficha`**: `hd` e `alergias` gravam **sem** coalesce — payload sem
essas chaves APAGA o valor. O serviço do app sempre reenvia os dois. E `save_ficha` só fala o
`plantao` legado; `data_plantao`/`turno` o app manda explícitos (noturna iniciada antes das 07h cai
no dia anterior — regra de `fn_evolucao_relogios`, que só roda no INSERT).

## Regras de texto (da skill, valem para todo texto que o app gera)

- Sinal vital `MÁX–MÍN` sempre, SpO2 incluso. Min > max na fonte → inverte + `(revisar)`.
- Setas `↑ ↓ =` proibidas; tendência em palavra. Única sobrevivente: `->` entre valores da mesma
  variável em série (`Cr 1,7 -> 2,0`).
- Ausente tem 4 formas conforme o contexto, sem misturar: JSON → `null`; bloco de vitais → `?`;
  evolução → sistema inteiro "não avaliado" ou linha omitida; tela → travessão.
- Impressão numerada, conduta 1:1 com a impressão, meta numérica, profilaxias na última linha.
- SOFA sempre com `componentes capturados: X/6 · faltando: [...]` — transparência > escore falso.
- Acentuação completa; CAPS só em rótulo de seção; zero frase de preenchimento — linha de conduta
  sem fonte **não existe**.
- Vírgula decimal na saída; `parseNumeroBR` na entrada.

## Mapa de reuso (não reescrever)

| Peça | Onde | Uso |
| --- | --- | --- |
| `BedCard`, `GradeDeLeitos` | `features/beds/components` | Tela 1 evolui o card (`PropsBedCard` já previa `alertasAbertos`) |
| Serviço de alertas + `useAlertas` | `features/alerts` | Tela 1 liga; ack já implementado com `.eq('acked', false)` |
| `calcularSofa` + componentes | `lib/clinical/sofa.ts` | Fechamento; neuro suprimido sob sedação, cardio exige peso |
| `rotuloInfusao` (`InfusaoOuTexto`) | `lib/formatters/clinico.ts` | dvas/sedativos do banco vivo são TEXTO puro — filtrar só objeto descarta 100% das drogas (defeito já ocorrido 2×) |
| `exigirDado` | `lib/data/erros.ts` | todo serviço novo |
| `assinarTabela` | `lib/supabase/realtime.ts` | invalidação de query ao vivo |
| stores Zustand (3, órfãos) | `src/stores` | filtros da grade, tema, war room |
| `UTIS`/`TOTAL_LEITOS` | `lib/constants/leitos.ts` | fonte única de capacidade (UTI2=13) |

## Consertos que entram no bloco 1 (defeitos reais, medidos)

1. `types/clinical.ts` + `lib/clinical/sasi.ts` chaveiam o enum **velho** de gravidade
   (`grave`/`moderado`/`obito`); o banco pós-P0 devolve `watcher`/`instavel`, que caem no default e
   pintam paciente instável de **verde**. Mapa novo: `estavel→green`, `watcher→yellow`,
   `instavel→red`, `critico→red`; óbito sai da gravidade (vive em `status_leito`).
2. `LEITOS_POR_UTI` em `clinico.ts` diz UTI2=12; o operador mediu 13 — paciente real em UTI2-L13
   marcado "fora da numeração". Passa a derivar de `constants/leitos.ts` (casa única).

## Blocos de entrega

| Bloco | Conteúdo | Portão | Estado |
| --- | --- | --- | --- |
| 1 | fundação (provider, nav, tema) + consertos acima + Meu plantão enriquecido | `pnpm check` + `build` + preview Vercel | ✅ **entregue** 12-ago-2026 (PR #9) |
| 2 | Captura completa | idem + teste das validações puras | ✅ **entregue** 12-ago-2026 (PR #12) |
| 3 | migration `intercorrencias` + Fechamento (ficha, template, passagem) + fumaça e2e das 3 rotas | idem + e2e | ✅ **entregue** 13-ago-2026 (migration commitada; o código do Fechamento aguarda PR) |

### O que foi medido no fechamento do bloco 3 (13-ago-2026)

| Portão | Resultado |
| --- | --- |
| `pnpm typecheck` | sem erro |
| `pnpm lint` | sem erro |
| `pnpm test` | 303 testes em 18 arquivos, todos passando |
| `pnpm build` | fecha; as 6 rotas listadas como dinâmicas |
| `pnpm test:e2e` | 7 testes, todos passando — as 4 rotas de servidor respondem **200 contra o banco vivo** |

A fumaça (`tests/e2e/fumaca.spec.ts`) prova que a rota responde, o título chega e a navegação das 3
telas está desenhada. Ela **não clica em Salvar**, de propósito: o app aponta para produção com
paciente real, e escrita por robô sujaria prontuário.

Preview da Vercel: **não conferido nesta sessão** — o portão cumprido aqui é local (`check` +
`build` + `e2e`).

O que o bloco 3 deixou de fora, e é dívida declarada e não defeito: `internacoes`/
`fn_internacao_atual` seguem sem leitor (o trigger carimba `internacao_id` sozinho); `autor_crm`/
`autor_nome` não são editáveis porque não há autenticação, e sem `autor_nome` a linha "Assinatura:"
é **omitida** em vez de inventada; `src/lib/ai/` continua não existindo, conforme a decisão 4.

## Débitos conhecidos (registrados, não desta entrega)

- `br.ts` duplica `num`/`unidadeSegura` de `clinico.ts` com comportamento diferente — consolidar.
- `realtime.ts` tem `@ts-expect-error` com comentário morto.
- ~~`middleware.ts` usa o nome aposentado pelo Next 16 (`proxy`)~~ — resolvido em 12-ago-2026: o
  arquivo foi **removido** (derrubava o site com 500). Conferido em 13-ago: não existe
  `middleware.ts` nem `proxy.ts` no repo.
- Tabelas em 0 linhas (`dispositivo_episodios`, `janelas_24h`, `atbs`, `culturas`, `antibiograma`):
  tela ligada nelas nasce em branco até a ingestão alimentar — não é defeito de código.
