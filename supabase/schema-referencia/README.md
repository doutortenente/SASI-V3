# Schema de referência — NÃO é migration

`10_schema_producao_v3.sql` (o Anexo A) descreve o schema **do zero**, para um banco
novo ou ambiente de teste. Ele **nunca foi aplicado** no projeto vivo
`idswehsvvqczzkiatuzu`, que existe desde 30-jul com pacientes reais.

## Por que saiu de `supabase/migrations/`

Estava lá com o nome `20260807000000_schema_inicial_v3.sql`. A pasta `migrations/` é
a que o `pnpm db:push` lê e aplica. Rodar aquele comando tentaria criar do zero
tabelas que já existem, num banco com paciente de verdade dentro.

Ele continua sendo a **fonte da verdade do estado-alvo** — use para conferir se o
banco tem tudo (enums, restrições, índices, gatilhos, views). Foi assim que se
descobriu, em 08-ago-2026, que faltavam `eventos_confidence_check` e `idx_eventos_user`.

## A seção 6 (RLS de produção) está fora de propósito

As 41 policies de dono e `fn_owns_paciente` não foram aplicadas: o operador usa o
sistema sozinho e a `dev_bypass` fica ativa por decisão dele.
