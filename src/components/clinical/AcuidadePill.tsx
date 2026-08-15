/**
 * Pílula de resumo — "N críticos" tingido, sem caixa nem sombra.
 *
 * Portada do War Room real do V2 em produção (sasi-uti.vercel.app): ao lado de
 * "N leitos ativos", uma pílula por nível de gravidade que tem paciente — nível
 * zerado não aparece. Substitui o `StatPill` em quadro branco, que divergia do
 * design system e pesava a tela.
 */
import {SOLIDO_ACUIDADE} from './GravityBadge';
import type {Acuidade} from '@/lib/clinical/sasi';

const FUNDO_ACUIDADE: Record<Acuidade, string> = {
    ESTAVEL: 'bg-gravidade-estavel-bg text-gravidade-estavel-text',
    VIGILANCIA: 'bg-gravidade-watcher-bg text-gravidade-watcher-text',
    INSTAVEL: 'bg-gravidade-instavel-bg text-gravidade-instavel-text',
    CRITICO: 'bg-gravidade-critico-bg text-gravidade-critico-text',
    OBITO: 'bg-gravidade-obito-bg text-gravidade-obito-text',
};

/** Rótulo por contagem — não é o `ROTULO_ACUIDADE` (singular, maiúscula inicial) do selo do card. */
const ROTULO_CONTAGEM: Record<Acuidade, (n: number) => string> = {
    CRITICO: (n) => (n === 1 ? 'crítico' : 'críticos'),
    INSTAVEL: (n) => (n === 1 ? 'instável' : 'instáveis'),
    VIGILANCIA: () => 'em vigilância',
    ESTAVEL: (n) => (n === 1 ? 'estável' : 'estáveis'),
    OBITO: (n) => (n === 1 ? 'óbito' : 'óbitos'),
};

export function AcuidadePill({nivel, contagem}: {nivel: Acuidade; contagem: number}) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase ${FUNDO_ACUIDADE[nivel]}`}
        >
            <span className={`size-2 shrink-0 rounded-full ${SOLIDO_ACUIDADE[nivel]}`} aria-hidden="true" />
            {contagem} {ROTULO_CONTAGEM[nivel](contagem)}
        </span>
    );
}
