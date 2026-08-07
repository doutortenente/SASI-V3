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
