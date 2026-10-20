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
          <span v-if="store.sessao?.cliente?.nome">Cliente: <strong>{{ store.sessao.cliente.nome }}</strong></span>
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
        <button v-if="notaSessao && temCoordenada(notaSessao)" class="cp-mapa" @click="mapaAberto = true">
          <q-icon name="navigation" size="20px" />
        </button>
        <button class="cp-exit" @click="encerrar">
          <q-icon name="logout" size="20px" />
        </button>
      </div>
    </header>

    <!-- ── ÁREA DE REGISTRO ───────────────────────────────────── -->
    <main class="cp-main">

      <div class="cp-card">

        <h2 class="cp-card-title">
          {{ fotoPrincipal ? 'Poste em registro' : 'Registrar Poste' }}
          <span v-if="fotoPrincipal" class="cp-card-step">{{ 1 + extras.length }} {{ extras.length ? 'fotos' : 'foto' }}</span>
        </h2>

        <!-- 1. PG -->
        <div class="cp-pg-wrap">
          <label class="cp-pg-label">Número do PG</label>
          <input
            v-model="pg"
            class="cp-pg-input"
            placeholder="Ex: PG-0001"
            type="text"
            inputmode="text"
            maxlength="20"
            @keyup.enter="!fotoPrincipal && abrirCamera('principal')"
          />
        </div>

        <!-- 2. Foto principal -->
        <button v-if="!fotoPrincipal" class="cp-camera-btn" @click="abrirCamera('principal')" :disabled="!pg.trim()">
          <div class="cp-camera-icon">
            <q-icon name="photo_camera" size="40px" />
          </div>
          <span>{{ pg.trim() ? 'Tirar foto principal do poste' : 'Digite o PG primeiro' }}</span>
        </button>

        <template v-else>
          <div class="cp-fotos-label">Foto principal</div>
          <div class="cp-principal">
            <img :src="fotoPrincipal" class="cp-principal-img" alt="foto principal do poste" @click="verFotos(fotosPosteAtual, 0)" />
            <button class="cp-principal-refazer" @click="abrirCamera('principal')">
              <q-icon name="replay" size="16px" /> Refazer
            </button>
          </div>

          <!-- 3. Fotos adicionais -->
          <div class="cp-fotos-label">Fotos adicionais <span class="cp-fotos-opc">(opcional)</span></div>
          <div class="cp-extras">
            <div v-for="(f, i) in extras" :key="i" class="cp-extra">
              <img :src="f" alt="foto adicional" @click="verFotos(fotosPosteAtual, i + 1)" />
              <button class="cp-extra-x" @click="extras.splice(i, 1)">
                <q-icon name="close" size="14px" />
              </button>
            </div>
            <button class="cp-extra-add" @click="abrirCamera('extra')">
              <q-icon name="add_a_photo" size="24px" />
              <span>Adicionar</span>
            </button>
          </div>

          <!-- 4. Salvar e partir para o próximo -->
          <div class="cp-preview-actions">
            <button class="cp-btn-refazer" @click="descartarPoste">
              <q-icon name="delete_outline" size="20px" /> Descartar
            </button>
            <button class="cp-btn-salvar" @click="salvar" :disabled="salvando || !pg.trim()">
              <q-circular-progress v-if="salvando" indeterminate size="20px" color="white" />
              <q-icon v-else name="check_circle" size="20px" />
              {{ salvando ? 'Salvando…' : 'Salvar poste' }}
            </button>
          </div>
        </template>

      </div>

    </main>

    <!-- ── LISTA DE REGISTROS ─────────────────────────────────── -->
    <section class="cp-list" v-if="store.registros.length > 0">
      <div class="cp-list-header">
        <span>Postes desta nota</span>
        <span class="cp-list-count">
          {{ store.registros.length }}<template v-if="postesPrevistos"> de {{ postesPrevistos }}</template>
        </span>
      </div>
      <div v-if="postesPrevistos" class="cp-progress">
        <div class="cp-progress-bar" :style="{ width: Math.min(100, store.registros.length / postesPrevistos * 100) + '%' }" />
      </div>
      <div v-if="anteriores" class="cp-retomada">
        <q-icon name="history" size="16px" />
        Continuando: {{ anteriores }} {{ anteriores === 1 ? 'poste registrado' : 'postes registrados' }} em turnos anteriores
      </div>
      <div class="cp-list-scroll">
        <div v-for="reg in store.registros" :key="reg.id" class="cp-reg-item">
          <div v-if="fotosDe(reg).length" class="cp-reg-thumb-wrap" @click="verFotos(fotosDe(reg), 0)">
            <img :src="fotosDe(reg)[0]" class="cp-reg-thumb" alt="foto do poste" />
            <span v-if="fotosDe(reg).length > 1" class="cp-reg-thumb-count">+{{ fotosDe(reg).length - 1 }}</span>
          </div>
          <div class="cp-reg-thumb cp-reg-thumb--empty" v-else>
            <q-icon name="image_not_supported" size="20px" />
          </div>
          <div class="cp-reg-info">
            <div class="cp-reg-pg">{{ reg.pg_numero }}</div>
            <div class="cp-reg-time">
              {{ formatarQuando(reg.created_at) }}<template v-if="reg.equipe && reg.equipe !== store.sessao?.equipe"> · {{ reg.equipe }}</template>
            </div>
          </div>
          <div class="cp-reg-status" :class="reg.sync ? 'cp-reg-status--ok' : 'cp-reg-status--pend'">
            <q-icon :name="reg.sync ? 'cloud_done' : 'cloud_upload'" size="18px" />
          </div>
        </div>
      </div>
    </section>

    <div class="cp-empty" v-else-if="!fotoPrincipal">
      <q-spinner v-if="store.carregandoHist" size="32px" color="grey-6" />
      <template v-else>
        <q-icon name="camera_alt" size="48px" class="cp-empty-icon" />
        <p>Nenhum poste registrado nesta nota.<br />Cadastre o primeiro poste acima.</p>
      </template>
    </div>

    <!-- ── RODAPÉ: pausar e retomar outro dia ─────────────────── -->
    <footer v-if="!fotoPrincipal" class="cp-footer">
      <button v-if="store.registros.length" class="cp-btn-finalizar" @click="finalizarNota">
        <q-icon name="task_alt" size="20px" />
        Finalizar nota
      </button>
      <button class="cp-btn-imprevisto" @click="imprevistoAberto = true">
        <q-icon name="report_problem" size="20px" />
        Imprevisto
      </button>
      <button class="cp-btn-depois" @click="concluirMaisTarde">
        <q-icon name="schedule" size="20px" />
        Concluir mais tarde
      </button>
    </footer>

    <MapaNotas
      v-model="mapaAberto"
      modo="campo"
      :grupos="notasParaMapa"
      :foco="store.sessao?.nota"
      :permitir-abrir="false"
      :plano-notas="store.plano.itens.map(i => i.nota)"
      @planejar="adicionarAoDia"
    />

    <ImprevistoDialog
      v-model="imprevistoAberto"
      :equipe="store.sessao?.equipe"
      :nota="notaSessao"
      @enviado="onImprevistoEnviado"
    />

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
        <div class="cam-pg-label">PG: {{ pg }} · {{ modoCaptura === 'extra' ? `Foto adicional ${extras.length + 1}` : 'Foto principal' }}</div>

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

    <!-- Visualizador de foto -->
    <q-dialog v-model="fotoDialog">
      <q-card style="width:95vw;max-width:520px;background:#0a1628;color:#fff">
        <q-card-section class="q-pa-sm">
          <img :src="fotoDialogLista[fotoDialogIdx]" style="max-width:100%;max-height:70vh;display:block;margin:0 auto;border-radius:8px" alt="foto ampliada" />
        </q-card-section>
        <q-card-actions align="between" class="items-center">
          <q-btn flat round icon="chevron_left" color="white" :disable="fotoDialogIdx === 0" @click="fotoDialogIdx--" />
          <span class="text-caption">
            {{ fotoDialogIdx === 0 ? 'Foto principal' : `Adicional ${fotoDialogIdx}` }} · {{ fotoDialogIdx + 1 }} de {{ fotoDialogLista.length }}
          </span>
          <q-btn flat round icon="chevron_right" color="white" :disable="fotoDialogIdx >= fotoDialogLista.length - 1" @click="fotoDialogIdx++" />
        </q-card-actions>
        <q-card-actions align="right" class="q-pt-none">
          <q-btn flat label="Fechar" color="white" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useCampoStore } from 'stores/campo'
