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
              multiple
              :display-value="filtroBase.length > 1 ? `${filtroBase.length} bases` : (filtroBase[0] ?? undefined)"
              label="Base"
              class="mapa-filtro"
              options-dense
              behavior="menu"
              :hide-dropdown-icon="compacto && !!filtroBase.length"
            >
              <template #prepend>
                <q-icon name="business" size="18px" />
              </template>
              <template #option="{ itemProps, opt }">
                <q-item v-bind="itemProps" dense>
                  <q-item-section side><q-checkbox :model-value="filtroBase.includes(opt)" dense color="primary" /></q-item-section>
                  <q-item-section><q-item-label>{{ opt }}</q-item-label></q-item-section>
                </q-item>
              </template>
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
              :style="{ '--clr': s.cor }"
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

        <transition name="mapa-fabs">
          <div v-if="modo === 'campo' && !selecionado" class="mapa-fabs">
            <q-btn
              round
              :color="seguindo ? 'blue-7' : 'white'"
              :text-color="seguindo ? 'white' : 'blue-8'"
              :icon="seguindo ? 'gps_fixed' : 'my_location'"
              class="mapa-fab-gps"
              :class="{ 'mapa-fab-gps--ativo': seguindo }"
              @click="centralizarEmMim"
            >
              <q-tooltip v-if="!compacto">{{ seguindo ? 'Seguindo você' : 'Onde estou' }}</q-tooltip>
            </q-btn>
            <q-btn round color="teal-7" icon="near_me" :disable="!minhaPos" @click="irParaMaisProxima">
              <q-tooltip v-if="!compacto">Nota mais próxima</q-tooltip>
            </q-btn>
          </div>
        </transition>

        <transition name="mapa-sheet">
          <div
            v-if="selecionado"
            ref="sheetEl"
            class="mapa-sheet"
            :class="{ 'mapa-sheet--arrastando': arrasteY > 0 }"
            :style="arrasteY > 0 ? { transform: `translateY(${arrasteY}px)` } : null"
            @touchstart.passive="iniciarArraste"
            @touchmove="moverArraste"
            @touchend="soltarArraste"
            @touchcancel="soltarArraste"
          >
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

            <div v-if="rota.estado === 'ok'" class="mapa-sheet-rota">
              <q-icon name="directions_car" size="22px" />
              <div class="mapa-sheet-rota-info">
                <b>{{ formatarDuracao(rota.minutos) }}</b>
                <span>{{ formatarDistancia(rota.km) }} de carro</span>
              </div>
              <q-btn flat dense no-caps color="primary" icon="route" label="Ver trajeto" @click="enquadrarRota" />
            </div>
            <div v-else-if="rota.estado === 'carregando'" class="mapa-sheet-rota mapa-sheet-rota--carregando">
              <q-spinner-dots size="22px" color="primary" />
              <span>Calculando rota{{ distanciaSelecionado ? ` · ${distanciaSelecionado} em linha reta` : '' }}</span>
            </div>
            <div v-else-if="distanciaSelecionado" class="mapa-sheet-dist">
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
import { urlGoogleMaps, urlWaze, distanciaKm, formatarDistancia, formatarDuracao, buscarRota } from 'src/utils/rota'
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
const seguindo     = ref(false)
const rota         = ref({ estado: null })
const arrasteY     = ref(0)
let mapa = null
let camadaMarcadores = null
let camadaDestaque = null
let camadaRota = null
let camadasBase = {}
let ajustouVisao = false
let marcadorEu = null
let circuloEu = null
let gpsWatch = null
let rumo = null
let ouvindoBussola = false
let seguirPrimeiraPosicao = false

// O plugin de agrupamento procura o Leaflet na variável global
let clusterPronto = null
function carregarCluster () {
  if (!clusterPronto) {
    window.L = L
    clusterPronto = Promise.all([
      import('leaflet.markercluster'),
      import('leaflet.markercluster/dist/MarkerCluster.css')
    ])
  }
  return clusterPronto
}

function atualizarOnline () { online.value = navigator.onLine }

const todasNotas = computed(() => props.grupos.flatMap(g => g._notas?.length ? g._notas : [g]))
const comCoordenada = computed(() => todasNotas.value.filter(n => Number.isFinite(n.latitude) && Number.isFinite(n.longitude)))
const semCoordenada = computed(() => todasNotas.value.filter(n => !Number.isFinite(n.latitude) || !Number.isFinite(n.longitude)))

