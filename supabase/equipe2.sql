-- Equipe 2: registra a descrição e a foto do serviço e conclui a Etapa 2 (clientes e medidores) pelo PWA, sem login.
-- Executar no SQL Editor do Supabase. Pode ser executado mais de uma vez.

ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS descricao_servico TEXT;
ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS foto_servico_url   TEXT;

DROP FUNCTION IF EXISTS public.equipe2_carregar(text);
DROP FUNCTION IF EXISTS public.equipe2_salvar(text, jsonb, boolean);

-- Rascunho salvo para uma nota (para continuar de onde parou)
CREATE OR REPLACE FUNCTION public.equipe2_carregar(p_nota text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
        'descricao', a.descricao_servico,
        'foto_servico', a.foto_servico_url,
        'clientes', a.clientes)
     FROM public.apontamentos a
     WHERE a.nota = p_nota AND a.rascunho
     ORDER BY a.created_at DESC
     LIMIT 1),
    '{}'::jsonb)
$$;

-- Salva o rascunho ou conclui a Etapa 2 (status vai para Baixar Medidor)
CREATE OR REPLACE FUNCTION public.equipe2_salvar(
  p_nota text, p_descricao text, p_foto_servico text, p_clientes jsonb, p_concluir boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n record;
  v_postes int;
  v_pgs jsonb;
  v_apid uuid;
  v_esperados int;
  v_atendidos int;
BEGIN
  SELECT * INTO n FROM public.notas_servico WHERE nota = p_nota AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTA_NAO_ENCONTRADA'; END IF;
  IF n.status <> 'em_andamento' THEN RAISE EXCEPTION 'NOTA_NAO_EM_ANDAMENTO'; END IF;

  SELECT count(*)::int, coalesce(jsonb_agg(c.pg_numero ORDER BY c.created_at), '[]'::jsonb)
    INTO v_postes, v_pgs
  FROM public.campo_registros c WHERE c.nota = p_nota;
  IF v_postes = 0 THEN RAISE EXCEPTION 'SEM_POSTES_REGISTRADOS'; END IF;

  IF jsonb_typeof(p_clientes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'CLIENTES_INVALIDOS'; END IF;
  v_atendidos := jsonb_array_length(p_clientes);
  v_esperados := greatest(jsonb_array_length(coalesce(n.clientes_planilha, '[]'::jsonb)), 1);

  IF p_concluir THEN
    IF coalesce(trim(p_descricao), '') = '' OR coalesce(p_foto_servico, '') = '' THEN
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
       rascunho, descricao_servico, foto_servico_url)
    VALUES
      (coalesce(n.pep, ''), p_nota, n.base, v_postes, v_pgs, p_clientes,
       v_atendidos >= v_esperados, '[]'::jsonb, v_atendidos,
       NOT p_concluir, nullif(trim(p_descricao), ''), nullif(p_foto_servico, ''))
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
      foto_servico_url = nullif(p_foto_servico, ''),
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

GRANT EXECUTE ON FUNCTION public.equipe2_carregar(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.equipe2_salvar(text, text, text, jsonb, boolean) TO anon, authenticated;
