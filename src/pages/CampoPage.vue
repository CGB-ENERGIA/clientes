<template>
  <div class="campo-root">

    <!-- ── HEADER ─────────────────────────────────────────────── -->
    <header class="cp-header">
      <div class="cp-session">
        <div class="cp-session-tag">{{ store.sessao?.base }}</div>
        <div class="cp-session-info">
          <span v-if="store.sessao?.pep">PEP: <strong>{{ store.sessao.pep }}</strong></span>
          <span v-if="store.sessao?.nota">NOTA: <strong>{{ store.sessao.nota }}</strong></span>
          <span>Equipe: <strong>{{ store.sessao?.equipe }}</strong></span>
        </div>
      </div>

      <div class="cp-header-right">
        <div class="cp-online" :class="store.online ? 'cp-online--ok' : 'cp-online--off'">
          <span class="cp-online-dot" />
          {{ store.online ? 'Online' : 'Offline' }}
        </div>
        <div v-if="store.fila.length > 0" class="cp-badge">
          <q-icon name="sync" size="14px" :class="{ 'spin': store.sincronizando }" />
          {{ store.fila.length }}
        </div>
        <button class="cp-exit" @click="encerrar">
          <q-icon name="logout" size="20px" />
        </button>
      </div>
    </header>

    <!-- ── ÁREA DE REGISTRO ───────────────────────────────────── -->
    <main class="cp-main">

      <!-- CARD de novo registro -->
      <div class="cp-card" v-if="!fotoPreview">

        <h2 class="cp-card-title">Registrar Poste</h2>

        <!-- PG input -->
        <div class="cp-pg-wrap">
          <label class="cp-pg-label">Número do PG</label>
          <input
            v-model="pg"
            class="cp-pg-input"
            placeholder="Ex: PG-0001"
            type="text"
            inputmode="text"
            maxlength="20"
            @keyup.enter="abrirCamera"
          />
        </div>

        <!-- Botão câmera -->
        <button class="cp-camera-btn" @click="abrirCamera" :disabled="!pg.trim()">
          <div class="cp-camera-icon">
            <q-icon name="photo_camera" size="40px" />
          </div>
          <span>{{ pg.trim() ? 'Tirar Foto do Poste' : 'Digite o PG primeiro' }}</span>
        </button>

      </div>

      <!-- PREVIEW da foto -->
      <div class="cp-preview-card" v-else>
        <div class="cp-preview-pg">PG: <strong>{{ pg }}</strong></div>
        <img :src="fotoPreview" class="cp-preview-img" alt="foto do poste" />
        <div class="cp-preview-actions">
          <button class="cp-btn-refazer" @click="refazerFoto">
            <q-icon name="replay" size="20px" /> Refazer
          </button>
          <button class="cp-btn-salvar" @click="salvar" :disabled="salvando">
            <q-circular-progress v-if="salvando" indeterminate size="20px" color="white" />
            <q-icon v-else name="check_circle" size="20px" />
            {{ salvando ? 'Salvando…' : 'Salvar' }}
          </button>
        </div>
      </div>

    </main>

    <!-- ── LISTA DE REGISTROS ─────────────────────────────────── -->
    <section class="cp-list" v-if="store.registros.length > 0">
      <div class="cp-list-header">
        <span>Registros desta sessão</span>
        <span class="cp-list-count">{{ store.registros.length }}</span>
      </div>
      <div class="cp-list-scroll">
        <div v-for="reg in store.registros" :key="reg.id" class="cp-reg-item">
          <img
            v-if="reg.foto_b64 || reg.foto_url"
            :src="reg.foto_url || reg.foto_b64"
            class="cp-reg-thumb" alt=""
          />
          <div class="cp-reg-thumb cp-reg-thumb--empty" v-else>
            <q-icon name="image_not_supported" size="20px" />
          </div>
          <div class="cp-reg-info">
            <div class="cp-reg-pg">{{ reg.pg_numero }}</div>
            <div class="cp-reg-time">{{ formatarHora(reg.created_at) }}</div>
          </div>
          <div class="cp-reg-status" :class="reg.sync ? 'cp-reg-status--ok' : 'cp-reg-status--pend'">
            <q-icon :name="reg.sync ? 'cloud_done' : 'cloud_upload'" size="18px" />
          </div>
        </div>
      </div>
    </section>

    <div class="cp-empty" v-else-if="!fotoPreview">
      <q-icon name="camera_alt" size="48px" class="cp-empty-icon" />
      <p>Nenhum registro nesta sessão.<br />Cadastre o primeiro poste acima.</p>
    </div>

    <!-- ── MODAL CÂMERA ──────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="cameraAberta" class="cam-overlay">

        <!-- Viewfinder -->
        <video
          ref="videoEl"
          class="cam-video"
          autoplay
          playsinline
          muted
        />

        <!-- Timestamp ao vivo sobre o vídeo -->
        <div class="cam-timestamp">
          <div class="cam-ts-equipe">{{ store.sessao?.equipe }}</div>
          <div class="cam-ts-time">{{ horaAoVivo }}</div>
          <div class="cam-ts-gps" v-if="gps">
            {{ gps.lat.toFixed(6) }}, {{ gps.lng.toFixed(6) }}
          </div>
          <div class="cam-ts-gps cam-ts-gps--buscando" v-else>
            <q-spinner size="10px" /> Buscando GPS…
          </div>
        </div>

        <!-- Indicador de câmera traseira -->
        <div class="cam-pg-label">PG: {{ pg }}</div>

        <!-- Controles -->
        <div class="cam-controls">
          <button class="cam-btn-cancel" @click="fecharCamera">
            <q-icon name="close" size="28px" />
          </button>
          <button class="cam-shutter" @click="capturar">
            <div class="cam-shutter-inner" />
          </button>
          <button class="cam-btn-flip" @click="flipCamera">
            <q-icon name="flip_camera_ios" size="28px" />
          </button>
        </div>

        <!-- Canvas oculto para captura -->
        <canvas ref="canvasEl" class="cam-canvas-hidden" />
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useCampoStore } from 'stores/campo'
import { useNotasStore } from 'stores/notas'

