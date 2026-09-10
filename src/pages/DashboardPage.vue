<template>
  <q-page>
    <!-- KPIs -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-6 col-sm-3" v-for="kpi in kpis" :key="kpi.label">
        <div class="kpi-card" :style="kpi.grad">
          <div class="kpi-icon-wrap"><q-icon :name="kpi.icon" size="20px" /></div>
          <div class="kpi-value">{{ kpi.value }}</div>
          <div class="kpi-label">{{ kpi.label }}</div>
          <div v-if="kpi.sub" class="kpi-sub">{{ kpi.sub }}</div>
        </div>
      </div>
    </div>

    <div class="row q-col-gutter-sm">

      <!-- Distribuição por status -->
      <div class="col-12 col-md-5">
        <div class="card-modern q-pa-md h-card">
          <div class="section-title">
            <q-icon name="donut_large" size="15px" />
            Distribuição por Status
          </div>
          <div v-if="!notasStore.notas.length" class="empty-state">
            <q-icon name="cloud_download" size="36px" class="text-grey-4" />
            <div class="empty-txt">Nenhuma nota importada ainda</div>
          </div>
          <div v-else class="q-gutter-xs q-mt-sm">
            <div v-for="s in distStatus" :key="s.val">
              <div class="row items-center q-mb-xs no-wrap">
                <span class="status-dot" :style="{ background: s.cor }" />
                <span class="padrao-lbl">{{ s.label }}</span>
                <q-space />
                <span class="stat-txt">{{ s.total }} · {{ s.pct }}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: s.pct + '%', background: s.cor }" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Bases -->
      <div class="col-12 col-md-7">
        <div class="column q-gutter-sm">

          <div class="card-modern q-pa-md">
            <div class="section-title"><q-icon name="location_on" size="15px" />Notas por Base</div>
            <div v-if="!rankBase.length" class="empty-txt-sm">Sem dados ainda</div>
            <div v-else class="q-gutter-xs">
              <div v-for="(r, i) in rankBase" :key="i">
                <div class="row items-center q-mb-xs no-wrap">
                  <span class="pep-txt col ellipsis">{{ r.base }}</span>
                  <span class="stat-txt q-ml-sm">{{ r.total }} nota{{ r.total !== 1 ? 's' : '' }}</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" :style="{ width: (r.pct * 100) + '%', background: 'var(--accent)' }" />
                </div>
              </div>
            </div>
          </div>

          <div class="card-modern q-pa-md">
            <div class="section-title"><q-icon name="folder_open" size="15px" />Apontamentos por PEP</div>
            <div v-if="!rankPep.length" class="empty-txt-sm">Sem dados ainda</div>
            <div v-else class="q-gutter-xs">
              <div v-for="(r, i) in rankPep" :key="i">
                <div class="row items-center q-mb-xs no-wrap">
                  <span class="pep-txt col ellipsis">{{ r.pep }}</span>
                  <span class="stat-txt q-ml-sm">{{ r.total }}</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" :style="{ width: (r.pct * 100) + '%', background: '#7b1fa2' }" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useNotasStore } from 'stores/notas'
import { supabase } from 'boot/supabase'

const notasStore      = useNotasStore()
const totalCampo      = ref(0)

onMounted(async () => {
  if (!notasStore.notas.length) await notasStore.fetchNotas()
  // Conta registros de campo
  const { count } = await supabase
    .from('campo_registros')
    .select('*', { count: 'exact', head: true })
  totalCampo.value = count ?? 0
})

const STATUS_CONFIG = [
  { val: 'pendente',       label: 'Não Iniciado',   cor: '#9e9e9e' },
  { val: 'em_andamento',   label: 'Em Andamento',   cor: '#e65100' },
  { val: 'baixar_medidor', label: 'Baixar Medidor', cor: '#1565c0' },
  { val: 'concluido',      label: 'Concluído',      cor: '#2e7d32' },
  { val: 'expurgo',        label: 'Expurgo',        cor: '#b71c1c' },
  { val: 'sem_acesso',     label: 'Sem Acesso',     cor: '#6a1b9a' },
]

const totais = computed(() => {
  const notas   = notasStore.notas
  const total   = notas.length
  const postes  = notas.reduce((s, n) => s + (Number(n.postes) || 0), 0)
  const clientes = notas.reduce((s, n) => s + (Number(n.qtd_clientes) || 0), 0)
  const concluido = notas.filter(n => n.status === 'concluido').length
  return { total, postes, clientes, concluido }
})

