<template>
  <q-dialog
    :model-value="modelValue"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
    @update:model-value="v => emit('update:modelValue', v)"
    @show="montarMapa"
    @hide="desmontarMapa"
  >
    <q-card class="mapa-card">
      <q-bar class="mapa-bar">
        <q-icon name="map" size="18px" />
        <span class="q-ml-sm text-weight-bold">Mapa das notas</span>
        <span class="mapa-bar-sub q-ml-sm">
          {{ notasNoMapa.length }} no mapa
          <template v-if="semCoordenada.length"> · {{ semCoordenada.length }} sem coordenada</template>
        </span>
        <q-space />
        <q-btn icon="close" flat dense round color="white" v-close-popup />
      </q-bar>

      <div class="mapa-toolbar">
        <q-input
          v-model="busca"
          dense outlined
          placeholder="Buscar nota, SAP ou município"
          class="mapa-busca"
          clearable
          @keyup.enter="irParaBusca"
        >
          <template #prepend><q-icon name="search" /></template>
        </q-input>

        <q-select
          v-model="filtroBase"
          :options="basesOpcoes"
          dense outlined clearable
          label="Base"
          class="mapa-filtro"
          options-dense
        >
          <template #prepend><q-icon name="business" size="18px" /></template>
        </q-select>
        <q-select
          v-model="filtroMunicipio"
          :options="municipiosOpcoesFiltradas"
          dense outlined clearable
          use-input input-debounce="0"
          label="Município"
          class="mapa-filtro mapa-filtro--mun"
          options-dense
          @filter="filtrarMunicipios"
        >
          <template #prepend><q-icon name="location_city" size="18px" /></template>
          <template #no-option>
            <q-item><q-item-section class="text-grey">Nenhum município</q-item-section></q-item>
          </template>
        </q-select>

        <div class="mapa-legenda">
          <button
            v-for="s in statusVisiveis"
            :key="s.val"
            class="mapa-leg-item"
            :class="{ 'mapa-leg-item--off': ocultos.has(s.val) }"
            @click="alternarStatus(s.val)"
          >
            <span class="mapa-leg-dot" :style="{ background: s.cor }" />
            {{ s.label }}
            <b>{{ contagem[s.val] || 0 }}</b>
          </button>
        </div>

        <template v-if="modo === 'campo'">
          <q-btn dense unelevated no-caps color="blue-7" icon="my_location" label="Onde estou" @click="centralizarEmMim" />
          <q-btn dense unelevated no-caps color="teal-7" icon="near_me" label="Mais próxima" :disable="!minhaPos" @click="irParaMaisProxima" />
        </template>

        <q-btn-toggle
          v-model="camada"
          dense unelevated no-caps
          toggle-color="primary"
          color="grey-3" text-color="grey-8"
          :options="[{ value: 'ruas', label: 'Ruas' }, { value: 'satelite', label: 'Satélite' }]"
        />
      </div>

      <div v-if="!online" class="mapa-offline">
        <q-icon name="cloud_off" size="16px" />
        Sem internet: o fundo do mapa pode não carregar, mas os pontos e a rota continuam disponíveis.
      </div>
      <div v-if="erroGps" class="mapa-offline">
        <q-icon name="location_disabled" size="16px" /> {{ erroGps }}
      </div>
      <div v-if="avisoArea" class="mapa-offline">
        <q-icon name="info" size="16px" /> {{ avisoArea }}
      </div>
      <div v-if="areaAtual" class="mapa-area">
        <q-icon :name="filtroMunicipio ? 'location_city' : 'business'" size="18px" />
        <div>
          <b>{{ areaAtual.titulo }}</b>
          <span>{{ areaAtual.sub }}</span>
        </div>
      </div>

      <div ref="mapaEl" class="mapa-el" />
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { urlGoogleMaps, urlWaze, distanciaKm, formatarDistancia } from 'src/utils/rota'
import { chaveMunicipio, limitesDe } from 'src/utils/limites'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'

const props = defineProps({
  modelValue: Boolean,
  grupos: { type: Array, default: () => [] },
  // 'sistema': escritório | 'campo': PWA, com localização da equipe e botões de rota
  modo: { type: String, default: 'sistema' },
  // Nota a destacar ao abrir (centraliza e abre o popup)
  foco: { type: String, default: null },
  rotuloAbrir: { type: String, default: 'Abrir nota' },
  permitirAbrir: { type: Boolean, default: true },
  baseInicial: { type: String, default: null }
})
const emit = defineEmits(['update:modelValue', 'abrir'])

