/**
 * Filtro segmentado de unidade. Porta de
 * `sasi-design-system/components/chrome/SegmentedUti.jsx`.
 */
export function SegmentedUti({
    opcoes,
    valor,
    aoMudar,
}: {
    opcoes: string[];
    valor: string;
    aoMudar: (opcao: string) => void;
}) {
    return (
        <div
            role="group"
            aria-label="Filtrar por unidade"
            className="inline-flex items-center gap-0.5 rounded-2xl border border-borda-padrao bg-superficie-afundada p-1"
        >
            {opcoes.map((o) => (
                <button
                    key={o}
                    type="button"
                    aria-pressed={valor === o}
                    onClick={() => aoMudar(o)}
                    className={`min-h-8.5 rounded-xl px-4 font-mono text-xs font-semibold tracking-wide transition-colors duration-(--dur-fast) ${
                        valor === o
                            ? 'bg-superficie-card text-texto-titulo shadow-card'
                            : 'text-texto-suave hover:text-texto-titulo'
                    }`}
                >
                    {o}
                </button>
            ))}
        </div>
    );
}
