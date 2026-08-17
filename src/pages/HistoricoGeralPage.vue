<template>
  <q-page>

    <!-- KPIs compactos -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-6 col-sm-3">
        <div class="mini-kpi bg-blue-9">
          <q-icon name="assignment" size="18px" /><span>{{ listagem.length }}</span>
          <div class="mini-kpi-label">Registros</div>
        </div>
      </div>
      <div class="col-6 col-sm-3">
        <div class="mini-kpi bg-teal-7">
          <q-icon name="electrical_services" size="18px" /><span>{{ totais.postes }}</span>
          <div class="mini-kpi-label">Postes</div>
        </div>
      </div>
      <div class="col-6 col-sm-3">
        <div class="mini-kpi bg-purple-7">
          <q-icon name="people" size="18px" /><span>{{ totais.clientes }}</span>
          <div class="mini-kpi-label">Clientes</div>
        </div>
      </div>
      <div class="col-6 col-sm-3">
        <div class="mini-kpi" :class="corAdeClass(totais.aderencia)">
          <q-icon name="track_changes" size="18px" /><span>{{ totais.aderencia }}%</span>
          <div class="mini-kpi-label">Aderência</div>
        </div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card-modern q-pa-sm q-mb-md">
      <div class="row q-col-gutter-sm items-end">
        <div class="col-12 col-sm-6 col-md-2">
          <q-select v-model="filtros.base" :options="['', ...bases]" label="Base" outlined dense clearable emit-value map-options>
            <template #prepend><q-icon name="location_on" size="16px" /></template>
          </q-select>
        </div>
        <div class="col-12 col-sm-6 col-md-2">
          <q-input v-model="filtros.pep" label="PEP" outlined dense clearable debounce="300">
            <template #prepend><q-icon name="search" size="16px" /></template>
          </q-input>
        </div>
        <div class="col-12 col-sm-6 col-md-2">
          <q-input v-model="filtros.nota" label="NOTA" outlined dense clearable debounce="300">
            <template #prepend><q-icon name="search" size="16px" /></template>
          </q-input>
        </div>
        <div class="col-6 col-sm-3 col-md-2">
          <q-input v-model="filtros.dataInicio" label="De" type="date" outlined dense clearable />
        </div>
        <div class="col-6 col-sm-3 col-md-2">
          <q-input v-model="filtros.dataFim" label="Até" type="date" outlined dense clearable />
        </div>
        <div class="col-12 col-sm-6 col-md-2 row items-center justify-end q-gutter-sm">
          <q-btn flat dense no-caps icon="clear_all" color="grey-6" label="Limpar" size="sm" @click="limparFiltros" />
          <q-btn flat dense no-caps icon="download" color="positive" label="Excel" size="sm" @click="exportarExcel" />
        </div>
      </div>
    </div>

    <!-- Tabela -->
    <div class="card-modern overflow-hidden">
      <q-table
        :rows="listagem"
        :columns="columns"
        row-key="id"
        :loading="store.loading"
        flat dense
        :pagination="{ rowsPerPage: 50 }"
        no-data-label="Nenhum apontamento encontrado"
        class="modern-table"
      >
        <template #body-cell-base="props">
          <q-td :props="props">
            <q-badge color="blue-8" :label="props.row.base || '—'" />
          </q-td>
        </template>

        <template #body-cell-pg="props">
          <q-td :props="props">
            <div v-for="(pg, i) in (props.row.pg_numeros || [])" :key="i" style="font-family:monospace;font-size:11px">{{ pg }}</div>
            <span v-if="!props.row.pg_numeros?.length" style="color:var(--text-muted)">—</span>
          </q-td>
        </template>

        <template #body-cell-clientes="props">
          <q-td :props="props">
            <div v-for="c in (props.row.clientes || [])" :key="c.id" class="cliente-row">
              <span style="font-weight:500">{{ c.nome }}</span>
              <q-badge v-if="c.padrao" outline :color="corPadraoQ(c.padrao)" :label="c.padrao" class="q-ml-xs" />
            </div>
            <span v-if="!props.row.clientes?.length" style="color:var(--text-muted)">—</span>
          </q-td>
        </template>

        <template #body-cell-aderencia="props">
          <q-td :props="props" class="text-center">
            <q-badge :color="corAdeQ(calcAde(props.row))">{{ calcAde(props.row) }}%</q-badge>
          </q-td>
        </template>

        <template #body-cell-acoes="props">
          <q-td :props="props" class="text-center">
            <q-btn icon="edit" flat round dense size="sm" color="primary" @click="abrirEdicao(props.row)">
              <q-tooltip>Editar</q-tooltip>
            </q-btn>
            <q-btn icon="delete" flat round dense size="sm" color="negative" @click="confirmarExclusao(props.row)">
              <q-tooltip>Excluir</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </div>

  </q-page>

  <!-- Edit Dialog -->
  <q-dialog v-model="editDialog" persistent>
    <q-card style="min-width:min(680px,95vw);background:var(--bg-card);color:var(--text-primary)">
      <q-card-section class="row items-center" style="border-bottom:1px solid var(--border)">
        <div class="text-subtitle1 text-weight-bold">Editar Apontamento</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>
      <q-card-section class="q-gutter-sm">
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-4">
            <q-select v-model="editForm.base" :options="bases" label="BASE" outlined dense emit-value map-options />
          </div>
          <div class="col-12 col-sm-4">
            <q-input v-model="editForm.pep" label="PEP" outlined dense />
          </div>
          <div class="col-12 col-sm-4">
            <q-input v-model="editForm.nota" label="NOTA" outlined dense />
          </div>
          <div class="col-6 col-sm-6">
            <q-input v-model.number="editForm.postes" label="POSTES" type="number" outlined dense min="0" @update:model-value="ajustarPg" />
          </div>
          <div class="col-6 col-sm-6">
            <q-input v-model.number="editForm.qtd_clientes_nota" label="QTD CLIENTES NOTA" type="number" outlined dense min="0" />
          </div>
        </div>
        <div v-if="editForm.postes > 0">
          <div class="text-caption text-weight-bold q-mb-xs" style="color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em">PG</div>
          <div class="row q-col-gutter-sm">
            <div v-for="i in editForm.postes" :key="i" class="col-6 col-sm-4 col-md-3">
              <q-input v-model="editForm.pg_numeros[i - 1]" :label="`PG ${i}`" outlined dense />
            </div>
          </div>
        </div>
        <q-separator />
        <div class="text-caption text-weight-bold q-mb-xs" style="color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em">Clientes</div>
        <ClientesForm v-model="editForm.clientes" />
      </q-card-section>
      <q-card-actions align="right" class="q-px-md q-pb-md" style="border-top:1px solid var(--border)">
        <q-btn label="Cancelar" flat color="grey-6" v-close-popup />
        <q-btn label="Salvar" icon="save" color="primary" unelevated :loading="editLoading" @click="salvarEdicao" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import * as XLSX from 'xlsx'
