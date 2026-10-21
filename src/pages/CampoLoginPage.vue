<template>
  <div class="campo-login">

    <!-- Cabeçalho -->
    <div class="cl-header">
      <img src="/logo.ico" class="cl-logo" alt="CGB" />
      <div class="cl-brand">CGB <span>Campo</span></div>
      <p class="cl-sub">Registro de postes em campo</p>
    </div>

    <!-- Formulário -->
    <div class="cl-form">

      <!-- EQUIPE -->
      <div class="cl-field">
        <label class="cl-label">Nome da equipe <span class="cl-req">*</span></label>
        <div class="cl-input-wrap" :class="{ 'cl-input-wrap--err': erros.equipe }">
          <q-icon name="groups" size="20px" class="cl-icon" />
          <input
            v-model="form.equipe"
            class="cl-input"
            placeholder="EX: EQUIPE ALPHA"
            style="text-transform:uppercase"
            @input="form.equipe = form.equipe.toUpperCase()"
          />
        </div>
        <span v-if="erros.equipe" class="cl-err">{{ erros.equipe }}</span>
      </div>

      <!-- MEU DIA -->
      <div v-if="diaItens.length" class="cl-dia">
        <div class="cl-dia-head">
          <div>
            <div class="cl-dia-titulo"><q-icon name="event_note" size="18px" /> Meu dia</div>
            <div class="cl-dia-sub">
              {{ diaFeitas }} de {{ diaItens.length }} {{ diaItens.length === 1 ? 'nota' : 'notas' }}
              <template v-if="diaOntem"> · {{ diaOntem }} de ontem</template>
              <template v-if="diaKmRestante"> · ≈ {{ diaKmRestante }} a percorrer</template>
            </div>
          </div>
          <div class="cl-dia-acoes">
            <button v-if="diaAbertas.length > 1" type="button" title="Reordenar pelo caminho mais curto" aria-label="Reordenar pelo caminho mais curto" @click="otimizarDia">
              <q-icon :name="otimizando ? 'hourglass_empty' : 'flash_on'" size="18px" />
            </button>
            <button type="button" title="Limpar o dia" aria-label="Limpar o dia" @click="limparDia">
              <q-icon name="delete_sweep" size="18px" />
            </button>
          </div>
        </div>
        <div class="cl-dia-barra"><i :style="{ width: diaPct + '%' }" /></div>

        <div v-if="diaProxima" class="cl-dia-prox">
          <div class="cl-dia-prox-label">{{ diaProxima.deOntem ? 'Ficou de ontem' : diaProxima.estado === 'pausada' ? 'Retomar' : (diaFeitas ? 'Próxima' : 'Começar por') }}</div>
          <div class="cl-dia-prox-nota">
            {{ diaProxima.nota.projeto_info_sap || diaProxima.nota.nota }}
            <span>{{ diaProxima.nota.base }}</span>
          </div>
          <div class="cl-dia-prox-sub">
            {{ [diaProxima.nota.municipio, `${Number(diaProxima.nota.postes) || 0} postes`].filter(Boolean).join(' · ') }}
            <template v-if="diaDistProxima"> · {{ diaDistProxima }} de você</template>
          </div>
          <div class="cl-dia-prox-btns">
            <button type="button" class="cl-dia-go" @click="iniciarDaLista(diaProxima.nota)">
              <q-icon name="play_arrow" size="20px" /> Iniciar turno
            </button>
            <button v-if="temCoordenada(diaProxima.nota)" type="button" class="cl-dia-nav" @click="iniciarDeslocamento(diaProxima.nota)">
              <q-icon name="navigation" size="18px" /> Ir
            </button>
          </div>
        </div>
        <div v-else class="cl-dia-fim"><q-icon name="task_alt" size="20px" /> Dia concluído. Todas as notas foram atendidas.</div>

        <div class="cl-dia-lista">
          <div v-for="it in diaItens" :key="it.nota.nota" class="cl-dia-item" :class="`cl-dia-item--${it.estado}`">
            <q-icon :name="ICONE_ESTADO[it.estado]" size="18px" class="cl-dia-ico" />
            <button
              type="button"
              class="cl-dia-corpo"
              :disabled="it.estado === 'concluida' || it.estado === 'imprevisto'"
              @click="iniciarDaLista(it.nota)"
            >
              <b>{{ it.nota.projeto_info_sap || it.nota.nota }}</b>
              <small>{{ [it.nota.municipio || it.nota.base, rotuloDia(it)].join(' · ') }}</small>
            </button>
            <button
              v-if="it.estado !== 'concluida' && it.estado !== 'atual'"
              type="button" class="cl-dia-rm" title="Tirar do dia" aria-label="Tirar do dia"
              @click="store.removerDoPlano(it.nota.nota)"
            >
              <q-icon name="close" size="16px" />
            </button>
          </div>
        </div>
      </div>

      <!-- CONTINUAR DE ONDE PAROU -->
      <div v-if="emAndamento.length && !form.nota" class="cl-field">
        <label class="cl-label">Continuar de onde parou</label>
        <div class="cl-retomar-list">
          <button
            v-for="r in emAndamento"
            :key="r.nota.nota"
            type="button"
            class="cl-retomar-item"
            :class="{ 'cl-retomar-item--equipe': r.daEquipe }"
            @click="selecionarNota(r.nota)"
          >
            <div class="cl-retomar-top">
              <span class="cl-retomar-nota">{{ r.nota.projeto_info_sap || r.nota.nota }}</span>
              <span class="cl-retomar-base">{{ r.nota.base }}</span>
            </div>
            <div class="cl-retomar-sub">
              <q-icon name="electrical_services" size="12px" />
              {{ r.total }}<template v-if="Number(r.nota.postes)"> de {{ r.nota.postes }}</template> postes
              · último {{ formatarQuando(r.ultimo) }}
              <template v-if="r.equipes.length"> · {{ r.equipes.join(', ') }}</template>
            </div>
          </button>
        </div>
      </div>

      <!-- NOTA -->
      <div class="cl-field">
        <div class="cl-label-row">
          <label class="cl-label">Nota de serviço <span class="cl-req">*</span></label>
          <button v-if="notas.length" type="button" class="cl-btn-mapa" @click="abrirMapa(null)">
            <q-icon name="map" size="16px" /> Ver no mapa
          </button>
        </div>

        <!-- Loading -->
        <div v-if="carregando" class="cl-input-wrap">
          <q-icon name="hourglass_empty" size="20px" class="cl-icon" />
          <span class="cl-input" style="color:rgba(255,255,255,0.35)">Carregando notas...</span>
        </div>

        <!-- Sem notas no cache -->
        <div v-else-if="notas.length === 0" class="cl-sem-notas">
          <q-icon name="warning_amber" size="18px" />
          Nenhuma nota disponível offline. Conecte-se para carregar.
          <button class="cl-btn-mini" @click="recarregar">Tentar novamente</button>
        </div>

        <!-- Notas carregadas: sync + busca -->
        <template v-else>
          <div class="cl-sync-bar">
            <div v-if="sincronizando" class="cl-sync-bar--loading">
              <q-spinner size="11px" /> Atualizando notas…
            </div>
            <div v-else class="cl-sync-bar--ok">
              <q-icon name="cloud_done" size="13px" />
              {{ notas.length }} notas · sincronizado {{ ultimoSync }}
            </div>
          </div>
          <div class="cl-autocomplete" ref="autocompleteRef">
            <div class="cl-input-wrap" :class="{ 'cl-input-wrap--err': erros.nota }">
              <q-icon name="search" size="20px" class="cl-icon" />
              <input
                v-model="buscaNota"
                class="cl-input"
                placeholder="Digite nota ou PEP..."
                autocomplete="off"
                @input="onBusca"
                @focus="dropdownAberto = true"
                @blur="onBlur"
                @keydown.down.prevent="moverSelecao(1)"
                @keydown.up.prevent="moverSelecao(-1)"
                @keydown.enter.prevent="selecionarDestacado"
                @keydown.escape="fecharDropdown"
              />
              <q-icon v-if="buscaNota" name="close" size="16px" class="cl-clear" @mousedown.prevent="limparBusca" />
            </div>
            <!-- Lista de sugestões -->
            <div v-if="dropdownAberto && notasFiltradas.length" class="cl-dropdown">
              <div
                v-for="(n, idx) in notasFiltradas"
                :key="n.nota"
                class="cl-dropdown-item"
                :class="{ 'cl-dropdown-item--active': idx === itemDestacado }"
                @mousedown.prevent="selecionarNota(n)"
              >
                <span class="cl-di-nota">{{ n.projeto_info_sap || n.nota }}</span>
                <span class="cl-di-sep">—</span>
                <span class="cl-di-base">{{ n.base }}</span>
                <span class="cl-di-pep">{{ n.pep }}</span>
                <span v-if="resumoPorNota.has(n.nota)" class="cl-di-tag">
                  {{ resumoPorNota.get(n.nota).total }} postes
                </span>
              </div>
            </div>
            <div v-else-if="dropdownAberto && buscaNota && !notasFiltradas.length" class="cl-dropdown">
              <div class="cl-dropdown-empty">Nenhuma nota encontrada</div>
            </div>
          </div>
          <span v-if="erros.nota" class="cl-err">{{ erros.nota }}</span>
        </template>

        <!-- Chips info do projeto selecionado -->
        <div v-if="notaInfo" class="cl-nota-info">
          <span class="cl-chip"><span class="cl-chip-label">SAP</span> {{ notaInfo.projeto_info_sap || notaInfo.nota }}</span>
          <span class="cl-chip"><span class="cl-chip-label">BASE</span> {{ notaInfo.base }}</span>
          <span class="cl-chip"><span class="cl-chip-label">PEP</span> {{ notaInfo.pep }}</span>
          <span class="cl-chip"><span class="cl-chip-label">POSTES</span> {{ notaInfo.postes }}</span>
        </div>

        <div v-if="notaInfo && temCoordenada(notaInfo)" class="cl-desloc">
          <button type="button" class="cl-desloc-btn" @click="iniciarDeslocamento(notaInfo)">
            <q-icon name="navigation" size="20px" /> Iniciar deslocamento
          </button>
          <button type="button" class="cl-desloc-waze" @click="iniciarDeslocamento(notaInfo, 'waze')">Waze</button>
          <button type="button" class="cl-desloc-mapa" @click="abrirMapa(notaInfo.nota)">
            <q-icon name="map" size="20px" />
          </button>
        </div>
        <div v-else-if="notaInfo" class="cl-desloc-sem">
          <q-icon name="location_off" size="14px" /> Esta nota não tem coordenadas na planilha.
        </div>
      </div>

      <!-- CLIENTE -->
      <div class="cl-field" v-if="clientesNota.length > 0">
        <label class="cl-label">Cliente <span class="cl-req">*</span></label>
        <div class="cl-clientes-list">
          <button
            v-for="c in clientesNota"
            :key="c.conta_contrato || c.nome"
            class="cl-cliente-item"
            :class="{ 'cl-cliente-item--ativo': form.cliente?.nome === c.nome }"
            type="button"
            @click="selecionarCliente(c)"
          >
            <div class="cl-cliente-nome">{{ c.nome }}</div>
            <div v-if="c.endereco || c.bairro" class="cl-cliente-end">
              {{ [c.endereco, c.bairro].filter(Boolean).join(', ') }}
            </div>
          </button>
        </div>
        <span v-if="erros.cliente" class="cl-err">{{ erros.cliente }}</span>
      </div>

      <!-- Botão -->
      <button class="cl-btn" @click="iniciar">
        <q-icon name="play_arrow" size="22px" />
        Iniciar Turno
      </button>

      <button class="cl-btn-imprevisto" type="button" @click="abrirImprevisto">
        <q-icon name="report_problem" size="18px" />
        Reportar imprevisto
      </button>

      <button class="cl-btn-equipe2" type="button" @click="router.push('/campo/equipe2')">
        <q-icon name="fact_check" size="18px" />
        Equipe 2: concluir serviço e clientes
      </button>

    </div>

    <MapaNotas
      v-model="mapaAberto"
      modo="campo"
      :grupos="notasParaMapa"
      :foco="mapaFoco"
      rotulo-abrir="Selecionar esta nota"
      :plano-notas="store.plano.itens.map(i => i.nota)"
      @abrir="selecionarDoMapa"
      @planejar="adicionarDoMapa"
    />

    <ImprevistoDialog
      v-model="imprevistoAberto"
      :equipe="form.equipe.trim().toUpperCase()"
      :nota="notaInfo"
      @enviado="onImprevistoEnviado"
    />

    <!-- Banner de fila pendente -->
    <div v-if="store.fila.length > 0 || store.filaImprevistos.length > 0 || store.filaStatus.length > 0" class="cl-sync-pending">
      <div class="cl-sync-pending-info">
        <q-icon
          :name="store.sincronizando ? 'sync' : 'cloud_upload'"
          size="20px"
          :class="{ 'spin': store.sincronizando }"
        />
        <div>
          <div class="cl-sync-pending-title">
            <template v-if="store.fila.length">
              {{ store.fila.length }} {{ store.fila.length === 1 ? 'registro pendente' : 'registros pendentes' }}
            </template>
            <template v-if="store.fila.length && store.filaImprevistos.length"> · </template>
            <template v-if="store.filaImprevistos.length">
              {{ store.filaImprevistos.length }} {{ store.filaImprevistos.length === 1 ? 'imprevisto' : 'imprevistos' }}
            </template>
            <template v-if="!store.fila.length && !store.filaImprevistos.length && store.filaStatus.length">
              {{ store.filaStatus.length }} {{ store.filaStatus.length === 1 ? 'atualização de nota' : 'atualizações de nota' }}
            </template>
          </div>
          <div class="cl-sync-pending-sub">
            {{ store.online ? (store.sincronizando ? 'Sincronizando…' : 'Aguardando envio') : 'Sem conexão — será enviado quando online' }}
          </div>
        </div>
      </div>
      <button
        class="cl-sync-btn"
        :disabled="!store.online || store.sincronizando"
        @click="store.sincronizar()"
      >
        <q-icon name="sync" size="16px" />
        Sincronizar
      </button>
    </div>

    <!-- Rodapé -->
    <div class="cl-footer">© {{ ano }} CGB Energia</div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCampoStore } from 'stores/campo'
