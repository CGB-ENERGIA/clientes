-- Implantação: postes e clientes feitos por dia (fuso de São Paulo) e por equipe, em qualquer período.
-- Um poste = um número PG distinto dentro da nota. Fotos com rótulo (MEDIDOR, VIZINHO, etc.) não contam.
-- Postes marcados como "antigo" (já existiam) não contam como implantados, mas ficam listados como evidência.
-- Cada dia traz a lista dos postes: nota, PEP, número PG, equipe, hora e foto.
-- Correção de PG: o número precisa ter exatamente 8 dígitos.
-- Executar no SQL Editor do Supabase. Pode ser executado mais de uma vez.

ALTER TABLE public.campo_registros ADD COLUMN IF NOT EXISTS poste_antigo BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.implantacao_resumo(p_inicio DATE, p_fim DATE)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH pg AS (
    -- Cada número PG da nota é um poste; o dia é o do primeiro registro dele
    SELECT c.nota, c.pg_numero,
           min(c.created_at) AS primeiro,
           min(c.equipe) AS equipe,
           (array_agg(c.foto_url ORDER BY c.created_at))[1] AS foto,
           bool_or(c.poste_antigo) AS antigo
    FROM public.campo_registros c
    WHERE c.pg_numero ~ '^[0-9]+$'
    GROUP BY c.nota, c.pg_numero
  ),
  pg_ok AS (
    SELECT * FROM pg WHERE NOT antigo
  ),
  pg_antigo AS (
    SELECT * FROM pg WHERE antigo
  ),
  postes AS (
    SELECT (p.primeiro AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           COALESCE(NULLIF(trim(p.equipe), ''), '—') AS equipe,
           count(*) AS qtd
    FROM pg_ok p
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
  ),
  antigos AS (
    SELECT p.nota, p.pg_numero, p.equipe, p.foto, p.primeiro,
           (p.primeiro AT TIME ZONE 'America/Sao_Paulo')::date AS dia
    FROM pg_antigo p
    WHERE (p.primeiro AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_inicio AND p_fim
  )
  SELECT jsonb_build_object(
    'inicio', p_inicio,
    'fim', p_fim,
    'total_postes', COALESCE((SELECT sum(qtd) FROM postes), 0),
    'total_clientes', COALESCE((SELECT sum(qtd) FROM clientes), 0),
    'total_antigos', COALESCE((SELECT count(*) FROM antigos), 0),
    'dias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'data', d.dia,
        'postes', COALESCE((SELECT sum(p.qtd) FROM postes p WHERE p.dia = d.dia), 0),
        'clientes', COALESCE((SELECT sum(c.qtd) FROM clientes c WHERE c.dia = d.dia), 0),
        'equipes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('equipe', p.equipe, 'postes', p.qtd) ORDER BY p.equipe)
          FROM postes p WHERE p.dia = d.dia), '[]'::jsonb),
        'postes_lista', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'nota', p.nota,
            'pep', (SELECT n.pep FROM public.notas_servico n WHERE n.nota = p.nota LIMIT 1),
            'pg', p.pg_numero,
            'equipe', COALESCE(NULLIF(trim(p.equipe), ''), '—'),
            'hora', to_char(p.primeiro AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
            'foto', p.foto
          ) ORDER BY p.primeiro)
          FROM pg_ok p
          WHERE (p.primeiro AT TIME ZONE 'America/Sao_Paulo')::date = d.dia), '[]'::jsonb)
      ) ORDER BY d.dia DESC)
      FROM dias d
    ), '[]'::jsonb),
    'antigos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'data', a.dia,
        'hora', to_char(a.primeiro AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
        'nota', a.nota,
        'pep', (SELECT n.pep FROM public.notas_servico n WHERE n.nota = a.nota LIMIT 1),
        'pg', a.pg_numero,
        'equipe', COALESCE(NULLIF(trim(a.equipe), ''), '—'),
        'foto', a.foto
      ) ORDER BY a.dia DESC, a.primeiro DESC)
      FROM antigos a), '[]'::jsonb)
  )
$$;

-- Corrige o número PG de um poste: precisa ter exatamente 8 dígitos e não pode repetir na nota
CREATE OR REPLACE FUNCTION public.implantacao_corrigir_pg(p_nota TEXT, p_pg_atual TEXT, p_pg_novo TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  atualizados INT;
BEGIN
  IF p_pg_novo IS NULL OR p_pg_novo !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'PG_INVALIDO'; END IF;
  IF p_pg_novo <> p_pg_atual AND EXISTS (
    SELECT 1 FROM public.campo_registros WHERE nota = p_nota AND pg_numero = p_pg_novo
  ) THEN
    RAISE EXCEPTION 'PG_JA_EXISTE';
  END IF;

  UPDATE public.campo_registros SET pg_numero = p_pg_novo
  WHERE nota = p_nota AND pg_numero = p_pg_atual;
  GET DIAGNOSTICS atualizados = ROW_COUNT;

  UPDATE public.apontamentos SET pg_numeros = array_replace(pg_numeros, p_pg_atual, p_pg_novo)
  WHERE nota = p_nota;

  RETURN jsonb_build_object('atualizados', atualizados);
END $$;

-- Marca (ou desmarca) um poste como antigo: continua com a evidência, mas não conta como implantado
CREATE OR REPLACE FUNCTION public.implantacao_marcar_antigo(p_nota TEXT, p_pg TEXT, p_antigo BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  atualizados INT;
BEGIN
  UPDATE public.campo_registros SET poste_antigo = p_antigo
  WHERE nota = p_nota AND pg_numero = p_pg;
  GET DIAGNOSTICS atualizados = ROW_COUNT;
  RETURN jsonb_build_object('atualizados', atualizados);
END $$;

-- Somente quem entra no sistema (supervisão), não o público do campo
REVOKE EXECUTE ON FUNCTION public.implantacao_resumo(DATE, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.implantacao_resumo(DATE, DATE) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.implantacao_corrigir_pg(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.implantacao_corrigir_pg(TEXT, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.implantacao_marcar_antigo(TEXT, TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.implantacao_marcar_antigo(TEXT, TEXT, BOOLEAN) TO authenticated;
