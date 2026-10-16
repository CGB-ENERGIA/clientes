<template>
  <q-page class="prog q-pa-md">
    <div class="prog-head">
      <div>
        <div class="prog-titulo">Programação semanal</div>
        <div class="prog-sub">{{ ultimaTexto }}</div>
      </div>
      <div class="prog-acoes">
        <q-btn
          v-if="dropboxUrl"
          unelevated no-caps color="primary" icon="cloud_sync" label="Sincronizar Dropbox"
          :loading="ocupado" :disable="ocupado"
          @click="sincronizarDropbox"
        />
        <q-btn v-else outline no-caps color="primary" icon="link" label="Configurar link Dropbox" @click="abrirConfig" />
        <q-btn
          outline no-caps color="primary" icon="upload_file" label="Importar planilha"
          :loading="ocupado" :disable="ocupado"
          @click="fileRef.click()"
        />
        <input ref="fileRef" type="file" accept=".xlsx,.xlsm" hidden @change="onArquivo" />
      </div>
    </div>

    <q-banner v-if="precisaAtualizar" rounded class="prog-alerta q-my-md">
      <template #avatar><q-icon name="update" color="orange-9" /></template>
      {{ ultimaImportacao ? 'A programação ainda não foi atualizada hoje.' : 'Nenhuma programação importada ainda.' }}
      Sincronize o Dropbox ou importe a planilha do dia.
    </q-banner>

    <div class="prog-tiles">
      <div v-for="t in tiles" :key="t.key" class="prog-tile" :class="`prog-tile--${t.key}`">
        <div class="prog-tile-n">{{ t.n }}</div>
        <div class="prog-tile-l">{{ t.label }}</div>
      </div>
    </div>

    <div class="prog-barra q-mt-lg">
      <q-tabs v-model="aba" dense no-caps active-color="primary" indicator-color="primary" align="left" class="prog-abas">
        <q-tab name="aplicar" :label="`Atualizar (${contagem.aplicar})`" />
        <q-tab name="conferir" :label="`Conferir (${contagem.conferir})`" />
        <q-tab name="sem_correspondencia" :label="`Sem correspondência (${contagem.sem_correspondencia})`" />
      </q-tabs>
      <q-space />
      <q-input v-model="busca" dense outlined clearable placeholder="Buscar nota, município ou equipe" class="prog-busca">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-btn
        v-if="aba === 'aplicar' && contagem.aplicar"
        unelevated no-caps color="positive" icon="done_all" :label="`Aplicar ${contagem.aplicar}`"
        class="q-ml-sm"
        @click="confirmarAplicarTodas"
      />
    </div>

    <q-table
      flat bordered
      :rows="linhasAba"
      :columns="colunas"
      row-key="sap"
      :pagination="{ rowsPerPage: 25, sortBy: 'sap' }"
      no-data-label="Nada nesta lista"
      class="prog-tabela q-mt-sm"
    >
      <template #body-cell-prog="props">
        <q-td :props="props">
          <span class="prog-chip" :class="`prog-chip--${props.row.status_programacao.toLowerCase()}`">
            {{ ROTULO_PROGRAMACAO[props.row.status_programacao] }}
          </span>
          <div v-if="props.row.data_programada" class="prog-data">{{ formatarData(props.row.data_programada) }}</div>
          <q-tooltip v-if="props.row.motivo || props.row.observacao" anchor="top middle" self="bottom middle">
            {{ [props.row.motivo, props.row.observacao].filter(Boolean).join(' · ') }}
          </q-tooltip>
        </q-td>
      </template>
      <template #body-cell-sis="props">
        <q-td :props="props">
          <template v-if="props.row.qtd > 1">
            <div class="prog-aviso">{{ props.row.qtd }} notas com este SAP · conferir</div>
            <div v-for="n in props.row.notas_sistema" :key="n.nota" class="prog-sis-linha">
              {{ n.nota }} · PEP {{ n.pep }} · {{ ROTULO_SISTEMA[n.status] }}
            </div>
          </template>
          <template v-else>
            <span v-if="props.row.status_sistema" class="prog-sis">{{ ROTULO_SISTEMA[props.row.status_sistema] }}</span>
            <span v-else class="prog-muted">—</span>
          </template>
        </q-td>
      </template>
      <template #body-cell-acao="props">
        <q-td :props="props" class="text-right">
          <q-btn
            v-if="props.row.acao === 'aplicar'"
            unelevated dense no-caps color="positive" label="Atualizar"
            :disable="aplicando === props.row.sap"
            :loading="aplicando === props.row.sap"
            @click="aplicarUma(props.row)"
          />
          <span v-else-if="props.row.acao === 'conferir'" class="prog-muted">
            {{ props.row.qtd > 1 ? 'Conferir ligações' : 'Conferir: situações diferentes' }}
          </span>
          <span v-else-if="props.row.acao === 'sem_correspondencia'" class="prog-muted">Não existe no sistema</span>
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="configAberta">
      <q-card style="width: 460px; max-width: 94vw">
        <q-card-section>
          <div class="text-h6">Link da programação no Dropbox</div>
          <div class="text-caption text-grey-7">Crie um link compartilhado da planilha e cole abaixo.</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-input v-model="configUrl" outlined dense label="Link da planilha" placeholder="https://www.dropbox.com/scl/fi/..." />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn unelevated no-caps color="primary" label="Salvar" :disable="!configUrl.trim()" @click="salvarConfig" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { supabase, fetchAll } from 'boot/supabase'
