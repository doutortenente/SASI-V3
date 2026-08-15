---
description: Vale sempre que for procurar qualquer coisa dentro deste repositório — arquivo, símbolo, trecho de texto, "onde mora X" ou "quem usa X" — antes de abrir arquivo.
---

# Como navegar neste repo

## A regra

**Buscar antes de varrer.** Medido em 14-ago-2026 sobre o que o git rastreia: **180 arquivos ·
1.692 KB · 30.866 linhas**. Fonte é pouca; o que engana é o resto do disco — `node_modules/` tem
**833 MB** e `memory/` tem **31 MB** de índice gerado, e varredura cega entra nos dois. É o exame de
corpo inteiro pedido antes da anamnese: demora, custa caro, devolve ruído. Localizar primeiro, abrir
só o alvo.

## A IDE responde melhor que o grep, e há um hook que cobra isso

Com o WebStorm aberto neste projeto, o MCP `jetbrains-index` está no ar. **Termo de dev:** MCP é a
ponte que deixa o Claude conversar com a IDE; "índice" é o catálogo que a IDE monta do código, como
o sumário de um livro — ela já sabe onde cada coisa está, em vez de reler tudo.

| Você quer saber                | Ferramenta                 | Não use  |
| ------------------------------ | -------------------------- | -------- |
| onde mora este arquivo         | `ide_find_file`            | `Glob`   |
| onde este texto aparece        | `ide_search_text`          | `Grep`   |
| quem usa este símbolo          | `ide_find_references`      | `Grep`   |
| onde este símbolo nasce        | `ide_find_definition`      | `Grep`   |
| quem implementa esta interface | `ide_find_implementations` | `Grep`   |
| renomear símbolo               | `ide_refactor_rename`      | `sed -i` |
| mover arquivo                  | `ide_move_file`            | `mv`     |

**Por que isso não é preferência de estilo.** O grep conta linha de texto; o índice conta ponto de
chamada. Medido aqui em 14-ago-2026: `getSupabaseBrowser` mais `getSupabaseServer` dão **31
referências em 15 arquivos** (`totalIsExact: true`), enquanto um `grep -l` havia estimado "10+" —
e essa contagem era o que decidia se um pacote podia sobrescrever os dois clientes. Errar o número
aqui é errar a decisão.

`.claude/hooks/prefer-ide-tools.sh` barra `Grep`, `Glob` e `sed -i` em massa **uma vez por sessão e
por classe**, com o nome da ferramenta que resolve. Barrou e você tem motivo legítimo? Repita a mesma
chamada: a segunda passa.

## Três armadilhas medidas, nesta ordem de frequência

**1. A IDE guarda mais de um repo.** O catálogo tem `SASI-V3`, `claude` e `scripts`. Uma busca sem
escopo pode responder pelo repo errado e você lê o resultado como se fosse daqui — aconteceu em
14-ago-2026. Confirme com `ide_project_status` e, quando houver dúvida, passe
`project_path: /home/dr/projetos/SASI-V3`.

**2. `isDumbMode: true` mente por omissão.** Significa que a IDE ainda está montando o catálogo: a
resposta volta curta, sem erro nenhum. Rode `ide_index_status` antes da primeira busca. Espere e
repita — não caia para o grep.

**3. Gravou por `Write`/`Edit`? Sincronize.** Essas duas ferramentas escrevem no disco por fora da
IDE, e o índice não sabe. Chame `ide_sync_files` com os caminhos antes de buscar de novo.

## Onde as coisas moram — e o que NÃO está mais aqui

O mapa de pastas vive no `CLAUDE.md`, seção "Onde mora o quê". Duas ausências que já custaram busca
perdida:

| O quê                          | Onde está de verdade                                          |
| ------------------------------ | ------------------------------------------------------------- |
| Os 5 docs do manual humano     | `~/projetos/_material/docs/` — saíram deste repo em 14-ago    |
| O v1/v2 inteiro, para consulta | `~/projetos/_material/` — **irmão** deste repo, não filho     |
| Script de infra da máquina     | `~/projetos/scripts/` — casa única, nenhum repo tem o próprio |
| `memory/`                      | está aqui, mas é índice **gerado**: 31 MB, fora do git        |

Escrever `_material/...` como caminho relativo à raiz deste repo aponta para o vazio. Ele é irmão,
em `~/projetos/`.

## Antes de criar arquivo

`~/projetos/_material/` tem o v1/v2 completo. Card de leito, tokens de cor, lógica de triagem e
tipos do domínio **já foram reescritos do zero uma vez** porque ninguém conferiu. Índice em
`~/projetos/_material/docs/INVENTARIO-MATERIAL.md`. Se a peça é clínica ou visual, presuma que ela
já existe e prove o contrário antes de digitar.
