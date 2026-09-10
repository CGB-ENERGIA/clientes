<template>
  <q-page class="dash-page">

    <!-- ── KPI strip ──────────────────────────────────────────── -->
    <div class="kpi-strip">
      <div class="kpi-tile" v-for="kpi in kpis" :key="kpi.label">
        <div class="kpi-tile-top">
          <span class="kpi-tile-label" :style="{ color: kpi.cor }">{{ kpi.label }}</span>
          <q-icon :name="kpi.icon" size="14px" :style="{ color: kpi.cor, opacity: 0.7 }" />
        </div>
        <div class="kpi-tile-value">{{ kpi.value }}</div>
        <div v-if="kpi.sub" class="kpi-tile-sub">{{ kpi.sub }}</div>
        <div class="kpi-tile-bar" :style="{ background: kpi.cor }" />
      </div>
    </div>

    <!-- ── Charts ─────────────────────────────────────────────── -->
    <div class="dash-grid">

      <!-- Status geral -->
      <div class="dash-card">
        <div class="dash-card-title">
          <q-icon name="donut_large" size="13px" />
          Distribuição por Status
        </div>

        <template v-if="notasStore.notas.length">
          <!-- Barra empilhada -->
          <div class="stacked-bar">
            <div
              v-for="s in distStatus"
              :key="s.val"
              class="stacked-bar-seg"
              :style="{ width: s.pct + '%', background: s.cor }"
            >
              <q-tooltip>{{ s.label }}: {{ s.total }} ({{ s.pct }}%)</q-tooltip>
            </div>
          </div>

          <!-- Legenda -->
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

        <!-- Por Base -->
        <div class="dash-card">
          <div class="dash-card-title">
            <q-icon name="location_on" size="13px" />
            Notas por Base
          </div>
          <div v-if="!rankBase.length" class="empty-sm">Sem dados</div>
          <div v-else class="rank-list">
            <div class="rank-row" v-for="(r, i) in rankBase" :key="i">
              <span class="rank-pos">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="rank-name">{{ r.base }}</span>
              <div class="rank-track">
                <div class="rank-fill" :style="{ width: (r.pct * 100) + '%' }" />
              </div>
              <span class="rank-val">{{ r.total }}</span>
            </div>
          </div>
        </div>

        <!-- Por PEP -->
        <div class="dash-card">
          <div class="dash-card-title">
            <q-icon name="folder_open" size="13px" />
            Por PEP
          </div>
          <div v-if="!rankPep.length" class="empty-sm">Sem dados</div>
          <div v-else class="rank-list">
            <div class="rank-row" v-for="(r, i) in rankPep" :key="i">
              <span class="rank-pos">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="rank-name rank-name--mono">{{ r.pep }}</span>
              <div class="rank-track">
                <div class="rank-fill rank-fill--purple" :style="{ width: (r.pct * 100) + '%' }" />
              </div>
              <span class="rank-val">{{ r.total }}</span>
            </div>
          </div>
        </div>

      </div>
    </div>

  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useNotasStore } from 'stores/notas'

const notasStore = useNotasStore()

onMounted(async () => {
  if (!notasStore.notas.length) await notasStore.fetchNotas()
})

const STATUS_CONFIG = [
  { val: 'pendente',       label: 'Não Iniciado',   cor: '#64748b' },
  { val: 'em_andamento',   label: 'Em Andamento',   cor: '#ea580c' },
  { val: 'baixar_medidor', label: 'Baixar Medidor', cor: '#1d4ed8' },
  { val: 'concluido',      label: 'Concluído',      cor: '#16a34a' },
  { val: 'expurgo',        label: 'Expurgo',        cor: '#dc2626' },
  { val: 'sem_acesso',     label: 'Sem Acesso',     cor: '#7c3aed' },
]

const totais = computed(() => {
  const notas    = notasStore.notas
  const total    = notas.length
  const postes   = notas.reduce((s, n) => s + (Number(n.postes) || 0), 0)
  const clientes = notas.reduce((s, n) => s + (Number(n.qtd_clientes) || 0), 0)
  const concluido = notas.filter(n => n.status === 'concluido').length
  const pct = total > 0 ? Math.round((concluido / total) * 100) : 0
  return { total, postes, clientes, concluido, pct }
})

const kpis = computed(() => {
  const { total, postes, clientes, concluido, pct } = totais.value
  return [
    { label: 'Total de Notas',    value: total,     icon: 'assignment',          cor: '#3b82f6' },
    { label: 'Postes Previstos',  value: postes,    icon: 'electrical_services', cor: '#10b981' },
    { label: 'Clientes Previstos',value: clientes,  icon: 'people',              cor: '#a855f7' },
    { label: 'Concluídas',        value: concluido, icon: 'check_circle',        cor: pct >= 80 ? '#16a34a' : pct >= 40 ? '#f59e0b' : '#ef4444', sub: pct + '% do total' },
  ]
})

