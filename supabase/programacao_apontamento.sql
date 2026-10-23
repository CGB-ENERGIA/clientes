-- Postes apontados manualmente na programação (obras sem registro no app de campo).
-- Executar no SQL Editor do Supabase, depois de programacao_postes.sql e implantacao.sql.
-- Pode ser executado mais de uma vez.

ALTER TABLE public.programacao_notas ADD COLUMN IF NOT EXISTS postes_apontados INTEGER;
ALTER TABLE public.programacao_notas ADD COLUMN IF NOT EXISTS postes_apontados_em TIMESTAMPTZ;

-- Mesma view de programacao_postes.sql, com os postes apontados e a quantidade registrada no app de campo
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
       p.postes,
       p.postes_apontados,
       p.postes_apontados_em,
       (SELECT count(DISTINCT c.pg_numero)
        FROM public.notas_servico n
        JOIN public.campo_registros c ON c.nota = n.nota
        WHERE n.projeto_info_sap = p.nota AND n.ativo AND c.pg_numero ~ '^[0-9]+$') AS postes_campo
FROM public.programacao_notas p
JOIN m ON m.sap = p.nota;

GRANT SELECT ON public.programacao_comparativo TO anon, authenticated;

-- Registra quantos postes foram realmente utilizados numa obra (sem registro no app de campo)
CREATE OR REPLACE FUNCTION public.programacao_apontar_postes(p_sap TEXT, p_qtd INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  atualizados INT;
BEGIN
  IF p_qtd IS NULL OR p_qtd < 0 OR p_qtd > 999 THEN RAISE EXCEPTION 'QUANTIDADE_INVALIDA'; END IF;

  UPDATE public.programacao_notas
  SET postes_apontados = p_qtd, postes_apontados_em = NOW()
  WHERE nota = p_sap;
  GET DIAGNOSTICS atualizados = ROW_COUNT;

  RETURN jsonb_build_object('atualizados', atualizados);
END $$;

REVOKE EXECUTE ON FUNCTION public.programacao_apontar_postes(TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.programacao_apontar_postes(TEXT, INTEGER) TO authenticated;