const kpis = computed(() => {
  const { total, postes, clientes, concluido } = totais.value
  const pctConcluido = total > 0 ? Math.round((concluido / total) * 100) : 0
  const gradConc = pctConcluido >= 80 ? 'linear-gradient(135deg,#2e7d32,#43a047)'
    : pctConcluido >= 40 ? 'linear-gradient(135deg,#e65100,#f57c00)'
    : 'linear-gradient(135deg,#b71c1c,#c62828)'
  return [
    { label: 'Total de Notas',       value: total,           icon: 'assignment',          grad: 'background:linear-gradient(135deg,#1565c0,#1976d2)' },
    { label: 'Postes Previstos',      value: postes,          icon: 'electrical_services', grad: 'background:linear-gradient(135deg,#00695c,#00897b)' },
    { label: 'Clientes Previstos',    value: clientes,        icon: 'people',              grad: 'background:linear-gradient(135deg,#6a1b9a,#8e24aa)' },
    { label: 'Concluídas',            value: concluido,       icon: 'check_circle',        grad: 'background:' + gradConc, sub: pctConcluido + '% do total' },
  ]
})

const distStatus = computed(() => {
  const notas = notasStore.notas
  const total = notas.length || 1
  return STATUS_CONFIG.map(s => {
    const count = notas.filter(n => n.status === s.val).length
    return { ...s, total: count, pct: Math.round((count / total) * 100) }
  }).filter(s => s.total > 0)
})

const rankBase = computed(() => {
  const mapa = {}
  for (const n of notasStore.notas) {
    if (n.base) mapa[n.base] = (mapa[n.base] || 0) + 1
  }
  const lista = Object.entries(mapa)
    .map(([base, total]) => ({ base, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
  const max = lista[0]?.total || 1
  return lista.map(r => ({ ...r, pct: r.total / max }))
})

const rankPep = computed(() => {
  const mapa = {}
  for (const n of notasStore.notas) {
    if (n.pep) mapa[n.pep] = (mapa[n.pep] || 0) + 1
  }
  const lista = Object.entries(mapa)
    .map(([pep, total]) => ({ pep, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
  const max = lista[0]?.total || 1
  return lista.map(r => ({ ...r, pct: r.total / max }))
})
</script>

<style scoped>
/* KPI */
.kpi-card {
  border-radius: 12px; padding: 14px 16px;
  color: #fff; position: relative; overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
}
.kpi-card::before {
  content:''; position:absolute; top:-20px; right:-20px;
  width:64px; height:64px; border-radius:50%; background:rgba(255,255,255,0.09);
}
.kpi-icon-wrap {
  width:32px; height:32px; border-radius:8px;
  background:rgba(255,255,255,0.15);
  display:flex; align-items:center; justify-content:center; margin-bottom:10px;
}
.kpi-value { font-size:26px; font-weight:800; line-height:1; }
.kpi-label { font-size:11px; opacity:0.8; margin-top:4px; }
.kpi-sub   { font-size:10px; opacity:0.6; margin-top:2px; }

/* Cards */
.card-modern { background:var(--bg-card); border:1px solid var(--border); border-radius:12px; box-shadow:var(--shadow-sm); }
.h-card { height:100%; }

/* Status dist */
.status-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; margin-right:8px; }
.padrao-lbl { font-size:12px; font-weight:600; color:var(--text-primary); }

/* Progress */
.progress-track { height:5px; border-radius:99px; background:var(--border); overflow:hidden; }
.progress-fill  { height:100%; border-radius:99px; transition:width 0.5s ease; }

/* Texts */
.stat-txt     { font-size:11px; color:var(--text-muted); white-space:nowrap; }
.pep-txt      { font-size:12px; font-weight:500; color:var(--text-primary); }
.empty-txt    { font-size:12px; color:var(--text-muted); margin-top:8px; }
.empty-txt-sm { text-align:center; padding:16px; font-size:12px; color:var(--text-muted); }
.empty-state  { display:flex; flex-direction:column; align-items:center; padding:32px 0; }

/* Section title */
.section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--text-muted);
  margin-bottom: 12px;
}
</style>
