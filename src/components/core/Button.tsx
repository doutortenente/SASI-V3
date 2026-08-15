/**
 * Botão de comando. Porta de `sasi-design-system/components/core/Button.jsx`.
 * `destaque` é a ação-produto da tela (uma por tela); `chip` é filtro/escolha
 * e acende por `aria-pressed`. Todo alvo tem no mínimo 44px de altura.
 */
import type {LucideIcon} from 'lucide-react';

const VARIANTE = {
    destaque:
        'min-h-14 rounded-xl bg-acento px-5 text-base font-semibold text-(--texto-sobre-acento) shadow-card hover:bg-(--acento-hover)',
    padrao:
        'min-h-11 rounded-md border border-borda-padrao bg-superficie-card px-3 text-sm font-medium text-texto-corpo hover:bg-superficie-elevada hover:text-texto-titulo',
    chip: 'min-h-11 rounded-md border px-3 text-xs font-medium transition-colors',
    texto: 'min-h-11 rounded-md px-2 text-xs font-medium text-texto-suave hover:text-texto-titulo',
} as const;

export type VarianteBotao = keyof typeof VARIANTE;

export function Button({
    children,
    variante = 'padrao',
    ativo,
    bloco = false,
    Icone,
    className = '',
    onClick,
    type = 'button',
    disabled,
    title,
}: {
    children?: React.ReactNode;
    variante?: VarianteBotao;
    /** Só para `variante="chip"` — liga `aria-pressed` e a cor de acento. */
    ativo?: boolean;
    bloco?: boolean;
    Icone?: LucideIcon;
    className?: string;
    onClick?: () => void;
    type?: 'button' | 'submit';
    disabled?: boolean;
    title?: string;
}) {
    const classeChip =
        variante === 'chip'
            ? ativo
                ? 'border-acento/35 bg-acento-suave font-semibold text-acento-texto'
                : 'border-borda-padrao bg-superficie-card text-texto-suave hover:text-texto-titulo'
            : '';

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-pressed={variante === 'chip' && ativo !== undefined ? ativo : undefined}
            className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors duration-(--dur-fast) disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTE[variante]} ${classeChip} ${bloco ? 'w-full' : ''} ${className}`}
        >
            {Icone && <Icone aria-hidden size={16} />}
            {children}
        </button>
    );
}
