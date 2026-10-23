-- Implantação: postes e clientes feitos por dia (fuso de São Paulo) e por equipe, em qualquer período.
-- Um poste = um número PG distinto dentro da nota. Fotos com rótulo (MEDIDOR, VIZINHO, etc.) não contam.
-- Executar no SQL Editor do Supabase. Pode ser executado mais de uma vez.

CREATE OR REPLACE FUNCTION public.implantacao_resumo(p_inicio DATE, p_fim DATE)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH pg AS (
    -- Cada número PG da nota é um poste; o dia é o do primeiro registro dele
    SELECT c.nota, c.pg_numero,
           min(c.created_at) AS primeiro,
           min(c.equipe) AS equipe
    FROM public.campo_registros c
    WHERE c.pg_numero ~ '^[0-9]+$'
    GROUP BY c.nota, c.pg_numero
  ),
  postes AS (
    SELECT (p.primeiro AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           COALESCE(NULLIF(trim(p.equipe), ''), '—') AS equipe,
           count(*) AS qtd
    FROM pg p
    WHERE (p.primeiro AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_inicio AND p_fim
    GROUP BY 1, 2
  ),
  clientes AS (
    -- Clientes atendidos nas etapas salvas (dia em que a etapa foi atualizada)
    SELECT (COALESCE(a.atualizado_em, a.created_at) AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           sum(COALESCE(a.qtd_clientes_nota, 0)) AS qtd
    FROM public.apontamentos a
    WHERE NOT a.rascunho
      AND (COALESCE(a.atualizado_em, a.created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_inicio AND p_fim
    GROUP BY 1
  ),
  dias AS (
    SELECT dia FROM postes
    UNION
    SELECT dia FROM clientes
  )
  SELECT jsonb_build_object(
    'inicio', p_inicio,
    'fim', p_fim,
    'total_postes', COALESCE((SELECT sum(qtd) FROM postes), 0),
    'total_clientes', COALESCE((SELECT sum(qtd) FROM clientes), 0),
    'dias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'data', d.dia,
        'postes', COALESCE((SELECT sum(p.qtd) FROM postes p WHERE p.dia = d.dia), 0),
        'clientes', COALESCE((SELECT sum(c.qtd) FROM clientes c WHERE c.dia = d.dia), 0),
        'equipes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('equipe', p.equipe, 'postes', p.qtd) ORDER BY p.equipe)
          FROM postes p WHERE p.dia = d.dia), '[]'::jsonb)
      ) ORDER BY d.dia DESC)
      FROM dias d
    ), '[]'::jsonb)
  )
$$;

-- Somente quem entra no sistema (supervisão), não o público do campo
REVOKE EXECUTE ON FUNCTION public.implantacao_resumo(DATE, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.implantacao_resumo(DATE, DATE) TO authenticated;
