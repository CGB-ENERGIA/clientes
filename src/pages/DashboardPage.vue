<template>
  <q-page class="dash-page">

    <!-- ── Filtros ────────────────────────────────────────────── -->
    <div class="filtros-dash">
      <q-select
        v-model="filtroMes"
        :options="mesesOptions"
        label="Mês"
        dense outlined
        emit-value map-options
        clearable
        style="min-width:190px"
        @update:model-value="fetchCampo"
      >
        <template #prepend><q-icon name="calendar_month" size="16px" /></template>
      </q-select>

      <q-input
        v-model="filtroDia"
        type="date"
        label="Dia"
        dense outlined
        clearable
        style="min-width:160px"
        @update:model-value="fetchCampo"
      >
        <template #prepend><q-icon name="today" size="16px" /></template>
      </q-input>

      <q-btn
        v-if="filtroMes || filtroDia"
        flat dense icon="filter_alt_off"
        color="grey-6" size="sm"
        @click="limparFiltros"
      >
        <q-tooltip>Limpar filtros</q-tooltip>
      </q-btn>

      <span v-if="filtroMes || filtroDia" class="filtro-label">
        <q-icon name="info_outline" size="13px" />
        Executado filtrado · Previsto = total geral
      </span>

      <q-spinner v-if="loadingCampo" size="18px" color="primary" class="q-ml-auto" />
    </div>

    <!-- ── KPI strip ──────────────────────────────────────────── -->
    <div class="kpi-strip">

      <!-- Postes -->
      <div class="kpi-tile">
        <div class="kpi-tile-top">
          <span class="kpi-tile-label" style="color:#10b981">Postes</span>
          <q-icon name="electrical_services" size="14px" style="color:#10b981;opacity:.7" />
        </div>
        <div class="kpi-row">
          <div>
            <div class="kpi-exec">{{ executado.postes }}</div>
            <div class="kpi-exec-lbl">executados</div>
          </div>
          <div class="kpi-sep">/</div>
          <div>
            <div class="kpi-prev">{{ totais.postes }}</div>
            <div class="kpi-prev-lbl">previstos</div>
          </div>
        </div>
        <div class="kpi-postes-breakdown">
          <span class="kpi-breakdown-item" style="color:#10b981">
            <q-icon name="photo_camera" size="10px" /> {{ executado.postesCampo }} campo
          </span>
          <span class="kpi-breakdown-sep">·</span>
          <span class="kpi-breakdown-item" style="color:#34d399">
            <q-icon name="task_alt" size="10px" /> {{ executado.postesPlanilha }} planilha
          </span>
        </div>
        <div class="kpi-progress-track">
          <div class="kpi-progress-fill" :style="{ width: pct(executado.postes, totais.postes) + '%', background: '#10b981' }" />
        </div>
        <div class="kpi-tile-bar" style="background:#10b981" />
      </div>

      <!-- Notas executadas -->
      <div class="kpi-tile">
        <div class="kpi-tile-top">
          <span class="kpi-tile-label" style="color:#3b82f6">Notas Executadas</span>
          <q-icon name="assignment" size="14px" style="color:#3b82f6;opacity:.7" />
        </div>
        <div class="kpi-row">
          <div>
            <div class="kpi-exec">{{ executado.notas }}</div>
            <div class="kpi-exec-lbl">executadas</div>
          </div>
          <div class="kpi-sep">/</div>
          <div>
            <div class="kpi-prev">{{ totais.total }}</div>
            <div class="kpi-prev-lbl">total</div>
          </div>
        </div>
        <div class="kpi-progress-track">
          <div class="kpi-progress-fill" :style="{ width: pct(executado.notas, totais.total) + '%', background: '#3b82f6' }" />
        </div>
        <div class="kpi-tile-bar" style="background:#3b82f6" />
      </div>

      <!-- Concluídas -->
      <div class="kpi-tile">
        <div class="kpi-tile-top">
          <span class="kpi-tile-label" :style="{ color: corConcluidas }">Concluídas</span>
          <q-icon name="check_circle" size="14px" :style="{ color: corConcluidas, opacity: .7 }" />
        </div>
        <div class="kpi-row">
          <div>
            <div class="kpi-exec">{{ totais.concluido }}</div>
            <div class="kpi-exec-lbl">concluídas</div>
          </div>
          <div class="kpi-sep">/</div>
          <div>
            <div class="kpi-prev">{{ totais.total }}</div>
            <div class="kpi-prev-lbl">total</div>
          </div>
        </div>
        <div class="kpi-progress-track">
          <div class="kpi-progress-fill" :style="{ width: totais.pct + '%', background: corConcluidas }" />
        </div>
        <div class="kpi-tile-bar" :style="{ background: corConcluidas }" />
      </div>

      <!-- Equipes ativas -->
      <div class="kpi-tile">
        <div class="kpi-tile-top">
          <span class="kpi-tile-label" style="color:#a855f7">Equipes Ativas</span>
          <q-icon name="groups" size="14px" style="color:#a855f7;opacity:.7" />
        </div>
        <div class="kpi-row">
          <div>
            <div class="kpi-exec">{{ executado.equipes }}</div>
            <div class="kpi-exec-lbl">{{ filtroMes || filtroDia ? 'no período' : 'total' }}</div>
          </div>
          <div class="kpi-sep" />
          <div>
            <div class="kpi-prev">{{ executado.postes }}</div>
            <div class="kpi-prev-lbl">registros</div>
          </div>
        </div>
        <div class="kpi-progress-track" />
        <div class="kpi-tile-bar" style="background:#a855f7" />
      </div>

    </div>

    <!-- ── Charts ─────────────────────────────────────────────── -->
    <div class="dash-grid">

      <!-- Status -->
      <div class="dash-card">
        <div class="dash-card-title">
          <q-icon name="donut_large" size="13px" />
          Distribuição por Status
        </div>
        <template v-if="notasStore.notas.length">
          <div class="stacked-bar">
            <div
              v-for="s in distStatus" :key="s.val"
              class="stacked-bar-seg"
              :style="{ width: s.pct + '%', background: s.cor }"
            ><q-tooltip>{{ s.label }}: {{ s.total }} ({{ s.pct }}%)</q-tooltip></div>
          </div>
          <div class="status-list">
            <div class="status-row" v-for="s in distStatus" :key="s.val">
              <span class="status-dot" :style="{ background: s.cor }" />
              <span class="status-lbl">{{ s.label }}</span>
              <span class="status-count" :style="{ color: s.cor }">{{ s.total }}</span>
              <span class="status-pct">{{ s.pct }}%</span>
            </div>
          </div>
        </template>
        <div v-else class="empty-state">
          <q-icon name="cloud_download" size="32px" class="text-grey-4" />
          <span>Nenhuma nota importada</span>
        </div>
      </div>

      <!-- Rankings -->
      <div class="dash-col">
        <div class="dash-card">
          <div class="dash-card-title">
            <q-icon name="location_on" size="13px" />
            Notas por Base
          </div>
          <div v-if="!rankBase.length" class="empty-sm">Sem dados</div>
          <div v-else class="rank-list">
            <div class="rank-row" v-for="(r, i) in rankBase" :key="i">
              <span class="rank-pos">{{ String(i+1).padStart(2,'0') }}</span>
              <span class="rank-name">{{ r.base }}</span>
              <div class="rank-track"><div class="rank-fill" :style="{ width: (r.pct*100)+'%' }" /></div>
              <span class="rank-val">{{ r.total }}</span>
            </div>
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-card-title">
            <q-icon name="folder_open" size="13px" />
            Por PEP
          </div>
          <div v-if="!rankPep.length" class="empty-sm">Sem dados</div>
          <div v-else class="rank-list">
            <div class="rank-row" v-for="(r, i) in rankPep" :key="i">
              <span class="rank-pos">{{ String(i+1).padStart(2,'0') }}</span>
              <span class="rank-name rank-name--mono">{{ r.pep }}</span>
              <div class="rank-track"><div class="rank-fill rank-fill--purple" :style="{ width: (r.pct*100)+'%' }" /></div>
              <span class="rank-val">{{ r.total }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useNotasStore } from 'stores/notas'
