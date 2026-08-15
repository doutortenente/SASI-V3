#!/usr/bin/env bash
# prefer-ide-tools.sh — enquanto a IDE JetBrains estiver viva, empurra a busca e
# a troca em massa para as ferramentas do MCP `jetbrains-index`, em vez de
# grep/glob/sed na mão.
#
# HOOK = gatilho automático: um programa que o Claude Code chama sozinho antes
# de usar uma ferramenta, e que pode barrar essa ação.
#
# ESTE ARQUIVO É AUTOSSUFICIENTE, DE PROPÓSITO. Existe um hook irmão no repo
# `~/projetos/claude`, registrado na settings global. Este aqui não depende dele,
# nem daquele repo estar aberto, anexado ou sequer presente no disco: o SASI é o
# produto e precisa se defender sozinho.
#
# Dois eventos, um arquivo só:
#   SessionStart -> injeta a tabela de roteamento no começo da sessão (só quando
#                   a IDE está viva; sessão sem IDE não paga esse contexto).
#   PreToolUse   -> intercepta Grep, Glob e Bash. Barra UMA vez por sessão e por
#                   classe, com o nome exato da ferramenta da IDE que resolve.
#
# COMO ELE SABE QUE A IDE ESTÁ VIVA — e por que NÃO por arquivo de lock:
#   O hook do repo `claude` procura `*.lock` em `~/.claude/ide/` e na raiz DAQUELE
#   repo. Medido em 14-ago-2026: `~/.claude/ide/` está vazia, e os 12 locks vivem
#   em `~/projetos/claude/ide/` — 1 vivo e 11 órfãos. Depender daquele caminho
#   amarraria este repo ao outro, que é exatamente o que se quer cortar.
#   Aqui a checagem é o PROCESSO da IDE: barato, sem rede, sem lock, sem
#   depender da porta (que muda a cada reinício).
#
# FALHA ABERTA, SEMPRE. Qualquer erro interno (sem jq, sem pgrep, JSON estranho)
# termina em exit 0. Um hook de roteamento nunca pode travar o trabalho — com
# paciente na tela, menos ainda.
#
# POR QUE BARRAR SÓ UMA VEZ: existe caso legítimo — índice em `isDumbMode`,
# arquivo fora do projeto, log, binário, saída de comando. Barrar sempre viraria
# parede; barrar uma vez força ler a alternativa e deixa a segunda passar.
#
# EFEITO COLATERAL CONHECIDO: com o hook do repo `claude` também registrado na
# global, os dois disparam na mesma chamada e o aviso sai em dobro. Incômodo, não
# quebra — cada um tem seu próprio arquivo de marca. Some quando aquele sair.
#
# LIMITES, para não prometer o que não entrega:
#   - Só vê Grep, Glob e Bash. `Read`, `Edit` e `Write` passam direto — para
#     esses o que vale é chamar `ide_sync_files` depois de gravar.
#   - O processo vivo não diz QUAL projeto está aberto. `ide_project_status` diz.
#   - Subagente não tem o MCP da IDE na caixa. Perde no máximo uma chamada por
#     classe e segue.
#   - Desligar na marra: exportar IDE_HOOK=off.
#
# Contrato do PreToolUse: exit 2 + mensagem no stderr = barra e o texto vai para
# o Claude. exit 0 = libera.

[ "${IDE_HOOK:-on}" = "off" ] && exit 0
command -v jq >/dev/null 2>&1 || exit 0

entrada=$(cat 2>/dev/null) || exit 0
[ -n "$entrada" ] || exit 0

evento=$(printf '%s' "$entrada" | jq -r '.hook_event_name // empty' 2>/dev/null)
sid=$(printf '%s' "$entrada" | jq -r '.session_id // "sem-sessao"' 2>/dev/null)

# Casa o binário lançador (`.../JetBrains/<build>/bin/webstorm`), com fim de
# linha ancorado. Sem a âncora, qualquer terminal aberto DENTRO da IDE — que
# carrega o caminho dela no cmdline — contaria como IDE viva.
ide_viva() {
  command -v pgrep >/dev/null 2>&1 || return 1
  pgrep -f 'JetBrains/[^/]+/bin/(webstorm|idea|pycharm|datagrip|rustrover|goland)$' >/dev/null 2>&1
}

ide_viva || exit 0

# ---------------------------------------------------------------- SessionStart
if [ "$evento" = "SessionStart" ]; then
  jq -n --arg c 'A IDE JetBrains está viva, então o MCP `jetbrains-index` está no ar. Buscar com grep aqui é escolher ver letra em vez de estrutura. Roteamento obrigatório: onde mora o arquivo -> `ide_find_file` (não Glob) · texto no código -> `ide_search_text` (não Grep) · quem usa este símbolo -> `ide_find_references` · onde ele nasce -> `ide_find_definition` · renomear símbolo -> `ide_refactor_rename` (nunca `sed -i` em massa) · mover arquivo -> `ide_move_file`. Antes da primeira busca, `ide_index_status`: com `isDumbMode: true` o catálogo ainda está sendo montado e a resposta vem incompleta, mentindo por omissão — espere e repita, não caia para o grep. A IDE guarda MAIS DE UM repo no catálogo: confira com `ide_project_status` e, se a resposta vier de outro projeto, repita passando `project_path: /home/dr/projetos/SASI-V3`. Depois de gravar arquivo por Write/Edit, `ide_sync_files` antes de buscar de novo.' \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $c}}'
  exit 0
