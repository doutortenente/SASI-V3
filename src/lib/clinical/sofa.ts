// ============================================================================
// SASI v3 — SOFA (Sequential Organ Failure Assessment)
// ----------------------------------------------------------------------------
// FONTE PRIMÁRIA: Singer M, Deutschman CS, Seymour CW, et al. The Third
// International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3).
// JAMA. 2016;315(8):801-810. DOI: 10.1001/jama.2016.0287 — Tabela 2.
//
// Recriado a partir da spec de `code/scores/sofa.ts` do repositório sasi-import,
// que documenta 7 defeitos P0 corrigidos. Os 7 estão honrados aqui:
//   #1 cardiovascular usa a DOSE calculada (peso × diluição), não a vazão
//   #2 neurológico é SUPRIMIDO sob sedação ativa
//   #5 respiratório 3 e 4 exigem ventilação invasiva
//   #6 renal cruza creatinina COM débito urinário e terapia dialítica
//   #7 toda leitura numérica passa por parseNumeroBR (vírgula decimal)
//   #9 FiO2 normalizada antes da relação P/F
//   #11 cardiovascular usa a PAM MÍNIMA (o pior valor), não a máxima
//
// O código da fonte NÃO compila (faltam 9 módulos que nunca foram escritos).
// Vale a regra, não o arquivo — recriado módulo a módulo, com teste.
// ============================================================================
import { DVA, calcularDose } from '@/lib/clinical/infusoes';
import {
  calcularDebitoUrinario,
  coerceFiO2,
  coercePlaquetas,
  parseNumeroBR,
} from '@/lib/clinical/unidades';

export type PontoSofa = 0 | 1 | 2 | 3 | 4;
export type SistemaSofa = 'resp' | 'coag' | 'hepatico' | 'cardio' | 'neuro' | 'renal';

/**
 * O resultado de um componente.
 *
 * `pontos: null` significa NÃO CALCULÁVEL — falta dado. É diferente de 0, que
 * significa "medido e sem disfunção". Somar null como 0 é o defeito que faz um
 * SOFA aparecer baixo em paciente grave só porque ninguém colheu o exame.
 */
export interface ComponenteSofa {
  pontos: PontoSofa | null;
  /** O que faltou, quando `pontos` é null. */
  faltou?: string | undefined;
  /** Explicação do valor, para a tela e para a auditoria. */
  detalhe?: string | undefined;
  /** Ressalva clínica: o componente pontuou, mas com uma condição relevante. */
  ressalva?: string | undefined;
  /** Componente deliberadamente não pontuado (hoje: neuro sob sedação). */
  suprimido?: string | undefined;
}

export interface ResultadoSofa {
  /**
   * Total do SOFA — `null` enquanto QUALQUER um dos 6 componentes não for
   * calculável.
   *
   * IMPORTANT: é uma divergência deliberada da fonte, que somava componente
   * ausente como 0 e exibia um total. Um "SOFA 3" apurado sobre 1 de 6 sistemas
   * é um número que parece medido e não é — e é o número grande que o olho pega
   * às 3 da manhã. Aqui, incompleto é `null`, e a tela mostra travessão.
   */
  total: number | null;
  /** Soma do que foi possível apurar. Sempre acompanhado de `apurados`. */
  parcial: number;
  /** Quantos dos 6 sistemas foram calculáveis. */
  apurados: number;
  componentes: Record<SistemaSofa, ComponenteSofa>;
  faltando: string[];
  ressalvas: string[];
}

// ---------------------------------------------------------------------------
// 1. Respiratório — relação PaO2/FiO2
// ---------------------------------------------------------------------------
/**
 * DEFEITO P0 #5: os pontos 3 e 4 exigem ventilação mecânica invasiva.
 * Sem ela, a Tabela 2 de Singer 2016 não permite passar de 2. Um P/F de 90 em
 * ar ambiente é grave e merece alarme — mas não é SOFA respiratório 4.
 */