import { useNotasStore } from 'stores/notas'
import { lerProgramacao, hashArquivo, ROTULO_PROGRAMACAO } from 'src/utils/programacao'

const $q = useQuasar()
const notasStore = useNotasStore()

const CONFIG_KEY = 'dropbox_programacao_url'
const NOME_ARQUIVO = 'PROGRAMAÇÃO SEMANAL EQUIPE PLA.xlsx'
const ROTULO_SISTEMA = {
  pendente: 'Não Iniciado',
  em_andamento: 'Andamento',
  baixar_medidor: 'Baixar Medidor',
  concluido: 'Concluído',
  expurgo: 'Expurgo',
  sem_acesso: 'Sem Acesso'
}

const linhas = ref([])
const ultimaImportacao = ref(null)
const dropboxUrl = ref('')
const ocupado = ref(false)
const aplicando = ref(null)
const aba = ref('aplicar')
const busca = ref('')
const fileRef = ref(null)
const configAberta = ref(false)
const configUrl = ref('')

const colunas = [
  { name: 'sap', label: 'Nota SAP', field: 'sap', align: 'left', sortable: true },
  { name: 'municipio', label: 'Município', field: 'municipio', align: 'left', sortable: true },
  { name: 'equipe', label: 'Equipe', field: 'equipe', align: 'left', sortable: true },
  { name: 'prog', label: 'Programação', field: 'status_programacao', align: 'left', sortable: true },
  { name: 'sis', label: 'Sistema', field: 'status_sistema', align: 'left' },
  { name: 'acao', label: '', field: 'acao', align: 'right' }
]

const contagem = computed(() => {
  const c = { aplicar: 0, conferir: 0, sem_correspondencia: 0, ok: 0 }
  for (const l of linhas.value) c[l.acao] = (c[l.acao] || 0) + 1
  return c
})

const tiles = computed(() => [
  { key: 'aplicar', n: contagem.value.aplicar, label: 'Para atualizar' },
  { key: 'conferir', n: contagem.value.conferir, label: 'Para conferir' },
  { key: 'sem_correspondencia', n: contagem.value.sem_correspondencia, label: 'Sem correspondência' },
  { key: 'ok', n: contagem.value.ok, label: 'Em dia' }
])

const linhasAba = computed(() => {
  const q = busca.value.trim().toLowerCase()
  return linhas.value.filter(l =>
    l.acao === aba.value &&
    (!q || [l.sap, l.municipio, l.equipe].some(v => String(v ?? '').toLowerCase().includes(q)))
  )
})

const precisaAtualizar = computed(() =>
  !ultimaImportacao.value || new Date(ultimaImportacao.value.criado_em).toDateString() !== new Date().toDateString()
)

const ultimaTexto = computed(() => {
  const u = ultimaImportacao.value
  if (!u) return 'Nenhuma programação importada'
  const quando = new Date(u.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const origem = u.origem === 'dropbox' ? 'Dropbox' : u.origem === 'agendador' ? 'agendador' : 'importação manual'
  return `Última atualização: ${quando} (${origem}) · ${u.notas} notas`
})

function formatarData (iso) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

async function carregar () {
  const [{ data: v }, { data: imp }, { data: cfg }] = await Promise.all([
    fetchAll(() => supabase.from('programacao_comparativo').select('*').order('sap')),
    supabase.from('programacao_importacoes').select('*').order('criado_em', { ascending: false }).limit(1),
    supabase.from('configuracoes').select('valor').eq('chave', CONFIG_KEY).maybeSingle()
  ])
  linhas.value = v || []
  ultimaImportacao.value = imp?.[0] || null
  dropboxUrl.value = cfg?.valor || ''
}

// Qualquer caminho de importação passa por aqui: grava a programação e aplica as mudanças seguras
async function importarBuffer (buffer, { origem, arquivo }) {
  ocupado.value = true
  try {
    const { registros, lidas, ignoradas } = lerProgramacao(buffer)
    const hash = await hashArquivo(buffer)
    const { error } = await supabase.rpc('importar_programacao', {
      p_registros: registros, p_origem: origem, p_arquivo: arquivo, p_hash: hash
    })
    if (error) throw error
    const { data: ap, error: erroAplicar } = await supabase.rpc('aplicar_programacao', { p_saps: null })
    if (erroAplicar) throw erroAplicar
    await Promise.all([carregar(), notasStore.fetchNotas()])
    const atualizadas = ap?.aplicados ?? 0
    $q.notify({
      type: 'positive', icon: 'event_available', position: 'top', timeout: 4500,
      message: `${registros.length} notas na programação (${lidas} linhas)` +
        (atualizadas ? ` · ${atualizadas} atualizadas no sistema` : '') +
        (ignoradas ? ` · ${ignoradas} linhas com status desconhecido` : '')
    })
  } catch (e) {
    $q.notify({ type: 'negative', message: 'Erro na importação: ' + e.message, position: 'top', timeout: 6000 })
  } finally {
    ocupado.value = false
  }
}

async function onArquivo (e) {
  const file = e.target.files[0]
  if (!file) return
  e.target.value = ''
  await importarBuffer(await file.arrayBuffer(), { origem: 'upload', arquivo: file.name })
}

async function sincronizarDropbox () {
  if (!dropboxUrl.value) { abrirConfig(); return }
  ocupado.value = true
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ url: dropboxUrl.value })
    })
    const payload = await res.json()
    if (payload.error) throw new Error(payload.error)
    const binario = atob(payload.b64)
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
    ocupado.value = false
    await importarBuffer(bytes.buffer, { origem: 'dropbox', arquivo: NOME_ARQUIVO })
  } catch (e) {
    ocupado.value = false
    $q.notify({ type: 'negative', message: 'Erro ao sincronizar: ' + e.message, position: 'top', timeout: 6000 })
  }
}