import { useNotasStore } from 'stores/notas'
import { useQuasar } from 'quasar'
import ImprevistoDialog from 'components/ImprevistoDialog.vue'
import MapaNotas from 'components/MapaNotas.vue'
import { temCoordenada, iniciarDeslocamento, distanciaKm, formatarDistancia } from 'src/utils/rota'
import { ordenarRoteiro } from 'src/utils/roteiro'

const $q         = useQuasar()
const router     = useRouter()
const store      = useCampoStore()
const notasStore = useNotasStore()
const ano        = new Date().getFullYear()
const carregando = ref(false)

const form  = reactive({ equipe: store.ultimaEquipe || '', nota: '', cliente: null })
const erros = reactive({ equipe: '', nota: '', cliente: '' })

const notas        = computed(() => notasStore.notas)
const notaInfo     = computed(() => notasStore.getNota(form.nota))
const clientesNota = computed(() => notaInfo.value?.clientes_planilha ?? [])
const sincronizando = ref(false)
const ultimoSync    = ref('')
let   syncInterval  = null

function formatarSyncTime (d) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatarQuando (iso) {
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === new Date().toDateString()) return `hoje ${hora}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`
}

// ── Notas com postes já registrados e ainda não finalizadas ──────
const resumoPorNota = computed(() => new Map(store.resumoNotas.map(r => [r.nota, r])))

