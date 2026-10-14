import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from 'boot/supabase'

const QUEUE_KEY   = 'cgb_campo_fila'
const SESSAO_KEY  = 'cgb_campo_sessao'
const EQUIPE_KEY  = 'cgb_campo_equipe'
const RESUMO_KEY  = 'cgb_campo_resumo'
const HIST_PREFIX = 'cgb_campo_hist_'

function lerJson (key, padrao) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? padrao } catch { return padrao } }
function lerFila  () { return lerJson(QUEUE_KEY, []) }
function lerSessao() { return lerJson(SESSAO_KEY, null) }

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

  // Resumo por nota (postes já registrados, equipes, último registro) para retomar trabalho
  const resumoNotas    = ref(lerJson(RESUMO_KEY, []))
  const ultimaEquipe   = ref(localStorage.getItem(EQUIPE_KEY) || '')
  const carregandoHist = ref(false)

  async function carregarResumo () {
    if (!navigator.onLine) return
    const { data, error } = await supabase.rpc('campo_resumo_notas')
    if (error || !data) return
    resumoNotas.value = data
    localStorage.setItem(RESUMO_KEY, JSON.stringify(data))
  }

  // ── Sessão ────────────────────────────────────────────────────
  function iniciarSessao (data) {
    sessao.value = data
    registros.value = []
    localStorage.setItem(SESSAO_KEY, JSON.stringify(data))
    ultimaEquipe.value = data.equipe
    localStorage.setItem(EQUIPE_KEY, data.equipe)
  }

  // Junta os registros já enviados da nota (de qualquer dia/equipe) com os pendentes deste aparelho
  async function carregarRegistrosNota () {
    const nota = sessao.value?.nota
    if (!nota) return
    const key = HIST_PREFIX + nota
    let remotos = lerJson(key, [])
    if (navigator.onLine) {
      carregandoHist.value = true
      const { data, error } = await supabase.rpc('campo_registros_da_nota', { p_nota: nota })
      carregandoHist.value = false
      if (!error && data) {
        remotos = data
        localStorage.setItem(key, JSON.stringify(data))
      }
    }
    const pendentes = fila.value.filter(r => r.nota === nota)
    const ids = new Set(pendentes.map(r => r.id))
    const daSessao = registros.value.filter(r => r.nota === nota && !ids.has(r.id))
    const vistos = new Set([...ids, ...daSessao.map(r => r.id)])
    registros.value = [
      ...pendentes,
      ...daSessao,
      ...remotos.filter(r => !vistos.has(r.id)).map(r => ({ ...r, nota, sync: true }))
    ].sort((a, b) => b.created_at.localeCompare(a.created_at))
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

          if (upErr) {
            console.warn('[Campo] upload foto:', upErr.message)
            continue
          }

          const { data: urlData } = supabase.storage.from('campo-fotos').getPublicUrl(nome)
          foto_url = urlData.publicUrl
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
          const fotoOk = !r.foto_b64 || !!foto_url
          if (!fotoOk) continue

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
    resumoNotas, ultimaEquipe, carregandoHist,
    iniciarSessao, encerrarSessao, salvarRegistro, sincronizar,
    carregarResumo, carregarRegistrosNota
  }
})
