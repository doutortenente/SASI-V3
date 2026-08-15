/**
 * Estatística inline do cabeçalho. Porta de
 * `sasi-design-system/components/core/StatPill.jsx`.
 */
const COR_TEXTO = {
    neutro: 'text-texto-titulo',
    critico: 'text-gravidade-critico',
    instavel: 'text-gravidade-instavel',
    vigilancia: 'text-gravidade-watcher',
    estavel: 'text-gravidade-estavel',
    acento: 'text-acento-texto',
} as const;

const COR_BORDA = {
    neutro: 'border-borda-padrao',
    critico: 'border-gravidade-critico/35',
    instavel: 'border-gravidade-instavel/35',
    vigilancia: 'border-gravidade-watcher/35',
    estavel: 'border-gravidade-estavel/35',
    acento: 'border-acento/35',
} as const;

export type TomStatPill = keyof typeof COR_TEXTO;

export function StatPill({
    valor,
    rotulo,
    tom = 'neutro',
}: {
    valor: string | number;
    rotulo: string;
    tom?: TomStatPill;
}) {
    return (
        <div
            className={`flex min-w-26 flex-col gap-0.5 rounded-lg border bg-superficie-card px-3 py-2 shadow-card ${COR_BORDA[tom]}`}
        >
            <span className="sasi-eyebrow">{rotulo}</span>
            <span data-clinical-number className={`text-xl leading-none font-semibold ${COR_TEXTO[tom]}`}>
                {valor}
            </span>
        </div>
    );
}
