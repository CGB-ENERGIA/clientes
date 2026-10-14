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
    <q-card class="mapa-card" :class="{ 'mapa-card--compacto': compacto }">
      <header class="mapa-bar">
        <q-icon name="map" size="18px" />
        <span class="mapa-bar-titulo">{{ compacto ? 'Mapa' : 'Mapa das notas' }}</span>
        <span class="mapa-bar-sub">
          {{ notasNoMapa.length }} {{ notasNoMapa.length === 1 ? 'nota' : 'notas' }}
          <template v-if="semCoordenada.length && !compacto"> · {{ semCoordenada.length }} sem coordenada</template>
        </span>
        <q-space />
        <q-btn icon="close" flat dense round color="white" v-close-popup />
      </header>

      <div class="mapa-toolbar">
        <q-input
          v-model="busca"
          dense outlined
          :placeholder="compacto ? 'Buscar nota, SAP, município' : 'Buscar nota, SAP ou município'"
          class="mapa-busca"
          clearable
          enterkeyhint="search"
          @keyup.enter="irParaBusca"
        >
          <template #prepend><q-icon name="search" /></template>
        </q-input>

        <q-btn
          v-if="compacto"
          :flat="!painelAberto" :unelevated="painelAberto"
          :color="painelAberto ? 'primary' : 'grey-8'"
          icon="tune"
          class="mapa-btn-filtros"
          @click="painelAberto = !painelAberto"
        >
          <q-badge v-if="filtrosAtivos" floating rounded color="red">{{ filtrosAtivos }}</q-badge>
        </q-btn>

        <div v-show="!compacto || painelAberto" class="mapa-controles">
          <div class="mapa-filtros">
            <q-select
              v-model="filtroBase"
              :options="basesOpcoes"
              dense outlined clearable
              label="Base"
              class="mapa-filtro"
              options-dense
              behavior="menu"
              :hide-dropdown-icon="compacto && !!filtroBase"
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
              behavior="menu"
              :hide-dropdown-icon="compacto && !!filtroMunicipio"
              @filter="filtrarMunicipios"
            >
              <template #prepend><q-icon name="location_city" size="18px" /></template>
              <template #no-option>
                <q-item><q-item-section class="text-grey">Nenhum município</q-item-section></q-item>
              </template>
            </q-select>
          </div>

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

          <q-btn-toggle
            v-model="camada"
            dense unelevated no-caps
            toggle-color="primary"
            color="grey-3" text-color="grey-8"
            class="mapa-camada"
            :options="[{ value: 'ruas', label: 'Ruas' }, { value: 'satelite', label: 'Satélite' }]"
          />
        </div>
      </div>

      <div v-if="!online" class="mapa-aviso">
        <q-icon name="cloud_off" size="16px" />
        <span>Sem internet: o fundo do mapa pode não carregar, mas os pontos e a rota funcionam.</span>
      </div>
      <div v-if="erroGps" class="mapa-aviso">
        <q-icon name="location_disabled" size="16px" /> <span>{{ erroGps }}</span>
      </div>
      <div v-if="avisoArea" class="mapa-aviso">
        <q-icon name="info" size="16px" /> <span>{{ avisoArea }}</span>
      </div>
      <div v-if="areaAtual" class="mapa-area">
        <q-icon :name="filtroMunicipio ? 'location_city' : 'business'" size="18px" />
        <b>{{ areaAtual.titulo }}</b>
        <span>{{ areaAtual.sub }}</span>
      </div>

      <div class="mapa-wrap">
        <div ref="mapaEl" class="mapa-el" />

        <div v-if="modo === 'campo' && !selecionado" class="mapa-fabs">
          <q-btn round color="white" text-color="blue-8" icon="my_location" @click="centralizarEmMim">
            <q-tooltip v-if="!compacto">Onde estou</q-tooltip>
          </q-btn>
          <q-btn round color="teal-7" icon="near_me" :disable="!minhaPos" @click="irParaMaisProxima">
            <q-tooltip v-if="!compacto">Nota mais próxima</q-tooltip>
          </q-btn>
        </div>

        <transition name="mapa-sheet">
          <div v-if="selecionado" ref="sheetEl" class="mapa-sheet">
            <div v-if="compacto" class="mapa-sheet-alca" />
            <button class="mapa-sheet-fechar" aria-label="Fechar" @click="fecharSelecao">
              <q-icon name="close" size="20px" />
            </button>

            <div v-if="selecionado.length > 1" class="mapa-sheet-titulo">
              {{ selecionado.length }} notas neste ponto
            </div>

            <div class="mapa-sheet-lista">
              <div v-for="n in selecionado" :key="n.nota" class="mapa-sheet-nota">
                <div class="mapa-sheet-top">
                  <b>Nota {{ n.nota }}</b>
                  <span class="mapa-sheet-status" :style="{ background: corDe(n.status) }">{{ labelDe(n.status) }}</span>
                </div>
                <div v-if="n.projeto_info_sap" class="mapa-sheet-linha">SAP {{ n.projeto_info_sap }}</div>
                <div class="mapa-sheet-linha">{{ n.base }}<template v-if="n.municipio"> · {{ n.municipio }}</template></div>
                <div class="mapa-sheet-linha">{{ Number(n.postes) || 0 }} postes · {{ Number(n.qtd_clientes) || 0 }} clientes</div>
                <q-btn
                  v-if="permitirAbrir"
                  :label="rotuloAbrir"
                  color="primary" unelevated no-caps dense
                  class="mapa-sheet-abrir"
                  @click="emit('abrir', n)"
                />
              </div>
            </div>

            <div v-if="distanciaSelecionado" class="mapa-sheet-dist">
              <q-icon name="straighten" size="16px" /> A {{ distanciaSelecionado }} de você (em linha reta)
            </div>

            <div class="mapa-sheet-acoes">
              <template v-if="modo === 'campo'">
                <a class="mapa-rota mapa-rota--google" :href="urlGoogleMaps(selecionado[0].latitude, selecionado[0].longitude)" target="_blank" rel="noopener">
                  <q-icon name="navigation" size="20px" /> Iniciar deslocamento
                </a>
                <a class="mapa-rota mapa-rota--waze" :href="urlWaze(selecionado[0].latitude, selecionado[0].longitude)" target="_blank" rel="noopener">Waze</a>
              </template>
              <a
                v-else
                class="mapa-rota mapa-rota--link"
                :href="`https://www.google.com/maps/search/?api=1&query=${selecionado[0].latitude},${selecionado[0].longitude}`"
                target="_blank" rel="noopener"
              >
                <q-icon name="open_in_new" size="16px" /> Abrir no Google Maps
              </a>
            </div>
          </div>
        </transition>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useQuasar } from 'quasar'
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
  // Nota a destacar ao abrir (centraliza e mostra os detalhes)
  foco: { type: String, default: null },
  rotuloAbrir: { type: String, default: 'Abrir nota' },
  permitirAbrir: { type: Boolean, default: true },
  baseInicial: { type: String, default: null }
})
const emit = defineEmits(['update:modelValue', 'abrir'])