export function sofaResp(
  pao2: string | number | null | undefined,
  fio2: string | number | null | undefined,
  emVentilacaoInvasiva: boolean,
): ComponenteSofa {
  const p = parseNumeroBR(pao2);
  if (p === null || p <= 0) return { pontos: null, faltou: 'PaO2' };

  const f = coerceFiO2(fio2);
  if (f.valor === null) return { pontos: null, faltou: 'FiO2', ressalva: f.aviso };

  const pf = Math.round((p / f.valor) * 100);
  const vm = emVentilacaoInvasiva;

  let pontos: PontoSofa;
  let ressalva: string | undefined;

  if (pf >= 400) pontos = 0;
  else if (pf >= 300) pontos = 1;
  else if (pf >= 200) pontos = 2;
  else if (pf >= 100) {
    pontos = vm ? 3 : 2;
    if (!vm) ressalva = `P/F ${pf} daria 3 pontos, mas exige ventilação invasiva — pontuado 2`;
  } else {
    pontos = vm ? 4 : 3;
    if (!vm) ressalva = `P/F ${pf} daria 4 pontos, mas exige ventilação invasiva — pontuado 3`;
  }

  return { pontos, detalhe: `P/F ${pf}${vm ? ', em ventilação invasiva' : ''}`, ressalva };
}

// ---------------------------------------------------------------------------
// 2. Coagulação — plaquetas
// ---------------------------------------------------------------------------
/** Cutoffs em ×10³/µL. A normalização de unidade mora em `coercePlaquetas`. */
export function sofaCoag(
  plaquetas: string | number | null | undefined,
  unidade?: '×10³/µL' | '/µL',
): ComponenteSofa {
  const m = coercePlaquetas(plaquetas, unidade);
  if (m.valor === null) {
    return { pontos: null, faltou: 'Plaquetas', ressalva: m.aviso };
  }
  const v = m.valor;
  const pontos: PontoSofa = v < 20 ? 4 : v < 50 ? 3 : v < 100 ? 2 : v < 150 ? 1 : 0;
  return { pontos, detalhe: `Plaquetas ${v} ×10³/µL`, ressalva: m.aviso };
}

// ---------------------------------------------------------------------------
// 3. Hepático — bilirrubina total
// ---------------------------------------------------------------------------
export function sofaHepatico(bilirrubina: string | number | null | undefined): ComponenteSofa {
  const bb = parseNumeroBR(bilirrubina);
  if (bb === null || bb < 0) return { pontos: null, faltou: 'Bilirrubina total' };
  const pontos: PontoSofa = bb >= 12 ? 4 : bb >= 6 ? 3 : bb >= 2 ? 2 : bb >= 1.2 ? 1 : 0;
  return { pontos, detalhe: `Bilirrubina ${bb} mg/dL` };
}

// ---------------------------------------------------------------------------
// 4. Cardiovascular — PAM e vasopressores
// ---------------------------------------------------------------------------
/**
 * Droga que a Tabela 2 de Singer 2016 usa para pontuar. Vasodilatador e
 * betabloqueador NÃO entram.
 *
 * DIVERGÊNCIA DELIBERADA DA FONTE: o `sofa.ts` do sasi-import dá 2 pontos para
 * "outros vasopressores (Nipride, Tridil, Esmolol)". Nenhum dos três é
 * vasopressor — nitroprussiato e nitroglicerina são vasodilatadores e esmolol é
 * betabloqueador, todos usados para BAIXAR pressão. Pontuá-los como suporte
 * hemodinâmico inverte o sentido clínico: um paciente em nitroglicerina por
 * crise hipertensiva ganharia pontos de falência circulatória.
 *
 * Isto importa no dado real: UTI2-L04 está com nitroglicerina correndo.
 */
const PONTUA_CARDIO: ReadonlySet<string> = new Set([
  'Noradrenalina',
  'Adrenalina',
  'Dobutamina',
  'Vasopressina',
  'Dopamina',
]);

export interface InfusaoParaSofa {
  droga: string;
  /** Índice na tabela de diluições de `infusoes.ts`. */
  diluicao?: number;
  vazaoMlH?: string | number | null;
}