function abrirConfig () {
  configUrl.value = dropboxUrl.value
  configAberta.value = true
}

async function salvarConfig () {
  const url = configUrl.value.trim()
  const { error } = await supabase.from('configuracoes').upsert({ chave: CONFIG_KEY, valor: url }, { onConflict: 'chave' })
  if (error) {
    $q.notify({ type: 'negative', message: 'Não foi possível salvar o link: ' + error.message, position: 'top' })
    return
  }
  dropboxUrl.value = url
  configAberta.value = false
  sincronizarDropbox()
}

async function aplicarUma (linha) {
  aplicando.value = linha.sap
  const { error } = await supabase.rpc('aplicar_programacao', { p_saps: [linha.sap] })
  aplicando.value = null
  if (error) {
    $q.notify({ type: 'negative', message: 'Erro ao atualizar: ' + error.message, position: 'top' })
    return
  }
  await Promise.all([carregar(), notasStore.fetchNotas()])
}

function confirmarAplicarTodas () {
  $q.dialog({
    title: `Atualizar ${contagem.value.aplicar} notas no sistema?`,
    message: 'Só avança o status (ex.: Não Iniciado → Andamento). Nada que já esteja concluído, expurgado ou sem acesso é alterado.',
    cancel: { label: 'Voltar', flat: true },
    ok: { label: 'Atualizar', color: 'positive', unelevated: true }
  }).onOk(async () => {
    const { data, error } = await supabase.rpc('aplicar_programacao', { p_saps: null })
    if (error) {
      $q.notify({ type: 'negative', message: 'Erro ao atualizar: ' + error.message, position: 'top' })
      return
    }
    await Promise.all([carregar(), notasStore.fetchNotas()])
    $q.notify({ type: 'positive', message: `${data?.aplicados ?? 0} notas atualizadas.`, position: 'top' })
  })
}

onMounted(carregar)
</script>

<style scoped>
.prog-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; }
.prog-titulo { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
.prog-sub { font-size: 13px; color: #64748b; margin-top: 2px; }
.prog-acoes { display: flex; flex-wrap: wrap; gap: 8px; }
.prog-alerta { background: #fff3e0; color: #7c4a03; }

.prog-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 16px; }
.prog-tile {
  border-radius: 14px; padding: 14px 16px; background: #f8fafc;
  border-left: 4px solid #cbd5e1;
}
.prog-tile-n { font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; }
.prog-tile-l { font-size: 12px; font-weight: 600; color: #64748b; }
.prog-tile--aplicar { border-left-color: #43a047; }
.prog-tile--conferir { border-left-color: #fb8c00; }
.prog-tile--sem_correspondencia { border-left-color: #90a4ae; }
.prog-tile--ok { border-left-color: #1e88e5; }

.prog-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.prog-busca { min-width: 260px; }

.prog-chip {
  display: inline-block; font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 10px;
  background: #e2e8f0; color: #334155;
}
.prog-chip--concluida { background: #e8f5e9; color: #2e7d32; }
.prog-chip--andamento { background: #fff3e0; color: #e65100; }
.prog-chip--programada { background: #e3f2fd; color: #1565c0; }
.prog-chip--reprogramar { background: #f3e5f5; color: #6a1b9a; }
.prog-chip--cancelar { background: #eceff1; color: #546e7a; }
.prog-data { font-size: 11.5px; color: #64748b; margin-top: 2px; }
.prog-sis { font-size: 13px; font-weight: 600; }
.prog-aviso { font-size: 11.5px; color: #b26a00; font-weight: 600; }
.prog-sis-linha { font-size: 12px; color: #334155; font-variant-numeric: tabular-nums; }
.prog-muted { color: #94a3b8; font-size: 12.5px; }

.body--dark .prog-sub { color: #94a3b8; }
.body--dark .prog-tile { background: #111c2e; }
.body--dark .prog-tile-l { color: #94a3b8; }
.body--dark .prog-alerta { background: #3a2a10; color: #ffcc80; }
</style>