const emAndamento = computed(() => {
  const equipe = form.equipe.trim().toUpperCase()
  const pausadas = new Map(store.pausadas.map(p => [p.nota, p]))
  const pendentes = {}
  for (const r of store.fila) pendentes[r.nota] = (pendentes[r.nota] || 0) + 1
  const finalizadas = new Set(store.filaStatus.filter(s => s.acao === 'finalizar').map(s => s.nota))
  return notas.value
    .filter(n => (resumoPorNota.value.has(n.nota) || pausadas.has(n.nota) || pendentes[n.nota]) &&
                 !finalizadas.has(n.nota) &&
                 !['aguardando_etapa2', 'baixar_medidor', 'concluido', 'expurgo', 'sem_acesso'].includes(n.status))
    .map(n => {
      const r = resumoPorNota.value.get(n.nota)
      const p = pausadas.get(n.nota)
      const equipes = [...new Set([...(r?.equipes || []), ...(p ? [p.equipe] : [])])]
      const enviados = Number(r?.total || 0)
      const total = Math.max(enviados + (pendentes[n.nota] || 0), p?.registrados || 0)
      const ultimo = [r?.ultimo, p?.em].filter(Boolean).sort().pop()
      return { nota: n, total, ultimo, equipes, daEquipe: !!equipe && equipes.includes(equipe) }
    })
    .sort((a, b) => (b.daEquipe - a.daEquipe) || b.ultimo.localeCompare(a.ultimo))
    .slice(0, 6)
})