const STATUS = [
  { val: 'pendente',       label: 'Não Iniciado',   cor: '#9e9e9e' },
  { val: 'em_andamento',   label: 'Andamento',      cor: '#fb8c00' },
  { val: 'baixar_medidor', label: 'Baixar Medidor', cor: '#1976d2' },
  { val: 'concluido',      label: 'Concluído',      cor: '#43a047' },
  { val: 'expurgo',        label: 'Expurgo',        cor: '#e53935' },
  { val: 'sem_acesso',     label: 'Sem Acesso',     cor: '#6d4c41' }
]
const corDe   = s => STATUS.find(x => x.val === s)?.cor ?? '#607d8b'
const labelDe = s => STATUS.find(x => x.val === s)?.label ?? s

const mapaEl = ref(null)
const busca  = ref('')
const camada = ref('ruas')
const ocultos = ref(new Set())
const online = ref(navigator.onLine)
const minhaPos = ref(null)
const erroGps  = ref('')
let mapa = null
let camadaMarcadores = null
let camadasBase = {}
let ajustouVisao = false
let marcadorEu = null
let circuloEu = null
let gpsWatch = null
let seguirPrimeiraPosicao = false

function atualizarOnline () { online.value = navigator.onLine }

const todasNotas = computed(() => props.grupos.flatMap(g => g._notas?.length ? g._notas : [g]))
const comCoordenada = computed(() => todasNotas.value.filter(n => Number.isFinite(n.latitude) && Number.isFinite(n.longitude)))
const semCoordenada = computed(() => todasNotas.value.filter(n => !Number.isFinite(n.latitude) || !Number.isFinite(n.longitude)))

// ── Filtro por área (base / município) ───────────────────────────
const filtroBase      = ref(null)
const filtroMunicipio = ref(null)
const avisoArea       = ref('')
const areaAtual       = ref(null)
const buscaMunicipio  = ref('')
let camadaArea = null
let geracaoArea = 0

const basesOpcoes = computed(() =>
  [...new Set(todasNotas.value.map(n => n.base).filter(Boolean))].sort()
)
const municipiosOpcoes = computed(() =>
  [...new Set(todasNotas.value
    .filter(n => !filtroBase.value || n.base === filtroBase.value)
    .map(n => n.municipio).filter(Boolean))].sort()
)
const municipiosOpcoesFiltradas = computed(() => {
  const q = chaveMunicipio(buscaMunicipio.value)
  return q ? municipiosOpcoes.value.filter(m => chaveMunicipio(m).includes(q)) : municipiosOpcoes.value
})
function filtrarMunicipios (val, update) {
  update(() => { buscaMunicipio.value = val })
}

const notasDaArea = computed(() => comCoordenada.value.filter(n =>
  (!filtroBase.value || n.base === filtroBase.value) &&
  (!filtroMunicipio.value || chaveMunicipio(n.municipio) === chaveMunicipio(filtroMunicipio.value))
))

const contagem = computed(() => {
  const c = {}
  for (const n of notasDaArea.value) c[n.status] = (c[n.status] || 0) + 1
  return c
})

const statusVisiveis = computed(() => STATUS.filter(s => contagem.value[s.val] || ocultos.value.has(s.val)))

const notasNoMapa = computed(() => notasDaArea.value.filter(n => !ocultos.value.has(n.status)))

function resumoArea (notas) {
  const abertas = notas.filter(n => ['pendente', 'em_andamento', 'baixar_medidor'].includes(n.status)).length
  return `${notas.length} ${notas.length === 1 ? 'nota' : 'notas'} · ${abertas} em aberto`
}

function limparArea () {
  camadaArea?.remove()
  camadaArea = null
  areaAtual.value = null
  avisoArea.value = ''
}

