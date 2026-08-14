# Mapa banco ↔ telas

Medido em 11-ago-2026 no projeto `idswehsvvqczzkiatuzu` (lado do banco). Coluna "Estado" reconferida
em 13-ago-2026, import por import, após a entrega do bloco 3 (a tela de Fechamento). Documento de leitura:
diz **o que o banco já entrega pronto** e **o que cada uma das 3 telas ainda não liga**. Não propõe
código nem ordem de trabalho.

## O número que resume tudo

O banco publica **27 objetos** no schema `public` — 17 tabelas e 10 views. O app fala com **15**
(era 9 antes do bloco 3, e 5 antes do bloco 2), mais a função `save_ficha`, que não entra na conta
dos 27 por ser rotina e não objeto de dado.

| Objeto                   | Quem fala com ele hoje                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vw_dashboard_uti`       | `src/features/beds/services/leitos.ts`                                                                                                                                                                     |
| `vw_alertas_abertos`     | `src/features/alerts/services/alertas.ts`                                                                                                                                                                  |
| `alerts_log`             | `src/features/alerts/services/alertas.ts` (reconhecer alerta — só UPDATE)                                                                                                                                  |
| `pendencias`             | `src/features/pendencias/services/pendencias.ts` (ler, criar, concluir, reabrir)                                                                                                                           |
| `vw_dispositivos_ativos` | `src/features/devices/services/dispositivos.ts` (só leitura)                                                                                                                                               |
| `evento_tipo_ref`        | `src/features/captura/services/vocabulario.ts` (só leitura, sem `loinc_code`)                                                                                                                              |
| `eventos_clinicos`       | `src/features/captura/services/eventos.ts` (só INSERT, `fonte='manual'` explícita)                                                                                                                         |
| `janelas_24h`            | `src/features/captura/services/janelas.ts` (upsert `paciente_id,tipo,janela_fim`)                                                                                                                          |
| `vw_janelas_24h_render`  | `src/features/captura/services/janelas.ts` (só leitura — `render` pronto do banco)                                                                                                                         |
| `evolucoes`              | **bloco 3** — `fechamento/services/insumos.ts` (`lerEvolucaoCorrente`), `fechamento/services/pacientes.ts` (`lerResumoDasNotas`) e `fechamento/services/ficha.ts` (`complementarEvolucao`, UPDATE parcial) |
| `pacientes`              | **bloco 3** — `fechamento/services/pacientes.ts` (`lerPacientesParaFicha`: `hd`, `alergias`, `idade`, `peso`, `altura`, `patient_summary`)                                                                 |
| `atbs`                   | **bloco 3** — `fechamento/services/insumos.ts` (`lerAtbsDoPaciente`, histórico completo da evolução). Tabela ainda em 0 linhas                                                                             |
| `vw_dias_atb_ativo`      | **bloco 3** — `fechamento/services/insumos.ts` (`lerAtbsAtivosDoPaciente`, o D-X da passagem)                                                                                                              |
| `vw_bh_acumulado`        | **bloco 3** — `fechamento/services/insumos.ts` (`lerBhAcumulado`)                                                                                                                                          |
| `vw_sofa_diario`         | **bloco 3** — `fechamento/services/insumos.ts` (`lerSofaDiarioMaisRecente`, com `componentes_presentes`/`faltantes`)                                                                                       |
| `save_ficha` (RPC)       | **bloco 3** — `fechamento/services/ficha.ts` (`salvarFicha`, gravação em bloco)                                                                                                                            |

Os outros 12 estão de pé, com RLS ligada, e ninguém pergunta nada a eles. Do P0 de 10-ago,
`internacoes` e `dispositivo_episodios` seguem nesse grupo; `janelas_24h` e `vw_janelas_24h_render`
saíram dele no bloco 2, como `vw_dispositivos_ativos` saiu no bloco 1, e as 6 fontes do Fechamento
saíram no bloco 3.

## Tela 1 — Meu plantão

| Precisa de                                            | Fonte no banco                                     | Estado                                                                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leito, nome, idade, HD, gravidade, dias de internação | `vw_dashboard_uti`                                 | ✅ **ligado** — 9 linhas hoje                                                                                                                                          |
| SOFA e variação de 24h                                | `vw_dashboard_uti.sofa_total`, `delta_sofa_24h`    | ✅ ligado                                                                                                                                                              |
| Pendências abertas (contagem)                         | `vw_dashboard_uti.pendencias_abertas`              | ✅ ligado                                                                                                                                                              |
| Pendências (a lista, não a contagem)                  | `pendencias` — 55 linhas                           | ✅ **ligado no bloco 1** — `usePendencias` no painel, concluir a um toque no card (`useConcluirPendencia`)                                                             |
| Alertas abertos por leito                             | `vw_alertas_abertos` — 5 abertos                   | ✅ **ligado no bloco 1** — badge de contagem no card (`useAlertas`) e lista + reconhecer no card expandido (`useAlertasDoPaciente`)                                    |
| Dispositivos com dias de uso                          | `vw_dispositivos_ativos` (`dias_em_uso` calculado) | ✅ **ligado no bloco 1** (`useDispositivos`) — mas a tabela-fonte `dispositivo_episodios` segue **vazia**: a tela mostra estado vazio honesto até a ingestão alimentar |
| "O que mudou" desde a última nota                     | `vw_eventos_tendencia`, `vw_sofa_trend_72h`        | ❌ nenhum código lê — o card mostra só `delta_sofa_24h` (que vem de `vw_dashboard_uti`)                                                                                |

**A armadilha aqui:** `vw_dashboard_uti.dispositivos` continua existindo e o card já o mostra, mas desde
10-ago esse campo é **derivado** por `fn_refresh_dispositivos` a partir de `dispositivo_episodios` — que
tem **0 linhas**. Enquanto ninguém alimentar a tabela nova, o campo velho reflete o que sobrou de antes.
Dias de uso só saem de `vw_dispositivos_ativos`; nunca digitados.

## Tela 2 — Captura

| Precisa de                                              | Fonte no banco                                                                           | Estado                                                                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gravar vital, evento, conduta                           | `eventos_clinicos` — 335 linhas                                                          | ✅ **ligado no bloco 2** — `registrarEvento` (`useRegistrarEvento` no `FormEvento`), `ts` da coleta vindo do formulário e `fonte='manual'` explícita               |
| Vocabulário de tipos de evento (o que pode ser gravado) | `evento_tipo_ref` — 79 códigos, leitura liberada para `anon`                             | ✅ **ligado no bloco 2** — `lerTiposDeEvento` carregado no servidor da rota `/captura/[pacienteId]`                                                                |
| Gravar pendência                                        | `pendencias`                                                                             | ✅ **ligado no bloco 2** — `FormPendencia` chama `criarPendencia` via `useCriarPendencia` (o serviço já existia desde o bloco 1)                                   |
| Máx–Mín de 24h com excursões                            | `janelas_24h` → render pronto em `vw_janelas_24h_render.render` ("PAM 90-56 (4/12 <65)") | ✅ **ligado no bloco 2** — `registrarJanela` (upsert `paciente_id,tipo,janela_fim`) e leitura da view no `FormVital`; a tabela nasceu vazia e enche conforme o uso |
| Abrir/fechar dispositivo                                | `dispositivo_episodios` (janela + `motivo_fim`)                                          | ❌ **tabela vazia** — nenhum código escreve                                                                                                                        |
| Gravação em bloco de uma ficha                          | RPC `save_ficha`                                                                         | ❌ nunca chamada pelo app                                                                                                                                          |

**Decisão de 10-ago que restringe esta tela:** excursão de vital só se ingere como **agregado**
(`janelas_24h`), nunca aferição bruta. E os dispositivos não ganham tela de edição manual — a chavinha
foi vetada; o que existe é abrir e fechar episódio.

Desde o bloco 2 o app escreve em `eventos_clinicos`, `janelas_24h` e `pendencias`; em
`dispositivo_episodios` só a skill `sasi-ingest-export` escreveria, fora do app (e nada foi
ingerido até 13-ago).

## Tela 3 — Fechamento

| Precisa de                                                 | Fonte no banco                                                                      | Estado                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A nota, com os dois relógios                               | `evolucoes.data_plantao` + `turno` (derivados por `fn_evolucao_relogios` no INSERT) | ✅ **ligado no bloco 3** — lê em `lerEvolucaoCorrente`/`lerResumoDasNotas`, escreve em `complementarEvolucao`; os relógios saem de `derivarRelogiosDaNota` (noturna antes das 07h cai no dia anterior)                                                                                             |
| Autor e assinatura                                         | `evolucoes.autor_crm`, `autor_nome`, `finalizada_em`                                | ⚠️ **meio ligado** — `finalizada_em` é carimbado ao finalizar a nota e a tela não reoferece "Finalizar" para nota já fechada. `autor_crm`/`autor_nome` são **lidos e nunca escritos**: o app não tem autenticação, e sem `autor_nome` a linha "Assinatura:" é omitida do texto em vez de inventada |
| Gravidade da nota (não a do paciente)                      | `evolucoes.illness_severity`                                                        | ✅ **ligado no bloco 3** — 4 valores, desmarcável, enviado no complemento; fica `null` enquanto o médico não classificar (classificar por omissão seria inventar julgamento)                                                                                                                       |
| ATB: histórico completo na evolução, só ativos na passagem | `atbs` + `vw_dias_atb_ativo`                                                        | ✅ **ligado no bloco 3** (`lerAtbsDoPaciente` e `lerAtbsAtivosDoPaciente`) — mas **`atbs` segue em 0 linhas**: a seção nasce vazia até a ingestão. `vw_dias_atb_ativo` não expõe `dose`, então a passagem mostra droga/via/frequência/dias                                                         |
| Balanço hídrico acumulado                                  | `vw_bh_acumulado`                                                                   | ✅ **ligado no bloco 3** (`lerBhAcumulado`)                                                                                                                                                                                                                                                        |
| SOFA com transparência (X/6 componentes)                   | `vw_sofa_diario` (`componentes_presentes`/`faltantes`)                              | ✅ **ligado no bloco 3** (`lerSofaDiarioMaisRecente`) — total `null` quando incompleto, e a frase "componentes capturados: X/6 · faltando: [...]" sai igual na tela e no texto                                                                                                                     |
| Ficha inteira gravada numa transação                       | RPC `save_ficha`                                                                    | ✅ **ligado no bloco 3** (`salvarFicha`) — `hd`, `alergias`, `idade`, `peso` e `altura` são SEMPRE reenviados (gravam sem coalesce: payload sem a chave APAGA o valor). `internacao_id` nunca é enviado; `p_pendencias` vai sempre vazio, porque pendência tem casa única nos hooks                |
| Máx–Mín de 24h no texto da nota                            | `vw_janelas_24h_render.render`                                                      | ✅ **ligado desde o bloco 2**, agora consumido também pelo motor de texto — a linha vem PRONTA do banco e remontá-la é proibido. Com `janelas_24h` em 0 linhas, essas linhas saem omitidas                                                                                                         |
| Episódio de internação, reinternação, destino de alta      | `internacoes` (15 linhas, 9 em curso) + `fn_internacao_atual()`                     | ❌ nenhum código lê — o trigger carimba `internacao_id` sozinho, e o app depende disso                                                                                                                                                                                                             |
| Geração do texto                                           | montagem determinística em `src/lib/formatters/fechamento.ts`                       | ✅ **entregue no bloco 3** — `montarEvolucao` (TEMPLATE-BASE v2) e `montarPassagem` (Formato A). `src/lib/ai/` **continua não existindo** e nenhuma biblioteca de IA entrou no `package.json`: aritmética e contagem não são de LLM                                                                |

## Tabelas vazias — e o que isso significa

| Tabela                                  | Linhas | Por quê                                           |
| --------------------------------------- | -----: | ------------------------------------------------- |
| `dispositivo_episodios` · `janelas_24h` |      0 | Nasceram em 10-ago; nada foi ingerido desde então |
| `atbs` · `culturas` · `antibiograma`    |      0 | Nunca alimentadas, nem pelo app nem pela skill    |
| `memorias`                              |      0 | Busca vetorial, sem consumidor                    |

Tabela vazia **não é defeito de código**. É insumo que não chegou. Ligar tela em cima de qualquer uma
delas devolve tela em branco até a ingestão começar.

## O que já está pronto e ninguém aproveita

Vale a pena saber que existem, antes de alguém reescrever:

- `fn_internacao_atual(paciente_id)` — o episódio em curso, sem repetir o filtro `desfecho is null`.
- `vw_sofa_trend_72h` e `vw_eventos_tendencia` — o "o que mudou" que nenhuma tela lê ainda.
- O motor de alertas: 25 regras ativas, 2 gatilhos `after insert on eventos_clinicos`. O app **lê e
  reconhece**; nunca escreve em `alerts_log` — segundo produtor duplicaria alerta.

Saíram desta lista no bloco 3, porque agora têm consumidor: `save_ficha`, `vw_sofa_diario`,
`vw_bh_acumulado` e `vw_dias_atb_ativo`. `vw_janelas_24h_render.render` (a linha de vitais montada
**no banco**) e `vw_dispositivos_ativos.dias_em_uso` (contado a partir de `data_inicio`, nunca
digitado) já haviam saído nos blocos 2 e 1 — e o motor de texto do Fechamento consome os dois
prontos, sem recalcular.

## Regra que atravessa as 3 telas

Falha de leitura **lança exceção**, nunca vira lista vazia — `exigirDado` em `src/lib/data/erros.ts`,
usado nos 8 serviços que leem (`leitos`, `alertas`, `pendencias`, `dispositivos`, `vocabulario`,
`janelas` e, desde o bloco 3, `fechamento/insumos` e `fechamento/pacientes`). "Nenhuma pendência" e
"não consegui perguntar ao banco" são clinicamente opostos.

No Fechamento isso vale em bloco: as 8 fontes da rota do paciente sobem em `Promise.all` e falha em
UMA derruba o conjunto, de propósito. Meia ficha carregada é pior que ficha nenhuma — parece
completa.