// ── Filtro por área (base / município) ───────────────────────────
const filtroBase      = ref([])
const filtroMunicipio = ref(null)
const avisoArea       = ref('')
const areaAtual       = ref(null)
const buscaMunicipio  = ref('')
let camadaArea = null
let geracaoArea = 0
let municipiosDaArea = []

const filtrosAtivos = computed(() =>
  filtroBase.value.length + (filtroMunicipio.value ? 1 : 0) + ocultos.value.size
)

const basesOpcoes = computed(() =>
  [...new Set(todasNotas.value.map(n => n.base).filter(Boolean))].sort()
)
const municipiosOpcoes = computed(() =>
  [...new Set(todasNotas.value
    .filter(n => !filtroBase.value.length || filtroBase.value.includes(n.base))
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
  (!filtroBase.value.length || filtroBase.value.includes(n.base)) &&
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
  if (!mapa || (!filtroBase.value.length && !filtroMunicipio.value)) return

  const municipios = filtroMunicipio.value
    ? [filtroMunicipio.value]
    : todasNotas.value.filter(n => filtroBase.value.includes(n.base)).map(n => n.municipio)

  let res
  try {
    res = await limitesDe(municipios)
  } catch {
    if (geracao === geracaoArea) avisoArea.value = 'Não foi possível carregar os limites dos municípios.'
    return
  }
  if (geracao !== geracaoArea || !mapa) return

  const tituloBase = filtroBase.value.length === 1
    ? `Base ${filtroBase.value[0]}`
    : `${filtroBase.value.length} bases selecionadas`
  areaAtual.value = filtroMunicipio.value
    ? { titulo: filtroMunicipio.value, sub: resumoArea(notasDaArea.value) }
    : { titulo: tituloBase, sub: `${res.features.length} municípios · ${resumoArea(notasDaArea.value)}` }

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
}, { deep: true })
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
  const mesmoPonto = selecionado.value?.[0]?.nota === notas[0].nota
  selecionado.value = notas
  seguindo.value = false
  const { latitude: lat, longitude: lng } = notas[0]
  camadaDestaque.clearLayers()
  L.marker([lat, lng], {
    icon: L.divIcon({
      className: 'mapa-pulso',
      html: `<span class="mapa-pulso-onda"></span><span class="mapa-pulso-onda mapa-pulso-onda--2"></span><span class="mapa-pulso-anel" style="--cor:${corDe(notas[0].status)}"></span>`,
      iconSize: [44, 44]
    }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 1000
  }).addTo(camadaDestaque)
  if (!mesmoPonto) calcularRota()

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
  arrasteY.value = 0
  camadaDestaque?.clearLayers()
  limparRota()
}

// ── Rota de carro até a nota selecionada (modo campo) ───────────
let rotaAbort = null
let rotaOrigem = null
let rotaLinha = null
const cacheRotas = new Map()

function limparRota () {
  rotaAbort?.abort()
  rotaAbort = null
  rotaOrigem = null
  rotaLinha = null
  camadaRota?.clearLayers()
  rota.value = { estado: null }
}

async function calcularRota () {
  limparRota()
  if (props.modo !== 'campo' || !minhaPos.value || !selecionado.value || !navigator.onLine) return
  const n = selecionado.value[0]
  const origem = { lat: minhaPos.value.lat, lng: minhaPos.value.lng }
  // O servidor público não atende trajetos muito longos com rapidez
  if (distanciaKm(origem, { lat: n.latitude, lng: n.longitude }) > 400) return

  const chave = `${n.nota}|${origem.lat.toFixed(3)},${origem.lng.toFixed(3)}`
  rotaOrigem = origem
  rota.value = { estado: 'carregando' }
  let res = cacheRotas.get(chave)
  if (!res) {
    rotaAbort = new AbortController()
    try {
      res = await buscarRota(origem, { lat: n.latitude, lng: n.longitude }, rotaAbort.signal)
      cacheRotas.set(chave, res)
    } catch (e) {
      if (e.name !== 'AbortError') rota.value = { estado: 'erro' }
      return
    }
  }
  if (!mapa || selecionado.value?.[0]?.nota !== n.nota) return
  rota.value = { estado: 'ok', km: res.km, minutos: res.minutos }
  desenharRota(res.pontos)
}

function desenharRota (pontos) {
  camadaRota.clearLayers()
  const renderer = L.svg({ pane: 'rota' })
  L.polyline(pontos, { renderer, pane: 'rota', color: '#fff', weight: 9, opacity: 0.9, interactive: false, className: 'mapa-rota-linha mapa-rota-linha--borda' }).addTo(camadaRota)
  rotaLinha = L.polyline(pontos, { renderer, pane: 'rota', color: '#1e88e5', weight: 5, opacity: 1, interactive: false, className: 'mapa-rota-linha' }).addTo(camadaRota)
  // pathLength = 1 permite animar o "desenho" da linha com CSS, qualquer que seja o tamanho
  camadaRota.eachLayer(l => l.getElement()?.setAttribute('pathLength', '1'))
}

function enquadrarRota () {
  if (!mapa || !rotaLinha) return
  const sheet = compacto.value ? (sheetEl.value?.offsetHeight ?? 0) : 0
  const lateral = !compacto.value && sheetEl.value ? sheetEl.value.offsetWidth + 24 : 30
  mapa.flyToBounds(rotaLinha.getBounds(), {
    paddingTopLeft: [lateral, 30],
    paddingBottomRight: [30, sheet + 30],
    maxZoom: 17,
    duration: 0.9
  })
}

// ── Arrastar a gaveta para baixo fecha os detalhes ─────────────
let arrasteInicio = null
function iniciarArraste (e) {
  if (!compacto.value || sheetEl.value?.scrollTop > 0) { arrasteInicio = null; return }
  arrasteInicio = e.touches[0].clientY
}
function moverArraste (e) {
  if (arrasteInicio == null) return
  const dy = e.touches[0].clientY - arrasteInicio
  if (dy > 0) {
    arrasteY.value = dy
    if (e.cancelable) e.preventDefault()
  } else {
    arrasteY.value = 0
  }
}
function soltarArraste () {
  if (arrasteInicio == null) return
  arrasteInicio = null
  if (arrasteY.value > 90) {
    const el = sheetEl.value
    if (el) { el.style.transition = 'transform 0.2s ease-in'; el.style.transform = 'translateY(100%)' }
    fecharSelecao()
  } else {
    arrasteY.value = 0
  }
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
  moverESelecionar(() => mapa.flyTo([n.latitude, n.longitude], zoom, { duration: 0.9 }), n)
}

// ── Localização da equipe (modo campo) ──────────────────────────
function iniciarGps () {
  if (props.modo !== 'campo' || gpsWatch != null) return
  if (!navigator.geolocation) { erroGps.value = 'Este aparelho não informa a localização.'; return }
  gpsWatch = navigator.geolocation.watchPosition(
    pos => {
      erroGps.value = ''
      const { latitude, longitude, accuracy, heading, speed } = pos.coords
      minhaPos.value = { lat: latitude, lng: longitude, precisao: accuracy }
      // Em movimento, o rumo do GPS é mais confiável que a bússola
      if (Number.isFinite(heading) && speed > 1.5) atualizarRumo(heading)
      desenharEu()
      if (seguirPrimeiraPosicao) { seguirPrimeiraPosicao = false; centralizarEmMim() }
      else if (seguindo.value) mapa?.panTo([latitude, longitude], { animate: true, duration: 0.6 })
      if (rotaOrigem && distanciaKm(rotaOrigem, minhaPos.value) > 0.5) calcularRota()
      else if (selecionado.value && !rotaOrigem && rota.value.estado == null) calcularRota()
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
  pararBussola()
}

// ── Direção para onde a pessoa está virada (bússola do aparelho) ─
function aoGirarAparelho (e) {
  let h = null
  if (Number.isFinite(e.webkitCompassHeading)) h = e.webkitCompassHeading
  else if (e.absolute && Number.isFinite(e.alpha)) h = 360 - e.alpha
  if (h != null) atualizarRumo(h)
}

async function iniciarBussola () {
  if (ouvindoBussola || typeof window.DeviceOrientationEvent === 'undefined') return
  // iPhone exige permissão, pedida a partir de um toque do usuário
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      if (await DeviceOrientationEvent.requestPermission() !== 'granted') return
    } catch { return }
  }
  ouvindoBussola = true
  window.addEventListener('deviceorientationabsolute', aoGirarAparelho)
  window.addEventListener('deviceorientation', aoGirarAparelho)
}

function pararBussola () {
  if (!ouvindoBussola) return
  ouvindoBussola = false
  window.removeEventListener('deviceorientationabsolute', aoGirarAparelho)
  window.removeEventListener('deviceorientation', aoGirarAparelho)
}

function atualizarRumo (h) {
  rumo = ((h % 360) + 360) % 360
  const cone = marcadorEu?.getElement()?.querySelector('.mapa-eu-cone')
  if (cone) {
    cone.style.opacity = '1'
    cone.style.transform = `rotate(${rumo}deg)`
  }
}

function desenharEu () {
  if (!mapa || !minhaPos.value) return
  const { lat, lng, precisao } = minhaPos.value
  if (!marcadorEu) {
    circuloEu = L.circle([lat, lng], { radius: precisao, color: '#1e88e5', weight: 1, opacity: 0.5, fillOpacity: 0.1, interactive: false }).addTo(mapa)
    marcadorEu = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'mapa-eu',
        html: '<span class="mapa-eu-cone"></span><span class="mapa-eu-pulso"></span><span class="mapa-eu-ponto"></span>',
        iconSize: [64, 64]
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 900
    }).addTo(mapa)
    if (rumo != null) atualizarRumo(rumo)
  } else {
    marcadorEu.setLatLng([lat, lng])
    circuloEu.setLatLng([lat, lng]).setRadius(precisao)
  }
}

