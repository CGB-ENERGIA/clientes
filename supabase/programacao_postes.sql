-- Postes de concreto por nota (coluna CONCRETO da planilha), exibidos como "Poste" na programação completa.
-- Executar no SQL Editor do Supabase, depois de programacao_guarda.sql. Pode ser executado mais de uma vez.

ALTER TABLE public.programacao_notas ADD COLUMN IF NOT EXISTS postes INTEGER DEFAULT 0;

-- Mesma função de programacao_painel.sql, passando também os postes
CREATE OR REPLACE FUNCTION public.importar_programacao(p_registros JSONB, p_origem TEXT, p_arquivo TEXT, p_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  gravadas INT;
  removidas INT;
  imp_id BIGINT;
BEGIN
  IF p_registros IS NULL OR jsonb_array_length(p_registros) = 0 THEN
    RAISE EXCEPTION 'PLANILHA_VAZIA';
  END IF;

  DELETE FROM public.programacao_notas p
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_registros) AS x(nota TEXT) WHERE x.nota = p.nota
  );
  GET DIAGNOSTICS removidas = ROW_COUNT;

  INSERT INTO public.programacao_notas AS d
    (nota, pep, municipio, equipe, supervisor, status, data_programada, motivo, observacao, linhas,
     ultimo_status, ultimo_evento, postes, atualizado_em)
  SELECT x.nota, x.pep, x.municipio, x.equipe, x.supervisor, x.status, x.data_programada,
         x.motivo, x.observacao, x.linhas, x.ultimo_status, x.ultimo_evento, x.postes, NOW()
  FROM jsonb_to_recordset(p_registros) AS x(
    nota TEXT, pep TEXT, municipio TEXT, equipe TEXT, supervisor TEXT, status TEXT,
    data_programada DATE, motivo TEXT, observacao TEXT, linhas INTEGER,
    ultimo_status TEXT, ultimo_evento DATE, postes INTEGER)
  ON CONFLICT (nota) DO UPDATE SET
    pep = EXCLUDED.pep, municipio = EXCLUDED.municipio, equipe = EXCLUDED.equipe,
    supervisor = EXCLUDED.supervisor, status = EXCLUDED.status,
    data_programada = EXCLUDED.data_programada, motivo = EXCLUDED.motivo,
    observacao = EXCLUDED.observacao, linhas = EXCLUDED.linhas,
    ultimo_status = EXCLUDED.ultimo_status, ultimo_evento = EXCLUDED.ultimo_evento,
    postes = EXCLUDED.postes,
    atualizado_em = NOW();
  GET DIAGNOSTICS gravadas = ROW_COUNT;

  INSERT INTO public.programacao_importacoes (origem, arquivo, hash, linhas, notas)
  VALUES (p_origem, p_arquivo, p_hash, jsonb_array_length(p_registros), gravadas)
  RETURNING id INTO imp_id;

  INSERT INTO public.programacao_snapshots (importacao_id, nota, status, ultimo_status, ultimo_evento, equipe, municipio)
  SELECT imp_id, x.nota, x.status, x.ultimo_status, x.ultimo_evento, x.equipe, x.municipio
  FROM jsonb_to_recordset(p_registros) AS x(
    nota TEXT, status TEXT, ultimo_status TEXT, ultimo_evento DATE, equipe TEXT, municipio TEXT);

  RETURN jsonb_build_object('notas', gravadas, 'removidas', removidas);
END $$;

-- Mesma view de programacao_guarda.sql, com a coluna postes no final
CREATE OR REPLACE VIEW public.programacao_comparativo AS
WITH m AS (
  SELECT p.nota AS sap,
         COUNT(n.nota)      AS qtd,
         MIN(n.nota)        AS nota_sistema,
         MIN(n.status)      AS status_sistema,
         COALESCE(BOOL_OR(EXISTS (SELECT 1 FROM public.campo_registros c WHERE c.nota = n.nota)), false) AS tem_campo,
         COALESCE(jsonb_agg(jsonb_build_object('nota', n.nota, 'pep', n.pep, 'status', n.status)
                            ORDER BY n.nota) FILTER (WHERE n.nota IS NOT NULL), '[]'::jsonb) AS notas_sistema
  FROM public.programacao_notas p
  LEFT JOIN public.notas_servico n ON n.projeto_info_sap = p.nota AND n.ativo
  GROUP BY p.nota
)
SELECT p.nota AS sap,
       p.pep, p.municipio, p.equipe, p.supervisor,
       p.status AS status_programacao,
       p.data_programada, p.motivo, p.observacao, p.atualizado_em,
       m.qtd, m.nota_sistema, m.status_sistema,
       CASE
         WHEN m.qtd = 0 THEN 'sem_correspondencia'
         WHEN m.qtd > 1 THEN 'conferir'
         WHEN p.status = 'REPROGRAMAR' AND m.tem_campo THEN 'conferir'
         ELSE public.programacao_acao(p.status, m.status_sistema)
       END AS acao,
       m.notas_sistema,
       p.ultimo_status,
       p.ultimo_evento,
       p.postes
FROM public.programacao_notas p
JOIN m ON m.sap = p.nota;

GRANT SELECT ON public.programacao_comparativo TO anon, authenticated;
