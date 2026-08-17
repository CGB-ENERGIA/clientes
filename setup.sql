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

-- 4. CAMPO_REGISTROS (PWA de campo)
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

-- 7. STORAGE BUCKET (execute separado se der erro de permissão)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campo-fotos', 'campo-fotos', true, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 52428800;
