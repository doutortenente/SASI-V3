---
description: Vale quando a tarefa tocar chave, segredo, .env, credencial ou dado de paciente — e antes de todo commit deste repo.
---

# Segredos, credenciais e dado de paciente

**Este repositório é PÚBLICO** (`doutortenente/SASI-V3`, conferido em 14-ago-2026). Tudo que entra
aqui fica legível para qualquer pessoa, para sempre — apagar depois não desfaz, porque o histórico
do git guarda. Some a isso o fato de o banco ter **paciente real**, e a conta de errar aqui deixa de
ser técnica.

## Onde mora segredo

- **Cofre único:** `~/projetos/.env` — arquivo real, permissão `600` (só o dono lê), **fora deste
  repositório**. Não existe `.env` versionado aqui, e não deve passar a existir.
- **Segredo grande** (chave RSA, certificado) não cabe numa linha: mora em arquivo próprio em
  `~/.local/secrets/` (também `600`), com um ponteiro `_FILE` no cofre.
- **Neste repo mora `.env.example`**: molde só com nome de variável e valor falso. Ele pode ser
  commitado à vontade — é o mapa, não a chave.
- `.env.local` existe no disco e **está no `.gitignore`**. É o que o `pnpm dev` lê. Nunca commitar.

## As duas chaves que se confundem toda semana

| Chave                   | O que é                      | Serve para                                   | Pode ir para o navegador? |
| ----------------------- | ---------------------------- | -------------------------------------------- | ------------------------- |
| `SUPABASE_SECRET_KEY`   | chave do **projeto**         | o app ler e gravar no banco pelo servidor    | **não**                   |
| `SUPABASE_ACCESS_TOKEN` | token da **conta** (`sbp_…`) | o conector listar tabela e aplicar migration | **não**                   |

Só a primeira aparece no `.env.example`. A segunda fica no cofre de propósito: o
`~/projetos/scripts/sasi/mcp_supabase_wrapper.sh` a carrega em tempo de execução, e é por isso que o
`.mcp.json` pode ser versionado sem credencial dentro.

**`SUPABASE_SERVICE_ROLE_KEY` ignora toda a RLS.** Nunca em arquivo com `'use client'`, nunca em
variável `NEXT_PUBLIC_*`, nunca em componente. Só em Route Handler ou Edge Function.

## A chave que PODE ficar no código, e por quê

`src/lib/supabase/config.ts` carrega a URL e a chave **publicável** escritas no próprio arquivo, como
reserva para quando as variáveis de ambiente faltam. Isso é deliberado, não descuido: a chave
publicável vai para o navegador de qualquer visitante por desenho. O motivo da reserva está medido —
o app publicado passou **12 dias respondendo 500** porque o projeto da Vercel estava sem as duas
variáveis.

Regra que sai daí: **variável `NEXT_PUBLIC_*` não é segredo, e todo o resto é.** Se você está pensando
em dar reserva no código a uma chave que não começa com `NEXT_PUBLIC_`, pare.

## Dado de paciente

- `~/projetos/_material/` (fora deste repo) e `**/amostras/` têm **dado real**. `amostras/` está no
  `.gitignore`.
- **Não copiar de lá para `src/` nem para `tests/`.** Fixture de teste é sintética, sempre.
- O teste de ponta a ponta (`pnpm test:e2e`) abre as rotas mas **não clica em Salvar**: o app aponta
  para produção com paciente real, e gravar por robô sujaria prontuário.
- Nome, idade, leito e diagnóstico **nunca** entram em mensagem de commit, corpo de PR, log ou
  comentário de código.

## A `dev_bypass` fica, e não se reporta como falha

As policies `dev_bypass` seguem ativas de propósito. A decisão é do operador, com o motivo dito por
ele: uso solo, um usuário. Não propor remover, não propor tela de login, não abrir isso como defeito
de segurança — está em `CLAUDE.md` na lista de vetado. O fato de fundo que sustenta a decisão: os
pacientes têm `user_id` nulo, então tirar a `dev_bypass` deixaria o app cego, não mais seguro.

## Antes de commitar

1. `git status` — nenhum `.env`, nenhum `settings.local.json`, nenhum `*.log`, nada de `_material/`.
2. `git diff --cached` — leia o que está indo. Chave colada por acidente aparece aqui.
3. Nada de dado de paciente no diff nem na mensagem.
