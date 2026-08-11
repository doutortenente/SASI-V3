-- APLICADA no banco vivo em 10-ago-2026. Não editar.
-- ============================================================================
-- SASI V3 · P0 · Migration 005 — Expansão do vocabulário de eventos
-- Mata os eventos 'custom' (14 na base) e corrige o órfão 'pas_min'.
-- Doutrina mantida: loinc_code = NULL (ZERO ALUCINAÇÃO — só mapear verificado).
-- faixa_min/max = limites de absurdo fisiológico (sanity flag), não faixa normal.
-- ============================================================================

INSERT INTO public.evento_tipo_ref (codigo, categoria, rotulo, unidade_padrao, faixa_min, faixa_max, loinc_code, ativo, ordem)
VALUES
  ('pas_min',    'vital',     'PAS mínima (janela)',        'mmHg',   30,   300,   NULL, true, 15),
  ('troponina',  'cardio',    'Troponina',                  'ng/mL',  0,    1000,  NULL, true, 10),
  ('probnp',     'cardio',    'NT-proBNP',                  'pg/mL',  0,    200000,NULL, true, 20),
  ('tp',         'coag',      'Tempo de protrombina',       's',      5,    300,   NULL, true, 10),
  ('ttpa',       'coag',      'TTPA',                       's',      10,   400,   NULL, true, 20),
  ('d_dimero',   'coag',      'D-dímero',                   'ng/mL',  0,    200000,NULL, true, 30),
  ('tgo',        'hepato',    'TGO / AST',                  'U/L',    0,    30000, NULL, true, 10),
  ('tgp',        'hepato',    'TGP / ALT',                  'U/L',    0,    30000, NULL, true, 20),
  ('ggt',        'hepato',    'GGT',                        'U/L',    0,    15000, NULL, true, 30),
  ('fa',         'hepato',    'Fosfatase alcalina',         'U/L',    0,    15000, NULL, true, 40),
  ('bd',         'hepato',    'Bilirrubina direta',         'mg/dL',  0,    60,    NULL, true, 50),
  ('bi',         'hepato',    'Bilirrubina indireta',       'mg/dL',  0,    60,    NULL, true, 60),
  ('amilase',    'hepato',    'Amilase',                    'U/L',    0,    10000, NULL, true, 70),
  ('lipase',     'hepato',    'Lipase',                     'U/L',    0,    30000, NULL, true, 80),
  ('dhl',        'hepato',    'DHL / LDH',                  'U/L',    0,    30000, NULL, true, 90),
  ('vhs',        'infecto',   'VHS',                        'mm/h',   0,    200,   NULL, true, 40),
  ('tsh',        'endocrino', 'TSH',                        'µUI/mL', 0,    500,   NULL, true, 10),
  ('t4l',        'endocrino', 'T4 livre',                   'ng/dL',  0,    30,    NULL, true, 20)
ON CONFLICT (codigo) DO NOTHING;

-- 'bb' (categoria infecto) permanece como BILIRRUBINA TOTAL — insumo do SOFA hepático.
