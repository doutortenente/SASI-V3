/**
 * Selo — a FORMA comum por trás de `GravityBadge` e `TherapyBadge`.
 *
 * Traduzido de `sasi-design-system/components/core/Badge.jsx`, que já se
 * declarava assim: *"this is the neutral primitive behind them"*.
 *
 * O que ele resolve: a receita de forma do selo (linha, cantos, peso, caixa,
 * espaçamento entre letras e a escala de 3 tamanhos) estava escrita duas vezes,
 * uma em cada selo clínico, com diferenças que ninguém tinha decidido. Um dia
 * um muda e o outro não — e a mesma peça passa a ter dois tamanhos na mesma
 * tela. Aqui é o único lugar.
 *
 * O que ele NÃO resolve, de propósito: **cor**. No design system o Badge traz
 * um mapa de 5 tons (neutral/accent/success/warning/danger) e 3 preenchimentos
 * (solid/soft/outline). Esse mapa não cabe neste app: gravidade tem 5 níveis
 * (o laranja de "instável" e o cinza de "óbito" não existem no mapa) e terapia
 * tem 7 pares de cor próprios. Portar o mapa seria trazer código que ninguém
 * chama. Então a cor entra por `classe`, vinda de quem conhece o domínio, e o
 * par de token continua morando no selo clínico.
 */

/**
 * Escala de tamanho — a MEDIDA em produção, não a do design system.
 *
 * O DS corta o selo pequeno em 9px; aqui o menor é 10px (`text-2xs`), que é o
 * degrau que a escala tipográfica do painel já define. Um tamanho fora da
 * escala obrigaria um valor solto no CSS, e essa é a porta por onde entra a
 * segunda régua.
 */
const TAMANHO = {
    sm: 'text-2xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
} as const;

export type TamanhoSelo = keyof typeof TAMANHO;

export function Badge({
    children,
    classe,
    tamanho = 'md',
    caixaAlta = false,
    titulo,
    pulsar = false,
}: {
    children: React.ReactNode;
    /** Par de token de cor do domínio, ex.: `bg-selo-dva-bg text-selo-dva-text`. */
    classe: string;
    tamanho?: TamanhoSelo;
    /**
     * Caixa alta. Fica com quem chama porque nem todo selo pode: o rótulo livre
     * do selo de terapia ("Isolamento Contato") chega escrito e tem que sair
     * como foi escrito.
     */
    caixaAlta?: boolean;
    /** Texto do balão ao passar o mouse — onde a sigla é explicada por extenso. */
    titulo?: string;
    /** Pulsação de atenção. A ÚNICA animação de alerta do app: crítico e sepse. */
    pulsar?: boolean;
}) {
    const classes = [
        'inline-flex items-center gap-1 rounded-sm font-semibold tracking-wide',
        TAMANHO[tamanho],
        classe,
        caixaAlta ? 'uppercase' : '',
        pulsar ? 'sasi-critical-pulse' : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <span title={titulo} className={classes}>
            {children}
        </span>
    );
}
