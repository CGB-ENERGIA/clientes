#!/usr/bin/env bun
/**
 * Setup automático do Supabase — CGB Energia
 * Uso: bun run setup
 */
import { readFileSync } from 'fs'
import postgres from 'postgres'

// ── Lê .env ───────────────────────────────────────────────────────
const env = {}
try {
  readFileSync('.env', 'utf8').split('\n').forEach(ln => {
    const i = ln.indexOf('=')
    if (i > 0) env[ln.slice(0, i).trim()] = ln.slice(i + 1).trim()
  })
} catch {
  console.error('❌  .env não encontrado. Execute na raiz do projeto.')
  process.exit(1)
}

const DATABASE_URL = env.DATABASE_URL || ''
if (!DATABASE_URL || DATABASE_URL.includes('YOUR-PASSWORD')) {
  console.error('❌  DATABASE_URL não configurado no .env')
  process.exit(1)
}

// Parseia a URL manualmente para evitar problemas com "." no username
function parseConnStr(url) {
  // postgresql://user:pass@host:port/db
  const m = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/)
  if (!m) throw new Error('DATABASE_URL inválida')
  return {
    user:     decodeURIComponent(m[1]),
    password: decodeURIComponent(m[2]),
    host:     m[3],
    port:     Number(m[4]),
    database: m[5]
  }
}
const conn = parseConnStr(DATABASE_URL)
const sql = postgres({ ...conn, ssl: 'require', max: 1, idle_timeout: 20 })

const ok  = (label) => console.log(`  ✅  ${label}`)
const skip = (label) => console.log(`  ⏭   ${label} (já existe)`)

async function exec (label, query) {
  try {
    await sql.unsafe(query)
    ok(label)
  } catch (e) {
    if (/already exists|já existe/i.test(e.message)) { skip(label); return }
    throw new Error(`[${label}] ${e.message}`)
  }
}

console.log('\n🚀  Setup CGB Energia — Supabase\n')

