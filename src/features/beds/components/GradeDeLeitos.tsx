/**
 * Grade do War Room: leitos agrupados por UTI, mais grave primeiro dentro de cada uma.
 *
 * Agrupa por unidade porque a ronda é física — o médico anda uma UTI de cada vez.
 * Dentro do grupo a ordem é por acuidade, então o primeiro card de cada bloco é
 * o próximo paciente a ser visto.
 */
import { BedCard } from '@/features/beds/components/BedCard';
import type { LeitoNaGrade } from '@/features/beds/types';
import { LEITOS_POR_UTI } from '@/lib/formatters/clinico';
import type { Uti } from '@/types';

const ORDEM_UTI: Uti[] = ['UTI2', 'UTI3', 'UTI4'];

export function GradeDeLeitos({ leitos }: { leitos: LeitoNaGrade[] }) {
  if (leitos.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        Nenhum leito ocupado. Isto é um fato lido do banco, não uma falha de carregamento —
        falha de leitura mostra tela de erro, não esta mensagem.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {ORDEM_UTI.map((uti) => {
        const daUti = leitos.filter((l) => l.uti === uti);
        if (daUti.length === 0) return null;

        const excedentes = daUti.length - LEITOS_POR_UTI[uti];

        return (
          <section key={uti} aria-labelledby={`titulo-${uti}`}>
            <header className="mb-3 flex items-baseline gap-3">
              <h2 id={`titulo-${uti}`} className="font-mono text-sm font-semibold tracking-wide">
                {uti}
              </h2>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {daUti.length} de {LEITOS_POR_UTI[uti]} ocupados
              </span>
              {/*
                A unidade tem número fixo de leitos (UTI2 12 · UTI3 13 · UTI4 8).
                Mais leitos ocupados do que existem é erro de cadastro, não superlotação.
              */}
              {excedentes > 0 && (
                <span className="text-destructive text-xs font-medium">
                  {excedentes} leito(s) além dos {LEITOS_POR_UTI[uti]} que a unidade tem — conferir numeração
                </span>
              )}
            </header>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {daUti.map((l) => (
                <li key={l.paciente_id}>
                  <BedCard leito={l} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
