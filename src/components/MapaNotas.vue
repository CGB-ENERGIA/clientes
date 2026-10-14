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

        <div class="mapa-legenda">
          <button
            v-for="s in STATUS"
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
          :options="[{ value: 'ruas', label: 'Ruas' }, { value: 'satelite', label: 'Satélite' }]"
        />
      </div>

      <div ref="mapaEl" class="mapa-el" />
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  modelValue: Boolean,
  grupos: { type: Array, default: () => [] }
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
let mapa = null
let camadaMarcadores = null
let camadasBase = {}
let ajustouVisao = false

const todasNotas = computed(() => props.grupos.flatMap(g => g._notas?.length ? g._notas : [g]))
const comCoordenada = computed(() => todasNotas.value.filter(n => Number.isFinite(n.latitude) && Number.isFinite(n.longitude)))
const semCoordenada = computed(() => todasNotas.value.filter(n => !Number.isFinite(n.latitude) || !Number.isFinite(n.longitude)))

const contagem = computed(() => {
  const c = {}
  for (const n of comCoordenada.value) c[n.status] = (c[n.status] || 0) + 1
  return c
})

const notasNoMapa = computed(() => comCoordenada.value.filter(n => !ocultos.value.has(n.status)))

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
  const itens = notas.map(n => `
    <div class="mp-nota">
      <div class="mp-nota-top">
        <b>Nota ${escapar(n.nota)}</b>
        <span class="mp-status" style="background:${corDe(n.status)}">${escapar(labelDe(n.status))}</span>
      </div>
      ${n.projeto_info_sap ? `<div class="mp-linha">SAP ${escapar(n.projeto_info_sap)}</div>` : ''}
      <div class="mp-linha">${escapar(n.base)}${n.municipio ? ' · ' + escapar(n.municipio) : ''}</div>
      <div class="mp-linha">${Number(n.postes) || 0} postes · ${Number(n.qtd_clientes) || 0} clientes</div>
      <button class="mp-btn" data-abrir="${escapar(n.nota)}">Abrir nota</button>
    </div>`).join('')
  return `
    ${notas.length > 1 ? `<div class="mp-titulo">${notas.length} notas neste ponto</div>` : ''}
    <div class="mp-lista">${itens}</div>
    <a class="mp-rota" href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener">
      Abrir no Google Maps
    </a>`
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
      .bindPopup(() => popupHtml(notas), { maxWidth: 280, maxHeight: 320 })
      .addTo(camadaMarcadores)
  }

  if (!ajustouVisao && notasNoMapa.value.length) {
    mapa.fitBounds(L.latLngBounds(notasNoMapa.value.map(n => [n.latitude, n.longitude])), { padding: [30, 30] })
    ajustouVisao = true
  }
}

async function montarMapa () {
  await nextTick()
  if (mapa || !mapaEl.value) return
  mapa = L.map(mapaEl.value, { preferCanvas: true, zoomControl: true }).setView([-4.5, -44.8], 7)
  camadasBase = {
    ruas: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }),
    satelite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Imagens &copy; Esri'
    })
  }
  camadasBase[camada.value].addTo(mapa)
  camadaMarcadores = L.layerGroup().addTo(mapa)

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
}

function desmontarMapa () {
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
    const n = achadas[0]
    mapa.setView([n.latitude, n.longitude], 16)
    camadaMarcadores.eachLayer(m => {
      const p = m.getLatLng()
      if (Math.abs(p.lat - n.latitude) < 1e-6 && Math.abs(p.lng - n.longitude) < 1e-6) m.openPopup()
    })
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
.mapa-busca { width: 260px; }
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
</style>