import { useNotasStore } from 'stores/notas'
import ImprevistoDialog from 'components/ImprevistoDialog.vue'
import MapaNotas from 'components/MapaNotas.vue'
import { temCoordenada } from 'src/utils/rota'

const router      = useRouter()
const $q          = useQuasar()
const store       = useCampoStore()
const notasStore  = useNotasStore()

if (!store.sessao) router.replace('/campo')

// Sincroniza notas ao voltar online durante sessão ativa
function aoVoltarOnline () {
  notasStore.fetchNotas()
  store.carregarRegistrosNota()
}

onMounted(() => {
  window.addEventListener('online', aoVoltarOnline)
  if (navigator.onLine) notasStore.fetchNotas()
  store.carregarRegistrosNota()
})

const postesPrevistos = computed(() => Number(store.sessao?.postes) || 0)

const inicioTurno = new Date().toDateString()
const anteriores  = computed(() =>
  store.registros.filter(r => new Date(r.created_at).toDateString() !== inicioTurno).length
)

// ── Estado ──────────────────────────────────────────────────────
const pg             = ref('')
const fotoPrincipal  = ref(null)
const extras         = ref([])
const modoCaptura    = ref('principal')
const salvando       = ref(false)
const fotoDialog     = ref(false)
const fotoDialogLista = ref([])
const fotoDialogIdx  = ref(0)

