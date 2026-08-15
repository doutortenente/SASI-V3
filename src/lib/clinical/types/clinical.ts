// ============================================================================
// SASI — Alias de nome que o pacote `sasi-motor-clinico-v2` importa
// ----------------------------------------------------------------------------
// `sofa.ts`, `sepsis.ts` e `engine.ts` (o pacote do operador) importam de
// `'../types/clinical'`. Os tipos reais moram em `../types` (types.ts, uma
// pasta acima) — casa única. Isto não é o mesmo arquivo que `src/types/clinical.ts`
// (esse modela o BANCO; ver cabeçalho de `../types.ts`).
// ============================================================================

export * from '../types';