const distStatus = computed(() => {
  const notas = notasStore.notas
  const total = notas.length || 1
  return STATUS_CONFIG
    .map(s => ({ ...s, total: notas.filter(n => n.status === s.val).length }))
    .filter(s => s.total > 0)
    .map(s => ({ ...s, pct: Math.round((s.total / total) * 100) }))
})

const rankBase = computed(() => {
  const mapa = {}
  for (const n of notasStore.notas) if (n.base) mapa[n.base] = (mapa[n.base] || 0) + 1
  const lista = Object.entries(mapa).map(([base, total]) => ({ base, total })).sort((a, b) => b.total - a.total).slice(0, 7)
  const max = lista[0]?.total || 1
  return lista.map(r => ({ ...r, pct: r.total / max }))
})

const rankPep = computed(() => {
  const mapa = {}
  for (const n of notasStore.notas) if (n.pep) mapa[n.pep] = (mapa[n.pep] || 0) + 1
  const lista = Object.entries(mapa).map(([pep, total]) => ({ pep, total })).sort((a, b) => b.total - a.total).slice(0, 7)
  const max = lista[0]?.total || 1
  return lista.map(r => ({ ...r, pct: r.total / max }))
})
</script>

<style scoped>
/* ── Page ── */
.dash-page {
  background: #f1f5f9;
  padding: 20px;
  min-height: 100%;
}

/* ── KPI Strip ── */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
@media (max-width: 700px) { .kpi-strip { grid-template-columns: repeat(2, 1fr); } }

.kpi-tile {
  background: #0a1628;
  border-radius: 14px;
  padding: 20px 20px 16px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.06);
}
.kpi-tile::after {
  content: '';
  position: absolute;
  top: -28px; right: -18px;
  width: 80px; height: 80px;
  border-radius: 50%;
  background: rgba(255,255,255,0.025);
}

.kpi-tile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.kpi-tile-label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.kpi-tile-value {
  font-size: 44px;
  font-weight: 900;
  line-height: 1;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1px;
}
.kpi-tile-sub {
  font-size: 10px;
  color: rgba(255,255,255,0.28);
  margin-top: 6px;
  letter-spacing: 0.04em;
}
.kpi-tile-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3px;
  opacity: 0.8;
}

/* ── Charts grid ── */
.dash-grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 12px;
  align-items: start;
}
@media (max-width: 860px) { .dash-grid { grid-template-columns: 1fr; } }

.dash-col { display: flex; flex-direction: column; gap: 12px; }

.dash-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 20px;
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
  margin-bottom: 16px;
}

/* ── Stacked bar ── */
.stacked-bar {
  display: flex;
  height: 10px;
  border-radius: 99px;
  overflow: hidden;
  gap: 2px;
  margin-bottom: 16px;
}
.stacked-bar-seg {
  height: 100%;
  border-radius: 99px;
  flex-shrink: 0;
  cursor: default;
  transition: opacity 0.15s;
}
.stacked-bar-seg:hover { opacity: 0.8; }

/* ── Status list ── */
.status-list { display: flex; flex-direction: column; gap: 10px; }
.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-lbl {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}
.status-count {
  font-size: 13px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  min-width: 32px;
  text-align: right;
}
.status-pct {
  font-size: 10px;
  color: #94a3b8;
  min-width: 30px;
  text-align: right;
}

/* ── Rank list ── */
.rank-list { display: flex; flex-direction: column; gap: 8px; }
.rank-row {
  display: grid;
  grid-template-columns: 20px 1fr 80px 28px;
  align-items: center;
  gap: 8px;
}
.rank-pos {
  font-size: 10px;
  font-weight: 700;
  color: #cbd5e1;
  font-variant-numeric: tabular-nums;
}
.rank-name {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rank-name--mono {
  font-size: 11px;
  font-family: 'Courier New', monospace;
  color: #475569;
}
.rank-track {
  height: 4px;
  background: #f1f5f9;
  border-radius: 99px;
  overflow: hidden;
}
.rank-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 99px;
  transition: width 0.5s ease;
}
.rank-fill--purple { background: #7c3aed; }
.rank-val {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* ── Empty ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 0;
  gap: 8px;
  color: #94a3b8;
  font-size: 12px;
}
.empty-sm {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: #94a3b8;
}
</style>
