/**
 * Grade do War Room: leitos agrupados por UTI, mais grave primeiro dentro de cada uma.
 *
 * Agrupa por unidade porque a ronda é física — o médico anda uma UTI de cada vez.
 * Dentro do grupo a ordem é por acuidade, então o primeiro card de cada bloco é
 * o próximo paciente a ser visto.
 */
import { BedCard } from '@/features/beds/components/BedCard';
import type { DadosVivosDoPlantao, LeitoNaGrade } from '@/features/beds/types';
import { LEITOS_POR_UTI, foraDaNumeracao } from '@/lib/formatters/clinico';
import type { Uti } from '@/types';

const ORDEM_UTI: Uti[] = ['UTI2', 'UTI3', 'UTI4'];

export function GradeDeLeitos({
  leitos,
  agoraISO,
  vivos,
  haFiltroAtivo = false,
}: {
  leitos: LeitoNaGrade[];
  /** Instante da renderização, vindo da página: um relógio só para toda a grade. */
  agoraISO: string;
  /** Dado ao vivo (alertas, pendências, dispositivos) injetado pela ilha client. */
  vivos?: DadosVivosDoPlantao | undefined;
  /** A lista chegou FILTRADA? Muda a mensagem do vazio — ver abaixo. */
  haFiltroAtivo?: boolean | undefined;
}) {
  if (leitos.length === 0) {
    // Duas mensagens DIFERENTES de propósito: grade vazia por filtro não é
    // grade vazia no banco — dizer "nenhum leito ocupado" com um filtro ativo
    // seria mentir sobre o plantão.
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        {haFiltroAtivo
          ? 'Nenhum leito passa no filtro atual. Os leitos continuam no plantão — use "Limpar" para ver todos.'
          : 'Nenhum leito ocupado. Isto é um fato lido do banco, não uma falha de carregamento — falha de leitura mostra tela de erro, não esta mensagem.'}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {ORDEM_UTI.map((uti) => {
        const daUti = leitos.filter((l) => l.uti === uti);
        if (daUti.length === 0) return null;

        /*
          Confere o NÚMERO do leito, não a quantidade de ocupados.
          A capacidade vem de `LEITOS_POR_UTI`, derivada da casa única
          `constants/leitos.ts` (UTI2 13 · UTI3 13 · UTI4 8). A cópia à mão
          que dizia UTI2=12 marcava o paciente REAL de UTI2-L13 como "fora
          da numeração" — deriva de constante duplicada, defeito medido.
        */
        const foraDaFaixa = daUti.filter((l) => foraDaNumeracao(l.leito, uti));

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
                A unidade tem número fixo de leitos (UTI2 13 · UTI3 13 · UTI4 8).
                Leito numerado fora dessa faixa é erro de cadastro, não superlotação.
              */}
              {foraDaFaixa.length > 0 && (
                <span className="text-destructive text-xs font-medium">
                  Fora da numeração da unidade (vai até L
                  {String(LEITOS_POR_UTI[uti]).padStart(2, '0')}):{' '}
                  {foraDaFaixa.map((l) => l.leito).join(', ')} — conferir cadastro
                </span>
              )}
            </header>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {daUti.map((l) => (
                <li key={l.paciente_id}>
                  {/*
                    Fatia por paciente dos mapas ao vivo. `?? []` só depois de o
                    mapa EXISTIR: mapa carregado sem o paciente = zero itens
                    (fato); mapa `undefined` = ainda sem resposta (outra coisa).
                  */}
                  <BedCard
                    leito={l}
                    agoraISO={agoraISO}
                    alertasAbertos={vivos?.alertasPorPaciente.get(l.paciente_id)}
                    pendencias={
                      vivos?.pendenciasPorPaciente
                        ? (vivos.pendenciasPorPaciente[l.paciente_id] ?? [])
                        : undefined
                    }
                    erroPendencias={vivos?.erroPendencias ?? null}
                    dispositivos={
                      vivos?.dispositivosPorPaciente
                        ? (vivos.dispositivosPorPaciente[l.paciente_id] ?? [])
                        : undefined
                    }
                    erroDispositivos={vivos?.erroDispositivos ?? null}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