const router      = useRouter()
const $q          = useQuasar()
const store       = useCampoStore()
const notasStore  = useNotasStore()

if (!store.sessao) router.replace('/campo')

// Sincroniza notas ao voltar online durante sessão ativa
function aoVoltarOnline () {
  notasStore.fetchNotas()
}

onMounted(() => {
  window.addEventListener('online', aoVoltarOnline)
  if (navigator.onLine) notasStore.fetchNotas()
})

// ── Estado ──────────────────────────────────────────────────────
const pg          = ref('')
const fotoPreview = ref(null)
const fotoB64     = ref(null)
const salvando    = ref(false)

// ── Câmera ──────────────────────────────────────────────────────
const cameraAberta  = ref(false)
const videoEl       = ref(null)
const canvasEl      = ref(null)
const stream        = ref(null)
const facingMode    = ref('environment') // rear camera por padrão
const gps           = ref(null)
const horaAoVivo    = ref('')
let   clockInterval = null
let   geoWatchId    = null

function iniciarRelogio () {
  horaAoVivo.value = formatarDataHora(new Date())
  clockInterval = setInterval(() => {
    horaAoVivo.value = formatarDataHora(new Date())
  }, 1000)
}

function pararRelogio () {
  if (clockInterval) { clearInterval(clockInterval); clockInterval = null }
}

function iniciarGPS () {
  if (!navigator.geolocation) return
  geoWatchId = navigator.geolocation.watchPosition(
    pos => { gps.value = { lat: pos.coords.latitude, lng: pos.coords.longitude } },
    () => { gps.value = null },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

function pararGPS () {
  if (geoWatchId !== null) { navigator.geolocation.clearWatch(geoWatchId); geoWatchId = null }
}

async function iniciarStream () {
  try {
    if (stream.value) { stream.value.getTracks().forEach(t => t.stop()) }
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode.value, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    })
    if (videoEl.value) {
      videoEl.value.srcObject = stream.value
    }
  } catch (err) {
    $q.notify({ type: 'warning', message: 'Câmera indisponível. Usando seletor de arquivo.', position: 'top', timeout: 2500 })
    cameraAberta.value = false
    abrirCameraFallback()
  }
}

