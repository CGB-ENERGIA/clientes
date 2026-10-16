-- Programação semanal (planilha da supervisão). Executar no SQL Editor do Supabase.
-- Pode ser executado mais de uma vez.

CREATE TABLE IF NOT EXISTS public.programacao_notas (
  nota            TEXT PRIMARY KEY,          -- coluna NOTA da planilha = PROJETO SAP do sistema
  pep             TEXT,
  municipio       TEXT,
  equipe          TEXT,
  supervisor      TEXT,
  status          TEXT NOT NULL,             -- PROGRAMADA | ANDAMENTO | CONCLUIDA | REPROGRAMAR | CANCELAR
  data_programada DATE,
  motivo          TEXT,
  observacao      TEXT,
  linhas          INTEGER NOT NULL DEFAULT 1,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.programacao_importacoes (
  id        BIGSERIAL PRIMARY KEY,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origem    TEXT,                            -- upload | dropbox | agendador
  arquivo   TEXT,
  hash      TEXT,
  linhas    INTEGER,
  notas     INTEGER
);

ALTER TABLE public.programacao_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programacao_importacoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='programacao_notas' AND policyname='prog_select_all') THEN
    CREATE POLICY prog_select_all ON public.programacao_notas FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='programacao_importacoes' AND policyname='prog_imp_select_all') THEN
    CREATE POLICY prog_imp_select_all ON public.programacao_importacoes FOR SELECT USING (true);
  END IF;
END $$;

-- Novo status do sistema para cada situação da programação (NULL = nada a fazer).
-- A programação só avança o sistema; expurgo, sem acesso e status já concluídos não são tocados.
CREATE OR REPLACE FUNCTION public.programacao_novo_status(prog TEXT, sist TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN prog = 'CONCLUIDA'   AND sist IN ('pendente', 'em_andamento') THEN 'baixar_medidor'
    WHEN prog = 'ANDAMENTO'   AND sist = 'pendente'                    THEN 'em_andamento'
    WHEN prog = 'REPROGRAMAR' AND sist = 'em_andamento'                THEN 'pendente'
    ELSE NULL
  END
$$;

-- Ação sugerida: aplicar | conferir | ok
CREATE OR REPLACE FUNCTION public.programacao_acao(prog TEXT, sist TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN public.programacao_novo_status(prog, sist) IS NOT NULL THEN 'aplicar'
    WHEN sist IN ('expurgo', 'sem_acesso') AND prog IN ('CONCLUIDA', 'ANDAMENTO', 'PROGRAMADA') THEN 'conferir'
    WHEN sist IN ('baixar_medidor', 'concluido') AND prog IN ('REPROGRAMAR', 'CANCELAR', 'PROGRAMADA') THEN 'conferir'
    WHEN sist = 'em_andamento' AND prog = 'CANCELAR' THEN 'conferir'
    ELSE 'ok'
  END
$$;

-- Uma linha por nota da programação, com a comparação com o sistema.
-- Sem correspondência: a nota não existe no sistema com esse PROJETO SAP.
-- Mais de uma correspondência: fica para conferir, nada é aplicado automaticamente.
CREATE OR REPLACE VIEW public.programacao_comparativo AS
WITH m AS (
  SELECT p.nota AS sap,
         COUNT(n.nota)      AS qtd,
         MIN(n.nota)        AS nota_sistema,
         MIN(n.status)      AS status_sistema,
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
         ELSE public.programacao_acao(p.status, m.status_sistema)
       END AS acao,
       m.notas_sistema
FROM public.programacao_notas p
JOIN m ON m.sap = p.nota;

-- Aplica as mudanças sugeridas. p_saps NULL = todas as notas com ação "aplicar".
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
    AND (SELECT COUNT(*) FROM public.notas_servico x
         WHERE x.projeto_info_sap = p.nota AND x.ativo) = 1;
  GET DIAGNOSTICS aplicados = ROW_COUNT;
  RETURN jsonb_build_object('aplicados', aplicados);
END $$;

-- Substitui a programação pela planilha enviada (snapshot completo do dia).
CREATE OR REPLACE FUNCTION public.importar_programacao(p_registros JSONB, p_origem TEXT, p_arquivo TEXT, p_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  gravadas INT;
  removidas INT;
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
    (nota, pep, municipio, equipe, supervisor, status, data_programada, motivo, observacao, linhas, atualizado_em)
  SELECT x.nota, x.pep, x.municipio, x.equipe, x.supervisor, x.status, x.data_programada,
         x.motivo, x.observacao, x.linhas, NOW()
  FROM jsonb_to_recordset(p_registros) AS x(
    nota TEXT, pep TEXT, municipio TEXT, equipe TEXT, supervisor TEXT, status TEXT,
    data_programada DATE, motivo TEXT, observacao TEXT, linhas INTEGER)
  ON CONFLICT (nota) DO UPDATE SET
    pep = EXCLUDED.pep, municipio = EXCLUDED.municipio, equipe = EXCLUDED.equipe,
    supervisor = EXCLUDED.supervisor, status = EXCLUDED.status,
    data_programada = EXCLUDED.data_programada, motivo = EXCLUDED.motivo,
    observacao = EXCLUDED.observacao, linhas = EXCLUDED.linhas, atualizado_em = NOW();
  GET DIAGNOSTICS gravadas = ROW_COUNT;

  INSERT INTO public.programacao_importacoes (origem, arquivo, hash, linhas, notas)
  VALUES (p_origem, p_arquivo, p_hash, jsonb_array_length(p_registros), gravadas);

  RETURN jsonb_build_object('notas', gravadas, 'removidas', removidas);
END $$;

GRANT SELECT ON public.programacao_comparativo TO anon, authenticated;
