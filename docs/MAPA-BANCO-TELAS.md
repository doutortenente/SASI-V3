# Mapa banco ↔ telas

Medido em 11-ago-2026 no projeto `idswehsvvqczzkiatuzu` (lado do banco). Coluna "Estado" reconferida
em 12-ago-2026, import por import, após a entrega do bloco 1. Documento de leitura: diz **o que o banco
já entrega pronto** e **o que cada uma das 3 telas ainda não liga**. Não propõe código nem ordem de trabalho.

## O número que resume tudo

O banco publica **27 objetos** no schema `public` — 17 tabelas e 10 views. O app fala com **5**
(era 3 antes do bloco 1).

| Objeto | Quem fala com ele hoje |
| --- | --- |
| `vw_dashboard_uti` | `src/features/beds/services/leitos.ts` |
| `vw_alertas_abertos` | `src/features/alerts/services/alertas.ts` |
| `alerts_log` | `src/features/alerts/services/alertas.ts` (reconhecer alerta — só UPDATE) |
| `pendencias` | `src/features/pendencias/services/pendencias.ts` (ler, criar, concluir, reabrir) |
| `vw_dispositivos_ativos` | `src/features/devices/services/dispositivos.ts` (só leitura) |

Os outros 22 estão de pé, com RLS ligada, e ninguém pergunta nada a eles. Do P0 de 10-ago,
`internacoes`, `janelas_24h` e `vw_janelas_24h_render` seguem nesse grupo; `vw_dispositivos_ativos`
saiu dele no bloco 1.

## Tela 1 — Meu plantão

| Precisa de | Fonte no banco | Estado |
| --- | --- | --- |
| Leito, nome, idade, HD, gravidade, dias de internação | `vw_dashboard_uti` | ✅ **ligado** — 9 linhas hoje |
| SOFA e variação de 24h | `vw_dashboard_uti.sofa_total`, `delta_sofa_24h` | ✅ ligado |
| Pendências abertas (contagem) | `vw_dashboard_uti.pendencias_abertas` | ✅ ligado |
| Pendências (a lista, não a contagem) | `pendencias` — 55 linhas | ✅ **ligado no bloco 1** — `usePendencias` no painel, concluir a um toque no card (`useConcluirPendencia`) |
| Alertas abertos por leito | `vw_alertas_abertos` — 5 abertos | ✅ **ligado no bloco 1** — badge de contagem no card (`useAlertas`) e lista + reconhecer no card expandido (`useAlertasDoPaciente`) |
| Dispositivos com dias de uso | `vw_dispositivos_ativos` (`dias_em_uso` calculado) | ✅ **ligado no bloco 1** (`useDispositivos`) — mas a tabela-fonte `dispositivo_episodios` segue **vazia**: a tela mostra estado vazio honesto até a ingestão alimentar |
| "O que mudou" desde a última nota | `vw_eventos_tendencia`, `vw_sofa_trend_72h` | ❌ nenhum código lê — o card mostra só `delta_sofa_24h` (que vem de `vw_dashboard_uti`) |

**A armadilha aqui:** `vw_dashboard_uti.dispositivos` continua existindo e o card já o mostra, mas desde
10-ago esse campo é **derivado** por `fn_refresh_dispositivos` a partir de `dispositivo_episodios` — que
tem **0 linhas**. Enquanto ninguém alimentar a tabela nova, o campo velho reflete o que sobrou de antes.
Dias de uso só saem de `vw_dispositivos_ativos`; nunca digitados.

## Tela 2 — Captura