// ── Autocomplete ──────────────────────────────────────────────────
const buscaNota      = ref('')
const dropdownAberto = ref(false)
const itemDestacado  = ref(-1)
const autocompleteRef = ref(null)

const notasFiltradas = computed(() => {
  const q = buscaNota.value.trim().toLowerCase()
  const disponiveis = notas.value.filter(n => !NOTA_FINALIZADA.includes(n.status))
  if (!q) return disponiveis.slice(0, 20)
  return disponiveis.filter(n =>
    n.nota.includes(q) ||
    (n.pep  && n.pep.toLowerCase().includes(q)) ||
    (n.base && n.base.toLowerCase().includes(q))
  ).slice(0, 30)
})

function onBusca () {
  form.nota = ''
  dropdownAberto.value = true
  itemDestacado.value = -1
}

// ── Mapa: notas que ainda têm trabalho de campo ──────────────────
const mapaAberto = ref(false)
const mapaFoco   = ref(null)
const notasParaMapa = computed(() =>
  notas.value.filter(n => ['pendente', 'em_andamento'].includes(n.status) || n.nota === form.nota)
)

function abrirMapa (foco) {
  mapaFoco.value = foco
  mapaAberto.value = true
}

function selecionarDoMapa (n) {
  mapaAberto.value = false
  selecionarNota(n)
}

function selecionarNota (n) {
  form.nota    = n.nota
  form.cliente = null
  erros.cliente = ''
  buscaNota.value = `${n.projeto_info_sap || n.nota} — ${n.base}`
  dropdownAberto.value = false
  itemDestacado.value  = -1
  erros.nota = ''
  // Auto-seleciona se só houver 1 cliente
  const cls = n.clientes_planilha ?? []
  if (cls.length === 1) form.cliente = cls[0]
}

function selecionarCliente (c) {
  form.cliente  = c
  erros.cliente = ''
}

function moverSelecao (dir) {
  if (!dropdownAberto.value) { dropdownAberto.value = true; return }
  const max = notasFiltradas.value.length - 1
  itemDestacado.value = Math.min(Math.max(itemDestacado.value + dir, 0), max)
}

function selecionarDestacado () {
  if (itemDestacado.value >= 0 && notasFiltradas.value[itemDestacado.value]) {
    selecionarNota(notasFiltradas.value[itemDestacado.value])
  }
}

function fecharDropdown () {
  dropdownAberto.value = false
  itemDestacado.value  = -1
}

function onBlur () {
  setTimeout(fecharDropdown, 150)
}

function limparBusca () {
  buscaNota.value = ''
  form.nota = ''
  dropdownAberto.value = true
  itemDestacado.value  = -1
}

function validar () {
  erros.equipe  = form.equipe.trim() ? '' : 'Informe o nome da equipe'
  erros.nota    = form.nota          ? '' : 'Selecione uma nota de serviço'
  erros.cliente = (clientesNota.value.length === 0 || form.cliente) ? '' : 'Selecione o cliente'
  if (notaInfo.value && NOTA_FINALIZADA.includes(notaInfo.value.status)) erros.nota = 'Esta nota já foi finalizada pela equipe 1'
  return !erros.equipe && !erros.nota && !erros.cliente
}

function iniciar () {
  if (!validar()) return
  const n = notaInfo.value
  store.iniciarSessao({
    equipe:  form.equipe.trim().toUpperCase(),
    nota:    form.nota,
    base:    n?.base  ?? '',
    pep:     n?.pep   ?? '',
    postes:  n?.postes ?? 0,
    cliente: form.cliente ?? null
  })
  router.push('/campo/registro')
}

const imprevistoAberto = ref(false)

function abrirImprevisto () {
  erros.equipe  = form.equipe.trim() ? '' : 'Informe o nome da equipe'
  erros.nota    = form.nota          ? '' : 'Selecione uma nota de serviço'
  erros.cliente = ''
  if (erros.equipe || erros.nota) return
  imprevistoAberto.value = true
}