async function desenharArea () {
  const geracao = ++geracaoArea
  limparArea()
  if (!mapa || (!filtroBase.value && !filtroMunicipio.value)) return

  const municipios = filtroMunicipio.value
    ? [filtroMunicipio.value]
    : todasNotas.value.filter(n => n.base === filtroBase.value).map(n => n.municipio)

  let res
  try {
    res = await limitesDe(municipios)
  } catch {
    if (geracao === geracaoArea) avisoArea.value = 'Não foi possível carregar os limites dos municípios.'
    return
  }
  if (geracao !== geracaoArea || !mapa) return

  const titulo = filtroMunicipio.value
    ? filtroMunicipio.value
    : `Base ${filtroBase.value}`
  const sub = filtroMunicipio.value
    ? resumoArea(notasDaArea.value)
    : `${res.features.length} municípios · ${resumoArea(notasDaArea.value)}`
  areaAtual.value = { titulo, sub }

  if (res.naoEncontrados.length) {
    avisoArea.value = `Sem limite oficial para: ${res.naoEncontrados.join(', ')}.`
  }
  if (!res.features.length) return

  camadaArea = L.layerGroup().addTo(mapa)

  // Escurece tudo fora da área: retângulo do mundo com "furos" nos polígonos da área
  const contorno = res.contorno ?? res.features[0]
  const poligonos = contorno.geometry.type === 'MultiPolygon'
    ? contorno.geometry.coordinates
    : [contorno.geometry.coordinates]
  const furos = poligonos.map(p => p[0].map(([lng, lat]) => [lat, lng]))
  L.polygon([[[-89, -179], [-89, 179], [89, 179], [89, -179]], ...furos], {
    pane: 'mascara', stroke: false, fillColor: '#0a1628', fillOpacity: 0.35, interactive: false
  }).addTo(camadaArea)

  // Divisas internas dos municípios da base; o clique é tratado em aoClicarMapa
  municipiosDaArea = []
  if (!filtroMunicipio.value && res.features.length > 1) {
    municipiosDaArea = res.features
    L.geoJSON(featureCollectionDe(res.features), {
      pane: 'contorno',
      interactive: false,
      style: { color: '#1565c0', weight: 1, opacity: 0.7, dashArray: '4 4', fillColor: '#1565c0', fillOpacity: 0.03 }
    }).addTo(camadaArea)
    for (const f of res.features) {
      const centro = L.geoJSON(f).getBounds().getCenter()
      L.tooltip({ permanent: true, direction: 'center', className: 'mapa-mun-label', pane: 'rotulos' })
        .setLatLng(centro).setContent(f.properties.nome).addTo(camadaArea)
    }
  }

  const linha = L.geoJSON(contorno, {
    pane: 'contorno',
    interactive: false,
    style: { color: '#0d47a1', weight: 3.5, opacity: 0.95, fill: false }
  }).addTo(camadaArea)

  // A faixa com o nome da área muda a altura do mapa: recalcula antes de enquadrar
  await nextTick()
  if (!mapa) return
  mapa.invalidateSize()
  mapa.fitBounds(linha.getBounds(), { padding: [24, 24] })
  atualizarRotulos()
}

function atualizarRotulos () {
  const pane = mapa?.getPane('rotulos')
  if (pane) pane.style.display = mapa.getZoom() >= 9 ? '' : 'none'
}

function featureCollectionDe (features) {
  return { type: 'FeatureCollection', features }
}

let municipiosDaArea = []

function aoClicarMapa (e) {
  if (!municipiosDaArea.length) return
  const ponto = [e.latlng.lng, e.latlng.lat]
  const f = municipiosDaArea.find(m => booleanPointInPolygon(ponto, m))
  if (!f) return
  const alvo = municipiosOpcoes.value.find(m => chaveMunicipio(m) === chaveMunicipio(f.properties.nome))
  if (alvo) filtroMunicipio.value = alvo
}

watch(filtroBase, () => {
  if (filtroMunicipio.value && !municipiosOpcoes.value.includes(filtroMunicipio.value)) filtroMunicipio.value = null
  else desenharArea()
})
watch(filtroMunicipio, () => desenharArea())

function alternarStatus (s) {
  const novo = new Set(ocultos.value)
  novo.has(s) ? novo.delete(s) : novo.add(s)
  ocultos.value = novo
}