function abrirCamera () {
  if (!pg.value.trim()) return
  gps.value = null
  cameraAberta.value = true
  iniciarRelogio()
  iniciarGPS()
  // Aguarda o DOM montar o <video> antes de atribuir stream
  setTimeout(iniciarStream, 80)
}

function fecharCamera () {
  cameraAberta.value = false
  pararRelogio()
  pararGPS()
  if (stream.value) { stream.value.getTracks().forEach(t => t.stop()); stream.value = null }
}

async function flipCamera () {
  facingMode.value = facingMode.value === 'environment' ? 'user' : 'environment'
  await iniciarStream()
}

// ── Captura + watermark ─────────────────────────────────────────
function capturar () {
  const video  = videoEl.value
  const canvas = canvasEl.value
  if (!video || !canvas) return

  const W = video.videoWidth  || 1280
  const H = video.videoHeight || 720

  // Limita a 1280px mantendo proporção
  const MAX = 1280
  let w = W, h = H
  if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }

  canvas.width  = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0, w, h)

  // ── Watermark ─────────────────────────────────────────────────
  desenharWatermark(ctx, w, h)

  const b64 = canvas.toDataURL('image/jpeg', 0.88)
  fotoB64.value     = b64
  fotoPreview.value = b64

  fecharCamera()
}