import { useApontamentoStore } from 'stores/apontamento'
import ClientesForm from 'components/ClientesForm.vue'

const $q = useQuasar()
const store = useApontamentoStore()

const bases = ['BACABAL', 'ITAPECURU MIRIM', 'SANTA INES', 'PEDREIRAS', 'PRESIDENTE DUTRA', 'BARRA DO CORDA']
const filtros = ref({ base: '', pep: '', nota: '', dataInicio: '', dataFim: '' })
const editDialog = ref(false)
const editLoading = ref(false)
const editingId = ref(null)
const editForm = ref({ base: '', pep: '', nota: '', postes: 0, pg_numeros: [], clientes: [], qtd_clientes_nota: 0 })

const columns = [
  { name: 'data', label: 'DATA', align: 'left', field: row => fmt(row.created_at), sortable: true },
  { name: 'base', label: 'BASE', align: 'left', sortable: true },
  { name: 'pep', label: 'PEP', align: 'left', field: 'pep', sortable: true },
  { name: 'nota', label: 'NOTA', align: 'left', field: 'nota', sortable: true },
  { name: 'postes', label: 'POSTES', align: 'center', field: 'postes', sortable: true },
  { name: 'pg', label: 'PG', align: 'left' },
  { name: 'clientes', label: 'CLIENTES', align: 'left' },
  { name: 'aderencia', label: 'ADERÊNCIA', align: 'center' },
  { name: 'acoes', label: 'AÇÕES', align: 'center', style: 'width:90px' }
]

const listagem = computed(() =>
  store.apontamentos.filter(a => {
    const d = a.created_at ? a.created_at.substring(0, 10) : ''
    return (!filtros.value.base || a.base === filtros.value.base)
      && (!filtros.value.pep || (a.pep || '').toLowerCase().includes(filtros.value.pep.toLowerCase()))
      && (!filtros.value.nota || (a.nota || '').toLowerCase().includes(filtros.value.nota.toLowerCase()))
      && (!filtros.value.dataInicio || d >= filtros.value.dataInicio)
      && (!filtros.value.dataFim || d <= filtros.value.dataFim)
  })
)

const totais = computed(() => {
  const postes = listagem.value.reduce((s, a) => s + (a.postes || 0), 0)
  const clientes = listagem.value.reduce((s, a) => s + (a.clientes || []).length, 0)
  const prev = listagem.value.reduce((s, a) => s + (a.qtd_clientes_nota > 0 ? a.qtd_clientes_nota : (a.clientes || []).length), 0)
  const nao = listagem.value.reduce((s, a) => s + (a.todos_atendidos === false && Array.isArray(a.nao_atendidos) ? a.nao_atendidos.length : 0), 0)
  return { postes, clientes, aderencia: prev > 0 ? Math.max(0, Math.round(((prev - nao) / prev) * 100)) : 0 }
})

function calcAde (row) {
  const prev = row.qtd_clientes_nota > 0 ? row.qtd_clientes_nota : (row.clientes || []).length
  if (!prev) return 100
  const nao = row.todos_atendidos === false && Array.isArray(row.nao_atendidos) ? row.nao_atendidos.length : 0
  return Math.max(0, Math.round(((prev - nao) / prev) * 100))
}

