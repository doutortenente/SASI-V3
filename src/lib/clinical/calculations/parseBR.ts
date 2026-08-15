// ============================================================================
// SASI — `parseFloatBR`: a tomada entre o motor do operador e o leitor do app
// ----------------------------------------------------------------------------
// O app JÁ TEM o leitor de número pt-BR: `parseNumeroBR`, em
// `src/lib/clinical/unidades.ts`. A regra de leitura (vírgula é decimal, ponto é
// milhar só quando os grupos são de 3) NÃO é reescrita aqui — este arquivo
// delega para lá. Casa única mantida.
//
// O QUE MUDA É SÓ O CONTRATO DE FALHA, e ele NÃO PODE mudar:
//
//   `parseNumeroBR` devolve `null`   — convenção do app.
//   `parseFloatBR`  devolve `NaN`    — convenção do motor do operador.
//
// Isso não é preferência de estilo. O código dele checa `isNaN(x)` em 14 lugares
// (engine.ts, sepsis.ts, clinical-logic-compat.ts). Se este arquivo devolvesse
// `null`, `isNaN(null)` daria `false` — ou seja, `!isNaN(null)` daria `true` — e
// TODA guarda de "tenho o dado?" passaria a deixar o vazio entrar como se fosse
// medida. Um lactato ausente viraria lactato válido, e o alerta de choque séptico
// passaria a disparar sobre nada.
//
// Por isso a assinatura é NaN, e por isso ela tem teste próprio.
// ============================================================================

import {parseNumeroBR} from '@/lib/clinical/unidades';

/**
 * Lê número no formato brasileiro e devolve `NaN` quando não dá para ler.
 *
 * "1,2" → 1.2 · "1.234,5" → 1234.5 · "113.000" → 113000 · "" → NaN · null → NaN
 *
 * Ausente é `NaN`, nunca 0. Zero é um valor clínico — uma diurese de 0 mL e uma
 * diurese não anotada são coisas opostas à beira do leito.
 */
export function parseFloatBR(bruto: string | number | null | undefined): number {
    return parseNumeroBR(bruto) ?? Number.NaN;
}