function centralizarEmMim () {
  iniciarBussola()
  if (!minhaPos.value) { seguirPrimeiraPosicao = true; iniciarGps(); return }
  seguindo.value = true
  mapa?.flyTo([minhaPos.value.lat, minhaPos.value.lng], Math.max(mapa.getZoom(), 16), { duration: 0.8 })
}

function irParaMaisProxima () {
  if (!minhaPos.value || !notasNoMapa.value.length) return
  let melhor = null, menor = Infinity
  for (const n of notasNoMapa.value) {
    const d = distanciaKm(minhaPos.value, { lat: n.latitude, lng: n.longitude })
    if (d < menor) { menor = d; melhor = n }
  }
  if (!melhor) return
  moverESelecionar(() => mapa.flyToBounds(
    L.latLngBounds([[minhaPos.value.lat, minhaPos.value.lng], [melhor.latitude, melhor.longitude]]),
    { padding: [60, 60], maxZoom: 16, duration: 1 }
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
  const marcadores = []
  for (const notas of porPonto.values()) {
    const principal = [...notas].sort((a, b) => ordem(a.status) - ordem(b.status))[0]
    const m = L.circleMarker([principal.latitude, principal.longitude], {
      radius: notas.length > 1 ? raio + 2 : raio,
      color: '#fff',
      weight: notas.length > 1 ? 3 : 2,
      fillColor: corDe(principal.status),
      fillOpacity: 0.95,
      statusNotas: notas.map(n => n.status)
    })
    if (temHover) m.bindTooltip(notas.length > 1 ? `${notas.length} notas` : `Nota ${principal.nota}`, { direction: 'top', offset: [0, -6] })
    m.on('click', () => selecionarNoPonto(principal.latitude, principal.longitude))
    marcadores.push(m)
  }
  camadaMarcadores.addLayers ? camadaMarcadores.addLayers(marcadores) : marcadores.forEach(m => m.addTo(camadaMarcadores))

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

// Bolha com o total de notas e um anel colorido na proporção de cada status
function iconeCluster (cluster) {
  const cont = {}
  let total = 0
  for (const m of cluster.getAllChildMarkers()) {
    for (const s of m.options.statusNotas ?? []) { cont[s] = (cont[s] || 0) + 1; total++ }
  }
  let acc = 0
  const fatias = Object.keys(cont)
    .sort((a, b) => STATUS.findIndex(x => x.val === a) - STATUS.findIndex(x => x.val === b))
    .map(s => {
      const ini = acc
      acc += cont[s] / total * 360
      return `${corDe(s)} ${ini}deg ${acc}deg`
    })
  const tam = total < 10 ? 38 : total < 50 ? 46 : total < 200 ? 54 : 62
  return L.divIcon({
    className: 'mapa-cluster',
    html: `<div class="mapa-cluster-anel" style="background:conic-gradient(${fatias.join(',')})"><span>${total}</span></div>`,
    iconSize: [tam, tam]
  })
}

async function montarMapa () {
  await nextTick()
  await carregarCluster().catch(() => null)
  if (mapa || !mapaEl.value || !props.modelValue) return
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
  mapa.createPane('rota').style.zIndex = 390
  camadaMarcadores = (L.markerClusterGroup
    ? L.markerClusterGroup({
      iconCreateFunction: iconeCluster,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: false,
      disableClusteringAtZoom: 15,
      maxClusterRadius: z => z < 10 ? 60 : 45,
      chunkedLoading: true
    })
    : L.layerGroup()).addTo(mapa)
  camadaDestaque = L.layerGroup().addTo(mapa)
  camadaRota = L.layerGroup().addTo(mapa)
  mapa.on('dragstart', () => { seguindo.value = false })
  mapa.on('click', aoClicarMapa)
  mapa.on('zoomend', atualizarRotulos)

  ajustouVisao = false
  painelAberto.value = false
  desenharMarcadores()
  setTimeout(() => mapa?.invalidateSize(), 150)
  if (props.baseInicial && !filtroBase.value.includes(props.baseInicial)) filtroBase.value = [props.baseInicial]
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
  limparRota()
  camadaRota = null
  seguindo.value = false
  arrasteY.value = 0
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
    mapa.flyToBounds(L.latLngBounds(achadas.map(n => [n.latitude, n.longitude])), { padding: [40, 40], maxZoom: 15, duration: 0.9 })
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
  display: flex; flex-wrap: wrap; align-items: center; gap: 7px;
  padding: 9px 14px;
  background: rgba(255,255,255,0.97);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(15,23,42,0.07);
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

/* ── Search ── */
.mapa-busca { width: 226px; }
:deep(.mapa-busca .q-field__control) {
  border-radius: 22px !important; background: #eef2f9 !important; height: 36px;
}
:deep(.mapa-busca .q-field__control::before) { border: none !important; box-shadow: none !important; }
:deep(.mapa-busca .q-field__control::after)  { border: none !important; }
:deep(.mapa-busca .q-field__marginal)         { height: 36px; color: #64748b; }
:deep(.mapa-busca .q-field__native)           { color: #1e293b; font-size: 13px; }

/* ── Filters ── */
.mapa-controles { display: contents; }
.mapa-filtros   { display: contents; }
.mapa-filtro     { width: 162px; }
.mapa-filtro--mun { width: 206px; }
:deep(.mapa-filtro .q-field__control),
:deep(.mapa-filtro--mun .q-field__control) {
  border-radius: 22px !important; background: #eef2f9 !important; height: 36px;
}
:deep(.mapa-filtro .q-field__control::before),
:deep(.mapa-filtro--mun .q-field__control::before) { border-color: transparent !important; box-shadow: none !important; }
:deep(.mapa-filtro .q-field__control::after),
:deep(.mapa-filtro--mun .q-field__control::after)  { border: none !important; }
:deep(.mapa-filtro .q-field__marginal),
:deep(.mapa-filtro--mun .q-field__marginal)         { height: 36px; color: #64748b; }
:deep(.mapa-filtro .q-field__label),
:deep(.mapa-filtro--mun .q-field__label)             { font-size: 12.5px; color: #64748b; }
:deep(.mapa-filtro .q-field__native),
:deep(.mapa-filtro--mun .q-field__native)             { font-size: 13px; color: #1e293b; font-weight: 600; }

/* ── Legend pills ── */
.mapa-legenda { display: flex; flex-wrap: wrap; gap: 5px; flex: 1; align-items: center; }

.mapa-leg-item {
  display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
  padding: 4px 9px 4px 6px; border-radius: 22px;
  border: 1.5px solid transparent;
  background: #eef2f9;
  font-size: 11.5px; font-weight: 600; color: #334155;
  cursor: pointer; font-family: inherit; white-space: nowrap;
  transition: background 0.18s, border-color 0.18s, transform 0.13s, box-shadow 0.18s, opacity 0.18s;
  user-select: none;
}
.mapa-leg-item:hover {
  box-shadow: inset 0 0 0 1.5px var(--clr, #64748b), 0 3px 10px rgba(0,0,0,0.1);
  background: #fff;
  transform: translateY(-1px);
}
.mapa-leg-item:active { transform: scale(0.95); box-shadow: inset 0 0 0 1.5px var(--clr, #64748b); }

.mapa-leg-item b {
  font-size: 10.5px; font-weight: 700; color: #475569;
  background: rgba(0,0,0,0.07); padding: 1px 7px; border-radius: 10px; margin-left: 1px;
  min-width: 20px; text-align: center;
}
.mapa-leg-item--off { opacity: 0.32; filter: grayscale(0.4); }
.mapa-leg-item--off:hover { transform: none; box-shadow: none; }

.mapa-leg-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  box-shadow: 0 0 0 1.5px rgba(0,0,0,0.14);
}

/* ── Layer toggle ── */
:deep(.mapa-camada.q-btn-toggle) {
  border-radius: 22px; overflow: hidden;
  background: #eef2f9 !important;
  box-shadow: none !important; border: none !important;
  gap: 0;
}
:deep(.mapa-camada .q-btn) {
  border-radius: 0 !important;
  font-size: 11.5px !important; font-weight: 600 !important;
  min-height: 34px; padding: 0 14px !important;
  transition: background 0.18s, color 0.18s !important;
  letter-spacing: 0.01em;
}
:deep(.mapa-camada .q-btn:first-child) { border-radius: 22px 0 0 22px !important; }
:deep(.mapa-camada .q-btn:last-child)  { border-radius: 0 22px 22px 0 !important; }
:deep(.mapa-camada .q-btn--active) {
  background: #1d4ed8 !important; color: #fff !important;
  box-shadow: 0 2px 6px rgba(29,78,216,0.4) !important;
}

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

.mapa-sheet { transition: transform 0.25s cubic-bezier(0.2, 1.25, 0.35, 1); }
.mapa-sheet--arrastando { transition: none; }
.mapa-sheet-enter-active { transition: transform 0.42s cubic-bezier(0.2, 1.25, 0.35, 1), opacity 0.25s ease; }
.mapa-sheet-leave-active { transition: transform 0.2s ease-in, opacity 0.2s ease-in; }
.mapa-sheet-enter-from, .mapa-sheet-leave-to { transform: translateY(24px); opacity: 0; }

.mapa-sheet-rota {
  display: flex; align-items: center; gap: 10px; margin-top: 12px;
  background: #e3f2fd; color: #1565c0; border-radius: 12px; padding: 8px 6px 8px 12px;
  animation: mapa-surgir 0.3s ease;
}
.mapa-sheet-rota-info { display: flex; flex-direction: column; line-height: 1.2; flex: 1; min-width: 0; }
.mapa-sheet-rota-info b { font-size: 17px; color: #0d47a1; }
.mapa-sheet-rota-info span { font-size: 12px; color: #1976d2; }
.mapa-sheet-rota--carregando { background: #f5f7fa; color: #607d8b; font-size: 13px; padding: 10px 12px; }

@keyframes mapa-surgir { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.mapa-fabs-enter-active { transition: transform 0.35s cubic-bezier(0.2, 1.4, 0.4, 1), opacity 0.2s; }
.mapa-fabs-leave-active { transition: transform 0.15s ease-in, opacity 0.15s; }
.mapa-fabs-enter-from, .mapa-fabs-leave-to { transform: scale(0.4); opacity: 0; }
.mapa-fab-gps--ativo { box-shadow: 0 0 0 4px rgba(30,136,229,0.3), 0 3px 8px rgba(0,0,0,0.25); }

/* Bolhas de agrupamento */
:deep(.mapa-cluster) { background: none; border: none; }
:deep(.mapa-cluster-anel) {
  width: 100%; height: 100%; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  animation: mapa-pop 0.4s cubic-bezier(0.2, 1.5, 0.4, 1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}
:deep(.mapa-cluster-anel:hover) {
  transform: scale(1.12);
  box-shadow: 0 4px 14px rgba(0,0,0,0.35);
  opacity: 0.42;
}
:deep(.mapa-cluster-anel span) {
  width: calc(100% - 10px); height: calc(100% - 10px); border-radius: 50%;
  background: rgba(255,255,255,0.82);
  color: #1a2535; font-weight: 800; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(2px);
  transition: background 0.2s ease, color 0.2s ease, text-shadow 0.2s ease;
}
:deep(.mapa-cluster-anel:hover span) {
  background: transparent;
  color: #fff;
  text-shadow: 0 0 3px #000, 0 1px 6px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.7);
}
@keyframes mapa-pop { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* Nota selecionada */
:deep(.mapa-pulso) { background: none; border: none; pointer-events: none; }
:deep(.mapa-pulso-anel) {
  position: absolute; inset: 8px; border-radius: 50%;
  border: 4px solid #ffca28; box-shadow: 0 0 0 2px #fff, 0 2px 10px rgba(0,0,0,0.35);
  animation: mapa-pop 0.45s cubic-bezier(0.2, 1.6, 0.4, 1);
}
:deep(.mapa-pulso-onda) {
  position: absolute; inset: 8px; border-radius: 50%;
  background: rgba(255,202,40,0.45);
  animation: mapa-onda 1.8s ease-out infinite;
}
:deep(.mapa-pulso-onda--2) { animation-delay: 0.9s; }
@keyframes mapa-onda { from { transform: scale(0.6); opacity: 0.9; } to { transform: scale(2.2); opacity: 0; } }

/* Posição da equipe */
:deep(.mapa-eu) { background: none; border: none; pointer-events: none; }
:deep(.mapa-eu-ponto) {
  position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px;
  border-radius: 50%; background: #1e88e5; border: 3px solid #fff;
  box-shadow: 0 1px 6px rgba(0,0,0,0.4);
}
:deep(.mapa-eu-pulso) {
  position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px;
  border-radius: 50%; background: rgba(30,136,229,0.5);
  animation: mapa-onda 2s ease-out infinite;
}
:deep(.mapa-eu-cone) {
  position: absolute; inset: 0; opacity: 0;
  transition: transform 0.3s ease-out, opacity 0.3s;
  background: conic-gradient(from -28deg at 50% 50%, rgba(30,136,229,0.55) 0deg, rgba(30,136,229,0) 56deg, transparent 56deg);
  -webkit-mask: radial-gradient(circle, #000 0 30px, transparent 31px);
  mask: radial-gradient(circle, #000 0 30px, transparent 31px);
  border-radius: 50%;
}

/* Rota até a nota */
:deep(.mapa-rota-linha) {
  stroke-dasharray: 1; stroke-dashoffset: 1;
  animation: mapa-desenhar 1.1s ease-out forwards;
  stroke-linecap: round; stroke-linejoin: round;
}
@keyframes mapa-desenhar { to { stroke-dashoffset: 0; } }

:deep(.mapa-mun-label) {
  background: rgba(255,255,255,0.8); border: none; box-shadow: none;
  color: #0d47a1; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px;
}
:deep(.mapa-mun-label::before) { display: none; }

/* ── Celular ─────────────────────────────────────────────────── */
.mapa-card--compacto .mapa-toolbar { gap: 7px; padding: 8px 10px; }
.mapa-card--compacto .mapa-busca { flex: 1; width: auto; min-width: 0; }
.mapa-card--compacto .mapa-btn-filtros {
  width: 36px; height: 36px; border-radius: 18px;
  background: #eef2f9 !important;
}
.mapa-card--compacto .mapa-controles {
  display: flex; flex-wrap: wrap; align-items: center; gap: 7px; flex-basis: 100%; min-width: 0;
}
.mapa-card--compacto .mapa-filtros { display: flex; gap: 7px; flex-basis: 100%; min-width: 0; }
.mapa-card--compacto .mapa-filtro,
.mapa-card--compacto .mapa-filtro--mun { flex: 1 1 0; width: auto; min-width: 0; overflow: hidden; }
.mapa-card--compacto .mapa-filtros :deep(.q-field__native) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mapa-card--compacto .mapa-legenda {
  flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; min-width: 0;
  margin-left: -10px; padding-left: 10px;
  -webkit-overflow-scrolling: touch;
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
