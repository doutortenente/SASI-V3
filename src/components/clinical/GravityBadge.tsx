/**
 * Selo de gravidade — a linguagem central do painel.
 *
 * Portado do `sasi-design-system` do v2 (`components/clinical/GravityBadge`).
 * Cinco níveis, rótulo em português fixo, cor travada no token do tema.
 *
 * Por que os rótulos são constantes e não texto livre: no v2 o mesmo nível
 * aparecia como "Instável", "INSTAVEL" e "instavel" em telas diferentes, e a
 * passagem de turno virava discussão sobre palavra em vez de sobre paciente.
 */
import type {Acuidade} from '@/lib/clinical/sasi';

/** Rótulo humano de cada nível. Casa única — não redeclarar em componente. */
export const ROTULO_ACUIDADE: Record<Acuidade, string> = {
    ESTAVEL: 'Estável',
    VIGILANCIA: 'Vigilância',
    INSTAVEL: 'Instável',
    CRITICO: 'Crítico',
    OBITO: 'Óbito',
};

/** Preenchimento + texto por nível. Óbito é cinza, nunca verde. */
const CLASSE_ACUIDADE: Record<Acuidade, string> = {
    ESTAVEL: 'bg-gravidade-estavel-bg text-gravidade-estavel-text',
    VIGILANCIA: 'bg-gravidade-watcher-bg text-gravidade-watcher-text',
    INSTAVEL: 'bg-gravidade-instavel-bg text-gravidade-instavel-text',
    CRITICO: 'bg-gravidade-critico-bg text-gravidade-critico-text',
    OBITO: 'bg-gravidade-obito-bg text-gravidade-obito-text',
};

/** Cor cheia — usada no ponto e na barra lateral do card. */
export const SOLIDO_ACUIDADE: Record<Acuidade, string> = {
    ESTAVEL: 'bg-gravidade-estavel',
    VIGILANCIA: 'bg-gravidade-watcher',
    INSTAVEL: 'bg-gravidade-instavel',
    CRITICO: 'bg-gravidade-critico',
    OBITO: 'bg-gravidade-obito',
};

const TAMANHO = {
    sm: 'text-2xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
} as const;

export function GravityBadge({
    nivel,
    tamanho = 'md',
    ponto = false,
}: {
    nivel: Acuidade;
    tamanho?: keyof typeof TAMANHO;
    /** Forma mínima: só o ponto colorido e o rótulo, sem preenchimento. */
    ponto?: boolean;
}) {
    const rotulo = ROTULO_ACUIDADE[nivel];

    if (ponto) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-texto-suave">
                <span
                    className={`size-2 shrink-0 rounded-full ${SOLIDO_ACUIDADE[nivel]}`}
                    aria-hidden="true"
                />
                {rotulo}
            </span>
        );
    }

    return (
        <span
            className={`inline-flex items-center rounded-sm font-semibold tracking-wide uppercase ${TAMANHO[tamanho]} ${CLASSE_ACUIDADE[nivel]}`}
        >
            {rotulo}
        </span>
    );
}