const $q = useQuasar()
const compacto = computed(() => $q.screen.lt.sm)
const temHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches

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

const mapaEl  = ref(null)
const sheetEl = ref(null)
const busca   = ref('')
const camada  = ref('ruas')
const ocultos = ref(new Set())
const online  = ref(navigator.onLine)
const minhaPos = ref(null)
const erroGps  = ref('')
const painelAberto = ref(false)
const selecionado  = ref(null)
let mapa = null
let camadaMarcadores = null
let camadaDestaque = null
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
let municipiosDaArea = []

const filtrosAtivos = computed(() => (filtroBase.value ? 1 : 0) + (filtroMunicipio.value ? 1 : 0) + ocultos.value.size)

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

const distanciaSelecionado = computed(() => {
  if (!selecionado.value || !minhaPos.value) return ''
  const n = selecionado.value[0]
  return formatarDistancia(distanciaKm(minhaPos.value, { lat: n.latitude, lng: n.longitude }))
})

function resumoArea (notas) {
  const abertas = notas.filter(n => ['pendente', 'em_andamento', 'baixar_medidor'].includes(n.status)).length
  return `${notas.length} ${notas.length === 1 ? 'nota' : 'notas'} · ${abertas} em aberto`
}

function limparArea () {
  camadaArea?.remove()
  camadaArea = null
  areaAtual.value = null
  avisoArea.value = ''
  municipiosDaArea = []
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

  areaAtual.value = filtroMunicipio.value
    ? { titulo: filtroMunicipio.value, sub: resumoArea(notasDaArea.value) }
    : { titulo: `Base ${filtroBase.value}`, sub: `${res.features.length} municípios · ${resumoArea(notasDaArea.value)}` }

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
  if (!filtroMunicipio.value && res.features.length > 1) {
    municipiosDaArea = res.features
    L.geoJSON({ type: 'FeatureCollection', features: res.features }, {
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
  mapa.fitBounds(linha.getBounds(), { padding: compacto.value ? [12, 12] : [24, 24] })
  atualizarRotulos()
}

function atualizarRotulos () {
  const pane = mapa?.getPane('rotulos')
  if (pane) pane.style.display = mapa.getZoom() >= 9 ? '' : 'none'
}

function aoClicarMapa (e) {
  if (selecionado.value) { fecharSelecao(); return }
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
watch(filtroMunicipio, () => {
  if (compacto.value && filtroMunicipio.value) painelAberto.value = false
  desenharArea()
})

function alternarStatus (s) {
  const novo = new Set(ocultos.value)
  novo.has(s) ? novo.delete(s) : novo.add(s)
  ocultos.value = novo
}

// ── Detalhes da nota (gaveta inferior no celular, cartão no computador) ─
const chavePonto = (lat, lng) => `${lat.toFixed(6)},${lng.toFixed(6)}`

function notasNoPonto (lat, lng) {
  const k = chavePonto(lat, lng)
  const ordem = s => STATUS.findIndex(x => x.val === s)
  return notasNoMapa.value
    .filter(n => chavePonto(n.latitude, n.longitude) === k)
    .sort((a, b) => ordem(a.status) - ordem(b.status))
}

async function selecionar (notas) {
  if (!notas?.length || !mapa) return
  selecionado.value = notas
  const { latitude: lat, longitude: lng } = notas[0]
  camadaDestaque.clearLayers()
  L.circleMarker([lat, lng], {
    radius: compacto.value ? 16 : 13, color: '#ffca28', weight: 4, fill: false, interactive: false
  }).addTo(camadaDestaque)

  // Garante que o ponto fique visível acima da gaveta
  await nextTick()
  if (!mapa) return
  const altura = mapa.getSize().y
  const sheet = sheetEl.value?.offsetHeight ?? 0
  const visivel = compacto.value ? altura - sheet : altura
  const pt = mapa.latLngToContainerPoint([lat, lng])
  const alvoY = compacto.value ? visivel / 2 : Math.min(Math.max(pt.y, 60), altura - 60)
  const alvoX = Math.min(Math.max(pt.x, 50), mapa.getSize().x - 50)
  if (Math.abs(pt.y - alvoY) > 8 || Math.abs(pt.x - alvoX) > 8) {
    mapa.panBy([pt.x - alvoX, pt.y - alvoY], { animate: true })
  }
}

function fecharSelecao () {
  selecionado.value = null
  camadaDestaque?.clearLayers()
}

function selecionarNoPonto (lat, lng) {
  selecionar(notasNoPonto(lat, lng))
}

function moverESelecionar (mover, n) {
  mapa.once('moveend', () => setTimeout(() => selecionarNoPonto(n.latitude, n.longitude), 30))
  mover()
}

function irParaNota (n, zoom = 16) {
  if (!mapa || !n) return
  moverESelecionar(() => mapa.setView([n.latitude, n.longitude], zoom), n)
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
    marcadorEu = L.circleMarker([lat, lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#1e88e5', fillOpacity: 1, interactive: false }).addTo(mapa)
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
  moverESelecionar(() => mapa.fitBounds(
    L.latLngBounds([[minhaPos.value.lat, minhaPos.value.lng], [melhor.latitude, melhor.longitude]]),
    { padding: [60, 60], maxZoom: 16 }
  ), melhor)
}

function desenharMarcadores () {
  if (!mapa) return
  camadaMarcadores.clearLayers()

  // Notas no mesmo ponto viram um único marcador
  const porPonto = new Map()
  for (const n of notasNoMapa.value) {
    const k = chavePonto(n.latitude, n.longitude)
    if (!porPonto.has(k)) porPonto.set(k, [])
    porPonto.get(k).push(n)
  }

  const ordem = s => STATUS.findIndex(x => x.val === s)
  const raio = compacto.value ? 9 : 7
  for (const notas of porPonto.values()) {
    const principal = [...notas].sort((a, b) => ordem(a.status) - ordem(b.status))[0]
    const m = L.circleMarker([principal.latitude, principal.longitude], {
      radius: notas.length > 1 ? raio + 2 : raio,
      color: '#fff',
      weight: notas.length > 1 ? 3 : 2,
      fillColor: corDe(principal.status),
      fillOpacity: 0.95
    })
    if (temHover) m.bindTooltip(notas.length > 1 ? `${notas.length} notas` : `Nota ${principal.nota}`, { direction: 'top', offset: [0, -6] })
    m.on('click', () => selecionarNoPonto(principal.latitude, principal.longitude))
    m.addTo(camadaMarcadores)
  }

  if (selecionado.value) {
    const { latitude, longitude } = selecionado.value[0]
    const ainda = notasNoPonto(latitude, longitude)
    if (ainda.length) selecionado.value = ainda
    else fecharSelecao()
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
  mapa = L.map(mapaEl.value, {
    // Tolerância maior facilita acertar o ponto com o dedo
    renderer: L.canvas({ tolerance: compacto.value ? 10 : 4 }),
    zoomControl: !compacto.value,
    zoomSnap: 0.25,
    tapTolerance: 20
  }).setView([-4.5, -44.8], 7)
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
  camadaDestaque = L.layerGroup().addTo(mapa)
  mapa.on('click', aoClicarMapa)
  mapa.on('zoomend', atualizarRotulos)

  ajustouVisao = false
  painelAberto.value = false
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
  selecionado.value = null
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
  if (!achadas.length) {
    $q.notify({ type: 'warning', message: 'Nenhuma nota encontrada no mapa.', position: 'top', timeout: 1800 })
    return
  }
  document.activeElement?.blur?.()
  if (achadas.length === 1) {
    irParaNota(achadas[0])
  } else {
    fecharSelecao()
    mapa.fitBounds(L.latLngBounds(achadas.map(n => [n.latitude, n.longitude])), { padding: [40, 40], maxZoom: 15 })
  }
}

watch([notasNoMapa, compacto], desenharMarcadores)
watch(camada, (nova, antiga) => {
  if (!mapa) return
  mapa.removeLayer(camadasBase[antiga])
  camadasBase[nova].addTo(mapa)
})
// Painel de filtros, avisos e rotação da tela mudam o tamanho do mapa
watch([painelAberto, () => $q.screen.width, () => $q.screen.height, areaAtual, erroGps, online], async () => {
  await nextTick()
  setTimeout(() => mapa?.invalidateSize(), 220)
})
</script>

<style scoped>
.mapa-card { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

.mapa-bar {
  display: flex; align-items: center; gap: 8px;
  background: #0a1628; color: #fff;
  min-height: 46px; padding: 0 6px 0 14px;
  padding-top: env(safe-area-inset-top);
}
.mapa-bar-titulo { font-weight: 700; font-size: 15px; white-space: nowrap; }
.mapa-bar-sub { font-size: 12px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.mapa-toolbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  padding: 8px 12px; border-bottom: 1px solid #e0e0e0; background: #fafafa;
}
.mapa-busca { width: 240px; }
.mapa-controles { display: contents; }
.mapa-filtros { display: contents; }
.mapa-filtro { width: 190px; }
.mapa-filtro--mun { width: 240px; }

.mapa-legenda { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
.mapa-leg-item {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
  border: 1px solid #e0e0e0; background: #fff; border-radius: 20px;
  padding: 4px 10px; font-size: 12px; cursor: pointer; font-family: inherit; white-space: nowrap;
}
.mapa-leg-item b { color: #546e7a; }
.mapa-leg-item--off { opacity: 0.4; text-decoration: line-through; }
.mapa-leg-dot { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.2); }

.mapa-aviso {
  display: flex; align-items: center; gap: 6px;
  background: #fff3e0; color: #e65100; font-size: 12px; padding: 6px 12px;
}
.mapa-area {
  display: flex; align-items: center; gap: 8px;
  background: #e3f2fd; color: #0d47a1; padding: 6px 12px; font-size: 13px;
  border-bottom: 1px solid #bbdefb;
}
.mapa-area span { color: #1565c0; opacity: 0.85; }

.mapa-wrap { position: relative; flex: 1; min-height: 0; }
.mapa-el { position: absolute; inset: 0; z-index: 0; }

.mapa-fabs {
  position: absolute; right: 14px; bottom: calc(24px + env(safe-area-inset-bottom));
  z-index: 500; display: flex; flex-direction: column; gap: 12px;
}

/* Detalhes da nota */
.mapa-sheet {
  position: absolute; z-index: 600;
  left: 12px; bottom: 12px; width: 360px; max-height: calc(100% - 24px);
  overflow-y: auto; overscroll-behavior: contain;
  background: #fff; border-radius: 14px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.25);
  padding: 14px 14px 12px;
}
.mapa-sheet-alca { width: 40px; height: 4px; border-radius: 2px; background: #cfd8dc; margin: -4px auto 10px; }
.mapa-sheet-fechar {
  position: absolute; top: 8px; right: 8px;
  width: 36px; height: 36px; border-radius: 50%; border: none;
  background: #f1f3f4; color: #546e7a; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.mapa-sheet-titulo { font-weight: 700; color: #37474f; margin-bottom: 8px; padding-right: 40px; }
.mapa-sheet-lista { display: flex; flex-direction: column; gap: 10px; }
.mapa-sheet-nota { border-left: 3px solid #e0e0e0; padding-left: 10px; }
.mapa-sheet-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-right: 40px; font-size: 15px; }
.mapa-sheet-status { color: #fff; font-size: 11px; font-weight: 700; border-radius: 10px; padding: 2px 9px; white-space: nowrap; }
.mapa-sheet-linha { font-size: 13px; color: #546e7a; margin-top: 2px; }
.mapa-sheet-abrir { margin-top: 8px; padding: 2px 12px; }
.mapa-sheet-dist { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; font-weight: 700; color: #00695c; }
.mapa-sheet-acoes { display: flex; gap: 8px; margin-top: 10px; }
.mapa-rota {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  text-decoration: none; border-radius: 12px; font-weight: 800;
}
.mapa-rota--google { flex: 1; background: #2e7d32; color: #fff; padding: 13px 10px; font-size: 15px; }
.mapa-rota--waze { flex: 0 0 auto; background: #33ccff; color: #0d2b3e; padding: 13px 18px; font-size: 15px; }
.mapa-rota--link { color: #1565c0; font-size: 13px; font-weight: 700; padding: 4px 0; }
.mapa-rota:active { transform: scale(0.98); }

.mapa-sheet-enter-active, .mapa-sheet-leave-active { transition: transform 0.22s ease, opacity 0.22s ease; }
.mapa-sheet-enter-from, .mapa-sheet-leave-to { transform: translateY(24px); opacity: 0; }

:deep(.mapa-mun-label) {
  background: rgba(255,255,255,0.8); border: none; box-shadow: none;
  color: #0d47a1; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px;
}
:deep(.mapa-mun-label::before) { display: none; }

/* ── Celular ─────────────────────────────────────────────────── */
.mapa-card--compacto .mapa-toolbar { gap: 8px; padding: 8px 10px; }
.mapa-card--compacto .mapa-busca { flex: 1; width: auto; min-width: 0; }
.mapa-card--compacto .mapa-btn-filtros { width: 40px; height: 40px; border-radius: 10px; }
.mapa-card--compacto .mapa-controles {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex-basis: 100%; min-width: 0;
}
.mapa-card--compacto .mapa-filtros { display: flex; gap: 8px; flex-basis: 100%; min-width: 0; }
.mapa-card--compacto .mapa-filtro,
.mapa-card--compacto .mapa-filtro--mun { flex: 1 1 0; width: auto; min-width: 0; overflow: hidden; }
.mapa-card--compacto .mapa-filtros :deep(.q-field__native) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mapa-card--compacto .mapa-legenda {
  flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; min-width: 0;
  margin-left: -10px; padding-left: 10px;
}
.mapa-card--compacto .mapa-legenda::-webkit-scrollbar { display: none; }
.mapa-card--compacto .mapa-camada { flex-shrink: 0; }
.mapa-card--compacto .mapa-aviso span,
.mapa-card--compacto .mapa-area span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.mapa-card--compacto .mapa-area b { white-space: nowrap; flex-shrink: 0; }
.mapa-card--compacto .mapa-area { font-size: 12px; }

.mapa-card--compacto .mapa-sheet {
  left: 0; right: 0; bottom: 0; width: auto; max-height: 62%;
  border-radius: 18px 18px 0 0;
  padding: 12px 16px calc(14px + env(safe-area-inset-bottom));
  box-shadow: 0 -6px 24px rgba(0,0,0,0.2);
}
.mapa-card--compacto .mapa-sheet-enter-from,
.mapa-card--compacto .mapa-sheet-leave-to { transform: translateY(100%); opacity: 1; }
.mapa-card--compacto .mapa-sheet-abrir { width: 100%; padding: 6px 12px; font-size: 14px; }
.mapa-card--compacto .mapa-fabs :deep(.q-btn) { width: 48px; height: 48px; }

@media (max-width: 360px) {
  .mapa-rota--google { font-size: 14px; padding: 12px 8px; }
  .mapa-rota--waze { padding: 12px 12px; font-size: 14px; }
}
</style>