function escapar (t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function popupHtml (notas) {
  const { latitude: lat, longitude: lng } = notas[0]
  const dist = minhaPos.value ? formatarDistancia(distanciaKm(minhaPos.value, { lat, lng })) : ''
  const botaoAbrir = n => props.permitirAbrir
    ? `<button class="mp-btn" data-abrir="${escapar(n.nota)}">${escapar(props.rotuloAbrir)}</button>`
    : ''
  const rodape = props.modo === 'campo'
    ? `
      ${dist ? `<div class="mp-dist">A ${dist} de você (em linha reta)</div>` : ''}
      <div class="mp-rotas">
        <a class="mp-rota-btn mp-rota-btn--google" href="${urlGoogleMaps(lat, lng)}" target="_blank" rel="noopener">Iniciar deslocamento</a>
        <a class="mp-rota-btn mp-rota-btn--waze" href="${urlWaze(lat, lng)}" target="_blank" rel="noopener">Waze</a>
      </div>`
    : `<a class="mp-rota" href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener">Abrir no Google Maps</a>`
  const itens = notas.map(n => `
    <div class="mp-nota">
      <div class="mp-nota-top">
        <b>Nota ${escapar(n.nota)}</b>
        <span class="mp-status" style="background:${corDe(n.status)}">${escapar(labelDe(n.status))}</span>
      </div>
      ${n.projeto_info_sap ? `<div class="mp-linha">SAP ${escapar(n.projeto_info_sap)}</div>` : ''}
      <div class="mp-linha">${escapar(n.base)}${n.municipio ? ' · ' + escapar(n.municipio) : ''}</div>
      <div class="mp-linha">${Number(n.postes) || 0} postes · ${Number(n.qtd_clientes) || 0} clientes</div>
      ${botaoAbrir(n)}
    </div>`).join('')
  return `
    ${notas.length > 1 ? `<div class="mp-titulo">${notas.length} notas neste ponto</div>` : ''}
    <div class="mp-lista">${itens}</div>
    ${rodape}`
}

function abrirPopupEm (lat, lng) {
  camadaMarcadores?.eachLayer(m => {
    const p = m.getLatLng()
    if (Math.abs(p.lat - lat) < 1e-6 && Math.abs(p.lng - lng) < 1e-6) m.openPopup()
  })
}

// O popup só reposiciona o mapa para caber na tela se abrir depois que o movimento terminou
function moverEAbrir (mover, n) {
  mapa.once('moveend', () => setTimeout(() => abrirPopupEm(n.latitude, n.longitude), 50))
  mover()
}

function irParaNota (n, zoom = 16) {
  if (!mapa || !n) return
  moverEAbrir(() => mapa.setView([n.latitude, n.longitude], zoom), n)
}

// ── Localização da equipe (modo campo) ──────────────────────────
function iniciarGps () {
  if (props.modo !== 'campo' || gpsWatch != null) return
  if (!navigator.geolocation) { erroGps.value = 'Este aparelho não informa a localização.'; return }
  gpsWatch = navigator.geolocation.watchPosition(
    pos => {
      erroGps.value = ''
      minhaPos.value = { lat: pos.coords.latitude, lng: pos.coords.longitude, precisao: pos.coords.accuracy }
      desenharEu()
      if (seguirPrimeiraPosicao) { seguirPrimeiraPosicao = false; centralizarEmMim() }
    },
    err => {
      erroGps.value = err.code === 1
        ? 'Localização bloqueada. Permita o acesso à localização para ver onde você está.'
        : 'Não foi possível obter sua localização agora.'
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  )
}

function pararGps () {
  if (gpsWatch != null) navigator.geolocation.clearWatch(gpsWatch)
  gpsWatch = null
}

function desenharEu () {
  if (!mapa || !minhaPos.value) return
  const { lat, lng, precisao } = minhaPos.value
  if (!marcadorEu) {
    circuloEu = L.circle([lat, lng], { radius: precisao, color: '#1e88e5', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(mapa)
    marcadorEu = L.circleMarker([lat, lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#1e88e5', fillOpacity: 1 })
      .bindTooltip('Você está aqui', { direction: 'top', offset: [0, -6] })
      .addTo(mapa)
  } else {
    marcadorEu.setLatLng([lat, lng])
    circuloEu.setLatLng([lat, lng]).setRadius(precisao)
  }
}

function centralizarEmMim () {
  if (!minhaPos.value) { seguirPrimeiraPosicao = true; iniciarGps(); return }
  mapa?.setView([minhaPos.value.lat, minhaPos.value.lng], Math.max(mapa.getZoom(), 14))
}

function irParaMaisProxima () {
  if (!minhaPos.value || !notasNoMapa.value.length) return
  let melhor = null, menor = Infinity
  for (const n of notasNoMapa.value) {
    const d = distanciaKm(minhaPos.value, { lat: n.latitude, lng: n.longitude })
    if (d < menor) { menor = d; melhor = n }
  }
  if (!melhor) return
  moverEAbrir(() => mapa.fitBounds(
    L.latLngBounds([[minhaPos.value.lat, minhaPos.value.lng], [melhor.latitude, melhor.longitude]]),
    { padding: [60, 60], maxZoom: 16 }
  ), melhor)
}

function desenharMarcadores () {
  if (!mapa) return
  camadaMarcadores.clearLayers()

  // Notas no mesmo ponto viram um único marcador com a lista no popup
  const porPonto = new Map()
  for (const n of notasNoMapa.value) {
    const k = `${n.latitude.toFixed(6)},${n.longitude.toFixed(6)}`
    if (!porPonto.has(k)) porPonto.set(k, [])
    porPonto.get(k).push(n)
  }

  for (const notas of porPonto.values()) {
    const ordem = s => STATUS.findIndex(x => x.val === s)
    const principal = [...notas].sort((a, b) => ordem(a.status) - ordem(b.status))[0]
    L.circleMarker([principal.latitude, principal.longitude], {
      radius: notas.length > 1 ? 9 : 7,
      color: '#fff',
      weight: notas.length > 1 ? 3 : 2,
      fillColor: corDe(principal.status),
      fillOpacity: 0.95
    })
      .bindTooltip(notas.length > 1 ? `${notas.length} notas` : `Nota ${principal.nota}`, { direction: 'top', offset: [0, -6] })
      .bindPopup(() => popupHtml(notas), {
        maxWidth: Math.min(280, window.innerWidth - 90),
        minWidth: Math.min(220, window.innerWidth - 90),
        maxHeight: 320,
        autoPanPadding: [16, 16]
      })
      .addTo(camadaMarcadores)
  }

  if (!ajustouVisao && notasNoMapa.value.length) {
    const alvo = props.foco && notasNoMapa.value.find(n => n.nota === props.foco)
    if (alvo) irParaNota(alvo, 15)
    else mapa.fitBounds(L.latLngBounds(notasNoMapa.value.map(n => [n.latitude, n.longitude])), { padding: [30, 30] })
    ajustouVisao = true
  }
}

async function montarMapa () {
  await nextTick()
  if (mapa || !mapaEl.value) return
  mapa = L.map(mapaEl.value, { preferCanvas: true, zoomControl: true, zoomSnap: 0.25 }).setView([-4.5, -44.8], 7)
  camadasBase = {
    ruas: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }),
    satelite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Imagens &copy; Esri'
    })
  }
  camadasBase[camada.value].addTo(mapa)
  // Área filtrada fica abaixo dos pontos das notas (overlayPane = 400)
  mapa.createPane('mascara').style.zIndex = 350
  mapa.createPane('contorno').style.zIndex = 360
  mapa.createPane('rotulos').style.zIndex = 370
  camadaMarcadores = L.layerGroup().addTo(mapa)
  mapa.on('click', aoClicarMapa)
  mapa.on('zoomend', atualizarRotulos)

  mapa.on('popupopen', e => {
    e.popup.getElement()?.querySelectorAll('[data-abrir]').forEach(btn => {
      btn.onclick = () => {
        const nota = todasNotas.value.find(n => n.nota === btn.dataset.abrir)
        if (nota) emit('abrir', nota)
      }
    })
  })

  ajustouVisao = false
  desenharMarcadores()
  setTimeout(() => mapa?.invalidateSize(), 150)
  if (props.baseInicial && filtroBase.value !== props.baseInicial) filtroBase.value = props.baseInicial
  else desenharArea()

  window.addEventListener('online', atualizarOnline)
  window.addEventListener('offline', atualizarOnline)
  atualizarOnline()
  if (props.modo === 'campo') {
    iniciarGps()
    desenharEu()
  }
}

function desmontarMapa () {
  window.removeEventListener('online', atualizarOnline)
  window.removeEventListener('offline', atualizarOnline)
  pararGps()
  marcadorEu = null
  circuloEu = null
  camadaArea = null
  municipiosDaArea = []
  mapa?.remove()
  mapa = null
}

function irParaBusca () {
  const q = busca.value?.trim().toLowerCase()
  if (!q || !mapa) return
  const achadas = notasNoMapa.value.filter(n =>
    n.nota?.toLowerCase().includes(q) ||
    n.projeto_info_sap?.toLowerCase().includes(q) ||
    n.municipio?.toLowerCase().includes(q)
  )
  if (!achadas.length) return
  if (achadas.length === 1) {
    irParaNota(achadas[0])
  } else {
    mapa.fitBounds(L.latLngBounds(achadas.map(n => [n.latitude, n.longitude])), { padding: [40, 40], maxZoom: 15 })
  }
}

watch(notasNoMapa, desenharMarcadores)
watch(camada, (nova, antiga) => {
  if (!mapa) return
  mapa.removeLayer(camadasBase[antiga])
  camadasBase[nova].addTo(mapa)
})
</script>

<style scoped>
.mapa-card { display: flex; flex-direction: column; height: 100%; }
.mapa-bar { background: #0a1628; color: #fff; min-height: 44px; }
.mapa-bar-sub { font-size: 12px; opacity: 0.7; }
.mapa-toolbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  padding: 8px 12px; border-bottom: 1px solid #e0e0e0; background: #fafafa;
}
.mapa-busca { width: 240px; }
.mapa-filtro { width: 190px; }
.mapa-filtro--mun { width: 240px; }
.mapa-area {
  display: flex; align-items: center; gap: 10px;
  background: #e3f2fd; color: #0d47a1; padding: 6px 12px; font-size: 13px;
  border-bottom: 1px solid #bbdefb;
}
.mapa-area span { margin-left: 8px; color: #1565c0; opacity: 0.85; }
:deep(.mapa-mun-label) {
  background: rgba(255,255,255,0.8); border: none; box-shadow: none;
  color: #0d47a1; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px;
}
:deep(.mapa-mun-label::before) { display: none; }
.mapa-legenda { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
.mapa-leg-item {
  display: flex; align-items: center; gap: 6px;
  border: 1px solid #e0e0e0; background: #fff; border-radius: 20px;
  padding: 4px 10px; font-size: 12px; cursor: pointer; font-family: inherit;
}
.mapa-leg-item b { color: #546e7a; }
.mapa-leg-item--off { opacity: 0.4; text-decoration: line-through; }
.mapa-leg-dot { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.2); }
.mapa-el { flex: 1; min-height: 300px; }
.mapa-offline {
  display: flex; align-items: center; gap: 6px;
  background: #fff3e0; color: #e65100; font-size: 12px; padding: 6px 12px;
}
@media (max-width: 600px) {
  .mapa-busca { width: 100%; }
  .mapa-filtro, .mapa-filtro--mun { width: calc(50% - 5px); }
  .mapa-legenda { order: 3; }
}

:deep(.mp-titulo) { font-weight: 700; margin-bottom: 6px; color: #37474f; }
:deep(.mp-lista) { display: flex; flex-direction: column; gap: 8px; }
:deep(.mp-nota) { border-left: 3px solid #e0e0e0; padding-left: 8px; }
:deep(.mp-nota-top) { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
:deep(.mp-status) { color: #fff; font-size: 10px; font-weight: 700; border-radius: 10px; padding: 1px 8px; white-space: nowrap; }
:deep(.mp-linha) { font-size: 12px; color: #546e7a; margin-top: 2px; }
:deep(.mp-btn) {
  margin-top: 6px; border: none; border-radius: 6px; cursor: pointer;
  background: #1976d2; color: #fff; font-size: 12px; font-weight: 600; padding: 4px 10px;
}
:deep(.mp-rota) { display: inline-block; margin-top: 10px; font-size: 12px; font-weight: 600; }
:deep(.mp-dist) { margin-top: 10px; font-size: 12px; font-weight: 700; color: #00695c; }
:deep(.mp-rotas) { display: flex; gap: 6px; margin-top: 8px; }
:deep(.mp-rota-btn) {
  flex: 1; text-align: center; text-decoration: none;
  border-radius: 8px; padding: 9px 8px; font-size: 13px; font-weight: 700; color: #fff !important;
}
:deep(.mp-rota-btn--google) { background: #2e7d32; }
:deep(.mp-rota-btn--waze) { flex: 0 0 auto; background: #33ccff; color: #0d2b3e !important; }
</style>
