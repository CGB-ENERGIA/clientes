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

      <!-- Não atendidos -->
      <div class="col-12 col-md-5">
        <div class="card-modern q-pa-md h-card">
          <div class="section-title">
            <q-icon name="person_off" size="15px" />
            Clientes não atendidos
          </div>

          <div v-if="naoAtendidos.length === 0" class="empty-state">
            <q-icon name="check_circle" size="36px" class="text-positive" />
            <div class="empty-txt">Todos os clientes foram atendidos</div>
          </div>

          <q-scroll-area v-else class="scroll-area-card">
            <div v-for="(n, i) in naoAtendidos" :key="i" class="nao-item">
              <div class="nao-avatar"><q-icon name="person_off" size="14px" /></div>
              <div>
                <div class="nao-nome">{{ n.cliente }}</div>
                <div class="nao-motivo">{{ n.motivo }}</div>
                <div class="nao-ref">{{ n.pep }} · {{ n.nota }} · {{ n.data }}</div>
              </div>
            </div>
          </q-scroll-area>
        </div>
      </div>

      <!-- Gráficos -->
      <div class="col-12 col-md-7">
        <div class="column q-gutter-sm">

          <div class="card-modern q-pa-md">
            <div class="section-title"><q-icon name="bar_chart" size="15px" />Distribuição por Padrão</div>
            <div v-if="!dados.totalClientes" class="empty-txt-sm">Sem dados ainda</div>
            <div v-else class="q-gutter-xs">
              <div v-for="p in distPadrao" :key="p.label">
                <div class="row items-center q-mb-xs no-wrap">
                  <div class="padrao-chip" :style="chipStyle(p.label)">{{ p.label }}</div>
                  <q-space />
                  <span class="stat-txt">{{ p.total }} · {{ p.pct }}%</span>
                </div>
                <div class="progress-track"><div class="progress-fill" :style="{ width: p.pct + '%', background: corHex(p.label) }" /></div>
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
                <div class="progress-track"><div class="progress-fill" :style="{ width: (r.pct * 100) + '%', background: 'var(--accent)' }" /></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, computed, onMounted } from 'vue'
import { useApontamentoStore } from 'stores/apontamento'