// ── Meu dia ──────────────────────────────────────────────────────
const ICONE_ESTADO = { pendente: 'radio_button_unchecked', atual: 'play_circle', pausada: 'pause_circle', concluida: 'check_circle', imprevisto: 'report_problem' }
const ROTULO_ESTADO = { pendente: 'a fazer', atual: 'em andamento', pausada: 'pausada', concluida: 'concluída', imprevisto: 'imprevisto' }
const NOTA_FINALIZADA = ['aguardando_etapa2', 'baixar_medidor', 'concluido', 'expurgo', 'sem_acesso']

const minhaPos   = ref(null)
const otimizando = ref(false)

function obterPosicao () {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      p => { minhaPos.value = { lat: p.coords.latitude, lng: p.coords.longitude }; resolve(minhaPos.value) },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
    )
  })
}

// Nota já baixada por outro caminho (sistema, outra equipe) conta como feita
const diaItens = computed(() => store.plano.itens
  .map(i => ({ ...i, nota: notasStore.getNota(i.nota) }))
  .filter(i => i.nota)
  .map(i => (['pendente', 'pausada'].includes(i.estado) && NOTA_FINALIZADA.includes(i.nota.status)) ? { ...i, estado: 'concluida' } : i))
const diaAbertas = computed(() => diaItens.value.filter(i => ['pendente', 'pausada'].includes(i.estado)))
const diaFeitas  = computed(() => diaItens.value.filter(i => ['concluida', 'imprevisto'].includes(i.estado)).length)
const diaOntem   = computed(() => diaAbertas.value.filter(i => i.deOntem).length)
const rotuloDia  = it => it.deOntem && it.estado === 'pendente' ? 'ficou de ontem' : ROTULO_ESTADO[it.estado]
const diaPct     = computed(() => diaItens.value.length ? Math.round(diaFeitas.value / diaItens.value.length * 100) : 0)
const diaProxima = computed(() =>
  diaItens.value.find(i => i.estado === 'pendente') ?? diaItens.value.find(i => i.estado === 'pausada') ?? null)

const diaDistProxima = computed(() => {
  const n = diaProxima.value?.nota
  return minhaPos.value && n && temCoordenada(n)
    ? formatarDistancia(distanciaKm(minhaPos.value, { lat: n.latitude, lng: n.longitude }))
    : ''
})

// Distância em linha reta passando pelas notas que faltam, na ordem do dia
const diaKmRestante = computed(() => {
  const pts = diaAbertas.value.map(i => i.nota).filter(temCoordenada).map(n => ({ lat: n.latitude, lng: n.longitude }))
  if (minhaPos.value) pts.unshift(minhaPos.value)
  let km = 0
  for (let k = 1; k < pts.length; k++) km += distanciaKm(pts[k - 1], pts[k])
  return km > 0 ? formatarDistancia(km) : ''
})

function adicionarDoMapa (codigos) {
  const n = store.adicionarAoPlano(codigos)
  $q.notify({
    type: n ? 'positive' : 'info',
    icon: 'event_available',
    message: n ? `${n} ${n === 1 ? 'nota adicionada' : 'notas adicionadas'} ao seu dia.` : 'Essas notas já estão no seu dia.',
    position: 'top', timeout: 2200
  })
}

function limparDia () {
  $q.dialog({
    title: 'Limpar o dia?',
    message: 'As notas saem da lista de hoje. Os postes já registrados continuam salvos.',
    cancel: { label: 'Voltar', flat: true },
    ok: { label: 'Limpar', color: 'negative', unelevated: true }
  }).onOk(() => store.limparPlano())
}

async function otimizarDia () {
  if (otimizando.value) return
  otimizando.value = true
  const pos = minhaPos.value ?? await obterPosicao()
  // "De ontem" vem sempre antes; cada grupo parte de onde o anterior termina
  const ordem = []
  let origem = pos
  for (const grupo of [diaAbertas.value.filter(i => i.deOntem), diaAbertas.value.filter(i => !i.deOntem)]) {
    const paradas = grupo.filter(i => temCoordenada(i.nota)).map(i => ({ codigo: i.nota.nota, lat: i.nota.latitude, lng: i.nota.longitude }))
    const seq = ordenarRoteiro(paradas, origem)
    ordem.push(...seq.map(p => p.codigo), ...grupo.filter(i => !temCoordenada(i.nota)).map(i => i.nota.nota))
    if (seq.length) origem = seq[seq.length - 1]
  }
  store.reordenarPlano(ordem)
  otimizando.value = false
  $q.notify({
    type: 'positive', icon: 'flash_on', position: 'top', timeout: 2200,
    message: pos ? 'Dia reordenado a partir de onde você está.' : 'Dia reordenado pelo caminho mais curto.'
  })
}

// Escolhe a nota do dia; começa direto quando já dá (cliente único), senão leva ao cliente
async function iniciarDaLista (n) {
  selecionarNota(n)
  if (validar()) { iniciar(); return }
  await nextTick()
  const alvo = erros.equipe ? document.querySelector('.cl-input') : document.querySelector('.cl-clientes-list')
  alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  $q.notify({ type: 'info', position: 'top', timeout: 2200, message: erros.equipe ? 'Informe o nome da equipe para iniciar.' : 'Escolha o cliente para iniciar o turno.' })
}