const fotosPosteAtual = computed(() => fotoPrincipal.value ? [fotoPrincipal.value, ...extras.value] : [])

function fotosDe (reg) {
  const principal = reg.foto_url || reg.foto_b64
  const adicionais = reg.fotos_extras?.length ? reg.fotos_extras : (reg.extras_b64 || [])
  return [principal, ...adicionais].filter(Boolean)
}

function aplicarFoto (b64) {
  if (modoCaptura.value === 'extra') extras.value.push(b64)
  else fotoPrincipal.value = b64
}

function descartarPoste () {
  $q.dialog({
    title: 'Descartar este poste?',
    message: `As ${fotosPosteAtual.value.length} foto(s) do PG ${pg.value.trim()} serão perdidas.`,
    cancel: { label: 'Voltar', flat: true },
    ok: { label: 'Descartar', color: 'negative' }
  }).onOk(() => {
    fotoPrincipal.value = null
    extras.value = []
  })
}

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

function abrirCamera (modo = 'principal') {
  if (!pg.value.trim()) return
  modoCaptura.value = modo
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

  aplicarFoto(canvas.toDataURL('image/jpeg', 0.88))
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
        aplicarFoto(c.toDataURL('image/jpeg', 0.88))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }
  inp.click()
}

// ── Salvar poste ────────────────────────────────────────────────
function salvar () {
  if (!pg.value.trim() || !fotoPrincipal.value) return
  const alvo = pg.value.trim().toUpperCase()
  const repetido = store.registros.find(r => String(r.pg_numero).trim().toUpperCase() === alvo)
  if (!repetido) return gravar()
  $q.dialog({
    title: 'PG já registrado',
    message: `O PG ${pg.value.trim()} já foi registrado em ${formatarQuando(repetido.created_at)}. Registrar novamente?`,
    cancel: { label: 'Cancelar', flat: true },
    ok: { label: 'Registrar mesmo assim', color: 'warning' }
  }).onOk(gravar)
}

async function gravar () {
  salvando.value = true
  try {
    const total = fotosPosteAtual.value.length
    await store.salvarRegistro({ pg: pg.value.trim(), fotoB64: fotoPrincipal.value, extrasB64: [...extras.value] })
    $q.notify({
      type: 'positive',
      message: `PG ${pg.value.trim()} salvo com ${total} ${total === 1 ? 'foto' : 'fotos'}. Registre o próximo poste.`,
      position: 'top', timeout: 2200
    })
    pg.value = ''
    fotoPrincipal.value = null
    extras.value = []
  } catch (e) {
    $q.notify({ type: 'negative', message: 'Não foi possível salvar o poste no aparelho: ' + e.message, position: 'top', timeout: 6000 })
  } finally {
    salvando.value = false
  }
}

const imprevistoAberto = ref(false)
const notaSessao = computed(() => {
  const s = store.sessao
  if (!s) return null
  return notasStore.getNota(s.nota) ?? { nota: s.nota, base: s.base, pep: s.pep }
})

const mapaAberto = ref(false)
const notasParaMapa = computed(() => {
  const atual = store.sessao?.nota
  return notasStore.notas.filter(n => n.nota === atual || ['pendente', 'em_andamento'].includes(n.status))
})

function adicionarAoDia (codigos) {
  const n = store.adicionarAoPlano(codigos)
  $q.notify({
    type: n ? 'positive' : 'info',
    icon: 'event_available',
    message: n ? `${n} ${n === 1 ? 'nota adicionada' : 'notas adicionadas'} ao seu dia.` : 'Essas notas já estão no seu dia.',
    position: 'top', timeout: 2200
  })
}

