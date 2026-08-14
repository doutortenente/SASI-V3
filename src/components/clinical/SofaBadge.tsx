/**
 * Chip do SOFA — o número e a variação em 24 h.
 *
 * Portado do `sasi-design-system` do v2 (`components/clinical/SofaBadge`).
 *
 * Duas doutrinas do repo mandam aqui:
 * 1. SOFA ausente mostra travessão. NUNCA zero. Zero é um valor — dizer
 *    "SOFA 0" quando ninguém calculou é inventar dado. Hoje 0 de 16 evoluções
 *    têm `sofa_total`, então o travessão é o estado NORMAL desta tela.
 * 2. A variação vai em PALAVRA, não em seta. Seta se perde em fotocópia e se
 *    inverte em leitor de tela; "subindo" não.
 */
import {SEM_DADO} from '@/lib/formatters/clinico';

/**
 * Faixa de cor do escore.
 *
 * Os cortes seguem a estratificação usual do SOFA em coorte de UTI: quanto
 * maior o escore, maior a mortalidade observada. Vale como REALCE VISUAL, não
 * como decisão clínica — a conduta não sai da cor de um chip.
 * Fonte do escore: Vincent JL et al., Intensive Care Med 1996;22:707-10 (PMID 8844239).
 */
export function corDoSofa(escore: number | null | undefined): string {
    if (escore === null || escore === undefined || !Number.isFinite(escore)) return 'text-texto-tenue';
    if (escore <= 6) return 'text-sofa-baixo';
    if (escore <= 9) return 'text-sofa-medio';
    if (escore <= 12) return 'text-sofa-alto';
    return 'text-sofa-critico';
}

export function SofaBadge({
    escore,
    delta,
    tamanho = 'md',
}: {
    escore: number | null | undefined;
    /** Δ 24 h. Positivo = piorando (vermelho); negativo = melhorando (verde). */
    delta?: number | null;
    tamanho?: 'md' | 'lg';
}) {
    const temEscore = escore !== null && escore !== undefined && Number.isFinite(escore);
    const temDelta = delta !== null && delta !== undefined && Number.isFinite(delta);

    const classeNumero = tamanho === 'lg' ? 'text-2xl' : 'text-xl';

    return (
        <div className="flex items-baseline gap-1.5">
            <span
                data-clinical-number
                className={`${classeNumero} font-semibold ${corDoSofa(escore)}`}
                aria-label={temEscore ? `SOFA ${escore}` : 'SOFA não calculado'}
            >
                {temEscore ? escore : SEM_DADO}
            </span>

            {temDelta && delta !== 0 && (
                <span
                    className={`text-2xs font-semibold ${delta > 0 ? 'text-sofa-critico' : 'text-sofa-baixo'}`}
                    title="Variação do SOFA nas últimas 24 horas"
                >
                    {delta > 0 ? 'subindo' : 'em queda'} {Math.abs(delta)}
                </span>
            )}
            {temDelta && delta === 0 && (
                <span className="text-2xs font-medium text-texto-tenue">estável</span>
            )}
        </div>
    );
}