import { supabase, fetchAll } from 'boot/supabase'

const notasStore   = useNotasStore()
const campoRegs    = ref([])
const loadingCampo = ref(false)
const filtroMes    = ref('')
const filtroDia    = ref('')

// ── Opções de mês ──────────────────────────────────────────────
const mesesOptions = computed(() => {
  const opts = []
  const now  = new Date()
  for (let i = 0; i < 12; i++) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const label = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
    opts.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value })
  }
  return opts
})

// ── Fetch campo_registros com filtro de data ───────────────────
async function fetchCampo () {
  loadingCampo.value = true
  const buildQuery = () => {
    let q = supabase.from('campo_registros').select('id, nota, equipe, created_at').order('id')

    if (filtroDia.value) {
      q = q.gte('created_at', filtroDia.value + 'T00:00:00')
           .lte('created_at', filtroDia.value + 'T23:59:59')
    } else if (filtroMes.value) {
      const [year, month] = filtroMes.value.split('-')
      const next = month === '12'
        ? `${Number(year)+1}-01-01`
        : `${year}-${String(Number(month)+1).padStart(2,'0')}-01`
      q = q.gte('created_at', `${filtroMes.value}-01`).lt('created_at', next)
    }
    return q
  }

  const { data } = await fetchAll(buildQuery)
  campoRegs.value = data ?? []
  loadingCampo.value = false
}

