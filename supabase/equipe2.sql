-- Equipe 2: descrição e fotos do serviço, medidores e conclusão da Etapa 2 pelo PWA, sem login.
-- Executar no SQL Editor do Supabase. Pode ser executado mais de uma vez.

ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS descricao_servico TEXT;
ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS fotos_servico      JSONB DEFAULT '[]';

DROP FUNCTION IF EXISTS public.equipe2_carregar(text);
DROP FUNCTION IF EXISTS public.equipe2_salvar(text, jsonb, boolean);
DROP FUNCTION IF EXISTS public.equipe2_salvar(text, text, text, jsonb, boolean);

-- Notas aguardando Etapa 2 (finalizadas pela equipe 1 ou marcadas pela planilha) cuja Etapa 2 ainda não foi concluída
CREATE OR REPLACE FUNCTION public.equipe2_listar()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(s.x ORDER BY s.x->>'projeto_info_sap', s.x->>'nota'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'nota', n.nota,
      'projeto_info_sap', n.projeto_info_sap,
      'base', n.base,
      'municipio', n.municipio,
      'pep', n.pep,
      'clientes_planilha', coalesce(n.clientes_planilha, '[]'::jsonb),
      'postes', (SELECT count(*) FROM public.campo_registros c WHERE c.nota = n.nota),
      'rascunho', EXISTS (SELECT 1 FROM public.apontamentos a WHERE a.nota = n.nota AND a.rascunho)
    ) AS x
    FROM public.notas_servico n
    WHERE n.ativo
      AND n.status IN ('pendente', 'em_andamento', 'aguardando_etapa2')
      AND NOT EXISTS (SELECT 1 FROM public.apontamentos a WHERE a.nota = n.nota AND NOT a.rascunho)
  ) s
$$;

-- Rascunho salvo para uma nota (para continuar de onde parou)
CREATE OR REPLACE FUNCTION public.equipe2_carregar(p_nota text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
        'descricao', a.descricao_servico,
        'fotos_servico', coalesce(a.fotos_servico, '[]'::jsonb),
        'clientes', a.clientes)
     FROM public.apontamentos a
     WHERE a.nota = p_nota AND a.rascunho
     ORDER BY a.created_at DESC
     LIMIT 1),
    '{}'::jsonb)
$$;

-- Salva o rascunho ou conclui a Etapa 2. Concluir leva a nota direto para Auditar (baixar_medidor),
-- com ou sem a Etapa 1 concluída pela equipe 1.
CREATE OR REPLACE FUNCTION public.equipe2_salvar(
  p_nota text, p_descricao text, p_fotos_servico jsonb, p_clientes jsonb, p_concluir boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n record;
  v_postes int;
  v_pgs text[];
  v_apid uuid;
  v_esperados int;
  v_atendidos int;
BEGIN
  SELECT * INTO n FROM public.notas_servico WHERE nota = p_nota AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTA_NAO_ENCONTRADA'; END IF;
  IF n.status NOT IN ('pendente', 'em_andamento', 'aguardando_etapa2') THEN RAISE EXCEPTION 'NOTA_NAO_AGUARDANDO_ETAPA2'; END IF;

  SELECT count(*)::int, coalesce(array_agg(c.pg_numero ORDER BY c.created_at), '{}'::text[])
    INTO v_postes, v_pgs
  FROM public.campo_registros c WHERE c.nota = p_nota;

  IF jsonb_typeof(p_clientes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'CLIENTES_INVALIDOS'; END IF;
  IF jsonb_typeof(p_fotos_servico) IS DISTINCT FROM 'array' THEN p_fotos_servico := '[]'::jsonb; END IF;
  v_atendidos := jsonb_array_length(p_clientes);
  v_esperados := greatest(jsonb_array_length(coalesce(n.clientes_planilha, '[]'::jsonb)), 1);

  IF p_concluir THEN
    IF coalesce(trim(p_descricao), '') = '' OR jsonb_array_length(p_fotos_servico) = 0 THEN
      RAISE EXCEPTION 'SERVICO_INCOMPLETO';
    END IF;
    IF v_atendidos < v_esperados THEN RAISE EXCEPTION 'CLIENTES_INCOMPLETOS'; END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_clientes) c
      WHERE coalesce(trim(c->>'num_medidor'), '') = '' OR coalesce(c->>'foto_url', '') = ''
    ) THEN
      RAISE EXCEPTION 'MEDIDOR_OU_FOTO_FALTANDO';
    END IF;
  END IF;

  SELECT id INTO v_apid FROM public.apontamentos
  WHERE nota = p_nota AND rascunho ORDER BY created_at DESC LIMIT 1;

  IF v_apid IS NULL THEN
    INSERT INTO public.apontamentos
      (pep, nota, base, postes, pg_numeros, clientes, todos_atendidos, nao_atendidos, qtd_clientes_nota,
       rascunho, descricao_servico, fotos_servico)
    VALUES
      (coalesce(n.pep, ''), p_nota, n.base, v_postes, v_pgs, p_clientes,
       v_atendidos >= v_esperados, '[]'::jsonb, v_atendidos,
       NOT p_concluir, nullif(trim(p_descricao), ''), p_fotos_servico)
    RETURNING id INTO v_apid;
  ELSE
    UPDATE public.apontamentos SET
      pep = coalesce(n.pep, ''),
      base = n.base,
      postes = v_postes,
      pg_numeros = v_pgs,
      clientes = p_clientes,
      todos_atendidos = v_atendidos >= v_esperados,
      nao_atendidos = '[]'::jsonb,
      qtd_clientes_nota = v_atendidos,
      rascunho = NOT p_concluir,
      descricao_servico = nullif(trim(p_descricao), ''),
      fotos_servico = p_fotos_servico,
      atualizado_em = now()
    WHERE id = v_apid;
  END IF;

  DELETE FROM public.clientes WHERE apontamento_id = v_apid;
  INSERT INTO public.clientes (nome, padrao, conta_contrato, num_medidor, foto_url, apontamento_id)
  SELECT c->>'nome', coalesce(c->>'padrao', ''), c->>'conta_contrato', c->>'num_medidor', c->>'foto_url', v_apid
  FROM jsonb_array_elements(p_clientes) c;

  IF p_concluir THEN
    UPDATE public.notas_servico SET status = 'baixar_medidor', updated_at = now() WHERE nota = p_nota;
  END IF;

  RETURN jsonb_build_object('ok', true, 'rascunho', NOT p_concluir, 'postes', v_postes);
END $$;

GRANT EXECUTE ON FUNCTION public.equipe2_listar() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.equipe2_carregar(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.equipe2_salvar(text, text, jsonb, jsonb, boolean) TO anon, authenticated;
