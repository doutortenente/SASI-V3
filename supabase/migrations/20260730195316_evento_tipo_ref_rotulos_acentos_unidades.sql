-- APLICADA no banco vivo em 30-jul-2026. Recuperada de supabase_migrations.schema_migrations
-- em 11-ago-2026, com md5 conferido (3edea34e5b42665ef4e885783709fa0b). NAO EDITAR: migration aplicada nao se edita.
-- Ja consta como aplicada no banco, entao o `pnpm db:push` a pula.

-- evento_tipo_ref: acentos nos rotulos + unidades seguras/corretas (display-only)
update evento_tipo_ref set rotulo = 'pCO₂'                  where codigo = 'pco2';
update evento_tipo_ref set rotulo = 'Relação PaO₂/FiO₂'     where codigo = 'pf_ratio';
update evento_tipo_ref set rotulo = 'pO₂'                   where codigo = 'po2';
update evento_tipo_ref set rotulo = 'Hematócrito'           where codigo = 'ht';
update evento_tipo_ref set rotulo = 'Leucócitos'            where codigo = 'leuco';
update evento_tipo_ref set rotulo = 'Proteína C reativa'    where codigo = 'pcr';
update evento_tipo_ref set rotulo = 'Balanço hídrico acumulado' where codigo = 'bh_acumulado';
update evento_tipo_ref set rotulo = 'Balanço hídrico horário'   where codigo = 'bh_h';
update evento_tipo_ref set rotulo = 'Cálcio'                where codigo = 'ca';
update evento_tipo_ref set rotulo = 'Diurese horária'       where codigo = 'diurese_h';
update evento_tipo_ref set rotulo = 'Potássio'              where codigo = 'k';
update evento_tipo_ref set rotulo = 'Magnésio'              where codigo = 'mg';
update evento_tipo_ref set rotulo = 'Sódio'                 where codigo = 'na';
update evento_tipo_ref set rotulo = 'Fósforo'              where codigo = 'p';
update evento_tipo_ref set rotulo = 'SOFA coagulação'       where codigo = 'sofa_coag';
update evento_tipo_ref set rotulo = 'SOFA hepático'         where codigo = 'sofa_liver';
update evento_tipo_ref set rotulo = 'SOFA neurológico'      where codigo = 'sofa_neuro';
update evento_tipo_ref set rotulo = 'SOFA respiratório'     where codigo = 'sofa_resp';
update evento_tipo_ref set rotulo = 'Frequência cardíaca'   where codigo = 'fc';
update evento_tipo_ref set rotulo = 'Frequência respiratória' where codigo = 'fr';
update evento_tipo_ref set rotulo = 'PA diastólica'         where codigo = 'pa_dia';
update evento_tipo_ref set rotulo = 'PA sistólica'          where codigo = 'pa_sys';
update evento_tipo_ref set rotulo = 'PA média'              where codigo = 'pam';
update evento_tipo_ref set rotulo = 'PA média (mínima)'     where codigo = 'pam_min';
update evento_tipo_ref set rotulo = 'Saturação O₂'          where codigo = 'spo2';
update evento_tipo_ref set unidade_padrao = '×10³/mm³' where codigo in ('leuco', 'plaq');
update evento_tipo_ref set unidade_padrao = '°C'        where codigo = 'temp';