export function sofaCardio(
  pamMinima: string | number | null | undefined,
  dvas: InfusaoParaSofa[],
  pesoKg: string | number | null | undefined,
): ComponenteSofa {
  const queContam = dvas.filter((d) => d?.droga && PONTUA_CARDIO.has(d.droga));

  // Sem vasopressor: pontua pela PAM. DEFEITO P0 #11 — é a MÍNIMA, o pior valor.
  if (queContam.length === 0) {
    const pam = parseNumeroBR(pamMinima);
    if (pam === null) return { pontos: null, faltou: 'PAM mínima' };
    return pam < 70
      ? { pontos: 1, detalhe: `PAM mínima ${pam} mmHg, sem vasopressor` }
      : { pontos: 0, detalhe: `PAM mínima ${pam} mmHg` };
  }

  let pior: PontoSofa = 0;
  const partes: string[] = [];
  const ressalvas: string[] = [];

  for (const d of queContam) {
    // DEFEITO P0 #1: a dose vem do cálculo com peso e diluição, nunca da vazão.
    const r = calcularDose(d.droga, d.diluicao ?? 0, d.vazaoMlH, pesoKg, DVA);

    if (!r.ok) {
      // Sem dose calculável, a droga não deixa de existir. Conta o piso da
      // classe e diz por que não deu para precisar.
      const piso: PontoSofa = d.droga === 'Dobutamina' ? 2 : 3;
      pior = Math.max(pior, piso) as PontoSofa;
      partes.push(`${d.droga} (dose não calculável)`);
      ressalvas.push(
        `${d.droga}: ${r.motivo === 'peso-necessario' ? 'sem peso, dose não calculada' : 'vazão ausente ou inválida'} — pontuado o piso da classe (${piso})`,
      );
      continue;
    }

    const dose = r.dose.valor;
    let p: PontoSofa;

    if (d.droga === 'Dobutamina') {
      p = 2; // qualquer dose
    } else if (d.droga === 'Dopamina') {
      p = dose > 15 ? 4 : dose > 5 ? 3 : 2;
    } else if (d.droga === 'Noradrenalina' || d.droga === 'Adrenalina') {
      p = dose > 0.1 ? 4 : 3; // cutoff em mcg/kg/min
    } else {
      // Vasopressina: adjuvante, sem cutoff próprio na Tabela 2 de Singer 2016.
      p = 3;
      ressalvas.push('Vasopressina não tem ponto de corte próprio no SOFA — tratada como 3');
    }

    pior = Math.max(pior, p) as PontoSofa;
    partes.push(`${d.droga} ${dose} ${r.dose.unidade}`);
  }

  return {
    pontos: pior,
    detalhe: partes.join(' · '),
    ressalva: ressalvas.length > 0 ? ressalvas.join(' · ') : undefined,
  };
}

// ---------------------------------------------------------------------------
// 5. Neurológico — Escala de Coma de Glasgow
// ---------------------------------------------------------------------------
/**
 * DEFEITO P0 #2: sob sedação ativa, o Glasgow mede a droga, não o cérebro.
 * O componente é SUPRIMIDO, salvo quando existe um Glasgow pré-sedação
 * documentado — aí ele é usado, e a tela diz que é pré-sedação.
 *
 * Suprimido devolve `pontos: null`, não 0: o sistema não foi avaliado.
 */
export function sofaNeuro(
  glasgow: string | number | null | undefined,
  sobSedacao: boolean,
  glasgowPreSedacao?: string | number | null,
): ComponenteSofa {
  if (sobSedacao && (glasgowPreSedacao === null || glasgowPreSedacao === undefined)) {
    return {
      pontos: null,
      suprimido:
        'Neurológico suprimido: sedação ativa. O Glasgow reflete a droga, não a lesão. ' +
        'Registrar o Glasgow pré-sedação para poder pontuar.',
    };
  }

  const usado = sobSedacao ? glasgowPreSedacao : glasgow;
  const g = parseNumeroBR(usado);
  if (g === null) return { pontos: null, faltou: 'Glasgow' };
  if (g < 3 || g > 15) {
    return { pontos: null, faltou: 'Glasgow', ressalva: `Glasgow ${g} fora da escala (3 a 15)` };
  }

  const pontos: PontoSofa = g < 6 ? 4 : g <= 9 ? 3 : g <= 12 ? 2 : g <= 14 ? 1 : 0;
  return {
    pontos,
    detalhe: `Glasgow ${g}${sobSedacao ? ' (pré-sedação)' : ''}`,
  };
}

// ---------------------------------------------------------------------------
// 6. Renal — creatinina cruzada com débito urinário e diálise
// ---------------------------------------------------------------------------
/**
 * DEFEITO P0 #6: pontuar só por creatinina perde a lesão renal oligúrica.
 * O escore é o PIOR entre os dois eixos, e terapia dialítica é 4.
 *
 * DIVERGÊNCIA DELIBERADA DA FONTE: o `sofa.ts` do sasi-import converte o
 * estágio KDIGO em pontos de SOFA. A Tabela 2 de Singer 2016 não usa KDIGO —
 * usa o volume urinário DIÁRIO: menos de 500 mL/dia vale 3, menos de
 * 200 mL/dia vale 4. É esse o critério implementado aqui.
 */
