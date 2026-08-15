---
description: Vale quando a tarefa terminar em mudança de arquivo neste repositório — criar branch, commitar, pushar, abrir PR, mesclar ou desfazer commit errado.
---

# Branch, commit, push, merge

## Vocabulário

| Termo                   | Tradução                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **branch** (ramo)       | cópia paralela pra mexer sem sujar a versão boa — rascunhar a conduta antes de assinar   |
| **commit**              | fotografia salva dos arquivos, com nome dizendo o que mudou — a evolução datada          |
| **push** (empurrar)     | mandar os commits do PC pro GitHub                                                       |
| **PR** / _pull request_ | pedido de juntar o ramo na versão boa, com as mudanças à vista                           |
| **squash**              | juntar todos os commits do ramo num só ao mesclar — uma evolução em vez de dez rascunhos |
| **working tree**        | o estado dos arquivos como estão agora no disco, salvos ou não                           |

## O fluxo deste repo

`main` é a versão boa **e publica**: mesclar nela dispara o deploy na Vercel. Por isso não se commita
direto nela.

1. **Ramo primeiro.** `git checkout -b <tipo>/<assunto-curto>`.
2. **`pnpm check` antes de commitar.** É o portão: typecheck, lint e testes. Estado bom conhecido, em
   14-ago-2026: **303 testes em 18 arquivos**, tudo passando, lint e typecheck limpos. Se o número
   caiu, o problema é seu, não do repo.
3. **Commite só o que é seu.** `git add <caminhos>`, nunca `git add -A` de olhos fechados. O working
   tree costuma ter mudança de `.idea/` e configuração do operador que não é da sua tarefa —
   arrastá-la para o seu commit mistura duas coisas e some com a autoria dela.
4. **Push com `-u`** na primeira vez: `git push -u origin <ramo>`.
5. **PR** com corpo que diz o que mudou e **como foi conferido**, com número medido.
6. **Squash-merge**, apagando o ramo: `gh pr merge <n> --squash --delete-branch`.

Commit e push são rotina aqui, não cerimônia — o último PR mesclado é o **#22**. Não travar o
trabalho pedindo autorização a cada passo.

## Antes de mesclar na `main`

Mesclar publica. Confira os checks do PR (`gh pr checks <n>`): a Vercel monta um **preview** — uma
versão de teste, num endereço só dela — e o `Vercel` fica `pending` enquanto isso. Espere ele virar
`pass`. Mesclar com o preview quebrado publica o quebrado.

## Mensagem de commit

Padrão do repo: `tipo(escopo): o que mudou, em português`, minúscula na primeira letra depois dos dois
pontos. Tipos em uso: `feat`, `fix`, `chore`, `docs`, `style`.

O corpo é onde mora o valor. Escreva **o porquê e o número medido**, não o que o diff já mostra:

```
chore(supabase): cumpre o guia de conexão do projeto, adaptado para pnpm

O comando do guia não rodava: components.json não declarava a chave `registries`,
então o namespace @supabase não resolvia.

Conferido depois: pnpm check verde — typecheck, lint e 303 testes em 18 arquivos.
```

Toda mensagem termina com as duas linhas de coautoria que a sessão exige.

## O que não se faz

| Nunca                                    | Por quê                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `git add -A` sem ler o `git status`      | arrasta configuração e trabalho do operador para dentro do seu commit   |
| commitar direto na `main`                | mesclar na main publica; ramo e PR existem para isso ser visível        |
| `git push --force` em ramo compartilhado | reescreve história que outro clone já tem                               |
| editar migration já aplicada             | as 28 já rodaram no banco. Mudança nova é arquivo novo (`pnpm db:diff`) |
| commitar `.env`, `.env.local`, `*.log`   | o repositório é público — ver `security-and-secrets.md`                 |

## Desfazer

| Situação                              | Comando                                        |
| ------------------------------------- | ---------------------------------------------- |
| commitei e não pushei, quero refazer  | `git reset --soft HEAD~1` (mantém as mudanças) |
| quero jogar fora a mudança do arquivo | `git restore <caminho>`                        |
| já pushei e preciso reverter          | `git revert <sha>` — novo commit que desfaz    |

`git reset --hard` apaga trabalho sem volta. Antes dele, mostre o plano e espere confirmação.
