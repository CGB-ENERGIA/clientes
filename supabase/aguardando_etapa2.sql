-- Status "aguardando_etapa2": nota finalizada em campo (ou concluída pela programação) à espera da Etapa 2.
-- Auditar (baixar_medidor) passa a valer só depois que a Etapa 2 é concluída.
-- Executar no SQL Editor do Supabase, depois de programacao.sql, programacao_guarda.sql e equipe2.sql.
-- Pode ser executado mais de uma vez.

CREATE OR REPLACE FUNCTION public.campo_finalizar_nota(p_nota text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $function$
  UPDATE public.notas_servico SET status = 'aguardando_etapa2'
  WHERE nota = p_nota AND status IN ('pendente', 'em_andamento');
$function$;

CREATE OR REPLACE FUNCTION public.programacao_novo_status(prog TEXT, sist TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN prog = 'CONCLUIDA'   AND sist IN ('pendente', 'em_andamento') THEN 'aguardando_etapa2'
    WHEN prog = 'ANDAMENTO'   AND sist = 'pendente'                    THEN 'em_andamento'
    WHEN prog = 'REPROGRAMAR' AND sist = 'em_andamento'                THEN 'pendente'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.programacao_acao(prog TEXT, sist TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN public.programacao_novo_status(prog, sist) IS NOT NULL THEN 'aplicar'
    WHEN sist IN ('expurgo', 'sem_acesso') AND prog IN ('CONCLUIDA', 'ANDAMENTO', 'PROGRAMADA') THEN 'conferir'
    WHEN sist IN ('aguardando_etapa2', 'baixar_medidor', 'concluido') AND prog IN ('REPROGRAMAR', 'CANCELAR', 'PROGRAMADA') THEN 'conferir'
    WHEN sist = 'em_andamento' AND prog = 'CANCELAR' THEN 'conferir'
    ELSE 'ok'
  END
$$;

CREATE OR REPLACE FUNCTION public.status_rank(s text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE s
    WHEN 'pendente' THEN 0
    WHEN 'em_andamento' THEN 1
    WHEN 'aguardando_etapa2' THEN 2
    WHEN 'baixar_medidor' THEN 3
    WHEN 'concluido' THEN 4
    ELSE -1
  END
$function$;

-- Notas que já estavam em Baixar Medidor sem a Etapa 2 concluída voltam para Aguardando Etapa 2
UPDATE public.notas_servico n SET status = 'aguardando_etapa2', updated_at = now()
WHERE n.status = 'baixar_medidor'
  AND NOT EXISTS (SELECT 1 FROM public.apontamentos a WHERE a.nota = n.nota AND NOT a.rascunho);
