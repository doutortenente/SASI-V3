// ============================================================================
// SASI v3 — Lógica clínica pura (sem dependência de framework)  [F1 starter]
// Tipada contra database.types.ts (Anexo C). Testável isoladamente.
// Espelha o intel()/triagem do CLAUDE.md: acuidade derivada de fisiologia, não de rótulo.
// ============================================================================
import type {
  Gravidade, SeveridadeVisual, VwDashboardUti, EventoTipoRef,
} from '@/types/clinical';

/** IMC (mesma conta da coluna gerada no banco). altura em cm. */
export function imc(peso: number | null, alturaCm: number | null): number | null {
  if (!peso || !alturaCm) return null;
  const m = alturaCm / 100;
  return Math.round((peso / (m * m)) * 10) / 10;
}

/** Semáforo a partir da gravidade (mesma regra do gatilho sync_severidade_visual). */
export function severidadeVisualDe(g: Gravidade): SeveridadeVisual {
  switch (g) {
    case 'critico':
    case 'grave': return 'red';
    case 'moderado': return 'yellow';
    default: return 'green';
  }
}

/** true se o valor está fora da faixa fisiológica "impossível" (flag duro). */
export function foraDaFaixa(valor: number, ref: Pick<EventoTipoRef, 'faixa_min' | 'faixa_max'>): boolean {
  if (ref.faixa_min != null && valor < ref.faixa_min) return true;
  if (ref.faixa_max != null && valor > ref.faixa_max) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Semáforo exibido: por que a tela NÃO confia na coluna `severidade_visual`
// ---------------------------------------------------------------------------
// O gatilho sync_severidade_visual só recalcula o semáforo quando a gravidade
// muda E o semáforo NÃO foi tocado na mesma operação — para respeitar ajuste
// manual. Efeito colateral: quem grava gravidade e semáforo juntos (a ingestão
// faz isso) consegue deixar os dois em desacordo, e o valor errado fica.
//
// Medido no banco vivo em 08-ago-2026: 6 pacientes com semáforo contradizendo
// a gravidade, 1 deles ATIVO — crítico pintado de verde na tela de comando.
//
// Decisão: a tela deriva o semáforo da gravidade (fonte primária, escrita pelo
// médico) e SINALIZA o desacordo. Não corrige o banco: "flags gritam, não
// consertam" — quem decide dado clínico é o médico, não a tela.

type LinhaSemaforo = Pick<VwDashboardUti, 'gravidade' | 'severidade_visual'>;

/** O semáforo que a tela deve pintar: sempre derivado da gravidade. */
export function semaforoDe(row: Pick<VwDashboardUti, 'gravidade'>): SeveridadeVisual {
  return severidadeVisualDe(row.gravidade);
}

/** true quando o semáforo guardado no banco discorda do derivado da gravidade. */
export function semaforoDivergente(row: LinhaSemaforo): boolean {
  return row.severidade_visual !== semaforoDe(row);
}

export type Acuidade = 'CRITICO' | 'INSTAVEL' | 'VIGILANCIA' | 'ESTAVEL';

type LinhaTriagem = Pick<
  VwDashboardUti,
  'severidade_visual' | 'delta_sofa_24h' | 'out_of_range_count' | 'pendencias_abertas'
>;

/** Deriva tier de acuidade de limiares fisiológicos (não do status declarado). */
export function acuidadeDe(row: LinhaTriagem): Acuidade {
  if (row.severidade_visual === 'red') return 'CRITICO';
  if ((row.delta_sofa_24h ?? 0) >= 2 || (row.out_of_range_count ?? 0) >= 3) return 'INSTAVEL';
  if (row.severidade_visual === 'yellow' || (row.out_of_range_count ?? 0) > 0) return 'VIGILANCIA';
  return 'ESTAVEL';
}

const RANK: Record<Acuidade, number> = { CRITICO: 0, INSTAVEL: 1, VIGILANCIA: 2, ESTAVEL: 3 };

/** Ordena leitos por acuidade (mais grave primeiro) — base do War Room/SITREP. */
export function triagem<T extends LinhaTriagem>(rows: T[]): Array<T & { acuidade: Acuidade }> {
  return rows
    .map((r) => ({ ...r, acuidade: acuidadeDe(r) }))
    .sort((a, b) => RANK[a.acuidade] - RANK[b.acuidade]);
}

/** O que a triagem do War Room acrescenta a cada linha da view. */
export interface TriadoParaGrade {
  /** Semáforo a pintar — derivado da gravidade, não lido da coluna. */
  semaforo: SeveridadeVisual;
  /** A coluna `severidade_visual` do banco discorda do derivado. */
  divergenciaDeSemaforo: boolean;
  acuidade: Acuidade;
}

/**
 * Triagem do War Room: deriva o semáforo da gravidade, calcula a acuidade sobre
 * esse valor derivado (e não sobre a coluna, que pode estar em desacordo),
 * sinaliza o desacordo e ordena o mais grave primeiro.
 *
 * Empate de acuidade desempata por leito, para a grade não dançar entre
 * carregamentos — leito trocando de lugar na tela de comando é erro de leitura
 * esperando acontecer.
 */
export function triagemDeLeitos<T extends LinhaSemaforo & LinhaTriagem & { leito: string }>(
  rows: T[],
): Array<T & TriadoParaGrade> {
  return rows
    .map((r) => {
      const semaforo = semaforoDe(r);
      return {
        ...r,
        semaforo,
        divergenciaDeSemaforo: r.severidade_visual !== semaforo,
        acuidade: acuidadeDe({ ...r, severidade_visual: semaforo }),
      };
    })
    .sort((a, b) => RANK[a.acuidade] - RANK[b.acuidade] || a.leito.localeCompare(b.leito));
}

/** Dias de terapia de ATB (D-day), igual à view vw_dias_atb_ativo. */
export function diasTerapia(dataInicioISO: string, hojeISO: string): number {
  const d0 = new Date(dataInicioISO + 'T00:00:00');
  const d1 = new Date(hojeISO + 'T00:00:00');
  return Math.floor((d1.getTime() - d0.getTime()) / 86_400_000) + 1;
}

export function stewardshipFlag(dias: number): 'ok' | 'warning' | 'critical' {
  if (dias >= 14) return 'critical';
  if (dias >= 7) return 'warning';
  return 'ok';
}
