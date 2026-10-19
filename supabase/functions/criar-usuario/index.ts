// Supabase Edge Function — gestão de usuários (listar, criar, alterar perfil)
// Deploy: bunx supabase functions deploy criar-usuario

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PERFIS = ['viewer', 'admin', 'superadmin']

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: erroAuth } = await admin.auth.getUser(token)
    if (erroAuth || !user) return json({ error: 'Não autenticado' }, 401)

    const { data: quem } = await admin.from('profiles').select('role').eq('id', user.id).single()
    const papel: string = quem?.role ?? 'viewer'
    if (papel !== 'superadmin' && papel !== 'admin') return json({ error: 'Sem permissão' }, 403)

    const body = await req.json()

    if (body.acao === 'listar') {
      const { data, error } = await admin.from('profiles').select('id, email, role').order('email')
      if (error) return json({ error: error.message }, 500)
      return json({ usuarios: data, meuId: user.id })
    }
    if (body.acao === 'criar') return criar(body, papel)
    if (body.acao === 'perfil') return alterarPerfil(body, papel, user.id)

    return json({ error: 'Ação inválida' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

// Admin pode atribuir viewer e admin. Só superadmin atribui superadmin.
function podeAtribuir (papel: string, perfil: string): boolean {
  if (!PERFIS.includes(perfil)) return false
  if (perfil === 'superadmin') return papel === 'superadmin'
  return true
}

async function criar (body: any, papel: string) {
  const email = String(body.email ?? '').trim().toLowerCase()
  const senha = String(body.senha ?? '')
  const perfil = String(body.perfil ?? 'viewer')

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'E-mail inválido' }, 400)
  if (senha.length < 8) return json({ error: 'A senha precisa ter pelo menos 8 caracteres' }, 400)
  if (!podeAtribuir(papel, perfil)) return json({ error: 'Sem permissão para este perfil' }, 403)

  // O trigger handle_new_user cria o perfil como viewer; ajustamos logo em seguida
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (error) return json({ error: error.message }, 400)

  const { error: erroPerfil } = await admin.from('profiles').update({ role: perfil }).eq('id', data.user.id)
  if (erroPerfil) return json({ error: erroPerfil.message }, 500)

  return json({ id: data.user.id, email, perfil })
}

async function alterarPerfil (body: any, papel: string, meuId: string) {
  if (body.id === meuId) return json({ error: 'Você não pode alterar o próprio perfil' }, 400)

  const perfil = String(body.perfil ?? '')
  if (!podeAtribuir(papel, perfil)) return json({ error: 'Sem permissão para este perfil' }, 403)

  const { data: alvo } = await admin.from('profiles').select('role').eq('id', body.id).single()
  if (alvo?.role === 'superadmin' && papel !== 'superadmin') {
    return json({ error: 'Só um superadmin pode alterar outro superadmin' }, 403)
  }

  const { error } = await admin.from('profiles').update({ role: perfil }).eq('id', body.id)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
}

function json (data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
