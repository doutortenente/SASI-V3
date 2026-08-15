/**
 * Pílula do card de leito. Porta de
 * `sasi-design-system/components/clinical/Chip.jsx`. O tom é o vocabulário:
 * droga vasoativa é rosa, sedação é roxa, via aérea é azul, dispositivo é
 * neutro, isolamento e pendência são âmbar.
 */
const TOM = {
    iso: 'bg-selo-pend-bg text-selo-pend-text',
    dva: 'bg-selo-dva-bg text-selo-dva-text',
    sed: 'bg-selo-sed-bg text-selo-sed-text',
    via: 'bg-selo-vm-bg text-selo-vm-text',
    atb: 'bg-selo-atb-bg text-selo-atb-text',
    disp: 'bg-superficie-afundada text-texto-suave',
    pend: 'bg-selo-pend-bg text-selo-pend-text',
} as const;

export type TomChip = keyof typeof TOM;

export function Chip({
    tom = 'disp',
    children,
    titulo,
}: {
    tom?: TomChip;
    children: React.ReactNode;
    titulo?: string;
}) {
    return (
        <span
            title={titulo}
            className={`inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wide uppercase ${TOM[tom]}`}
        >
            {children}
        </span>
    );
}