// Depois de finalizar, pausar ou reportar imprevisto, lembra qual é a próxima nota do dia
function avisarProxima (excluir) {
  const p = store.proximaDoPlano
  const n = p && notasStore.getNota(p.nota)
  if (!n || n.nota === excluir) return
  setTimeout(() => $q.notify({
    type: 'info', icon: 'event_note', position: 'top', timeout: 5000,
    message: `Próxima do seu dia: ${n.projeto_info_sap || n.nota}${n.municipio ? ' · ' + n.municipio : ''}`
  }), 600)
}

function onImprevistoEnviado ({ enviado }) {
  const nota = store.sessao?.nota
  store.marcarNoPlano(nota, 'imprevisto')
  store.encerrarSessao()
  $q.notify({
    type: enviado ? 'positive' : 'warning',
    message: enviado
      ? `Imprevisto da nota ${nota} registrado. Turno encerrado.`
      : `Sem conexão: o imprevisto da nota ${nota} será enviado quando houver internet.`,
    position: 'top'
  })
  avisarProxima()
  router.push('/campo')
}

function finalizarNota () {
  const total = store.registros.length
  const nota  = store.sessao?.nota
  const faltam = postesPrevistos.value > total ? postesPrevistos.value - total : 0
  $q.dialog({
    title: `Finalizar a nota ${nota}?`,
    message: `${total} ${total === 1 ? 'poste registrado' : 'postes registrados'}` +
      (postesPrevistos.value ? ` de ${postesPrevistos.value} previstos` : '') + '. ' +
      (faltam ? `Ainda faltam ${faltam} poste(s) previsto(s). ` : '') +
      'A nota seguirá para a Etapa 2 (equipe 2) no sistema e sairá da lista "Continuar de onde parou". ' +
      'Se ainda for voltar ao local, use "Concluir mais tarde".',
    cancel: { label: 'Voltar', flat: true },
    ok: { label: 'Finalizar', color: 'positive', unelevated: true }
  }).onOk(async () => {
    const { enviado } = await store.finalizarSessao()
    store.carregarResumo()
    $q.notify({
      type: enviado ? 'positive' : 'warning',
      message: enviado
        ? `Nota ${nota} finalizada e enviada para a Etapa 2.`
        : `Nota ${nota} finalizada. Seguirá para a Etapa 2 quando todos os postes subirem — não desinstale o app.`,
      position: 'top', timeout: enviado ? 2500 : 6000
    })
    avisarProxima()
    router.push('/campo')
  })
}

function concluirMaisTarde () {
  const total = store.registros.length
  const pend  = store.fila.filter(r => r.nota === store.sessao?.nota).length
  const resumo = `${total} ${total === 1 ? 'poste registrado' : 'postes registrados'}` +
    (postesPrevistos.value ? ` de ${postesPrevistos.value} previstos` : '') + '.'
  const aviso = pend
    ? ` ${pend} ainda ${pend === 1 ? 'aguarda' : 'aguardam'} envio e ${pend === 1 ? 'será enviado' : 'serão enviados'} quando houver internet — não desinstale o app.`
    : ''
  $q.dialog({
    title: 'Concluir mais tarde?',
    message: `${resumo}${aviso} Para continuar, escolha esta nota em "Continuar de onde parou".`,
    cancel: { label: 'Voltar', flat: true },
    ok: { label: 'Pausar turno', color: 'warning', unelevated: true }
  }).onOk(async () => {
    if (store.online && store.fila.length) await store.sincronizar()
    const nota = store.sessao?.nota
    store.pausarSessao()
    store.carregarResumo()
    $q.notify({ type: 'info', message: `Nota ${nota} pausada. Continue quando quiser.`, icon: 'schedule', position: 'top' })
    avisarProxima(nota)
    router.push('/campo')
  })
}

