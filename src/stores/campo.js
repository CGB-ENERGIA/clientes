import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from 'boot/supabase'

const QUEUE_KEY   = 'cgb_campo_fila'
const SESSAO_KEY  = 'cgb_campo_sessao'
const EQUIPE_KEY  = 'cgb_campo_equipe'
const RESUMO_KEY  = 'cgb_campo_resumo'
const HIST_PREFIX = 'cgb_campo_hist_'
const PAUSA_KEY   = 'cgb_campo_pausadas'
const IMPREV_KEY  = 'cgb_campo_imprevistos_fila'
const STATUS_KEY  = 'cgb_campo_status_fila'

export const MOTIVOS_IMPREVISTO = [
  'Sem acesso ao local',
  'Cliente ausente',
  'Condições climáticas',
  'Falta de material',
  'Problema no veículo/equipamento',
  'Área de risco',
  'Impedimento de terceiros',
  'Outro'
]

function lerJson (key, padrao) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? padrao } catch { return padrao } }
function lerSessao() { return lerJson(SESSAO_KEY, null) }

// A fila de postes (com fotos em base64) fica no IndexedDB: o localStorage tem só ~5 MB,
// o que não comporta um dia inteiro offline com várias fotos por poste.
const IDB_NOME = 'cgb_campo'
const IDB_STORE = 'fila'