| Precisa de | Fonte no banco | Estado |
| --- | --- | --- |
| Gravar vital, evento, conduta | `eventos_clinicos` — 335 linhas | ❌ nenhuma escrita pelo app |
| Vocabulário de tipos de evento (o que pode ser gravado) | `evento_tipo_ref` — 79 códigos, leitura liberada para `anon` | ❌ nenhum código lê |
| Gravar pendência | `pendencias` | ⚠️ o serviço `criarPendencia` nasceu no bloco 1; a tela de Captura (bloco 2) ainda não o chama |
| Máx–Mín de 24h com excursões | `janelas_24h` → render pronto em `vw_janelas_24h_render.render` ("PAM 90-56 (4/12 <65)") | ❌ **tabela vazia** |
| Abrir/fechar dispositivo | `dispositivo_episodios` (janela + `motivo_fim`) | ❌ **tabela vazia** |
| Gravação em bloco de uma ficha | RPC `save_ficha` | ❌ nunca chamada pelo app |

**Decisão de 10-ago que restringe esta tela:** excursão de vital só se ingere como **agregado**
(`janelas_24h`), nunca aferição bruta. E os dispositivos não ganham tela de edição manual — a chavinha
foi vetada; o que existe é abrir e fechar episódio.

Quem escreve nessas tabelas hoje é a skill `sasi-ingest-export`, fora do app.

## Tela 3 — Fechamento

| Precisa de | Fonte no banco | Estado |
| --- | --- | --- |
| A nota, com os dois relógios | `evolucoes.data_plantao` + `turno` (derivados por `fn_evolucao_relogios` no INSERT) | ❌ nenhum código lê nem escreve |
| Autor e assinatura | `evolucoes.autor_crm`, `autor_nome`, `finalizada_em` | ❌ |
| Gravidade da nota (não a do paciente) | `evolucoes.illness_severity` | ❌ |
| ATB: histórico completo na evolução, só ativos na passagem | `atbs` + `vw_dias_atb_ativo` | ❌ **`atbs` está vazia** |
| Balanço hídrico acumulado | `vw_bh_acumulado` | ❌ nenhum código lê |
| Episódio de internação, reinternação, destino de alta | `internacoes` (15 linhas, 9 em curso) + `fn_internacao_atual()` | ❌ nenhum código lê |
| Geração do texto | `src/lib/ai/` | ❌ **a pasta não existe**; nenhuma biblioteca de IA no `package.json` |

## Tabelas vazias — e o que isso significa

| Tabela | Linhas | Por quê |
| --- | ---: | --- |
| `dispositivo_episodios` · `janelas_24h` | 0 | Nasceram em 10-ago; nada foi ingerido desde então |
| `atbs` · `culturas` · `antibiograma` | 0 | Nunca alimentadas, nem pelo app nem pela skill |
| `memorias` | 0 | Busca vetorial, sem consumidor |

Tabela vazia **não é defeito de código**. É insumo que não chegou. Ligar tela em cima de qualquer uma
delas devolve tela em branco até a ingestão começar.

## O que já está pronto e ninguém aproveita

Vale a pena saber que existem, antes de alguém reescrever:

- `vw_janelas_24h_render.render` — a linha de texto da nota, montada **no banco**.
- `vw_dispositivos_ativos.dias_em_uso` — contado a partir de `data_inicio`, nunca digitado.
- `fn_internacao_atual(paciente_id)` — o episódio em curso, sem repetir o filtro `desfecho is null`.
- `save_ficha` — gravação de ficha inteira numa transação só.
- `vw_sofa_diario` (6.660 caracteres, os 6 sistemas) e `vw_sofa_trend_72h`.
- O motor de alertas: 25 regras ativas, 2 gatilhos `after insert on eventos_clinicos`. O app **lê e
  reconhece**; nunca escreve em `alerts_log` — segundo produtor duplicaria alerta.

## Regra que atravessa as 3 telas

Falha de leitura **lança exceção**, nunca vira lista vazia — `exigirDado` em `src/lib/data/erros.ts`,
usado nos 4 serviços (`leitos`, `alertas`, `pendencias`, `dispositivos`). "Nenhuma pendência" e "não
consegui perguntar ao banco" são clinicamente opostos.
