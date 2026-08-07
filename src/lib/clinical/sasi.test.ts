import { describe, expect, it } from 'vitest';
import { acuidadeDe, diasTerapia, imc, severidadeVisualDe, stewardshipFlag, triagem } from './sasi';

describe('imc', () => {
  it('calcula IMC igual à coluna gerada no banco (peso 80kg, 175cm → 26.1)', () => {
    expect(imc(80, 175)).toBe(26.1);
  });
  it('dado ausente → null, nunca inventado', () => {
    expect(imc(null, 175)).toBeNull();
    expect(imc(80, null)).toBeNull();
  });
});

describe('severidadeVisualDe', () => {
  it('critico e grave → red', () => {
    expect(severidadeVisualDe('critico')).toBe('red');
    expect(severidadeVisualDe('grave')).toBe('red');
  });
  it('moderado → yellow, estavel → green', () => {
    expect(severidadeVisualDe('moderado')).toBe('yellow');
    expect(severidadeVisualDe('estavel')).toBe('green');
  });
});

describe('acuidadeDe', () => {
  const base = {
    severidade_visual: 'green' as const,
    delta_sofa_24h: 0,
    out_of_range_count: 0,
    pendencias_abertas: 0,
  };
  it('semáforo red → CRITICO, independente do resto', () => {
    expect(acuidadeDe({ ...base, severidade_visual: 'red' })).toBe('CRITICO');
  });
  it('ΔSOFA≥2 → INSTAVEL (Sepsis-3: piora de 2 pontos define disfunção)', () => {
    expect(acuidadeDe({ ...base, delta_sofa_24h: 2 })).toBe('INSTAVEL');
  });
  it('≥3 valores fora de faixa → INSTAVEL', () => {
    expect(acuidadeDe({ ...base, out_of_range_count: 3 })).toBe('INSTAVEL');
  });
  it('tudo normal → ESTAVEL', () => {
    expect(acuidadeDe(base)).toBe('ESTAVEL');
  });
});

describe('triagem', () => {
  it('ordena mais grave primeiro (base do War Room)', () => {
    const rows = [
      { severidade_visual: 'green', delta_sofa_24h: 0, out_of_range_count: 0, pendencias_abertas: 0 },
      { severidade_visual: 'red', delta_sofa_24h: 0, out_of_range_count: 0, pendencias_abertas: 0 },
      { severidade_visual: 'yellow', delta_sofa_24h: 0, out_of_range_count: 1, pendencias_abertas: 0 },
    ] as const;
    const ordenado = triagem([...rows]);
    expect(ordenado.map((r) => r.acuidade)).toEqual(['CRITICO', 'VIGILANCIA', 'ESTAVEL']);
  });
});

describe('stewardship de ATB', () => {
  it('D1 conta como dia 1 (não dia 0)', () => {
    expect(diasTerapia('2026-08-01', '2026-08-01')).toBe(1);
  });
  it('D7 → warning, D14 → critical (janela de revisão de antibiótico)', () => {
    expect(stewardshipFlag(diasTerapia('2026-08-01', '2026-08-07'))).toBe('warning');
    expect(stewardshipFlag(diasTerapia('2026-08-01', '2026-08-14'))).toBe('critical');
    expect(stewardshipFlag(3)).toBe('ok');
  });
});
