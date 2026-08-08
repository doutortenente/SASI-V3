/**
 * Card de um leito no War Room.
 *
 * Componente EXIBE, não calcula: acuidade, semáforo e divergência chegam
 * prontos de `triagemDeLeitos`. Nenhum cálculo clínico mora aqui.
 */
import type { Acuidade } from '@/lib/clinical/sasi';
import {
  CLASSE_SEMAFORO,
  SEM_DADO,
  direcao,
  numeroDoLeito,
  rotuloInfusao,
  txt,
} from '@/lib/formatters/clinico';
import type { Dispositivos, Isolamento } from '@/types';
import type { LeitoNaGrade } from '@/features/beds/types';

/** Borda esquerda por acuidade — o olho acha o grave antes de ler. */
const BORDA_ACUIDADE: Record<Acuidade, string> = {
  CRITICO: 'border-l-gravidade-critico',
  INSTAVEL: 'border-l-gravidade-instavel',
  VIGILANCIA: 'border-l-gravidade-watcher',
  ESTAVEL: 'border-l-gravidade-estavel',
};

const ROTULO_ISOLAMENTO: Record<Isolamento, string | null> = {
  none: null,
  contact: 'Contato',
  droplet: 'Gotícula',
  aerosol: 'Aerossol',
};

/** Só dispositivo invasivo, que muda conduta. `detalhe` não é dispositivo. */
const ROTULO_DISPOSITIVO: Partial<Record<keyof Dispositivos, string>> = {
  iot: 'IOT', tqt: 'TQT', cvc: 'CVC', pai: 'PAI', svd: 'SVD', sne: 'SNE',
  avp: 'AVP', picc: 'PICC', dreno: 'Dreno', mpd: 'MPD', shilley: 'Shilley',
};

function dispositivosAtivos(d: Dispositivos | null): string[] {
  if (!d) return [];
  return (Object.keys(ROTULO_DISPOSITIVO) as Array<keyof Dispositivos>)
    .filter((k) => d[k] === true)
    .map((k) => ROTULO_DISPOSITIVO[k]!);
}

export function BedCard({ leito }: { leito: LeitoNaGrade }) {
  const dispositivos = dispositivosAtivos(leito.dispositivos);
  const isolamento = leito.isolation ? ROTULO_ISOLAMENTO[leito.isolation] : null;
  /*
    NÃO filtrar por `d.droga`: no banco vivo `dvas` é lista de TEXTO puro
    ("Dobutamina 5 ml/h"), que não tem esse campo. O filtro por campo descartava
    100% das drogas vasoativas em silêncio — o mesmo defeito de "dose que sumia
    da passagem" do v2. Aqui só sai o que é vazio de verdade.
  */
  const dvas = (leito.dvas ?? []).filter((d) =>
    typeof d === 'string' ? d.trim() !== '' : Boolean(d?.droga),
  );

  return (
    <article
      className={`bg-card text-card-foreground border-border rounded-xl border border-l-4 p-4 ${BORDA_ACUIDADE[leito.acuidade]}`}
      aria-label={`Leito ${leito.leito}, acuidade ${leito.acuidade}`}
    >
      {/* Cabeçalho: leito, semáforo, acuidade */}
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-mono text-lg font-semibold tabular-nums">{numeroDoLeito(leito.leito)}</h3>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium tracking-wide">{leito.acuidade}</span>
          <span
            className={`size-3 shrink-0 rounded-full ${CLASSE_SEMAFORO[leito.semaforo]}`}
            aria-label={`Semáforo ${leito.semaforo}`}
          />
        </div>
      </header>

      {/*
        Divergência de dado: o semáforo guardado no banco discorda da gravidade.
        A tela pinta o derivado da gravidade e AVISA — não corrige o banco.
      */}
      {leito.divergenciaDeSemaforo && (
        <p className="text-destructive mt-2 text-xs font-medium">
          Dado inconsistente: gravidade {txt(leito.gravidade)}, semáforo gravado{' '}
          {txt(leito.severidade_visual)}. A tela mostra o derivado da gravidade. Conferir no cadastro.
        </p>
      )}

      {/* Identificação */}
      <p className="mt-2 truncate text-sm font-medium" title={leito.nome ?? undefined}>
        {txt(leito.nome)}
      </p>
      <p className="text-muted-foreground text-xs">
        {leito.idade == null ? SEM_DADO : `${leito.idade} anos`} · {txt(leito.dias_internacao)} dias de internação
      </p>
      <p className="mt-1 line-clamp-2 text-xs" title={leito.hd ?? undefined}>
        {txt(leito.hd)}
      </p>

      {/* Números. SOFA ausente mostra travessão — nunca 0, nunca estimado. */}
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-muted-foreground text-[10px] tracking-wide">SOFA</dt>
          <dd className="font-mono text-base tabular-nums">{txt(leito.sofa_total)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[10px] tracking-wide">SOFA 24h</dt>
          <dd className="font-mono text-xs tabular-nums">{direcao(leito.delta_sofa_24h)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[10px] tracking-wide">Pendências</dt>
          <dd className="font-mono text-base tabular-nums">{txt(leito.pendencias_abertas)}</dd>
        </div>
      </dl>

      {/* Drogas vasoativas correndo — a dose nunca é omitida. */}
      {dvas.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {dvas.map((d, i) => {
            const rotulo = rotuloInfusao(d);
            return (
              <li key={`${rotulo}-${i}`} className="text-sistema-hemo font-mono text-xs">
                {rotulo}
              </li>
            );
          })}
        </ul>
      )}

      {/* Selos: isolamento primeiro, que muda a conduta de quem entra no box. */}
      {(isolamento || dispositivos.length > 0) && (
        <ul className="mt-3 flex flex-wrap gap-1">
          {isolamento && (
            <li className="bg-gravidade-watcher-bg text-gravidade-watcher rounded px-1.5 py-0.5 text-[10px] font-semibold">
              Isolamento {isolamento}
            </li>
          )}
          {dispositivos.map((d) => (
            <li key={d} className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
              {d}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
