-- F0 / Seção D — save_ficha na versão de produção (Anexo A, seção 4).
-- Aplicada em 08-ago-2026 no projeto idswehsvvqczzkiatuzu.
--
-- security definer + carimbo de user_id + guarda de dono.
-- Verificado antes de aplicar: os 15 pacientes têm user_id nulo, então
-- "(user_id is null or user_id = v_uid)" passa em todos com auth.uid() nulo.
-- Continua correta se o login for ligado depois.
--
-- Consequência conhecida e aceita: os advisors passam a apontar save_ficha como
-- função `security definer` chamável por anon via /rest/v1/rpc/save_ficha. Com a
-- dev_bypass ativa isso não abre porta nova — quem alcança a API já escreve em
-- qualquer tabela direto. O aviso some junto com a dev_bypass, se um dia sair.

create or replace function public.save_ficha(
  p_paciente_id uuid, p_pac jsonb, p_evol jsonb, p_evolucao_id uuid, p_plantao text, p_pendencias jsonb default '[]'::jsonb)
  returns uuid language plpgsql security definer set search_path to 'public','pg_catalog' as $$
declare v_evol_id uuid; v_uid uuid := auth.uid(); pend jsonb;
begin
  update pacientes set
    nome = coalesce(p_pac->>'nome', nome), leito = coalesce(p_pac->>'leito', leito),
    hd = p_pac->>'hd', idade = nullif(p_pac->>'idade','')::int,
    peso = nullif(p_pac->>'peso','')::numeric, altura = nullif(p_pac->>'altura','')::numeric,
    alergias = p_pac->>'alergias',
    gravidade = coalesce(nullif(p_pac->>'gravidade','')::public.gravidade_enum, gravidade),
    data_adm = coalesce(nullif(p_pac->>'data_adm','')::date, data_adm)
  where id = p_paciente_id and (user_id is null or user_id = v_uid);
  if not found then raise exception 'paciente % nao encontrado ou sem permissao', p_paciente_id; end if;

  if p_evolucao_id is not null then
    update evolucoes set
      neuro=coalesce(p_evol->'neuro','{}'::jsonb), resp=coalesce(p_evol->'resp','{}'::jsonb),
      hemo=coalesce(p_evol->'hemo','{}'::jsonb), tgi=coalesce(p_evol->'tgi','{}'::jsonb),
      renal=coalesce(p_evol->'renal','{}'::jsonb), hemato=coalesce(p_evol->'hemato','{}'::jsonb),
      infecto=coalesce(p_evol->'infecto','{}'::jsonb), dvas=coalesce(p_evol->'dvas','[]'::jsonb),
      sedativos=coalesce(p_evol->'sedativos','[]'::jsonb),
      impressao=coalesce(array(select jsonb_array_elements_text(p_evol->'impressao')),'{}'),
      conduta=coalesce(array(select jsonb_array_elements_text(p_evol->'conduta')),'{}'),
      problemas_ativos=coalesce(p_evol->'problemas_ativos','[]'::jsonb),
      condutas_sistemas=coalesce(p_evol->'condutas_sistemas','[]'::jsonb),
      riscos=coalesce(p_evol->'riscos','[]'::jsonb)
    where id = p_evolucao_id returning id into v_evol_id;
    if v_evol_id is null then raise exception 'evolucao % nao encontrada', p_evolucao_id; end if;
  else
    insert into evolucoes (paciente_id, user_id, data_evolucao, plantao, neuro, resp, hemo, tgi, renal, hemato, infecto,
      dvas, sedativos, impressao, conduta, problemas_ativos, condutas_sistemas, riscos, sofa_snapshot)
    values (p_paciente_id, v_uid, now(), p_plantao::public.plantao_enum,
      coalesce(p_evol->'neuro','{}'::jsonb), coalesce(p_evol->'resp','{}'::jsonb), coalesce(p_evol->'hemo','{}'::jsonb),
      coalesce(p_evol->'tgi','{}'::jsonb), coalesce(p_evol->'renal','{}'::jsonb), coalesce(p_evol->'hemato','{}'::jsonb),
      coalesce(p_evol->'infecto','{}'::jsonb), coalesce(p_evol->'dvas','[]'::jsonb), coalesce(p_evol->'sedativos','[]'::jsonb),
      coalesce(array(select jsonb_array_elements_text(p_evol->'impressao')),'{}'),
      coalesce(array(select jsonb_array_elements_text(p_evol->'conduta')),'{}'),
      coalesce(p_evol->'problemas_ativos','[]'::jsonb), coalesce(p_evol->'condutas_sistemas','[]'::jsonb),
      coalesce(p_evol->'riscos','[]'::jsonb), '{}'::jsonb)
    returning id into v_evol_id;
  end if;

  for pend in select * from jsonb_array_elements(coalesce(p_pendencias,'[]'::jsonb)) loop
    if coalesce(pend->>'id','') <> '' then
      update pendencias set tarefa=pend->>'tarefa', concluida=coalesce((pend->>'concluida')::boolean,false),
        concluida_at=case when (pend->>'concluida')::boolean then now() else null end
      where id = (pend->>'id')::uuid;
    elsif coalesce(pend->>'tarefa','') <> '' then
      insert into pendencias (paciente_id, user_id, tarefa, prioridade, concluida)
      values (p_paciente_id, v_uid, pend->>'tarefa', 2, coalesce((pend->>'concluida')::boolean,false));
    end if;
  end loop;
  return v_evol_id;
end; $$;