function limparFiltros () {
  filtroMes.value = ''
  filtroDia.value = ''
  fetchCampo()
}

onMounted(async () => {
  await Promise.all([
    notasStore.notas.length ? null : notasStore.fetchNotas(),
    fetchCampo()
  ])
})

// ── Métricas executado ─────────────────────────────────────────
const executado = computed(() => {
  const notasConcluidasPlanilha = notasStore.notas.filter(n => n.status === 'concluido')
  const postesPlanilha = notasConcluidasPlanilha.reduce((s, n) => s + (Number(n.postes) || 0), 0)
  const notasPlanilhaSet = new Set(notasConcluidasPlanilha.map(n => n.nota))

  const postesCampo = campoRegs.value.length
  const notasCampoSet = new Set(campoRegs.value.map(r => r.nota).filter(Boolean))

  // União das notas (campo OU concluído planilha)
  const notasExecSet = new Set([...notasCampoSet, ...notasPlanilhaSet])

  return {
    postes:        postesCampo + postesPlanilha,
    postesCampo,
    postesPlanilha,
    notas:         notasExecSet.size,
    equipes:       new Set(campoRegs.value.map(r => r.equipe).filter(Boolean)).size,
  }
})

// ── Métricas previsto (notas_servico) ─────────────────────────
const totais = computed(() => {
  const ns = notasStore.notas
  const total     = ns.length
  const postes    = ns.reduce((s, n) => s + (Number(n.postes) || 0), 0)
  const clientes  = ns.reduce((s, n) => s + (Number(n.qtd_clientes) || 0), 0)
  const concluido = ns.filter(n => n.status === 'concluido').length
  const pct       = total > 0 ? Math.round((concluido / total) * 100) : 0
  return { total, postes, clientes, concluido, pct }
})

const corConcluidas = computed(() => {
  const p = totais.value.pct
  return p >= 80 ? '#16a34a' : p >= 40 ? '#f59e0b' : '#ef4444'
})

function pct (exec, prev) {
  if (!prev) return 0
  return Math.min(100, Math.round((exec / prev) * 100))
}

// ── Status distribution ────────────────────────────────────────
const STATUS_CONFIG = [
  { val: 'pendente',       label: 'Não Iniciado',   cor: '#64748b' },
  { val: 'em_andamento',   label: 'Em Andamento',   cor: '#ea580c' },
  { val: 'baixar_medidor', label: 'Auditar', cor: '#1d4ed8' },
  { val: 'concluido',      label: 'Concluído',      cor: '#16a34a' },
  { val: 'expurgo',        label: 'Expurgo',        cor: '#dc2626' },
  { val: 'sem_acesso',     label: 'Sem Acesso',     cor: '#7c3aed' },
]

const distStatus = computed(() => {
  const ns    = notasStore.notas
  const total = ns.length || 1
  return STATUS_CONFIG
    .map(s => ({ ...s, total: ns.filter(n => n.status === s.val).length }))
    .filter(s => s.total > 0)
    .map(s => ({ ...s, pct: Math.round((s.total / total) * 100) }))
})

const rankBase = computed(() => {
  const mapa = {}
  for (const n of notasStore.notas) if (n.base) mapa[n.base] = (mapa[n.base]||0)+1
  const lista = Object.entries(mapa).map(([base,total]) => ({base,total})).sort((a,b)=>b.total-a.total).slice(0,7)
  const max = lista[0]?.total || 1
  return lista.map(r => ({...r, pct: r.total/max}))
})

