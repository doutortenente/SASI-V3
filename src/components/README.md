# `src/components/` — UI reutilizável

Três pastas, três donos:

| Pasta       | O que mora aqui                                                           | Quem escreve |
| ----------- | ------------------------------------------------------------------------- | ------------ |
| `ui/`       | primitivas do shadcn (`pnpm dlx shadcn@latest add <comp>`) — fora do lint | gerador      |
| `core/`     | peça genérica, sem regra clínica: `Badge`, `StatPill`, nav, tema          | nós          |
| `clinical/` | peça que carrega vocabulário clínico: gravidade, SOFA, terapia            | nós          |

## A regra da casa

**Componente EXIBE, não calcula.** Cálculo clínico mora em `src/lib/clinical/`, texto clínico em
`src/lib/formatters/`. Se uma peça daqui precisa decidir um limiar, a decisão está no lugar errado.

**Cor sai de token, nunca de hex.** O tema inteiro está em `src/styles/globals.css`. Faltou um token,
o conserto é lá — não é um `#hex` solto no componente.

**Forma comum mora em `core/`.** `core/Badge` é a receita de forma dos dois selos clínicos
(`GravityBadge` e `TherapyBadge`): linha, cantos, peso, caixa alta e a escala de 3 tamanhos. A COR
não passa por ele — ela entra por `classe`, vinda de quem conhece o domínio. Vem do
`sasi-design-system`, que já descrevia o Badge assim: _"the neutral primitive behind them"_.

## O que este código promete e o teste cobra

`GravityBadge`, `SofaBadge`, `TherapyBadge` e `StatPill` têm teste que **congela a aparência** —
par de cor por nível, escala de tamanho, caixa alta e rótulo. Refatorar é permitido; mudar o que
o médico vê, não. Se o teste quebrou depois de um refactor, o refactor é que está errado.

Três regras aparecem como teste, não como comentário:

- dado ausente é **travessão**, nunca zero (`SofaBadge`);
- **seta de tendência é proibida** — a direção vai em palavra ("subindo", "em queda");
- contagem só aparece quando é maior que zero — "DVA 0" afirmaria o que não há.
