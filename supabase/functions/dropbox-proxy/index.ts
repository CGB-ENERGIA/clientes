// Supabase Edge Function — proxy para download do Dropbox sem restrição CORS
// Deploy: bunx supabase functions deploy dropbox-proxy --no-verify-jwt

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { url } = await req.json() as { url: string }

    if (!url?.includes('dropbox')) {
      return json({ error: 'URL inválida' }, 400)
    }

    // Converte link de compartilhamento para download direto
    let dl = url.trim()
      .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
      .replace('dl=0', 'dl=1')
    if (!dl.includes('dl=')) dl += (dl.includes('?') ? '&' : '?') + 'dl=1'

    const res = await fetch(dl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })

    if (!res.ok) return json({ error: `Dropbox retornou HTTP ${res.status}` }, 502)

    // Converte para base64 (loop para evitar stack overflow em arquivos grandes)
    const buf   = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let b64 = ''
    for (let i = 0; i < bytes.length; i++) {
      b64 += String.fromCharCode(bytes[i])
    }

    return json({ b64: btoa(b64), size: bytes.length })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

function json (data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
}