export default defineComponent({
  name: 'DashboardPage',
  setup: function () {
    var store = useApontamentoStore()
    onMounted(function () { if (!store.apontamentos.length) store.fetchApontamentos() })

    var dados = computed(function () {
      var lista = store.apontamentos
      var totalClientes = lista.reduce(function (s, a) { return s + (a.clientes || []).length }, 0)
      var totalPrevisto = lista.reduce(function (s, a) { return s + (a.qtd_clientes_nota > 0 ? a.qtd_clientes_nota : (a.clientes || []).length) }, 0)
      var naoCount = 0
      lista.forEach(function (a) { if (a.todos_atendidos === false && Array.isArray(a.nao_atendidos)) naoCount += a.nao_atendidos.length })
      var atendidos = Math.max(0, totalPrevisto - naoCount)
      var aderencia = totalPrevisto > 0 ? Math.max(0, Math.round((atendidos / totalPrevisto) * 100)) : 0
      return {
        apontamentos: lista.length,
        postes: lista.reduce(function (s, a) { return s + (a.postes || 0) }, 0),
        totalClientes: totalClientes, totalPrevisto: totalPrevisto, atendidos: atendidos, aderencia: aderencia
      }
    })

    var kpis = computed(function () {
      var d = dados.value
      var gradAde = d.aderencia >= 90 ? 'linear-gradient(135deg,#2e7d32,#43a047)' : d.aderencia >= 60 ? 'linear-gradient(135deg,#e65100,#f57c00)' : 'linear-gradient(135deg,#b71c1c,#c62828)'
      return [
        { label: 'Apontamentos', value: d.apontamentos, icon: 'assignment', grad: 'background:linear-gradient(135deg,#1565c0,#1976d2)' },
        { label: 'Total de Postes', value: d.postes, icon: 'electrical_services', grad: 'background:linear-gradient(135deg,#00695c,#00897b)' },
        { label: 'Total de Clientes', value: d.totalClientes, icon: 'people', grad: 'background:linear-gradient(135deg,#6a1b9a,#8e24aa)' },
        { label: 'Nível de Aderência', value: d.aderencia + '%', icon: 'track_changes', grad: 'background:' + gradAde, sub: d.atendidos + '/' + d.totalPrevisto + ' previstos' }
      ]
    })

    var distPadrao = computed(function () {
      var total = dados.value.totalClientes || 1
      var mapa = { PP: 0, '5 M': 0, '7 M': 0 }
      store.apontamentos.forEach(function (a) { (a.clientes || []).forEach(function (c) { if (c.padrao in mapa) mapa[c.padrao]++ }) })
      return Object.entries(mapa).map(function (e) { return { label: e[0], total: e[1], pct: Math.round((e[1] / total) * 100) } })
    })

    var rankPep = computed(function () {
      var mapa = {}
      store.apontamentos.forEach(function (a) { mapa[a.pep] = (mapa[a.pep] || 0) + 1 })
      var lista = Object.entries(mapa).map(function (e) { return { pep: e[0], total: e[1] } })
      lista.sort(function (a, b) { return b.total - a.total })
      lista = lista.slice(0, 8)
      var max = lista.length ? lista[0].total : 1
      return lista.map(function (r) { return { pep: r.pep, total: r.total, pct: r.total / max } })
    })

    var naoAtendidos = computed(function () {
      var rows = []
      store.apontamentos.forEach(function (a) {
        if (a.todos_atendidos === false && Array.isArray(a.nao_atendidos)) {
          a.nao_atendidos.forEach(function (n) {
            rows.push({ data: new Date(a.created_at).toLocaleDateString('pt-BR'), pep: a.pep, nota: a.nota, cliente: n.cliente, motivo: n.motivo })
          })
        }
      })
      return rows
    })

    function corHex (p) {
      return p === 'PP' ? '#e64a19' : p === '5 M' ? '#1565c0' : p === '7 M' ? '#7b1fa2' : '#546e7a'
    }
    function chipStyle (p) {
      var c = corHex(p)
      return { background: c + '20', color: c, fontWeight: 700, fontSize: '11px', padding: '2px 10px', borderRadius: '99px' }
    }

    return { dados, kpis, distPadrao, rankPep, naoAtendidos, corHex, chipStyle }
  }
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

/* Não atendidos */
.scroll-area-card { height: 280px; }
.nao-item { display:flex; gap:10px; padding:10px 0; border-bottom:1px solid var(--border); }
.nao-item:last-child { border-bottom:none; }
.nao-avatar { width:28px; height:28px; border-radius:50%; background:rgba(198,40,40,0.1); color:#c62828; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; }
.nao-nome   { font-size:13px; font-weight:600; color:var(--text-primary); }
.nao-motivo { font-size:11px; color:#c62828; margin-top:2px; }
.nao-ref    { font-size:10px; color:var(--text-muted); margin-top:2px; }

/* Progress */
.progress-track { height:5px; border-radius:99px; background:var(--border); overflow:hidden; }
.progress-fill  { height:100%; border-radius:99px; transition:width 0.5s ease; }

/* Texts */
.stat-txt     { font-size:11px; color:var(--text-muted); white-space:nowrap; }
.pep-txt      { font-size:12px; font-weight:500; color:var(--text-primary); }
.empty-txt    { font-size:12px; color:var(--text-muted); margin-top:8px; }
.empty-txt-sm { text-align:center; padding:16px; font-size:12px; color:var(--text-muted); }
.empty-state  { display:flex; flex-direction:column; align-items:center; padding:32px 0; }
</style>
