/**
 * Porta única dos tipos do app.
 *
 * Regra: componente e hook importam de `@/types`, nunca do arquivo interno.
 * Isso deixa trocar `clinical.ts` por `supabase.ts` (gerado) sem tocar em quem consome.
 *
 * - `clinical.ts` — escrito à mão. Dono dos contratos JSONB (o gerador do Supabase
 *   achata JSONB em `Json` e perde a riqueza clínica).
 * - `supabase.ts` — GERADO por `pnpm gen:types`. Não editar à mão.
 */

export type * from './clinical';
