<template>
  <!-- Filtros -->
  <div class="q-pa-md" style="border-bottom:1px solid var(--border)">
    <div class="row q-col-gutter-sm items-center">
      <div class="col-12 col-sm-3">
        <q-input v-model="store.filtros.pep" label="Filtrar PEP" outlined dense clearable debounce="300">
          <template #prepend><q-icon name="search" size="18px" /></template>
        </q-input>
      </div>
      <div class="col-12 col-sm-3">
        <q-input v-model="store.filtros.nota" label="Filtrar NOTA" outlined dense clearable debounce="300">
          <template #prepend><q-icon name="search" size="18px" /></template>
        </q-input>
      </div>
      <div class="col-12 col-sm-2">
        <q-input v-model="store.filtros.dataInicio" label="De" type="date" outlined dense clearable />
      </div>
      <div class="col-12 col-sm-2">
        <q-input v-model="store.filtros.dataFim" label="Até" type="date" outlined dense clearable />
      </div>
      <div class="col-12 col-sm-2 row items-center justify-end q-gutter-sm">
        <span class="text-caption" style="color:var(--text-muted)">{{ store.apontamentosFiltrados.length }} reg.</span>
        <q-btn flat dense no-caps icon="download" color="positive" label="Excel" size="sm" @click="exportarExcel" />
      </div>
    </div>
  </div>

  <q-table
    :rows="store.apontamentosFiltrados"
    :columns="columns"
    row-key="id"
    :loading="store.loading"
    flat dense
    :pagination="{ rowsPerPage: 20 }"
    no-data-label="Nenhum apontamento encontrado"
    class="modern-table"
  >
    <template #body-cell-pg="props">
      <q-td :props="props">
        <div v-for="(pg, i) in (props.row.pg_numeros || [])" :key="i" class="text-caption mono">{{ pg }}</div>
        <span v-if="!props.row.pg_numeros?.length" class="text-muted-cell">—</span>
      </q-td>
    </template>

    <template #body-cell-clientes="props">
      <q-td :props="props">
        <div v-for="c in (props.row.clientes || [])" :key="c.id" class="cliente-row">
          <span class="text-weight-medium">{{ c.nome }}</span>
          <q-badge v-if="c.padrao" outline :color="corPadrao(c.padrao)" :label="c.padrao" class="q-ml-xs" />
          <span v-if="c.conta_contrato" class="text-muted-cell q-ml-xs">{{ c.conta_contrato }}</span>
        </div>
        <span v-if="!props.row.clientes?.length" class="text-muted-cell">—</span>
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

    <template #bottom-row>
      <q-tr class="totals-row">
        <q-td colspan="3" class="text-weight-bold" style="color:var(--accent)">TOTAIS</q-td>
        <q-td class="text-center text-weight-bold" style="color:var(--accent)">{{ store.totais.postes }}</q-td>
        <q-td />
        <q-td class="text-weight-bold" style="color:var(--accent)">{{ store.totais.clientes }} cliente(s)</q-td>
        <q-td />
      </q-tr>
    </template>
  </q-table>

  <!-- Edit Dialog -->
  <q-dialog v-model="editDialog" persistent>
    <q-card style="min-width:680px;max-width:92vw;background:var(--bg-card);color:var(--text-primary)">
      <q-card-section class="row items-center" style="border-bottom:1px solid var(--border)">
        <div class="text-subtitle1 text-weight-bold">Editar Apontamento</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>
      <q-card-section>
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-12 col-sm-4">
            <q-input v-model="editForm.pep" label="PEP" outlined dense />
          </div>
          <div class="col-12 col-sm-4">
            <q-input v-model="editForm.nota" label="NOTA" outlined dense />
          </div>
          <div class="col-12 col-sm-4">
            <q-input v-model.number="editForm.postes" label="POSTES" type="number" outlined dense min="0" @update:model-value="ajustarEditPgLista" />
          </div>
        </div>
        <div v-if="editForm.postes > 0" class="q-mb-md">
          <div class="text-caption text-weight-bold q-mb-sm" style="color:var(--text-secondary);letter-spacing:0.08em;text-transform:uppercase">Números de PG</div>
          <div class="row q-col-gutter-sm">
            <div v-for="i in editForm.postes" :key="i" class="col-6 col-sm-4 col-md-3">
              <q-input v-model="editForm.pg_numeros[i - 1]" :label="`PG ${i}`" outlined dense />
            </div>
          </div>
        </div>
        <q-separator class="q-my-md" />
        <div class="text-caption text-weight-bold q-mb-sm" style="color:var(--text-secondary);letter-spacing:0.08em;text-transform:uppercase">Clientes</div>
        <ClientesForm v-model="editForm.clientes" />
      </q-card-section>
      <q-card-actions align="right" class="q-px-md q-pb-md" style="border-top:1px solid var(--border)">
        <q-btn label="Cancelar" flat color="grey-6" v-close-popup />
        <q-btn label="Salvar alterações" icon="save" color="primary" unelevated :loading="editLoading" @click="salvarEdicao" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import * as XLSX from 'xlsx'
import { useApontamentoStore } from 'stores/apontamento'
import ClientesForm from './ClientesForm.vue'

