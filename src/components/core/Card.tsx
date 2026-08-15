/**
 * Painel padrão — borda de 1px, raio 12, fundo de card. Porta de
 * `sasi-design-system/components/core/Card.jsx`. Sombra é opcional.
 */
export function Card({
    titulo,
    nota,
    elevado = false,
    children,
    className = '',
}: {
    titulo?: string;
    nota?: string;
    elevado?: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section
            className={`rounded-lg border border-borda-padrao bg-superficie-card p-3 ${elevado ? 'shadow-card' : ''} ${className}`}
        >
            {titulo && <h3 className="text-sm font-semibold text-texto-titulo">{titulo}</h3>}
            {nota && <p className="mt-0.5 text-2xs text-texto-tenue">{nota}</p>}
            {titulo || nota ? <div className="mt-2">{children}</div> : children}
        </section>
    );
}