function abrirIdb () {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NOME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idb (modo, fn) {
  const db = await abrirIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, modo)
    const req = fn(tx.objectStore(IDB_STORE))
    tx.oncomplete = () => { db.close(); resolve(req?.result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

const idbTodos   = () => idb('readonly', s => s.getAll())
const idbSalvar  = rec => idb('readwrite', s => s.put(rec))
const idbRemover = id => idb('readwrite', s => s.delete(id))

function b64ToBlob (b64, mime) {
  const str = atob(b64.split(',')[1])
  const buf = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i)
  return new Blob([buf], { type: mime })
}

export const useCampoStore = defineStore('campo', () => {
  const sessao       = ref(lerSessao())
  const registros    = ref([])
  const fila         = ref([])
  const online       = ref(navigator.onLine)
  const sincronizando = ref(false)

  // Carrega a fila do IndexedDB e migra a fila antiga que ficava no localStorage
  const filaPronta = (async () => {
    try {
      const legado = lerJson(QUEUE_KEY, [])
      for (const r of legado) await idbSalvar(r)
      if (legado.length) localStorage.removeItem(QUEUE_KEY)
      const todos = await idbTodos()
      fila.value = (todos || []).sort((a, b) => a.created_at.localeCompare(b.created_at))
    } catch (e) {
      console.warn('[Campo] IndexedDB indisponível:', e)
      fila.value = lerJson(QUEUE_KEY, [])
    }
    if (online.value && fila.value.length) sincronizar()
  })()

  window.addEventListener('online',  () => { online.value = true;  sincronizar() })
  window.addEventListener('offline', () => { online.value = false })

  // Tenta sincronizar fila a cada 30s se online e houver pendências
  setInterval(() => {
    if (online.value && (fila.value.length > 0 || filaImprevistos.value.length > 0)) sincronizar()
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
    await filaPronta
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

  // Notas pausadas neste aparelho com "Concluir mais tarde"
  const pausadas = ref(lerJson(PAUSA_KEY, []))

  function pausarSessao () {
    const s = sessao.value
    if (!s) return
    const registrados = registros.value.length
    if (registrados) enfileirarStatus(s.nota, 'andamento')
    pausadas.value = [
      { nota: s.nota, equipe: s.equipe, em: new Date().toISOString(), registrados },
      ...pausadas.value.filter(p => p.nota !== s.nota)
    ].slice(0, 20)
    localStorage.setItem(PAUSA_KEY, JSON.stringify(pausadas.value))
    encerrarSessao()
  }

  // ── Mudança de status da nota pelo campo ─────────────────────
  // 'andamento' (Concluir mais tarde) → Andamento; 'finalizar' → Baixar Medidor.
  const filaStatus = ref(lerJson(STATUS_KEY, []))

  function gravarFilaStatus () {
    localStorage.setItem(STATUS_KEY, JSON.stringify(filaStatus.value))
  }

  function enfileirarStatus (nota, acao) {
    filaStatus.value = [...filaStatus.value.filter(s => s.nota !== nota), { nota, acao }]
    gravarFilaStatus()
  }

  async function enviarStatus () {
    for (const s of [...filaStatus.value]) {
      // A nota só vai para Baixar Medidor depois que todos os postes dela chegaram ao sistema
      if (fila.value.some(r => r.nota === s.nota)) continue
      const fn = s.acao === 'finalizar' ? 'campo_finalizar_nota' : 'campo_marcar_em_andamento'
      const { error } = await supabase.rpc(fn, { p_nota: s.nota })
      if (error) { console.warn('[Campo] status:', error.message); continue }
      filaStatus.value = filaStatus.value.filter(x => x !== s)
    }
    gravarFilaStatus()
  }

  async function finalizarSessao () {
    const s = sessao.value
    if (!s) return
    enfileirarStatus(s.nota, 'finalizar')
    pausadas.value = pausadas.value.filter(p => p.nota !== s.nota)
    localStorage.setItem(PAUSA_KEY, JSON.stringify(pausadas.value))
    encerrarSessao()
    if (online.value) await sincronizar()
    return { enviado: !filaStatus.value.some(x => x.nota === s.nota) }
  }

  function encerrarSessao () {
    sessao.value = null
    registros.value = []
    localStorage.removeItem(SESSAO_KEY)
  }

  // ── Salvar registro (online ou offline) ───────────────────────
  async function salvarRegistro ({ pg, fotoB64, extrasB64 = [] }) {
    const id = crypto.randomUUID()
    const rec = {
      id,
      base:       sessao.value.base,
      pep:        sessao.value.pep,
      nota:       sessao.value.nota,
      equipe:     sessao.value.equipe,
      pg_numero:  pg,
      foto_b64:   fotoB64,
      extras_b64: extrasB64,
      foto_url:   null,
      fotos_extras: [],
      created_at: new Date().toISOString(),
      sync:       false
    }

    // Grava no aparelho antes de qualquer envio: se falhar aqui, o poste não é dado como salvo
    await filaPronta
    await idbSalvar(rec)
    registros.value.unshift(rec)
    fila.value.push(rec)

    if (online.value) sincronizar()
    return rec
  }

  async function enviarFoto (b64, nome) {
    const { error } = await supabase.storage
      .from('campo-fotos')
      .upload(nome, b64ToBlob(b64, 'image/jpeg'), { contentType: 'image/jpeg', upsert: true })
    if (error) { console.warn('[Campo] upload foto:', error.message); return null }
    return supabase.storage.from('campo-fotos').getPublicUrl(nome).data.publicUrl
  }

  // ── Sincronizar fila com Supabase ─────────────────────────────
  // ── Imprevistos (não execução) ────────────────────────────────
  const filaImprevistos = ref(lerJson(IMPREV_KEY, []))

  async function reportarImprevisto ({ nota, base, pep, equipe, motivo, observacao }) {
    filaImprevistos.value.push({
      id: crypto.randomUUID(),
      nota, base, pep, equipe, motivo,
      observacao: observacao || null,
      created_at: new Date().toISOString()
    })
    localStorage.setItem(IMPREV_KEY, JSON.stringify(filaImprevistos.value))
    if (online.value) await enviarImprevistos()
    return { enviado: !filaImprevistos.value.length }
  }

  async function enviarImprevistos () {
    for (const imp of [...filaImprevistos.value]) {
      const { error } = await supabase.from('campo_imprevistos').insert(imp)
      if (error && error.code !== '23505') { console.warn('[Campo] imprevisto:', error.message); continue }
      filaImprevistos.value = filaImprevistos.value.filter(i => i.id !== imp.id)
    }
    localStorage.setItem(IMPREV_KEY, JSON.stringify(filaImprevistos.value))
  }

  async function sincronizar () {
    if (filaImprevistos.value.length) await enviarImprevistos()
    if (sincronizando.value) return
    if (fila.value.length === 0) {
      if (filaStatus.value.length) await enviarStatus()
      return
    }
    sincronizando.value = true

    const pendentes = [...fila.value]
    for (const r of pendentes) {
      try {
        // Só remove da fila quando a foto principal e todas as extras foram enviadas
        let foto_url = null
        if (r.foto_b64) {
          foto_url = await enviarFoto(r.foto_b64, `${r.id}.jpg`)
          if (!foto_url) continue
        }
        const extras = r.extras_b64 || []
        const fotos_extras = []
        for (let i = 0; i < extras.length; i++) {
          const url = await enviarFoto(extras[i], `${r.id}_${i + 1}.jpg`)
          if (!url) break
          fotos_extras.push(url)
        }
        if (fotos_extras.length < extras.length) continue

        const { error: dbErr } = await supabase.from('campo_registros').upsert({
          id:         r.id,
          base:       r.base,
          pep:        r.pep,
          nota:       r.nota,
          equipe:     r.equipe,
          pg_numero:  r.pg_numero,
          foto_url,
          fotos_extras,
          created_at: r.created_at
        })
        if (dbErr) { console.warn('[Campo] registro:', dbErr.message); continue }

        await idbRemover(r.id).catch(() => {})
        fila.value = fila.value.filter(f => f.id !== r.id)
        const local = registros.value.find(l => l.id === r.id)
        if (local) Object.assign(local, { sync: true, foto_url, fotos_extras })

        if (r.nota) await supabase.rpc('campo_marcar_em_andamento', { p_nota: r.nota })
      } catch (e) {
        console.warn('[Campo] sync error:', e)
      }
    }

    if (filaStatus.value.length) await enviarStatus()
    sincronizando.value = false
  }

  return {
    sessao, registros, fila, online, sincronizando,
    resumoNotas, ultimaEquipe, carregandoHist, pausadas, filaImprevistos, filaStatus,
    reportarImprevisto,
    iniciarSessao, encerrarSessao, pausarSessao, finalizarSessao, salvarRegistro, sincronizar,
    carregarResumo, carregarRegistrosNota
  }
})
