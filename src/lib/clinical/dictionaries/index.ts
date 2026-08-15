// ============================================================================
// SASI — Porta única dos dicionários do motor
// ----------------------------------------------------------------------------
// Substitui o `../dictionaries` que o pacote `sasi-motor-clinico-v2` importava.
// DVA_DICT e SEDACAO_DICT NÃO são redeclarados aqui: a tabela real (diluições,
// faixa terapêutica) mora em `../infusoes.ts`, casa única, com teste próprio
// (`infusoes.test.ts`). Este arquivo só reexporta com o nome que o motor espera
// (`DVA`/`SEDACAO` → `DVA_DICT`/`SEDACAO_DICT`).
// ============================================================================

export {DVA as DVA_DICT, SEDACAO as SEDACAO_DICT} from '../infusoes';

/**
 * Escalas neurológicas por nome canônico — a chave é o `EscalaNeuro.nome` que
 * o operador digita (ex.: `'ECG (Glasgow)'`, provado em `../scores/sofa.ts`).
 *
 * NENHUM dos 4 arquivos do pacote consulta este dicionário pelo VALOR — ele só
 * é importado e reexportado (`clinical-logic-compat.ts` do pacote, linhas
 * 36/38), sem uso no corpo de nenhuma função. Por isso a faixa/observação de
 * cada escala aqui é só documentação de referência à beira-leito, não entra em
 * cálculo algum — se algum dia entrar, o código muda, este dicionário não.
 */
export const ESCALAS_NEURO_DICT: Record<string, {rotulo: string; faixa: string; fonte: string}> = {
    'ECG (Glasgow)': {
        rotulo: 'Escala de Coma de Glasgow',
        faixa: '3 a 15 (abertura ocular + resposta verbal + resposta motora)',
        fonte: 'Teasdale G, Jennett B. Lancet 1974;2(7872):81-84.',
    },
    RASS: {
        rotulo: 'Richmond Agitation-Sedation Scale',
        faixa: '-5 (sem resposta) a +4 (combativo); 0 = alerta e calmo',
        fonte: 'Sessler CN et al. Am J Respir Crit Care Med 2002;166(10):1338-1344.',
    },
    'CAM-ICU': {
        rotulo: 'Confusion Assessment Method for the ICU',
        faixa: 'Positivo/Negativo — rastreio de delirium, exige RASS ≥ -3 para aplicar',
        fonte: 'Ely EW et al. JAMA 2001;286(21):2703-2710.',
    },
} as const;
