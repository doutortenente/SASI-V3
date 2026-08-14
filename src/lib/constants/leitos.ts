// Escopo de leitos SASI (CLAUDE.md): padrão de referência UTI#-L##.
// Portado do SASI v2 (src/lib/constants/leitos.ts) — tipado contra `Uti` do contrato v3
// (não um tipo local novo), para não divergir do enum usado em `Paciente`/`VwDashboardUti`.
import type {Uti} from '@/types';

/**
 * Lista de leitos ("L01", "L02"...) de cada UTI.
 * Fonte: operador, 08-ago-2026 — "uti 2 agora tem 13 leitos".
 * A UTI 2 ganhou o L13; antes eram 12. Já havia paciente gravado em UTI2-L13.
 */
export const UTIS: Record<Uti, string[]> = {
    UTI2: Array.from({length: 13}, (_, i) => `L${String(i + 1).padStart(2, '0')}`),
    UTI3: Array.from({length: 13}, (_, i) => `L${String(i + 1).padStart(2, '0')}`),
    UTI4: Array.from({length: 8}, (_, i) => `L${String(i + 1).padStart(2, '0')}`),
};

/** Total de leitos do serviço (13 + 13 + 8 = 34). */
export const TOTAL_LEITOS = 34;

/** Formata o padrão canônico de leito exibido em tela e gravado no banco: "UTI2-L01". */
export function formatarLeito(uti: Uti, n: number): string {
    return `${uti}-L${String(n).padStart(2, '0')}`;
}