function onImprevistoEnviado ({ enviado }) {
  store.marcarNoPlano(form.nota, 'imprevisto')
  $q.notify({
    type: enviado ? 'positive' : 'warning',
    message: enviado ? 'Imprevisto registrado.' : 'Sem conexão: o imprevisto será enviado quando houver internet.',
    position: 'top'
  })
}

async function sincronizarNotas (silencioso = false) {
  if (!navigator.onLine) return
  if (!silencioso) carregando.value = notas.value.length === 0
  sincronizando.value = true
  await Promise.all([notasStore.fetchNotas(), store.carregarResumo()])
  sincronizando.value = false
  carregando.value    = false
  ultimoSync.value    = formatarSyncTime(new Date())
}

async function recarregar () {
  await sincronizarNotas(false)
}

onMounted(async () => {
  if (store.sessao) { router.replace('/campo/registro'); return }
  // Nota que ficou "em andamento" sem sessão ativa (app fechado) volta como pausada
  store.plano.itens.filter(i => i.estado === 'atual').forEach(i => store.marcarNoPlano(i.nota, 'pausada'))
  if (store.plano.itens.length) obterPosicao()
  // Sempre sincroniza quando online (mostra cache enquanto carrega)
  await sincronizarNotas(notas.value.length > 0)
  // Atualiza a cada 2 minutos enquanto a tela estiver aberta
  syncInterval = setInterval(() => sincronizarNotas(true), 120_000)
})

onUnmounted(() => {
  if (syncInterval) clearInterval(syncInterval)
})
</script>

<style scoped>
.campo-login {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, #060b14 0%, #0a1628 60%, #060b14 100%);
  padding: 0 20px;
  overflow-y: auto;
}

