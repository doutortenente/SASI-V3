-- APLICADA no banco vivo em 11-ago-2026, md5 76f40e1211624d76d767660f6602d49b.
-- NAO EDITAR: migration aplicada nao se edita. Se precisar mudar, crie a proxima.

-- Devolve security_invoker as 3 views que o P0 de 10-ago deixou sem a trava.
-- vw_dashboard_uti nasceu com a opcao em 20260808102501 (linha 87) e a perdeu
-- ao ser derrubada e recriada em 20260810083301 (linhas 16 e 83).
-- vw_dispositivos_ativos e vw_janelas_24h_render nasceram sem, em 20260810083409 e 20260810083510.
-- alter view so troca a opcao: nao redefine a consulta.
alter view public.vw_dashboard_uti set (security_invoker = true);
alter view public.vw_dispositivos_ativos set (security_invoker = true);
alter view public.vw_janelas_24h_render set (security_invoker = true);
