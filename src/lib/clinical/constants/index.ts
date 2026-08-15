// ============================================================================
// SASI — Porta única das constantes clínicas do motor
// ----------------------------------------------------------------------------
// Substitui o `../constants` que o pacote `sasi-motor-clinico-v2` importava.
// Quem consome escreve `import {HEMO, INFECTO} from '@/lib/clinical/constants'`.
// ============================================================================

export {HEMO, INFECTO, METABOL, RENAL, RESP} from '@/lib/clinical/constants/thresholds';
export {SOFA_CUTOFFS} from '@/lib/clinical/constants/sofa-cutoffs';