fi

[ "$evento" = "PreToolUse" ] || exit 0

ferramenta=$(printf '%s' "$entrada" | jq -r '.tool_name // empty' 2>/dev/null)

# Barra uma vez por sessão e por classe. A marca é criada ANTES de barrar, então
# a repetição da mesma chamada passa. Prefixo próprio para não colidir com a
# marca do hook irmão.
ja_avisou() {
  local dir="${XDG_RUNTIME_DIR:-/tmp}/claude-ide-hook"
  mkdir -p "$dir" 2>/dev/null || return 1
  local marca="$dir/sasi-${sid}-$1"
  [ -e "$marca" ] && return 0
  : >"$marca" 2>/dev/null
  return 1
}

case "$ferramenta" in
Glob)
  ja_avisou glob && exit 0
  cat >&2 <<'FIM'
IDE viva: use `mcp__jetbrains-index__ide_find_file` no lugar do Glob.

O Glob casa nome de arquivo por padrão de texto. O `ide_find_file` responde pelo
índice da IDE, que já sabe o que é arquivo do projeto e o que é ruído.

Arquivo FORA do projeto é caso legítimo, e aqui isso é comum:
`~/projetos/_material/` (o v1/v2 e os 5 docs que saíram deste repo em 14-ago) e
`~/projetos/scripts/` (a casa única de script de infra). Também vale para a IDE
em `isDumbMode: true`. Nesses casos repita esta mesma chamada: a segunda passa.
FIM
  exit 2
  ;;
Grep)
  ja_avisou grep && exit 0
  cat >&2 <<'FIM'
IDE viva: use o MCP `jetbrains-index` no lugar do Grep.

| Você quer saber                | Ferramenta                 |
| ------------------------------ | -------------------------- |
| onde este texto aparece        | `ide_search_text`          |
| quem usa este símbolo          | `ide_find_references`      |
| onde este símbolo nasce        | `ide_find_definition`      |
| quem implementa esta interface | `ide_find_implementations` |

O grep vê letra; o índice entende estrutura. `ide_find_references` responde o
que o grep nem sabe perguntar: quem quebra se eu apagar isto?

Contar arquivo com `grep -l` não é contar ponto de chamada. Medido neste repo em
14-ago-2026: `getSupabaseBrowser` + `getSupabaseServer` = **31 referências em 15
arquivos** pelo índice, com `totalIsExact: true`; o grep havia dito "10+".

Rode `ide_index_status` antes. Com `isDumbMode: true` o catálogo ainda está
sendo montado e a resposta vem incompleta — espere e repita, não caia pro grep.
Se a resposta vier de outro repo, repita com
`project_path: /home/dr/projetos/SASI-V3`.

Busca em log, binário, saída de comando ou arquivo fora do projeto é caso
legítimo: repita esta mesma chamada que a segunda passa.
FIM
  exit 2
  ;;
Bash)
  comando=$(printf '%s' "$entrada" | jq -r '.tool_input.command // empty' 2>/dev/null)
  case "$comando" in
  *"sed -i"* | *"sed --in-place"* | *"perl -pi"* | *"perl -i "*) ;;
  *) exit 0 ;;
  esac
  # Troca num arquivo só é rotina. O risco é a troca em massa.
  printf '%s' "$comando" | grep -qE 'xargs|grep -rl|find |\*' || exit 0
  ja_avisou sed-massa && exit 0
  cat >&2 <<'FIM'
Troca em massa com `sed -i` neste repo: pare e escolha outra ferramenta.

O que está no caminho de uma varredura cega aqui:

- `supabase/migrations/*.sql` — as 28 já rodaram no banco vivo. O arquivo é
  retrato do que rodou; editado, ele passa a mentir sem quebrar nada.
- `src/types/supabase.ts` — 1.900 linhas geradas por `pnpm gen:types`.
- texto clínico — a direção vai em palavra ("lactato em queda"), nunca em seta.
  Uma troca de símbolo em massa reintroduz o que a regra proíbe.

Com a IDE viva existe caminho melhor:
- renomear símbolo (classe, função, variável) -> `ide_refactor_rename`
- trocar texto num arquivo -> `ide_replace_text_in_file`
- padrão estrutural -> `ide_structural_search_replace`
- mover arquivo -> `ide_move_file`

Se `sed` for mesmo o certo, troque só o que é CAMINHO, com a barra dentro do
padrão (`s|antigo/|novo/|g`), nunca a palavra solta — e repita esta chamada,
que a segunda passa.
FIM
  exit 2
  ;;
esac

exit 0
