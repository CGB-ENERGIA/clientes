-- ═══════════════════════════════════════════════════════════
--  CGB Energia — Setup completo do banco de dados
--  Cole e execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email      TEXT,
  role       TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select_own') THEN
    CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_update_own') THEN
    CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- Trigger: cria profile automaticamente ao registrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'viewer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. APONTAMENTOS
CREATE TABLE IF NOT EXISTS public.apontamentos (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pep               TEXT NOT NULL,
  nota              TEXT NOT NULL,
  postes            INTEGER NOT NULL DEFAULT 0,
  pg_numeros        JSONB DEFAULT '[]',
  clientes          JSONB DEFAULT '[]',
  todos_atendidos   BOOLEAN DEFAULT TRUE,
  nao_atendidos     JSONB DEFAULT '[]',
  qtd_clientes_nota INTEGER NOT NULL DEFAULT 0,
  base              TEXT,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS pg_numeros        JSONB    DEFAULT '[]';
ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS clientes           JSONB    DEFAULT '[]';
ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS todos_atendidos    BOOLEAN  DEFAULT TRUE;
ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS nao_atendidos      JSONB    DEFAULT '[]';
ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS qtd_clientes_nota  INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS base               TEXT;
ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.apontamentos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='apontamentos' AND policyname='apontamentos_all_auth') THEN
    CREATE POLICY apontamentos_all_auth ON public.apontamentos
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 4. NOTAS_SERVICO (dados da planilha)
CREATE TABLE IF NOT EXISTS public.notas_servico (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  base         TEXT NOT NULL,
  pep          TEXT NOT NULL,
  nota         TEXT NOT NULL UNIQUE,
  postes       INTEGER NOT NULL DEFAULT 0,
  qtd_clientes INTEGER NOT NULL DEFAULT 0,
  ativo        BOOLEAN DEFAULT TRUE,
  status       TEXT NOT NULL DEFAULT 'pendente',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
-- status: 'pendente' | 'em_andamento' | 'concluido'
ALTER TABLE public.notas_servico ADD COLUMN IF NOT EXISTS status            TEXT  NOT NULL DEFAULT 'pendente';
ALTER TABLE public.notas_servico ADD COLUMN IF NOT EXISTS municipio         TEXT;
ALTER TABLE public.notas_servico ADD COLUMN IF NOT EXISTS clientes_planilha JSONB DEFAULT '[]';
ALTER TABLE public.notas_servico ADD COLUMN IF NOT EXISTS projeto_info_sap  TEXT;
ALTER TABLE public.notas_servico ADD COLUMN IF NOT EXISTS notas_lista       TEXT[];

ALTER TABLE public.notas_servico ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notas_servico' AND policyname='notas_select_all') THEN
    CREATE POLICY notas_select_all ON public.notas_servico FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notas_servico' AND policyname='notas_write_auth') THEN
    CREATE POLICY notas_write_auth ON public.notas_servico
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notas_nota   ON public.notas_servico(nota);
CREATE INDEX IF NOT EXISTS idx_notas_base   ON public.notas_servico(base);
CREATE INDEX IF NOT EXISTS idx_notas_status ON public.notas_servico(status);

-- 5. CAMPO_REGISTROS (PWA de campo)
CREATE TABLE IF NOT EXISTS public.campo_registros (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  base       TEXT NOT NULL,
  pep        TEXT,
  nota       TEXT,
  equipe     TEXT NOT NULL,
  pg_numero  TEXT NOT NULL,
  foto_url   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campo_registros ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campo_registros' AND policyname='campo_insert_anon') THEN
    CREATE POLICY campo_insert_anon ON public.campo_registros FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campo_registros' AND policyname='campo_select_auth') THEN
    CREATE POLICY campo_select_auth ON public.campo_registros
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 5. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_apt_created ON public.apontamentos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apt_base    ON public.apontamentos(base);
CREATE INDEX IF NOT EXISTS idx_cmp_created ON public.campo_registros(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmp_equipe  ON public.campo_registros(equipe);

-- 6. SUPERADMIN (execute após criar o usuário no Auth)
-- UPDATE public.profiles SET role = 'superadmin'
-- WHERE email = 'italo.fontes@cgbengenharia.com.br';

-- 7. STORAGE BUCKETS (execute separado se der erro de permissão)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campo-fotos', 'campo-fotos', true, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 52428800;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medidores', 'medidores', true, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 52428800;

-- 8. TABELA CLIENTES (coluna num_medidor e foto_url)
-- (A tabela é criada pelo apontamento store; adicione as colunas se já existir)
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS num_medidor TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS foto_url    TEXT;

-- 9. CONFIGURAÇÕES GLOBAIS DO SISTEMA
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave      TEXT PRIMARY KEY,
  valor      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='configuracoes' AND policyname='config_all_auth') THEN
    CREATE POLICY config_all_auth ON public.configuracoes
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
