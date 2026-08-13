// ============================================================================
// SASI v3 — Lógica clínica pura (sem dependência de framework)  [F1 starter]
// Tipada contra database.types.ts (Anexo C). Testável isoladamente.
// Espelha o intel()/triagem do CLAUDE.md: acuidade derivada de fisiologia, não de rótulo.
// ============================================================================
import type {EventoTipoRef, Gravidade, SeveridadeVisual, StatusLeito, VwDashboardUti,} from '@/types/clinical';

/** IMC (mesma conta da coluna gerada no banco). altura em cm. */
export function imc(peso: number | null, alturaCm: number | null): number | null {
    if (!peso || !alturaCm) return null;
    const m = alturaCm / 100;
    return Math.round((peso / (m * m)) * 10) / 10;
}

/**
 * Semáforo por gravidade (enum pós-P0: estavel|watcher|instavel|critico).
 *
 * Record EXAUSTIVO de propósito, sem `default`: a versão anterior chaveava os
 * valores VELHOS do enum (`grave`/`moderado`) e todo valor novo caía no ramo
 * padrão — paciente `watcher`/`instavel` pintado de VERDE na tela de comando.
 * Com o Record, valor novo no enum vira erro de compilação, não verde calado.
 */
const SEMAFORO_POR_GRAVIDADE: Record<Gravidade, SeveridadeVisual> = {
    estavel: 'green',
    watcher: 'yellow',
    instavel: 'red',
    critico: 'red',
};

/** Semáforo a partir da gravidade (mesma regra do gatilho sync_severidade_visual). */
export function severidadeVisualDe(g: Gravidade): SeveridadeVisual {
    return SEMAFORO_POR_GRAVIDADE[g];
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

/**
 * OBITO é um tier próprio, não um grau de gravidade.
 *
 * Desde o P0 de 10-ago óbito NÃO é valor de `gravidade` — o desfecho vive em
 * `status_leito` (e `internacoes.desfecho`). A `vw_dashboard_uti` só devolve
 * leito ATIVO, então em condições normais o tier nunca aparece; ele existe
 * para a linha que traga `status_leito='obito'` (consulta direta, dado em
 * trânsito) nunca ser rotulada de ESTAVEL — a tela dizendo "estável" sobre um
 * paciente morto é o defeito que este tier impede.
 */
export type Acuidade = 'CRITICO' | 'INSTAVEL' | 'VIGILANCIA' | 'ESTAVEL' | 'OBITO';

type LinhaTriagem = Pick<
    VwDashboardUti,
    'severidade_visual' | 'delta_sofa_24h' | 'out_of_range_count' | 'pendencias_abertas'
>;

/** Deriva tier de acuidade de limiares fisiológicos (não do status declarado). */
export function acuidadeDe(row: LinhaTriagem & { status_leito?: StatusLeito }): Acuidade {
    // Óbito antes de tudo: nenhum limiar fisiológico se aplica. Derivado de
    // `status_leito` (onde o desfecho mora desde o P0), não de gravidade.
    if (row.status_leito === 'obito') return 'OBITO';
    if (row.severidade_visual === 'red') return 'CRITICO';
    if ((row.delta_sofa_24h ?? 0) >= 2 || (row.out_of_range_count ?? 0) >= 3) return 'INSTAVEL';
    if (row.severidade_visual === 'yellow' || (row.out_of_range_count ?? 0) > 0) return 'VIGILANCIA';
    return 'ESTAVEL';
}

// OBITO por último: não há conduta a priorizar. Mas com rótulo próprio — ver o
// comentário do tipo Acuidade sobre por que ele não pode virar ESTAVEL.
const RANK: Record<Acuidade, number> = {
    CRITICO: 0,
    INSTAVEL: 1,
    VIGILANCIA: 2,
    ESTAVEL: 3,
    OBITO: 4,
};

/** Ordena leitos por acuidade (mais grave primeiro) — base do War Room/SITREP. */
export function triagem<T extends LinhaTriagem>(rows: T[]): Array<T & { acuidade: Acuidade }> {
    return rows
        .map((r) => ({...r, acuidade: acuidadeDe(r)}))
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
                acuidade: acuidadeDe({...r, severidade_visual: semaforo}),
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
