-- APLICADA no banco vivo em 10-ago-2026. Não editar.
-- ============================================================================
-- SASI V3 · P0 · Migration 007 — Vocabulário da FOLHA de controles/balanço
-- Os 14 eventos 'custom' reais não eram labs: eram dados de folha de balanço
-- (diurese 24h por leito, PVC, UF de diálise, débito de dreno, diurese parcial).
-- faixa_min/max = limite de absurdo fisiológico. loinc_code NULL (zero alucinação).
-- ============================================================================

INSERT INTO public.evento_tipo_ref (codigo, categoria, rotulo, unidade_padrao, faixa_min, faixa_max, loinc_code, ativo, ordem)
VALUES
  ('pvc',             'vital', 'PVC',                                   'mmHg', -5, 50,    NULL, true, 60),
  ('diurese_24h',     'renal', 'Diurese total (janela 24h)',            'mL',    0, 15000, NULL, true, 12),
  ('diurese_parcial', 'renal', 'Diurese em janela parcial (ver json)',  'mL',    0, 15000, NULL, true, 13),
  ('uf_dialise',      'renal', 'Ultrafiltração em diálise (sessão)',    'mL',    0, 10000, NULL, true, 14),
  ('debito_dreno',    'renal', 'Débito de dreno (24h)',                 'mL',    0, 5000,  NULL, true, 15)
ON CONFLICT (codigo) DO NOTHING;