function encerrar () {
  $q.dialog({
    title: 'Encerrar turno?',
    message: (fotoPrincipal.value ? `Atenção: o PG ${pg.value.trim()} em registro ainda não foi salvo e as fotos dele serão perdidas. ` : '') +
      'Os postes registrados ficam salvos. Para continuar outro dia, inicie um turno com a mesma nota.',
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

function formatarQuando (iso) {
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === new Date().toDateString()) return `hoje ${hora}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`
}

function verFotos (lista, idx = 0) {
  if (!lista?.length) return
  fotoDialogLista.value = lista
  fotoDialogIdx.value = idx
  fotoDialog.value = true
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
.cp-mapa {
  border: none; background: rgba(46,125,50,0.25);
  color: #81c784;
  border-radius: 10px; padding: 8px;
  cursor: pointer; display: flex; align-items: center;
  -webkit-tap-highlight-color: transparent;
}
.cp-mapa:active { background: rgba(46,125,50,0.4); }

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

/* Poste em registro: foto principal + adicionais */
.cp-card-title { display: flex; align-items: center; gap: 10px; }
.cp-card-step {
  font-size: 11px; font-weight: 700;
  color: #90caf9; background: rgba(25,118,210,0.18);
  border-radius: 20px; padding: 2px 10px;
}
.cp-fotos-label {
  font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.4);
  letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: -10px;
}
.cp-fotos-opc { text-transform: none; font-weight: 500; letter-spacing: 0; }
.cp-principal { position: relative; }
.cp-principal-img {
  width: 100%; max-height: 260px; object-fit: cover;
  border-radius: 14px; display: block; background: #0a1628; cursor: pointer;
}
.cp-principal-refazer {
  position: absolute; right: 10px; bottom: 10px;
  display: flex; align-items: center; gap: 4px;
  border: none; border-radius: 20px; padding: 6px 12px;
  background: rgba(0,0,0,0.6); color: #fff;
  font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
}
.cp-extras { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.cp-extra { position: relative; aspect-ratio: 1; }
.cp-extra img { width: 100%; height: 100%; object-fit: cover; border-radius: 10px; cursor: pointer; }
.cp-extra-x {
  position: absolute; top: -6px; right: -6px;
  width: 22px; height: 22px; border-radius: 50%; border: none;
  background: #c62828; color: #fff;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.cp-extra-add {
  aspect-ratio: 1;
  border-radius: 10px; border: 2px dashed rgba(25,118,210,0.5);
  background: rgba(25,118,210,0.08); color: #64b5f6;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  font-family: inherit; font-size: 11px; font-weight: 700; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.cp-extra-add:active { transform: scale(0.95); }
.cp-reg-thumb-wrap { position: relative; flex-shrink: 0; cursor: pointer; }
.cp-reg-thumb-count {
  position: absolute; right: -4px; bottom: -4px;
  background: #1976d2; color: #fff;
  font-size: 10px; font-weight: 800;
  border-radius: 10px; padding: 1px 6px;
  border: 2px solid #0e1e35;
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
.cp-progress {
  height: 6px; border-radius: 6px;
  background: rgba(255,255,255,0.08);
  overflow: hidden; margin: -4px 0 12px;
}
.cp-progress-bar { height: 100%; background: linear-gradient(90deg, #1976d2, #00c853); transition: width 0.3s; }
.cp-retomada {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: #90caf9;
  background: rgba(25,118,210,0.12);
  border: 1px solid rgba(25,118,210,0.25);
  border-radius: 12px; padding: 8px 12px;
  margin-bottom: 12px;
}
.cp-reg-item {
  display: flex; align-items: center; gap: 12px;
  background: #0e1e35;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px; padding: 12px 14px;
}
.cp-reg-thumb { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; flex-shrink: 0; background: rgba(255,255,255,0.05); cursor: pointer; }
.cp-reg-thumb--empty { display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.2); }
.cp-reg-info { flex: 1; min-width: 0; }
.cp-reg-pg   { font-size: 16px; font-weight: 700; color: #fff; }
.cp-reg-time { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
.cp-reg-status { flex-shrink: 0; }
.cp-reg-status--ok   { color: #00c853; }
.cp-reg-status--pend { color: #ff9800; }

/* Rodapé */
.cp-footer {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(6,13,26,0) 0%, #060d1a 35%);
}
.cp-footer { display: flex; flex-wrap: wrap; gap: 10px; }
.cp-btn-finalizar {
  flex: 1 1 100%;
  padding: 15px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #2e7d32, #43a047);
  color: #fff;
  font-family: inherit; font-size: 15px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(46,125,50,0.35);
  -webkit-tap-highlight-color: transparent;
}
.cp-btn-finalizar:active { transform: scale(0.97); }
.cp-btn-imprevisto {
  flex: 0 0 auto;
  padding: 15px 16px;
  border-radius: 14px;
  border: 1.5px solid rgba(239,83,80,0.5);
  background: rgba(239,83,80,0.12);
  color: #ef9a9a;
  font-family: inherit; font-size: 15px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.cp-btn-imprevisto:active { transform: scale(0.97); }
.cp-btn-depois {
  flex: 1;
  padding: 15px;
  border-radius: 14px;
  border: 1.5px solid rgba(255,152,0,0.5);
  background: rgba(255,152,0,0.12);
  color: #ffb74d;
  font-family: inherit; font-size: 15px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.12s, background 0.15s;
}
.cp-btn-depois:active { transform: scale(0.97); background: rgba(255,152,0,0.22); }

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