function desenharWatermark (ctx, w, h) {
  const equipe = store.sessao?.equipe ?? ''
  const agora  = new Date()
  const hora   = formatarDataHora(agora)
  const coord  = gps.value
    ? `${gps.value.lat.toFixed(6)}, ${gps.value.lng.toFixed(6)}`
    : 'GPS indisponível'

  const linhas = [equipe, hora, coord].filter(Boolean)

  const fontBase  = Math.max(12, Math.round(w * 0.022))
  const padding   = Math.round(fontBase * 0.8)
  const lineH     = Math.round(fontBase * 1.55)
  const blockH    = linhas.length * lineH + padding * 2
  const blockY    = h - blockH - Math.round(h * 0.015)

  // Fundo semi-transparente
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  const r = Math.round(fontBase * 0.6)
  const bx = Math.round(w * 0.015)
  roundRect(ctx, bx, blockY, w - bx * 2, blockH, r)
  ctx.fill()

  // Texto
  ctx.font      = `700 ${fontBase}px 'Arial', sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'

  linhas.forEach((ln, i) => {
    const y = blockY + padding + lineH * i + lineH / 2
    // Sombra leve
    ctx.shadowColor   = 'rgba(0,0,0,0.8)'
    ctx.shadowBlur    = 4
    ctx.shadowOffsetX = 1
    ctx.shadowOffsetY = 1
    ctx.fillText(ln, bx + padding, y)
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0
  })
}

function roundRect (ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ── Fallback: seletor de arquivo se getUserMedia falhar ──────────
const fileInput = ref(null)

function abrirCameraFallback () {
  const inp = document.createElement('input')
  inp.type    = 'file'
  inp.accept  = 'image/*'
  inp.capture = 'environment'
  inp.onchange = e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1280
        let w = img.width, h = img.height
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const ctx = c.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        desenharWatermark(ctx, w, h)
        const b64 = c.toDataURL('image/jpeg', 0.88)
        fotoB64.value     = b64
        fotoPreview.value = b64
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }
  inp.click()
}

// ── Refazer / salvar ────────────────────────────────────────────
function refazerFoto () {
  fotoPreview.value = null
  fotoB64.value     = null
  abrirCamera()
}

async function salvar () {
  if (!pg.value.trim() || !fotoB64.value) return
  salvando.value = true
  try {
    await store.salvarRegistro({ pg: pg.value.trim(), fotoB64: fotoB64.value, fotoMime: 'image/jpeg' })
    $q.notify({ type: 'positive', message: `PG ${pg.value} salvo!`, position: 'top', timeout: 1800 })
    pg.value = ''
    fotoPreview.value = null
    fotoB64.value     = null
  } finally {
    salvando.value = false
  }
}

function encerrar () {
  $q.dialog({
    title: 'Encerrar turno?',
    message: 'Você será redirecionado para a tela inicial.',
    cancel: true, ok: 'Encerrar', color: 'negative'
  }).onOk(() => {
    store.encerrarSessao()
    router.push('/campo')
  })
}

// ── Utils ────────────────────────────────────────────────────────
function formatarDataHora (d) {
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function formatarHora (iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

onUnmounted(() => {
  fecharCamera()
  window.removeEventListener('online', aoVoltarOnline)
})
</script>

<style scoped>
/* ── Root ── */
.campo-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #060d1a;
  color: #fff;
  font-family: inherit;
  max-width: 520px;
  margin: 0 auto;
}

/* ── Header ── */
.cp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #0a1628;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  gap: 10px;
  flex-shrink: 0;
}
.cp-session { flex: 1; min-width: 0; }
.cp-session-tag {
  display: inline-block;
  font-size: 10px; font-weight: 800;
  color: #ffca28; letter-spacing: 0.1em; text-transform: uppercase;
  background: rgba(255,202,40,0.12);
  border: 1px solid rgba(255,202,40,0.25);
  border-radius: 6px; padding: 2px 8px;
  margin-bottom: 4px;
}
.cp-session-info {
  display: flex; flex-wrap: wrap; gap: 6px 12px;
  font-size: 11px; color: rgba(255,255,255,0.5);
}
.cp-session-info strong { color: rgba(255,255,255,0.85); }
.cp-header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.cp-online {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
  border-radius: 20px; padding: 4px 10px;
}
.cp-online--ok  { background: rgba(0,200,83,0.15); color: #00c853; }
.cp-online--off { background: rgba(239,83,80,0.15); color: #ef5350; }
.cp-online-dot  { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

.cp-badge {
  display: flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 700;
  background: rgba(255,152,0,0.2); color: #ff9800;
  border-radius: 20px; padding: 3px 8px;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.cp-exit {
  border: none; background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.5);
  border-radius: 10px; padding: 8px;
  cursor: pointer; display: flex; align-items: center;
  transition: background 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.cp-exit:active { background: rgba(255,255,255,0.14); }

/* ── Main ── */
.cp-main { padding: 20px 16px; flex-shrink: 0; }

.cp-card {
  background: #0e1e35;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 24px 20px;
  display: flex; flex-direction: column; gap: 20px;
}
.cp-card-title { font-size: 18px; font-weight: 800; color: #fff; margin: 0; }

.cp-pg-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; text-transform: uppercase; }
.cp-pg-wrap  { display: flex; flex-direction: column; gap: 8px; }
.cp-pg-input {
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 2px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  color: #fff; font-size: 22px; font-weight: 700;
  padding: 14px 18px;
  outline: none; font-family: inherit;
  letter-spacing: 1px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.cp-pg-input::placeholder { color: rgba(255,255,255,0.2); font-weight: 400; font-size: 16px; }
.cp-pg-input:focus { border-color: #1976d2; box-shadow: 0 0 0 3px rgba(25,118,210,0.18); }

.cp-camera-btn {
  width: 100%;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 28px 20px;
  border-radius: 18px; border: 2px dashed rgba(25,118,210,0.4);
  background: rgba(25,118,210,0.07);
  color: #1976d2;
  cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 600;
  transition: background 0.2s, border-color 0.2s, transform 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.cp-camera-btn:disabled {
  color: rgba(255,255,255,0.2);
  border-color: rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.03);
  cursor: not-allowed;
}
.cp-camera-btn:not(:disabled):active { transform: scale(0.97); background: rgba(25,118,210,0.15); }
.cp-camera-icon {
  width: 72px; height: 72px; border-radius: 50%;
  background: rgba(25,118,210,0.15);
  display: flex; align-items: center; justify-content: center;
}

/* Preview */
.cp-preview-card {
  background: #0e1e35;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 20px;
  display: flex; flex-direction: column; gap: 16px;
}
.cp-preview-pg { font-size: 13px; color: rgba(255,255,255,0.5); }
.cp-preview-pg strong { color: #fff; font-size: 18px; }
.cp-preview-img {
  width: 100%; border-radius: 14px; object-fit: cover;
  max-height: 320px; background: #0a1628;
}
.cp-preview-actions { display: flex; gap: 12px; }
.cp-btn-refazer, .cp-btn-salvar {
  flex: 1; padding: 16px;
  border-radius: 14px; border: none;
  font-family: inherit; font-size: 15px; font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.12s;
}
.cp-btn-refazer:active, .cp-btn-salvar:active { transform: scale(0.96); }
.cp-btn-refazer { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.7); }
.cp-btn-salvar  { background: linear-gradient(135deg, #1b5e20, #2e7d32); color: #fff; box-shadow: 0 4px 20px rgba(46,125,50,0.4); }
.cp-btn-salvar:disabled { opacity: 0.7; cursor: not-allowed; }

/* Lista */
.cp-list { flex: 1; padding: 0 16px 24px; }
.cp-list-header {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.4);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin-bottom: 12px;
}
.cp-list-count { background: rgba(255,255,255,0.1); border-radius: 20px; padding: 2px 10px; font-size: 12px; color: rgba(255,255,255,0.6); }
.cp-list-scroll { display: flex; flex-direction: column; gap: 10px; }
.cp-reg-item {
  display: flex; align-items: center; gap: 12px;
  background: #0e1e35;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px; padding: 12px 14px;
}
.cp-reg-thumb { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; flex-shrink: 0; background: rgba(255,255,255,0.05); }
.cp-reg-thumb--empty { display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.2); }
.cp-reg-info { flex: 1; min-width: 0; }
.cp-reg-pg   { font-size: 16px; font-weight: 700; color: #fff; }
.cp-reg-time { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
.cp-reg-status { flex-shrink: 0; }
.cp-reg-status--ok   { color: #00c853; }
.cp-reg-status--pend { color: #ff9800; }

/* Empty */
.cp-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; padding: 40px 20px;
  color: rgba(255,255,255,0.25); text-align: center; font-size: 13px;
}
.cp-empty-icon { color: rgba(255,255,255,0.12); }

/* ── Modal câmera ── */
.cam-overlay {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.cam-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cam-canvas-hidden { display: none; }

/* Timestamp overlay */
.cam-timestamp {
  position: absolute;
  bottom: 130px;
  left: 12px;
  right: 12px;
  background: rgba(0,0,0,0.55);
  border-radius: 10px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  z-index: 2;
  backdrop-filter: blur(2px);
}
.cam-ts-equipe {
  font-size: 13px; font-weight: 800;
  color: #ffca28; letter-spacing: 0.06em;
  text-transform: uppercase;
}
.cam-ts-time {
  font-size: 12px; font-weight: 600; color: #fff;
  font-variant-numeric: tabular-nums;
}
.cam-ts-gps {
  font-size: 11px; color: rgba(255,255,255,0.7);
  display: flex; align-items: center; gap: 5px;
}
.cam-ts-gps--buscando { color: rgba(255,255,255,0.4); }

/* Label PG */
.cam-pg-label {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(2px);
  color: #fff;
  font-size: 14px; font-weight: 800;
  border-radius: 20px;
  padding: 6px 20px;
  z-index: 2;
  letter-spacing: 0.08em;
}

/* Controles */
.cam-controls {
  position: absolute;
  bottom: 28px;
  left: 0; right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  z-index: 2;
}

.cam-btn-cancel, .cam-btn-flip {
  width: 52px; height: 52px; border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.15);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, transform 0.1s;
}
.cam-btn-cancel:active, .cam-btn-flip:active {
  background: rgba(255,255,255,0.3);
  transform: scale(0.93);
}

.cam-shutter {
  width: 76px; height: 76px; border-radius: 50%;
  border: 4px solid #fff;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.1s;
}
.cam-shutter:active { transform: scale(0.9); }
.cam-shutter-inner {
  width: 58px; height: 58px; border-radius: 50%;
  background: #fff;
  transition: background 0.1s;
}
.cam-shutter:active .cam-shutter-inner { background: rgba(255,255,255,0.7); }
</style>