const $q = useQuasar()
const store = useApontamentoStore()

const editDialog = ref(false)
const editLoading = ref(false)
const editingId = ref(null)
const editForm = ref({ pep: '', nota: '', postes: 0, pg_numeros: [], clientes: [] })

const columns = [
  { name: 'data', label: 'DATA', align: 'left', field: row => formatDate(row.created_at), sortable: true },
  { name: 'pep', label: 'PEP', align: 'left', field: 'pep', sortable: true },
  { name: 'nota', label: 'NOTA', align: 'left', field: 'nota', sortable: true },
  { name: 'postes', label: 'POSTES', align: 'center', field: 'postes', sortable: true },
  { name: 'pg', label: 'PG', align: 'left' },
  { name: 'clientes', label: 'CLIENTES', align: 'left' },
  { name: 'acoes', label: 'AÇÕES', align: 'center', style: 'width:90px' }
]

function formatDate (d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('pt-BR')
}

function corPadrao (p) {
  if (p === 'PP') return 'deep-orange'
  if (p === '5 M') return 'blue'
  if (p === '7 M') return 'purple'
  return 'grey'
}

function ajustarEditPgLista (novoTotal) {
  const n = Number(novoTotal) || 0
  const atual = editForm.value.pg_numeros
  editForm.value.pg_numeros = n > atual.length
    ? [...atual, ...Array(n - atual.length).fill('')]
    : atual.slice(0, n)
}

function abrirEdicao (row) {
  editingId.value = row.id
  const pg = row.pg_numeros || []
  const n = row.postes || 0
  editForm.value = {
    pep: row.pep, nota: row.nota, postes: n,
    pg_numeros: pg.length >= n ? pg.slice(0, n) : [...pg, ...Array(n - pg.length).fill('')],
    clientes: (row.clientes || []).map(c => ({ nome: c.nome, padrao: c.padrao || '', conta_contrato: c.conta_contrato || '' }))
  }
  editDialog.value = true
}

async function salvarEdicao () {
  if (!editForm.value.pep || !editForm.value.nota) {
    $q.notify({ type: 'warning', message: 'Preencha PEP e NOTA.' })
    return
  }
  editLoading.value = true
  const { error } = await store.updateApontamento(editingId.value, {
    pep: editForm.value.pep.trim(),
    nota: editForm.value.nota.trim(),
    postes: Number(editForm.value.postes) || 0,
    pg_numeros: editForm.value.pg_numeros.filter(v => v?.trim()),
    clientes: editForm.value.clientes.filter(c => c.nome?.trim())
  })
  editLoading.value = false
  if (error) $q.notify({ type: 'negative', message: 'Erro: ' + error.message })
  else { $q.notify({ type: 'positive', message: 'Apontamento atualizado!' }); editDialog.value = false }
}

function confirmarExclusao (row) {
  $q.dialog({
    title: 'Excluir apontamento',
    message: `Excluir PEP <b>${row.pep}</b>?`,
    html: true,
    cancel: { label: 'Cancelar', flat: true, color: 'grey-6' },
    ok: { label: 'Excluir', color: 'negative', unelevated: true },
    persistent: true
  }).onOk(async () => {
    const { error } = await store.deleteApontamento(row.id)
    if (error) $q.notify({ type: 'negative', message: 'Erro: ' + error.message })
    else $q.notify({ type: 'positive', message: 'Excluído!' })
  })
}

function exportarExcel () {
  const rows = []
  store.apontamentosFiltrados.forEach(a => {
    const base = { DATA: formatDate(a.created_at), PEP: a.pep, NOTA: a.nota, POSTES: a.postes, PG: (a.pg_numeros || []).join(', ') }
    if (!a.clientes?.length) rows.push({ ...base, CLIENTE: '', PADRAO: '', CONTA_CONTRATO: '' })
    else a.clientes.forEach(c => rows.push({ ...base, CLIENTE: c.nome, PADRAO: c.padrao || '', CONTA_CONTRATO: c.conta_contrato || '' }))
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 18 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Histórico')
  XLSX.writeFile(wb, `apontamentos-${new Date().toISOString().split('T')[0]}.xlsx`)
  $q.notify({ type: 'positive', message: 'Excel exportado!' })
}

onMounted(() => {
  const hoje = new Date().toISOString().split('T')[0]
  store.filtros.dataInicio = hoje
  store.filtros.dataFim = hoje
  store.fetchApontamentos()
})
</script>

<style scoped>
.modern-table :deep(thead th) {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: var(--bg-card-alt);
  border-bottom: 1px solid var(--border);
}
.modern-table :deep(tbody td) {
  font-size: 13px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
}
.modern-table :deep(tbody tr:hover td) {
  background: var(--accent-light);
}
.totals-row :deep(td) {
  background: var(--accent-light) !important;
  border-top: 2px solid var(--accent) !important;
}
.cliente-row { font-size: 12px; margin-bottom: 4px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.cliente-row:last-child { margin-bottom: 0; }
.text-muted-cell { color: var(--text-muted); font-size: 11px; }
.mono { font-family: monospace; }
</style>