export function sofaRenal(
  creatinina: string | number | null | undefined,
  diureseMl: string | number | null | undefined,
  pesoKg: string | number | null | undefined,
  horasDeColeta: string | number | null | undefined,
  emDialise?: boolean,
): ComponenteSofa {
  if (emDialise) return { pontos: 4, detalhe: 'Terapia dialítica ativa' };

  const cr = parseNumeroBR(creatinina);
  const porCr: PontoSofa | null =
    cr === null || cr <= 0 ? null : cr >= 5 ? 4 : cr >= 3.5 ? 3 : cr >= 2 ? 2 : cr >= 1.2 ? 1 : 0;

  const du = calcularDebitoUrinario(diureseMl, pesoKg, horasDeColeta);
  const porDu: PontoSofa | null =
    du.mlEm24h === null ? null : du.mlEm24h < 200 ? 4 : du.mlEm24h < 500 ? 3 : 0;

  if (porCr === null && porDu === null) {
    return { pontos: null, faltou: 'Creatinina e débito urinário' };
  }

  const pontos = Math.max(porCr ?? 0, porDu ?? 0) as PontoSofa;
  const partes: string[] = [];
  if (cr !== null) partes.push(`creatinina ${cr} mg/dL`);
  if (du.mlEm24h !== null) partes.push(`diurese ${du.mlEm24h} mL/24 h`);

  const ressalvas: string[] = [];
  if (du.aviso) ressalvas.push(du.aviso);
  if (porCr !== null && porDu !== null && porDu > porCr) {
    ressalvas.push(
      `Oligúria eleva o renal de ${porCr} para ${pontos} — lesão renal pelo débito, não pela creatinina`,
    );
  }
  if (porCr === null) ressalvas.push('Sem creatinina: pontuado só pelo débito urinário');
  if (porDu === null) ressalvas.push('Sem débito urinário: pontuado só pela creatinina');

  return {
    pontos,
    detalhe: partes.join(' · '),
    ressalva: ressalvas.length > 0 ? ressalvas.join(' · ') : undefined,
  };
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------
export interface EntradaSofa {
  pao2?: string | number | null;
  fio2?: string | number | null;
  ventilacaoInvasiva?: boolean;
  plaquetas?: string | number | null;
  plaquetasUnidade?: '×10³/µL' | '/µL';
  bilirrubina?: string | number | null;
  pamMinima?: string | number | null;
  dvas?: InfusaoParaSofa[];
  pesoKg?: string | number | null;
  glasgow?: string | number | null;
  sobSedacao?: boolean;
  glasgowPreSedacao?: string | number | null;
  creatinina?: string | number | null;
  diureseMl?: string | number | null;
  horasDeColeta?: string | number | null;
  emDialise?: boolean;
}

const ROTULO: Record<SistemaSofa, string> = {
  resp: 'Respiratório',
  coag: 'Coagulação',
  hepatico: 'Hepático',
  cardio: 'Cardiovascular',
  neuro: 'Neurológico',
  renal: 'Renal',
};

/** SOFA completo. Total só existe quando os 6 sistemas foram apurados. */
export function calcularSofa(e: EntradaSofa): ResultadoSofa {
  const componentes: Record<SistemaSofa, ComponenteSofa> = {
    resp: sofaResp(e.pao2, e.fio2, e.ventilacaoInvasiva === true),
    coag: sofaCoag(e.plaquetas, e.plaquetasUnidade),
    hepatico: sofaHepatico(e.bilirrubina),
    cardio: sofaCardio(e.pamMinima, e.dvas ?? [], e.pesoKg),
    neuro: sofaNeuro(e.glasgow, e.sobSedacao === true, e.glasgowPreSedacao),
    renal: sofaRenal(e.creatinina, e.diureseMl, e.pesoKg, e.horasDeColeta, e.emDialise),
  };

  const chaves = Object.keys(componentes) as SistemaSofa[];
  const apurados = chaves.filter((k) => componentes[k].pontos !== null);
  const parcial = apurados.reduce((s, k) => s + (componentes[k].pontos ?? 0), 0);

  const faltando = chaves
    .filter((k) => componentes[k].pontos === null)
    .map((k) => `${ROTULO[k]}: ${componentes[k].suprimido ?? componentes[k].faltou ?? 'sem dado'}`);

  const ressalvas = chaves
    .map((k) => componentes[k].ressalva)
    .filter((r): r is string => typeof r === 'string');

  return {
    total: apurados.length === chaves.length ? parcial : null,
    parcial,
    apurados: apurados.length,
    componentes,
    faltando,
    ressalvas,
  };
}
