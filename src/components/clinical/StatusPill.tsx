/**
 * Contagem de leitos por gravidade — fileira do cabeçalho do War Room. Porta
 * de `sasi-design-system/components/clinical/StatusPill.jsx`.
 */
import {CLASSE_ACUIDADE, ROTULO_ACUIDADE, SOLIDO_ACUIDADE} from '@/components/clinical/GravityBadge';
import type {Acuidade} from '@/lib/clinical/sasi';

export function StatusPill({
    nivel,
    contagem,
    rotulo,
}: {
    nivel: Acuidade;
    contagem: number;
    rotulo?: string;
}) {
    return (
        <span
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-xs font-bold tracking-wide uppercase ${CLASSE_ACUIDADE[nivel]}`}
        >
            <span className={`size-2 shrink-0 rounded-full ${SOLIDO_ACUIDADE[nivel]}`} aria-hidden="true" />
            {contagem} {rotulo ?? ROTULO_ACUIDADE[nivel]}
        </span>
    );
}