const rankPep = computed(() => {
  const mapa = {}
  for (const n of notasStore.notas) if (n.pep) mapa[n.pep] = (mapa[n.pep]||0)+1
  const lista = Object.entries(mapa).map(([pep,total]) => ({pep,total})).sort((a,b)=>b.total-a.total).slice(0,7)
  const max = lista[0]?.total || 1
  return lista.map(r => ({...r, pct: r.total/max}))
})
</script>

<style scoped>
.dash-page { background:#f1f5f9; padding:16px; min-height:100%; }

/* ── Filtros ── */
.filtros-dash {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.filtro-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #94a3b8;
  font-style: italic;
}

/* ── KPI Strip ── */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
@media (max-width:860px) { .kpi-strip { grid-template-columns: repeat(2,1fr); } }
@media (max-width:480px) { .kpi-strip { grid-template-columns: 1fr; } }

.kpi-tile {
  background: #0a1628;
  border-radius: 14px;
  padding: 16px 18px 14px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.06);
}

.kpi-tile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.kpi-tile-label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* Previsto vs executado */
.kpi-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}
.kpi-exec {
  font-size: 40px;
  font-weight: 900;
  line-height: 1;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1px;
}
.kpi-exec-lbl {
  font-size: 9px;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.06em;
  margin-top: 3px;
  text-transform: uppercase;
}
.kpi-sep {
  font-size: 20px;
  color: rgba(255,255,255,0.15);
  padding-bottom: 12px;
  flex-shrink: 0;
}
.kpi-prev {
  font-size: 20px;
  font-weight: 700;
  color: rgba(255,255,255,0.35);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.kpi-prev-lbl {
  font-size: 9px;
  color: rgba(255,255,255,0.2);
  letter-spacing: 0.06em;
  margin-top: 3px;
  text-transform: uppercase;
}

/* breakdown campo vs planilha */
.kpi-postes-breakdown {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.kpi-breakdown-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.kpi-breakdown-sep {
  color: rgba(255,255,255,0.15);
  font-size: 10px;
}

/* mini progress inside tile */
.kpi-progress-track {
  height: 3px;
  background: rgba(255,255,255,0.08);
  border-radius: 99px;
  margin-top: 12px;
  overflow: hidden;
}
.kpi-progress-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.6s ease;
}

.kpi-tile-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3px;
  opacity: 0.7;
}

/* ── Charts grid ── */
.dash-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 12px;
  align-items: start;
}
@media (max-width:860px) { .dash-grid { grid-template-columns: 1fr; } }

.dash-col { display:flex; flex-direction:column; gap:12px; }

.dash-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 16px 18px;
}
.dash-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #94a3b8;
  margin-bottom: 14px;
}

/* Stacked bar */
.stacked-bar {
  display:flex; height:10px; border-radius:99px;
  overflow:hidden; gap:2px; margin-bottom:14px;
}
.stacked-bar-seg { height:100%; border-radius:99px; flex-shrink:0; cursor:default; }
.stacked-bar-seg:hover { opacity:.8; }

/* Status list */
.status-list { display:flex; flex-direction:column; gap:9px; }
.status-row  { display:flex; align-items:center; gap:8px; }
.status-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.status-lbl  { flex:1; font-size:12px; font-weight:600; color:#334155; }
.status-count{ font-size:13px; font-weight:800; font-variant-numeric:tabular-nums; min-width:30px; text-align:right; }
.status-pct  { font-size:10px; color:#94a3b8; min-width:28px; text-align:right; }

/* Rank list */
.rank-list { display:flex; flex-direction:column; gap:7px; }
.rank-row  { display:grid; grid-template-columns:20px 1fr 70px 26px; align-items:center; gap:8px; }
.rank-pos  { font-size:10px; font-weight:700; color:#cbd5e1; font-variant-numeric:tabular-nums; }
.rank-name { font-size:12px; font-weight:600; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rank-name--mono { font-size:11px; font-family:'Courier New',monospace; color:#475569; }
.rank-track { height:4px; background:#f1f5f9; border-radius:99px; overflow:hidden; }
.rank-fill  { height:100%; background:#3b82f6; border-radius:99px; transition:width .5s ease; }
.rank-fill--purple { background:#7c3aed; }
.rank-val   { font-size:11px; font-weight:700; color:#64748b; text-align:right; font-variant-numeric:tabular-nums; }

/* Empty */
.empty-state { display:flex; flex-direction:column; align-items:center; padding:24px 0; gap:8px; color:#94a3b8; font-size:12px; }
.empty-sm    { text-align:center; padding:16px; font-size:12px; color:#94a3b8; }
</style>
