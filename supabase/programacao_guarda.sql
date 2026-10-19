-- Proteção do trabalho de campo: reprogramação nunca volta o status de nota com registro no PWA.
-- Executar no SQL Editor do Supabase, depois de programacao.sql e programacao_painel.sql.
-- Pode ser executado mais de uma vez.

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
       p.ultimo_evento
FROM public.programacao_notas p
JOIN m ON m.sap = p.nota;

CREATE OR REPLACE FUNCTION public.aplicar_programacao(p_saps TEXT[] DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  aplicados INT;
BEGIN
  UPDATE public.notas_servico ns
  SET status = public.programacao_novo_status(p.status, ns.status),
      updated_at = NOW()
  FROM public.programacao_notas p
  WHERE ns.projeto_info_sap = p.nota
    AND ns.ativo
    AND (p_saps IS NULL OR p.nota = ANY(p_saps))
    AND public.programacao_novo_status(p.status, ns.status) IS NOT NULL
    AND NOT (p.status = 'REPROGRAMAR' AND EXISTS (SELECT 1 FROM public.campo_registros c WHERE c.nota = ns.nota))
    AND (SELECT COUNT(*) FROM public.notas_servico x
         WHERE x.projeto_info_sap = p.nota AND x.ativo) = 1;
  GET DIAGNOSTICS aplicados = ROW_COUNT;
  RETURN jsonb_build_object('aplicados', aplicados);
END $$;
