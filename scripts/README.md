# `scripts/` — utilitários locais DESTE repo

Aqui mora só script que é **do produto**: seed, geração, conversão pontual. Hoje a pasta tem apenas
este README — nada foi preciso ainda.

**Script de infra da máquina não mora aqui.** A casa única é `~/projetos/scripts/`, em 5 gavetas por
assunto, e nenhum repositório tem `scripts/` de infra próprio. Este arquivo existe para você não
precisar abrir aquele repo só para descobrir o que serve ao SASI.

## Os que servem a este repo

| Script                                            | O que faz                                                                           | Como chamar                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `~/projetos/scripts/indices/build_sasi_index.py`  | Varre a árvore inteira e materializa `memory/sasi_index.db` + `memory/MAPA-SASI.md` | `python3 ~/projetos/scripts/indices/build_sasi_index.py`            |
| `~/projetos/scripts/indices/query_sasi_index.py`  | Consulta rápida ao índice (categorias, arquivos maiores, contagem)                  | `python3 ~/projetos/scripts/indices/query_sasi_index.py categorias` |
| `~/projetos/scripts/sasi/audit_eventos.py`        | Auditoria de `eventos_clinicos`: fila `requires_review` e confiança baixa           | `python3 ~/projetos/scripts/sasi/audit_eventos.py`                  |
| `~/projetos/scripts/sasi/mcp_supabase_wrapper.sh` | Sobe o conector do banco carregando o cofre em tempo de execução                    | chamado pelo `.mcp.json`, **não na mão**                            |

Dois que **não** servem: `~/projetos/scripts/sasi/status.sh` é boletim de Docker, e o SASI não usa
Docker; `~/projetos/scripts/sasi/mcp_sasi_wrapper.sh` está **desativado** desde 11-ago-2026 (sai com
exit 1 — o `mcp-server/` que ele executava não existe em disco nenhum desde a troca do v2 pelo v3).

## Dois avisos medidos em 14-ago-2026

**1. O índice tem o caminho deste repo cravado no código.** `build_sasi_index.py` carrega a raiz numa
constante no topo do arquivo. A pasta já foi renomeada uma vez (`SASI-V3-SEM_MIGUE` → `SASI-V3`) e o
script teve de ser editado junto. **Renomear a pasta outra vez obriga passar lá**, senão ele indexa o
vazio em silêncio — sem erro, só com o mapa vazio. O cabeçalho do `query_sasi_index.py` ainda
documenta o uso antigo (`python3 scripts/query_sasi_index.py`), de quando havia `scripts/` dentro do
repo; o caminho válido é o da tabela acima.

**2. O `.mcp.json` deste repo não usa o wrapper, e a chave que ele passa está trocada.** O
`CLAUDE.md` diz que o conector do banco sobe pelo `mcp_supabase_wrapper.sh`; o `.mcp.json` na verdade
chama `npx @supabase/mcp-server-supabase` direto, com:

```json
"env": { "SUPABASE_ACCESS_TOKEN": "${SUPABASE_SECRET_KEY}" }
```

São duas chaves diferentes: `SUPABASE_SECRET_KEY` é do **projeto** (`sb_secret_…`, para o app ler e
gravar) e `SUPABASE_ACCESS_TOKEN` é da **conta** (`sbp_…`, para o conector listar tabela e aplicar
migration). Passando uma no lugar da outra, o conector responde
`Unauthorized. Please provide a valid access token` — medido nesta data. A entrada `webstorm` do mesmo
arquivo também tem a porta `64542` cravada, e a porta da IDE muda a cada reinício.

Nada disso foi consertado aqui: é decisão do operador, e mexer em `.mcp.json` derruba conector no meio
da sessão.
