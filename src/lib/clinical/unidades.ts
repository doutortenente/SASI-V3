// ============================================================================
// SASI v3 — Guardas de unidade e leitura numérica pt-BR
// ----------------------------------------------------------------------------
// Recriado a partir da spec de `code/scores/sofa.ts` do repositório sasi-import,
// que chama parseFloatBR, coercePlaquetas e coerceFiO2Input. Aquelas
// implementações nunca existiram em arquivo nenhum (a pasta clinical-engine/src
// só tem um INSTRUCOES.md dizendo "cole os 27 arquivos aqui").
//
// Regra da casa: na dúvida sobre unidade, DEVOLVE null + aviso. Nunca adivinha
// em silêncio. Adivinhar unidade de plaqueta foi o defeito que fez o app
// anterior pontuar trombocitose como plaquetopenia grave.
// ============================================================================

/** Resultado de uma leitura que pode não dar certo. `null` = não dá para saber. */
export interface Medida {
    valor: number | null;
    /** Aviso para a tela quando a leitura foi ambígua ou suspeita. */
    aviso?: string | undefined;
    /** O texto original, para o médico conferir contra a fonte. */
    original: string;
}

/**
 * Lê número no formato brasileiro: vírgula decimal, ponto de milhar.
 *
 * "1,2" → 1.2 · "1.234,5" → 1234.5 · "113.000" → 113000 · "" → null
 *
 * O ponto só é tratado como milhar quando vem seguido de exatamente 3 dígitos
 * e há vírgula depois, ou quando não há vírgula nenhuma e os grupos são de 3.
 * Sem essa regra, "1.2" (digitado em inglês) viraria 12.
 */
export function parseNumeroBR(bruto: string | number | null | undefined): number | null {
    if (bruto === null || bruto === undefined) return null;
    if (typeof bruto === 'number') return Number.isFinite(bruto) ? bruto : null;

    const s = bruto.trim();
    if (s === '') return null;

    // Tira tudo que não é dígito, vírgula, ponto ou sinal (unidades coladas, "≈", etc).
    const limpo = s.replace(/[^\d,.\-+]/g, '');
    if (limpo === '' || limpo === '-' || limpo === '+') return null;

    let normalizado: string;
    if (limpo.includes(',')) {
        // Tem vírgula: ela é o decimal, e todo ponto é milhar.
        normalizado = limpo.replace(/\./g, '').replace(',', '.');
    } else if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(limpo)) {
        // Sem vírgula, mas com grupos de 3 depois de cada ponto: milhar. "113.000"
        normalizado = limpo.replace(/\./g, '');
    } else {
        normalizado = limpo;
    }

    const n = Number(normalizado);
    return Number.isFinite(n) ? n : null;
}

/**
 * Normaliza plaquetas para ×10³/µL, que é a unidade dos cutoffs do SOFA.
 *
 * IMPORTANT: este é o defeito medido no banco vivo em 08-ago-2026. As plaquetas
 * estão gravadas em /µL (113.000 a 351.000) enquanto o dicionário
 * `evento_tipo_ref` declara ×10³/µL e a view do SOFA compara com 150/100/50/20.
 * Resultado: 113.000 > 150, o componente de coagulação dava ZERO em todos os
 * pacientes, sempre. Um paciente com 30 mil plaquetas pontuaria 4 e pontuava 0.
 *
 * Quando a unidade é declarada, ela manda. Quando não é, decide pela ordem de
 * grandeza — e AVISA quando o palpite cai na zona ambígua.
 */
export function coercePlaquetas(
    bruto: string | number | null | undefined,
    unidadeDeclarada?: '×10³/µL' | '/µL',
): Medida {
    const original = String(bruto ?? '');
    const n = parseNumeroBR(bruto);
    if (n === null || n <= 0) return {valor: null, original};

    if (unidadeDeclarada === '×10³/µL') return {valor: n, original};
    if (unidadeDeclarada === '/µL') return {valor: n / 1000, original};

    // Sem unidade declarada: decidir pela ordem de grandeza.
    // Plaqueta humana vai de ~2 a ~2000 ×10³/µL, ou ~2.000 a ~2.000.000 /µL.
    if (n >= 1000) return {valor: n / 1000, original};
    if (n <= 2000) return {valor: n, original};

    return {
        valor: null,
        original,
        aviso: `Plaquetas "${original}" sem unidade e fora das duas faixas plausíveis — confirmar se é /µL ou ×10³/µL`,
    };
}

/**
 * Normaliza FiO2 para PERCENTUAL (21 a 100), que é o que a conta de P/F usa.
 *
 * Aceita a fração (0,21) e o percentual (21 ou "21%"). Sem isto, um FiO2
 * digitado como 0,4 daria P/F cem vezes maior e transformaria um paciente
 * em insuficiência respiratória grave em SOFA respiratório zero.
 */
export function coerceFiO2(bruto: string | number | null | undefined): Medida {
    const original = String(bruto ?? '');
    const n = parseNumeroBR(bruto);
    if (n === null || n <= 0) return {valor: null, original};

    // Fração: 0,21 a 1,0 -> vira percentual.
    if (n > 0 && n <= 1) return {valor: n * 100, original};

    if (n >= 21 && n <= 100) return {valor: n, original};

    // Abaixo de 21% não existe em ar respirável; acima de 100% não existe.
    return {
        valor: null,
        original,
        aviso: `FiO2 "${original}" fora da faixa possível (21% a 100%, ou fração de 0,21 a 1,0)`,
    };
}

/**
 * Débito urinário em mL/kg/h, e o volume normalizado para 24 horas.
 *
 * O SOFA renal usa o volume DIÁRIO (menos de 500 mL/dia, menos de 200 mL/dia),
 * então uma coleta de 6 ou 12 horas precisa ser extrapolada antes de comparar —
 * e a extrapolação fica registrada, porque projetar 6 horas em 24 é estimativa,
 * não medida.
 */
export interface DebitoUrinario {
    mlPorKgPorHora: number | null;
    mlEm24h: number | null;
    /** true quando o volume de 24 h veio de extrapolação, não de coleta completa. */
    extrapolado: boolean;
    aviso?: string | undefined;
}

export function calcularDebitoUrinario(
    volumeMl: string | number | null | undefined,
    pesoKg: string | number | null | undefined,
    horas: string | number | null | undefined,
): DebitoUrinario {
    const vol = parseNumeroBR(volumeMl);
    const peso = parseNumeroBR(pesoKg);
    const h = parseNumeroBR(horas);

    if (vol === null || vol < 0 || h === null || h <= 0) {
        return {mlPorKgPorHora: null, mlEm24h: null, extrapolado: false};
    }

    const mlEm24h = Math.round((vol / h) * 24);
    const extrapolado = h < 24;

    if (peso === null || peso <= 0) {
        return {
            mlPorKgPorHora: null,
            mlEm24h,
            extrapolado,
            aviso: 'Sem peso: volume de 24 h calculado, mas mL/kg/h não — peso não se estima',
        };
    }

    const mlPorKgPorHora = Math.round((vol / peso / h) * 100) / 100;
    return {
        mlPorKgPorHora,
        mlEm24h,
        extrapolado,
        aviso: extrapolado
            ? `Coleta de ${h} h projetada para 24 h — o valor diário é estimativa, não medida`
            : undefined,
    };
}
