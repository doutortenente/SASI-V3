/**
 * Campo genérico. Porta de `sasi-design-system/components/core/Input.jsx`.
 * `tipo="numero"` usa `type="text"` + `inputMode="decimal"` de propósito:
 * `type="number"` recusa vírgula em teclado pt-BR — ver `CamposDoSistema`.
 */
import {Search} from 'lucide-react';

export function Input({
    rotulo,
    unidade,
    tipo = 'texto',
    exemplo,
    linhas = 2,
    value,
    onChange,
    className = '',
    id,
    name,
    disabled,
    ariaLabel,
}: {
    rotulo?: string;
    unidade?: string;
    tipo?: 'texto' | 'numero' | 'area' | 'busca';
    exemplo?: string;
    linhas?: number;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    className?: string;
    id?: string;
    name?: string;
    disabled?: boolean;
    ariaLabel?: string;
}) {
    const ctrlClasse =
        'min-h-11 w-full rounded-md border border-borda-padrao bg-superficie-card px-3 py-2 text-sm text-texto-titulo placeholder:text-texto-tenue focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

    const ctrl =
        tipo === 'area' ? (
            <textarea
                id={id}
                name={name}
                rows={linhas}
                value={value}
                onChange={onChange}
                placeholder={exemplo}
                disabled={disabled}
                aria-label={ariaLabel}
                className={ctrlClasse}
            />
        ) : (
            <input
                id={id}
                name={name}
                type={tipo === 'busca' ? 'search' : 'text'}
                inputMode={tipo === 'numero' ? 'decimal' : undefined}
                value={value}
                onChange={onChange}
                placeholder={exemplo}
                disabled={disabled}
                aria-label={ariaLabel}
                className={tipo === 'busca' ? `${ctrlClasse} pl-8` : ctrlClasse}
            />
        );

    const corpo =
        tipo === 'busca' ? (
            <span className="relative block">
                <Search
                    aria-hidden
                    size={14}
                    className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-texto-tenue"
                />
                {ctrl}
            </span>
        ) : (
            ctrl
        );

    if (!rotulo) return <span className={className}>{corpo}</span>;
    return (
        <label className={`block ${className}`}>
            <span className="sasi-eyebrow">
                {rotulo}
                {unidade ? ` (${unidade})` : ''}
            </span>
            <span className="mt-0.5 block">{corpo}</span>
        </label>
    );
}
