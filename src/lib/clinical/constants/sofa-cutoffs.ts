// ============================================================================
// SASI — Pontos de corte do SOFA
// ----------------------------------------------------------------------------
// LEIA O PORQUÊ DE ESTE ARQUIVO SER TÃO CURTO — ele foi encolhido de propósito.
//
// O app JÁ TEM um SOFA completo e em uso: `src/lib/clinical/sofa.ts`, 430 linhas,
// 425 de teste, todos os 7 defeitos P0 honrados. Ele carrega os cortes das seis
// tabelas DENTRO das próprias funções, cada um ao lado do comentário que o
// justifica:
//
//   respiratório  P/F 400 · 300 · 200 · 100      sofa.ts:121-130
//   coagulação    plaquetas 150 · 100 · 50 · 20  sofa.ts:148
//   hepático      bilirrubina 1,2 · 2 · 6 · 12   sofa.ts:158
//   cardiovascular PAM 70 · dopamina 5 e 15      sofa.ts:204 e :235
//   neurológico   Glasgow 14 · 12 · 9 · 6        sofa.ts:286
//   renal         creatinina 1,2 · 2 · 3,5 · 5   sofa.ts:316
//                 diurese 500 e 200 mL/24 h      sofa.ts:320
//
// COPIAR ESSES NÚMEROS PARA CÁ SERIA O DEFEITO, NÃO A ORGANIZAÇÃO: passariam a
// existir em dois lugares, e um dia um muda e o outro não. Enquanto o médico não
// decidir qual SOFA fica (ver a lista PARA O MEDICO DECIDIR), a casa deles é o
// arquivo onde eles já rodam.
//
// Aqui mora só o que o código NOVO consome e que não tem casa em outro lugar.
// ============================================================================

/**
 * Cortes do SOFA usados pelo código novo deste diretório.
 *
 * FONTE: Singer M, Deutschman CS, Seymour CW, et al. The Third International
 * Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA.
 * 2016;315(8):801-810. DOI: 10.1001/jama.2016.0287 — Tabela 2.
 */
export const SOFA_CUTOFFS = {
    /**
     * Dose de noradrenalina ou adrenalina, em mcg/kg/min, acima da qual o
     * componente cardiovascular vale 4 em vez de 3.
     *
     * Consumido por `isVasopressorHighDose` em `calculations/infusao.ts`.
     *
     * ORIGEM DO NÚMERO: o próprio operador o escreve duas vezes no pacote — no
     * cabeçalho de sofa.ts:264-265 ("Noradrenalina/Epinefrina ≤ 0.1 mcg/kg/min" /
     * "> 0.1 mcg/kg/min") e no detalhe que ele imprime em sofa.ts:347
     * (`Nor/Epi ${doseStr} > 0.1`).
     *
     * DUPLICATA CONHECIDA, e é o item 1 da lista PARA O MEDICO DECIDIR: o mesmo
     * 0,1 está cravado em `src/lib/clinical/sofa.ts:237`. Não foi unificado
     * porque unificar significa editar o SOFA que roda hoje em produção, e a
     * ordem foi não tocar nele até o médico decidir qual dos dois fica.
     * Comparador ESTRITO (`>`), como nos dois lados.
     */
    CARDIO_NOR_EPI_ALTA_DOSE: 0.1,
} as const;
