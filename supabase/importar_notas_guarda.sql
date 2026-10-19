-- Notas com registro no PWA não são expurgadas nem marcadas sem acesso pela planilha de notas.
-- A nota mantém o status de campo e é listada em "conferir_campo" no log da importação.
-- Executar no SQL Editor do Supabase. Pode ser executado mais de uma vez.

CREATE OR REPLACE FUNCTION public.importar_notas(p_registros jsonb, p_desativar_ausentes boolean DEFAULT true, p_forcar boolean DEFAULT false, p_origem text DEFAULT 'manual'::text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_ativas_antes int;
  v_desativar text[];
  v_protegidas text[];
  v_limite int;
  v_rel jsonb;
BEGIN
  IF jsonb_typeof(p_registros) IS DISTINCT FROM 'array' OR jsonb_array_length(p_registros) = 0 THEN
    RAISE EXCEPTION 'Planilha sem notas.';
  END IF;

  DROP TABLE IF EXISTS _imp;
  CREATE TEMP TABLE _imp ON COMMIT DROP AS
  SELECT DISTINCT ON (trim(x.nota))
    trim(x.nota) AS nota, x.projeto_info_sap, x.base, x.pep, x.municipio,
    x.postes, x.qtd_clientes, x.clientes_planilha, x.status_planilha,
    CASE WHEN x.latitude BETWEEN -90 AND 90 AND x.latitude <> 0 THEN x.latitude END AS latitude,
    CASE WHEN x.longitude BETWEEN -180 AND 180 AND x.longitude <> 0 THEN x.longitude END AS longitude
  FROM jsonb_to_recordset(p_registros) AS x(
    nota text, projeto_info_sap text, base text, pep text, municipio text,
    postes int, qtd_clientes int, clientes_planilha jsonb, status_planilha text,
    latitude double precision, longitude double precision)
  WHERE nullif(trim(x.nota), '') IS NOT NULL
  ORDER BY trim(x.nota);

  PERFORM 1 FROM notas_servico n WHERE n.nota IN (SELECT nota FROM _imp) FOR UPDATE;
  SELECT count(*) INTO v_ativas_antes FROM notas_servico WHERE ativo;

  DROP TABLE IF EXISTS _calc;
  CREATE TEMP TABLE _calc ON COMMIT DROP AS
  SELECT i.*,
         n.status AS status_atual,
         (n.nota IS NOT NULL) AS existe,
         coalesce(n.apagada, false) AS apagada,
         EXISTS (SELECT 1 FROM campo_registros r WHERE r.nota = i.nota) AS tem_campo,
         EXISTS (SELECT 1 FROM apontamentos a WHERE a.nota = i.nota AND NOT a.rascunho) AS tem_apont_final,
         NULL::text AS status_final
  FROM _imp i LEFT JOIN notas_servico n ON n.nota = i.nota;

  UPDATE _calc c SET status_final = CASE
    WHEN c.status_planilha IS NULL THEN coalesce(c.status_atual, CASE WHEN c.tem_campo THEN 'em_andamento' ELSE 'pendente' END)
    WHEN NOT c.existe THEN c.status_planilha
    WHEN c.status_planilha IN ('expurgo', 'sem_acesso') THEN
      CASE
        WHEN c.status_atual = 'concluido' AND c.tem_apont_final THEN 'concluido'
        WHEN c.tem_campo THEN CASE WHEN c.status_atual IN ('em_andamento', 'baixar_medidor', 'concluido') THEN c.status_atual ELSE 'em_andamento' END
        ELSE c.status_planilha
      END
    WHEN c.apagada AND c.status_planilha = 'concluido' THEN coalesce(c.status_atual, 'pendente')
    ELSE (
      SELECT s FROM unnest(ARRAY[c.status_planilha, c.status_atual, CASE WHEN c.tem_campo THEN 'em_andamento' END]) s
      WHERE status_rank(s) >= 0 ORDER BY status_rank(s) DESC LIMIT 1
    )
  END
  WHERE true;
  UPDATE _calc SET status_final = coalesce(status_final, status_planilha, 'pendente') WHERE status_final IS NULL;

  INSERT INTO notas_servico AS n (nota, projeto_info_sap, base, pep, municipio, postes, qtd_clientes, clientes_planilha, latitude, longitude, ativo, status, updated_at)
  SELECT nota, projeto_info_sap, coalesce(base, ''), coalesce(pep, ''), municipio, coalesce(postes, 0), coalesce(qtd_clientes, 0),
         coalesce(clientes_planilha, '[]'::jsonb), latitude, longitude, true, status_final, now()
  FROM _calc
  ON CONFLICT (nota) DO UPDATE SET
    projeto_info_sap  = coalesce(nullif(EXCLUDED.projeto_info_sap, ''), n.projeto_info_sap),
    base              = coalesce(nullif(EXCLUDED.base, ''), n.base),
    pep               = coalesce(nullif(EXCLUDED.pep, ''), n.pep),
    municipio         = coalesce(nullif(EXCLUDED.municipio, ''), n.municipio),
    postes            = CASE WHEN EXCLUDED.postes > 0 THEN EXCLUDED.postes ELSE n.postes END,
    qtd_clientes      = CASE WHEN EXCLUDED.clientes_planilha = '[]'::jsonb AND EXCLUDED.qtd_clientes = 0 THEN n.qtd_clientes ELSE EXCLUDED.qtd_clientes END,
    clientes_planilha = CASE WHEN EXCLUDED.clientes_planilha = '[]'::jsonb THEN n.clientes_planilha ELSE EXCLUDED.clientes_planilha END,
    latitude          = coalesce(EXCLUDED.latitude, n.latitude),
    longitude         = coalesce(EXCLUDED.longitude, n.longitude),
    ativo             = true,
    status            = EXCLUDED.status,
    updated_at        = now();

  SELECT
    coalesce(array_agg(n.nota) FILTER (WHERE NOT prot), '{}'),
    coalesce(array_agg(n.nota) FILTER (WHERE prot), '{}')
  INTO v_desativar, v_protegidas
  FROM (
    SELECT n.nota,
      (n.status = 'em_andamento'
        OR EXISTS (SELECT 1 FROM apontamentos a WHERE a.nota = n.nota AND a.rascunho)
        OR EXISTS (SELECT 1 FROM campo_imprevistos i WHERE i.nota = n.nota AND NOT i.resolvido)
        OR (n.status <> 'concluido' AND EXISTS (SELECT 1 FROM campo_registros r WHERE r.nota = n.nota))
      ) AS prot
    FROM notas_servico n
    WHERE n.ativo AND n.nota NOT IN (SELECT nota FROM _imp)
  ) n;

  IF NOT p_desativar_ausentes THEN
    v_desativar := '{}';
  END IF;

  v_limite := greatest(30, (v_ativas_antes * 0.15)::int);
  IF cardinality(v_desativar) > v_limite AND NOT p_forcar THEN
    RAISE EXCEPTION 'DESATIVACAO_EM_MASSA:%:%', cardinality(v_desativar), v_ativas_antes;
  END IF;

  IF cardinality(v_desativar) > 0 THEN
    UPDATE notas_servico SET ativo = false, updated_at = now() WHERE nota = ANY (v_desativar);
  END IF;

  v_rel := jsonb_build_object(
    'total',        (SELECT count(*) FROM _calc),
    'novas',        (SELECT count(*) FROM _calc WHERE NOT existe),
    'atualizadas',  (SELECT count(*) FROM _calc WHERE existe),
    'status_alterados', (SELECT count(*) FROM _calc WHERE existe AND status_final IS DISTINCT FROM status_atual),
    'preservados',  (SELECT coalesce(jsonb_agg(jsonb_build_object('nota', nota, 'sistema', status_atual, 'planilha', status_planilha, 'final', status_final)), '[]')
                     FROM _calc WHERE existe AND status_planilha IS NOT NULL AND status_final <> status_planilha),
    'conflitos',    (SELECT coalesce(jsonb_agg(jsonb_build_object('nota', nota, 'sistema', status_atual, 'planilha', status_planilha)), '[]')
                     FROM _calc WHERE existe AND status_planilha IN ('expurgo', 'sem_acesso') AND status_final = 'concluido'),
    'conferir_campo', (SELECT coalesce(jsonb_agg(jsonb_build_object('nota', nota, 'sistema', status_atual, 'planilha', status_planilha)), '[]')
                     FROM _calc WHERE existe AND tem_campo AND status_planilha IN ('expurgo', 'sem_acesso')),
    'desativadas',  to_jsonb(v_desativar),
    'protegidas',   to_jsonb(v_protegidas)
  );

  INSERT INTO importacoes_log (origem, relatorio) VALUES (p_origem, v_rel);
  RETURN v_rel;
END $function$;
