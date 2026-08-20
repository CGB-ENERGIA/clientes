import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from 'boot/supabase'

const QUEUE_KEY  = 'cgb_campo_fila'
const SESSAO_KEY = 'cgb_campo_sessao'

function lerFila  () { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)  || '[]')  } catch { return [] } }
function lerSessao() { try { return JSON.parse(localStorage.getItem(SESSAO_KEY) || 'null') } catch { return null } }

function b64ToBlob (b64, mime) {
  const str = atob(b64.split(',')[1])
  const buf = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i)
  return new Blob([buf], { type: mime })
}

export const useCampoStore = defineStore('campo', () => {
  const sessao       = ref(lerSessao())
  const registros    = ref([])
  const fila         = ref(lerFila())
  const online       = ref(navigator.onLine)
  const sincronizando = ref(false)

  window.addEventListener('online',  () => { online.value = true;  sincronizar() })
  window.addEventListener('offline', () => { online.value = false })

  // Tenta sincronizar fila a cada 30s se online e houver pendências
  setInterval(() => {
    if (online.value && fila.value.length > 0) sincronizar()
  }, 30_000)

  // ── Sessão ────────────────────────────────────────────────────
  function iniciarSessao (data) {
    sessao.value = data
    registros.value = []
    localStorage.setItem(SESSAO_KEY, JSON.stringify(data))
  }

  function encerrarSessao () {
    sessao.value = null
    registros.value = []
    localStorage.removeItem(SESSAO_KEY)
  }

  // ── Salvar registro (online ou offline) ───────────────────────
  async function salvarRegistro ({ pg, fotoB64, fotoMime }) {
    const id = crypto.randomUUID()
    const rec = {
      id,
      base:       sessao.value.base,
      pep:        sessao.value.pep,
      nota:       sessao.value.nota,
      equipe:     sessao.value.equipe,
      pg_numero:  pg,
      foto_b64:   fotoB64,
      foto_mime:  fotoMime,
      foto_url:   null,
      created_at: new Date().toISOString(),
      sync:       false
    }

    registros.value.unshift(rec)
    fila.value.push(rec)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(fila.value))

    if (online.value) await sincronizar()
    return rec
  }

  // ── Sincronizar fila com Supabase ─────────────────────────────
  async function sincronizar () {
    if (sincronizando.value || fila.value.length === 0) return
    sincronizando.value = true

    const pendentes = [...fila.value]
    for (const r of pendentes) {
      try {
        let foto_url = null

        if (r.foto_b64) {
          const blob = b64ToBlob(r.foto_b64, r.foto_mime || 'image/jpeg')
          const nome = `${r.id}.jpg`
          const { error: upErr } = await supabase.storage
            .from('campo-fotos')
            .upload(nome, blob, { contentType: 'image/jpeg', upsert: true })

          if (!upErr) {
            const { data: urlData } = supabase.storage.from('campo-fotos').getPublicUrl(nome)
            foto_url = urlData.publicUrl
          }
        }

        const { error: dbErr } = await supabase.from('campo_registros').upsert({
          id:         r.id,
          base:       r.base,
          pep:        r.pep,
          nota:       r.nota,
          equipe:     r.equipe,
          pg_numero:  r.pg_numero,
          foto_url,
          created_at: r.created_at
        })

        if (!dbErr) {
          fila.value = fila.value.filter(f => f.id !== r.id)
          const local = registros.value.find(l => l.id === r.id)
          if (local) { local.sync = true; local.foto_url = foto_url }

          // Marca nota como "em andamento" (não rebaixa se já estiver concluída)
          if (r.nota) {
            await supabase
              .from('notas_servico')
              .update({ status: 'em_andamento' })
              .eq('nota', r.nota)
              .neq('status', 'concluido')
          }
        }
      } catch (e) {
        console.warn('[Campo] sync error:', e)
      }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(fila.value))
    sincronizando.value = false
  }

  return {
    sessao, registros, fila, online, sincronizando,
    iniciarSessao, encerrarSessao, salvarRegistro, sincronizar
  }
})