/* ── Header ── */
.cl-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0 28px;
  gap: 6px;
}
.cl-logo {
  height: 52px; width: auto; object-fit: contain;
  filter: drop-shadow(0 4px 16px rgba(255,202,40,0.3));
  margin-bottom: 10px;
}
.cl-brand { font-size: 26px; font-weight: 900; color: #fff; letter-spacing: 1px; }
.cl-brand span { color: #ffca28; }
.cl-sub { font-size: 12px; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; margin: 0; }

/* ── Form ── */
.cl-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 440px;
  width: 100%;
  margin: 0 auto;
}

.cl-field { display: flex; flex-direction: column; gap: 7px; }
.cl-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.5); letter-spacing: 0.08em; text-transform: uppercase; }
.cl-req   { color: #ef9a9a; }
.cl-label-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cl-btn-mapa {
  display: flex; align-items: center; gap: 4px;
  border: 1px solid rgba(100,181,246,0.45); background: rgba(25,118,210,0.12);
  color: #90caf9; border-radius: 20px; padding: 4px 12px;
  font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
}
.cl-desloc { display: flex; gap: 8px; margin-top: 4px; }
.cl-desloc-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
  border: none; border-radius: 12px; padding: 13px;
  background: linear-gradient(135deg, #2e7d32, #43a047); color: #fff;
  font-family: inherit; font-size: 15px; font-weight: 800; cursor: pointer;
}
.cl-desloc-waze {
  border: none; border-radius: 12px; padding: 0 14px;
  background: #33ccff; color: #0d2b3e;
  font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer;
}
.cl-desloc-mapa {
  border: 1px solid rgba(100,181,246,0.45); border-radius: 12px; padding: 0 12px;
  background: rgba(25,118,210,0.12); color: #90caf9; cursor: pointer;
}
.cl-desloc-btn:active, .cl-desloc-waze:active, .cl-desloc-mapa:active { transform: scale(0.97); }
.cl-desloc-btn { min-width: 0; white-space: nowrap; }
@media (max-width: 380px) {
  .cl-desloc { gap: 6px; }
  .cl-desloc-btn { font-size: 13px; padding: 12px 8px; gap: 5px; }
  .cl-desloc-waze { padding: 0 10px; font-size: 13px; }
  .cl-desloc-mapa { padding: 0 9px; }
}
.cl-desloc-sem { font-size: 12px; color: rgba(255,255,255,0.4); display: flex; align-items: center; gap: 4px; }

.cl-btn-equipe2 {
  display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
  border: 1px solid rgba(129,199,132,0.45); border-radius: 14px; padding: 13px;
  background: rgba(67,160,71,0.12); color: #a5d6a7; cursor: pointer;
  font-family: inherit; font-size: 14px; font-weight: 700;
}
.cl-btn-equipe2:active { transform: scale(0.98); }

/* ── Meu dia ── */
.cl-dia {
  display: flex; flex-direction: column; gap: 12px;
  padding: 14px; border-radius: 18px;
  background: linear-gradient(160deg, rgba(255,202,40,0.1), rgba(255,255,255,0.03));
  border: 1px solid rgba(255,202,40,0.28);
}
.cl-dia-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.cl-dia-titulo { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 800; color: #ffca28; }
.cl-dia-sub { margin-top: 2px; font-size: 12px; color: rgba(255,255,255,0.55); font-variant-numeric: tabular-nums; }
.cl-dia-acoes { display: flex; gap: 6px; }
.cl-dia-acoes button {
  width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer;
  background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.75);
  display: flex; align-items: center; justify-content: center; transition: background 0.15s;
}
.cl-dia-acoes button:hover { background: rgba(255,255,255,0.16); }
.cl-dia-barra { height: 5px; border-radius: 3px; background: rgba(255,255,255,0.1); overflow: hidden; }
.cl-dia-barra i { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, #43a047, #66bb6a); transition: width 0.4s ease; }

.cl-dia-prox {
  padding: 12px 14px; border-radius: 14px;
  background: rgba(10,22,40,0.7); border: 1px solid rgba(100,181,246,0.35);
}
.cl-dia-prox-label { font-size: 10.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #90caf9; }
.cl-dia-prox-nota { margin-top: 3px; font-size: 19px; font-weight: 800; color: #fff; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.cl-dia-prox-nota span { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.5); }
.cl-dia-prox-sub { margin-top: 2px; font-size: 12.5px; color: rgba(255,255,255,0.55); }
.cl-dia-prox-btns { display: flex; gap: 8px; margin-top: 12px; }
.cl-dia-go {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  border: none; border-radius: 12px; padding: 13px; cursor: pointer;
  background: linear-gradient(135deg, #1565c0, #1e88e5); color: #fff;
  font-family: inherit; font-size: 15px; font-weight: 800;
}
.cl-dia-nav {
  display: flex; align-items: center; gap: 6px; border: none; border-radius: 12px; padding: 0 16px; cursor: pointer;
  background: linear-gradient(135deg, #2e7d32, #43a047); color: #fff;
  font-family: inherit; font-size: 14px; font-weight: 800;
}
.cl-dia-go:active, .cl-dia-nav:active { transform: scale(0.97); }
.cl-dia-fim {
  display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 14px;
  background: rgba(67,160,71,0.15); color: #a5d6a7; font-size: 14px; font-weight: 700;
}

.cl-dia-lista { display: flex; flex-direction: column; gap: 4px; }
.cl-dia-item { display: flex; align-items: center; gap: 8px; padding: 2px 4px; border-radius: 10px; }
.cl-dia-ico { flex-shrink: 0; color: rgba(255,255,255,0.35); }
.cl-dia-item--pendente .cl-dia-ico { color: #90caf9; }
.cl-dia-item--atual .cl-dia-ico { color: #ffca28; }
.cl-dia-item--pausada .cl-dia-ico { color: #ffb74d; }
.cl-dia-item--concluida .cl-dia-ico { color: #66bb6a; }
.cl-dia-item--imprevisto .cl-dia-ico { color: #ef9a9a; }
.cl-dia-corpo {
  flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
  border: none; background: none; padding: 6px 4px; cursor: pointer; text-align: left; font-family: inherit;
}
.cl-dia-corpo b { font-size: 14px; color: #fff; }
.cl-dia-corpo small { max-width: 100%; font-size: 11.5px; color: rgba(255,255,255,0.45); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl-dia-corpo:disabled { cursor: default; }
.cl-dia-item--concluida b, .cl-dia-item--imprevisto b { color: rgba(255,255,255,0.45); text-decoration: line-through; }
.cl-dia-rm {
  flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer;
  background: none; color: rgba(255,255,255,0.35); display: flex; align-items: center; justify-content: center;
}
.cl-dia-rm:hover { background: rgba(255,255,255,0.1); color: #fff; }

.cl-input-wrap, .cl-select-wrap {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,0.05);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  padding: 0 16px;
  transition: border-color 0.2s;
}
.cl-input-wrap:focus-within  { border-color: #1976d2; box-shadow: 0 0 0 3px rgba(25,118,210,0.15); }
.cl-input-wrap--err, .cl-select-wrap--err { border-color: #c62828 !important; }
.cl-select-wrap { position: relative; }

.cl-icon    { color: rgba(255,255,255,0.3); flex-shrink: 0; }
.cl-chevron { color: rgba(255,255,255,0.3); margin-left: auto; flex-shrink: 0; pointer-events: none; }

.cl-input {
  flex: 1; border: none; background: transparent;
  color: #fff; font-size: 15px; padding: 15px 0;
  outline: none; font-family: inherit;
}
.cl-input::placeholder { color: rgba(255,255,255,0.2); }

.cl-select {
  flex: 1; border: none; background: transparent;
  color: #fff; font-size: 15px; padding: 15px 0;
  outline: none; font-family: inherit;
  appearance: none; -webkit-appearance: none; cursor: pointer;
}
.cl-select option { background: #0a1628; color: #fff; }

.cl-err { font-size: 11px; color: #ef9a9a; padding-left: 4px; }

/* ── Faixa de sync ── */
.cl-sync-bar {
  margin-top: -2px;
  font-size: 11px;
  display: flex;
  align-items: center;
}
.cl-sync-bar--loading {
  display: flex; align-items: center; gap: 5px;
  color: rgba(255,255,255,0.4);
}
.cl-sync-bar--ok {
  display: flex; align-items: center; gap: 5px;
  color: rgba(0,200,83,0.7);
}

/* ── Autocomplete ── */
.cl-autocomplete { position: relative; }

.cl-clear {
  color: rgba(255,255,255,0.3);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s;
}
.cl-clear:hover { color: rgba(255,255,255,0.7); }

.cl-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0; right: 0;
  background: #0f1e35;
  border: 1.5px solid rgba(25,118,210,0.35);
  border-radius: 14px;
  max-height: 240px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.cl-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.12s;
}
.cl-dropdown-item:last-child { border-bottom: none; }
.cl-dropdown-item:hover,
.cl-dropdown-item--active { background: rgba(25,118,210,0.18); }

.cl-di-nota { font-size: 15px; font-weight: 700; color: #fff; min-width: 52px; }
.cl-di-sep  { color: rgba(255,255,255,0.25); }
.cl-di-base { font-size: 13px; color: rgba(255,255,255,0.65); flex: 1; }
.cl-di-pep  { font-size: 11px; color: #64b5f6; font-weight: 600; white-space: nowrap; }

.cl-dropdown-empty {
  padding: 16px;
  text-align: center;
  color: rgba(255,255,255,0.35);
  font-size: 13px;
}

.cl-di-tag {
  font-size: 10px; font-weight: 700;
  color: #ffb74d; background: rgba(255,152,0,0.15);
  border-radius: 10px; padding: 1px 7px; white-space: nowrap;
}

/* ── Continuar de onde parou ── */
.cl-retomar-list { display: flex; flex-direction: column; gap: 8px; }
.cl-retomar-item {
  width: 100%; text-align: left;
  padding: 12px 14px; border-radius: 14px;
  border: 1.5px solid rgba(255,152,0,0.25);
  background: rgba(255,152,0,0.07);
  color: #fff; font-family: inherit; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.cl-retomar-item:active { transform: scale(0.98); }
.cl-retomar-item--equipe { border-color: rgba(255,152,0,0.6); background: rgba(255,152,0,0.13); }
.cl-retomar-top { display: flex; align-items: baseline; gap: 8px; }
.cl-retomar-nota { font-size: 15px; font-weight: 800; }
.cl-retomar-base { font-size: 12px; color: rgba(255,255,255,0.55); }
.cl-retomar-sub {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
  font-size: 11px; color: #ffb74d; margin-top: 4px;
}

/* ── Info da nota ── */
.cl-nota-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}
.cl-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(25,118,210,0.18);
  border: 1px solid rgba(25,118,210,0.3);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 13px;
  color: #90caf9;
  font-weight: 600;
}
.cl-chip-label {
  font-size: 9px;
  font-weight: 800;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* ── Sem notas ── */
.cl-sem-notas {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: rgba(255,160,0,0.08);
  border: 1px solid rgba(255,160,0,0.2);
  border-radius: 14px;
  color: #ffb74d;
  font-size: 13px;
  text-align: center;
}
.cl-btn-mini {
  padding: 6px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255,183,77,0.4);
  background: transparent;
  color: #ffb74d;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  margin-top: 4px;
}

/* ── Botão ── */
.cl-btn {
  margin-top: 8px;
  width: 100%; padding: 18px;
  border-radius: 16px; border: none;
  background: linear-gradient(135deg, #1565c0, #1976d2);
  color: #fff; font-size: 17px; font-weight: 800;
  font-family: inherit; letter-spacing: 0.5px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  box-shadow: 0 6px 28px rgba(21,101,192,0.45);
  transition: transform 0.15s, box-shadow 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.cl-btn:active { transform: scale(0.97); box-shadow: 0 2px 12px rgba(21,101,192,0.3); }

.cl-btn-imprevisto {
  width: 100%; padding: 14px;
  border-radius: 14px;
  border: 1.5px solid rgba(255,152,0,0.45);
  background: rgba(255,152,0,0.08);
  color: #ffb74d;
  font-family: inherit; font-size: 14px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.cl-btn-imprevisto:active { transform: scale(0.97); }

/* ── Clientes da nota ── */
.cl-clientes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cl-cliente-item {
  width: 100%;
  text-align: left;
  padding: 13px 16px;
  border-radius: 14px;
  border: 1.5px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: #fff;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.cl-cliente-item:active { transform: scale(0.98); }
.cl-cliente-item--ativo {
  border-color: #1976d2;
  background: rgba(25,118,210,0.18);
  box-shadow: 0 0 0 3px rgba(25,118,210,0.15);
}
.cl-cliente-nome {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}
.cl-cliente-end {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin-top: 3px;
}

/* ── Banner fila pendente ── */
.cl-sync-pending {
  max-width: 440px;
  width: 100%;
  margin: 0 auto 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: rgba(255,152,0,0.1);
  border: 1px solid rgba(255,152,0,0.3);
  border-radius: 14px;
  padding: 14px 16px;
}
.cl-sync-pending-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #ffb74d;
  flex: 1;
  min-width: 0;
}
.cl-sync-pending-title {
  font-size: 13px;
  font-weight: 700;
  color: #ffca28;
}
.cl-sync-pending-sub {
  font-size: 11px;
  color: rgba(255,183,77,0.7);
  margin-top: 2px;
}
.cl-sync-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255,152,0,0.4);
  background: rgba(255,152,0,0.15);
  color: #ffb74d;
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
  flex-shrink: 0;
}
.cl-sync-btn:hover:not(:disabled) { background: rgba(255,152,0,0.25); }
.cl-sync-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Footer ── */
.cl-footer {
  padding: 24px;
  text-align: center;
  font-size: 11px;
  color: rgba(255,255,255,0.15);
}
</style>