function fmt (d) { return d ? new Date(d).toLocaleDateString('pt-BR') : '' }
function corAdeClass (p) { return p >= 90 ? 'bg-positive' : p >= 60 ? 'bg-warning' : 'bg-negative' }
function corAdeQ (p) { return p >= 90 ? 'positive' : p >= 60 ? 'warning' : 'negative' }
function corPadraoQ (p) { return p === 'PP' ? 'deep-orange' : p === '5 M' ? 'blue' : p === '7 M' ? 'purple' : 'grey' }
function limparFiltros () { filtros.value = { base: '', pep: '', nota: '', dataInicio: '', dataFim: '' } }

function ajustarPg (n) {
  const t = Number(n) || 0
  const a = editForm.value.pg_numeros
  editForm.value.pg_numeros = t > a.length ? [...a, ...Array(t - a.length).fill('')] : a.slice(0, t)
}

function abrirEdicao (row) {
  editingId.value = row.id
  const pg = row.pg_numeros || [], n = row.postes || 0
  editForm.value = {
    base: row.base || '', pep: row.pep, nota: row.nota, postes: n,
    pg_numeros: pg.length >= n ? pg.slice(0, n) : [...pg, ...Array(n - pg.length).fill('')],
    clientes: (row.clientes || []).map(c => ({ nome: c.nome, padrao: c.padrao || '', conta_contrato: c.conta_contrato || '' })),
    qtd_clientes_nota: row.qtd_clientes_nota || 0
  }
  editDialog.value = true
}

async function salvarEdicao () {
  if (!editForm.value.pep || !editForm.value.nota) { $q.notify({ type: 'warning', message: 'Preencha PEP e NOTA.' }); return }
  editLoading.value = true
  const { error } = await store.updateApontamento(editingId.value, {
    base: editForm.value.base,
    pep: editForm.value.pep.trim(), nota: editForm.value.nota.trim(),
    postes: Number(editForm.value.postes) || 0,
    pg_numeros: editForm.value.pg_numeros.filter(v => v?.trim()),
    clientes: editForm.value.clientes.filter(c => c.nome?.trim()),
    qtd_clientes_nota: Number(editForm.value.qtd_clientes_nota) || 0
  })
  editLoading.value = false
  if (error) $q.notify({ type: 'negative', message: 'Erro: ' + error.message })
  else { $q.notify({ type: 'positive', message: 'Atualizado!' }); editDialog.value = false }
}

function confirmarExclusao (row) {
  $q.dialog({
    title: 'Excluir', message: `Excluir PEP <b>${row.pep}</b>?`, html: true,
    cancel: { label: 'Cancelar', flat: true, color: 'grey-6' },
    ok: { label: 'Excluir', color: 'negative', unelevated: true }, persistent: true
  }).onOk(async () => {
    const { error } = await store.deleteApontamento(row.id)
    if (error) $q.notify({ type: 'negative', message: 'Erro: ' + error.message })
    else $q.notify({ type: 'positive', message: 'Excluído!' })
  })
}

function exportarExcel () {
  const rows = []
  listagem.value.forEach(a => {
    const base = { DATA: fmt(a.created_at), BASE: a.base || '', PEP: a.pep, NOTA: a.nota, POSTES: a.postes, PG: (a.pg_numeros || []).join(', '), QTD_PREVISTA: a.qtd_clientes_nota || 0, ADERENCIA: calcAde(a) + '%' }
    if (!a.clientes?.length) rows.push({ ...base, CLIENTE: '', PADRAO: '', CONTA_CONTRATO: '' })
    else a.clientes.forEach(c => rows.push({ ...base, CLIENTE: c.nome, PADRAO: c.padrao || '', CONTA_CONTRATO: c.conta_contrato || '' }))
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Histórico Geral')
  XLSX.writeFile(wb, `historico-${new Date().toISOString().split('T')[0]}.xlsx`)
  $q.notify({ type: 'positive', message: 'Excel exportado!' })
}

onMounted(() => store.fetchApontamentos())
</script>

<style scoped>
.mini-kpi {
  border-radius: 10px; padding: 12px 14px;
  color: #fff; display: flex; flex-direction: column;
  box-shadow: 0 3px 12px rgba(0,0,0,0.18);
}
.mini-kpi > span { font-size: 22px; font-weight: 800; margin-top: 4px; }
.mini-kpi-label { font-size: 10px; opacity: 0.75; margin-top: 2px; text-transform: uppercase; letter-spacing: .08em; }

.modern-table :deep(thead th) {
  font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
  color: var(--text-secondary); background: var(--bg-card-alt); border-bottom: 1px solid var(--border);
}
.modern-table :deep(tbody td) { font-size: 12px; color: var(--text-primary); border-bottom: 1px solid var(--border); }
.modern-table :deep(tbody tr:hover td) { background: var(--accent-light); }

.cliente-row { font-size: 12px; margin-bottom: 3px; display: flex; align-items: center; flex-wrap: wrap; gap: 3px; }
.cliente-row:last-child { margin-bottom: 0; }
</style>