try {

// ════════════════════════════════════════════════════════════════════
//  1. EXTENSÕES
// ════════════════════════════════════════════════════════════════════
console.log('📦  Extensões...')
await exec('uuid-ossp', `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
await exec('pgcrypto',  `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)

// ════════════════════════════════════════════════════════════════════
//  2. PROFILES  (roles: superadmin / admin / viewer)
// ════════════════════════════════════════════════════════════════════
console.log('\n👤  Tabela: profiles...')
await exec('profiles', `
  CREATE TABLE IF NOT EXISTS public.profiles (
    id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email      TEXT,
    role       TEXT NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`)
await exec('RLS profiles', `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY`)
await exec('policy profiles_select', `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select_own') THEN
      CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
    END IF;
  END $$
`)
await exec('policy profiles_update', `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_update_own') THEN
      CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
  END $$
`)
await exec('fn handle_new_user', `
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'viewer')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END $$
`)
await exec('trigger on_auth_user_created', `
  DO $$ BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END $$
`)

// ════════════════════════════════════════════════════════════════════
//  3. APONTAMENTOS
// ════════════════════════════════════════════════════════════════════
console.log('\n📋  Tabela: apontamentos...')
await exec('apontamentos', `
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
  )
`)
// Colunas extras (se tabela já existia incompleta)
const colunas = [
  [`col pg_numeros`,        `ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS pg_numeros        JSONB    DEFAULT '[]'`],
  [`col clientes`,          `ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS clientes           JSONB    DEFAULT '[]'`],
  [`col todos_atendidos`,   `ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS todos_atendidos    BOOLEAN  DEFAULT TRUE`],
  [`col nao_atendidos`,     `ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS nao_atendidos      JSONB    DEFAULT '[]'`],
  [`col qtd_clientes_nota`, `ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS qtd_clientes_nota INTEGER  NOT NULL DEFAULT 0`],
  [`col base`,              `ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS base               TEXT`],
  [`col user_id`,           `ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL`]
]
for (const [label, q] of colunas) await exec(label, q)

await exec('RLS apontamentos', `ALTER TABLE public.apontamentos ENABLE ROW LEVEL SECURITY`)
await exec('policy apontamentos_all', `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='apontamentos' AND policyname='apontamentos_all_auth') THEN
      CREATE POLICY apontamentos_all_auth ON public.apontamentos
        FOR ALL USING (auth.role() = 'authenticated');
    END IF;
  END $$
`)

// ════════════════════════════════════════════════════════════════════
//  4. CAMPO_REGISTROS  (PWA de campo)
// ════════════════════════════════════════════════════════════════════
console.log('\n📱  Tabela: campo_registros...')
await exec('campo_registros', `
  CREATE TABLE IF NOT EXISTS public.campo_registros (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    base       TEXT NOT NULL,
    pep        TEXT,
    nota       TEXT,
    equipe     TEXT NOT NULL,
    pg_numero  TEXT NOT NULL,
    foto_url   TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`)
await exec('RLS campo_registros', `ALTER TABLE public.campo_registros ENABLE ROW LEVEL SECURITY`)
await exec('policy campo_insert', `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campo_registros' AND policyname='campo_insert_anon') THEN
      CREATE POLICY campo_insert_anon ON public.campo_registros FOR INSERT WITH CHECK (true);
    END IF;
  END $$
`)
await exec('policy campo_select', `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campo_registros' AND policyname='campo_select_auth') THEN
      CREATE POLICY campo_select_auth ON public.campo_registros
        FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
  END $$
`)

// ════════════════════════════════════════════════════════════════════
//  5. STORAGE BUCKET  campo-fotos
// ════════════════════════════════════════════════════════════════════
console.log('\n🗄️   Storage: campo-fotos...')
await exec('bucket campo-fotos', `
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'campo-fotos', 'campo-fotos', true, 52428800,
    ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
  )
  ON CONFLICT (id) DO UPDATE
    SET public = true, file_size_limit = 52428800
`)
await exec('storage policy INSERT', `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.policies WHERE bucket_id='campo-fotos' AND name='campo_fotos_insert') THEN
      INSERT INTO storage.policies (name, bucket_id, definition, mode)
      VALUES ('campo_fotos_insert','campo-fotos','(bucket_id = ''campo-fotos'')','INSERT');
    END IF;
  END $$
`)
await exec('storage policy SELECT', `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.policies WHERE bucket_id='campo-fotos' AND name='campo_fotos_select') THEN
      INSERT INTO storage.policies (name, bucket_id, definition, mode)
      VALUES ('campo_fotos_select','campo-fotos','(bucket_id = ''campo-fotos'')','SELECT');
    END IF;
  END $$
`)

// ════════════════════════════════════════════════════════════════════
//  6. ÍNDICES
// ════════════════════════════════════════════════════════════════════
console.log('\n⚡  Índices...')
await exec('idx apt created_at', `CREATE INDEX IF NOT EXISTS idx_apt_created ON public.apontamentos(created_at DESC)`)
await exec('idx apt base',       `CREATE INDEX IF NOT EXISTS idx_apt_base    ON public.apontamentos(base)`)
await exec('idx campo created',  `CREATE INDEX IF NOT EXISTS idx_cmp_created ON public.campo_registros(created_at DESC)`)
await exec('idx campo equipe',   `CREATE INDEX IF NOT EXISTS idx_cmp_equipe  ON public.campo_registros(equipe)`)

// ════════════════════════════════════════════════════════════════════
//  7. SUPERADMIN
// ════════════════════════════════════════════════════════════════════
console.log('\n🔑  Superadmin...')
const rows = await sql`
  UPDATE public.profiles SET role = 'superadmin'
  WHERE email = 'italo.fontes@cgbengenharia.com.br'
  RETURNING id
`
if (rows.length > 0) {
  ok('italo.fontes@cgbengenharia.com.br → superadmin')
} else {
  console.log('  ℹ️   Usuário ainda não existe no Auth — crie-o no dashboard e rode novamente')
}

// ════════════════════════════════════════════════════════════════════
await sql.end()
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Setup concluído com sucesso!

   Tabelas  → profiles · apontamentos · campo_registros
   Storage  → campo-fotos (público, 50 MB/foto)
   RLS      → ativado em todas as tabelas
   Trigger  → profile criado automaticamente no cadastro
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

} catch (err) {
  await sql.end()
  console.error('\n❌  Erro:', err.message)
  process.exit(1)
}
