<template>
  <q-page>
    <div class="q-gutter-y-md">

      <div>
        <div class="section-title">
          <q-icon name="table_chart" size="15px" />
          Gestão de Notas de Serviço
        </div>

        <div class="card-modern q-pa-md">

          <!-- Ações -->
          <div class="row items-center q-mb-md q-gutter-sm flex-wrap">
            <q-btn
              label="Importar Planilha (.xlsx)"
              icon="upload_file"
              color="primary"
              unelevated
              :loading="store.importando"
              @click="triggerUpload"
            />
            <input ref="fileRef" type="file" accept=".xlsx,.xls" hidden @change="onFile" />
            <q-btn
              label="Atualizar"
              icon="refresh"
              flat color="grey-7"
              :loading="store.loading"
              @click="store.fetchNotas()"
            />
            <q-space />
            <div class="text-caption text-grey-6 self-center">
              {{ store.notas.length }} nota{{ store.notas.length !== 1 ? 's' : '' }} carregada{{ store.notas.length !== 1 ? 's' : '' }}
            </div>
          </div>

          <!-- Banner Dropbox -->
          <q-banner rounded class="banner-dropbox q-mb-md">
            <template #avatar>
              <q-icon name="cloud_sync" :color="dropboxUrl ? 'blue-7' : 'blue-4'" size="22px" />
            </template>

            <div v-if="dropboxUrl" class="row items-center q-gutter-sm flex-wrap">
              <span class="text-weight-bold">Dropbox configurado:</span>
              <span class="banner-url">{{ dropboxUrl.slice(0, 60) }}...</span>
            </div>
            <div v-else>
              <span class="text-weight-bold">Sincronização com Dropbox:</span>
              Configure o link da planilha para sincronizar com um clique.
            </div>

            <template #action>
              <q-btn
                label="Sincronizar agora"
                icon="sync"
                flat dense
                :color="dropboxUrl ? 'blue-8' : 'blue-4'"
                :loading="syncingDropbox"
                :disable="syncingDropbox"
                @click="dropboxUrl ? executarSync() : abrirConfigDialog()"
              />
              <q-btn
                :label="dropboxUrl ? 'Reconfigurar' : 'Configurar'"
                :icon="dropboxUrl ? 'edit' : 'settings'"
                flat dense color="blue-7"
                @click="abrirConfigDialog"
              />
            </template>
          </q-banner>

          <!-- Filtro -->
          <q-input
            v-model="filtro"
            dense outlined
            placeholder="Filtrar por NOTA, BASE ou PEP..."
            class="q-mb-md"
            clearable
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>

          <!-- Tabela -->
          <q-table
            :rows="notasFiltradas"
            :columns="cols"
            row-key="nota"
            flat
            :loading="store.loading"
            dense
            :pagination="{ rowsPerPage: 25 }"
            no-data-label="Nenhuma nota — importe uma planilha"
          >
            <template #body-cell-ativo="props">
              <q-td :props="props">
                <q-chip
                  :color="props.row.ativo ? 'positive' : 'grey-4'"
                  :text-color="props.row.ativo ? 'white' : 'grey-7'"
                  dense size="sm"
                >
                  {{ props.row.ativo ? 'Ativa' : 'Inativa' }}
                </q-chip>
              </q-td>
            </template>
          </q-table>
        </div>
      </div>

    </div>

    <!-- ══════════════════════════════════════════════════════
         DIALOG — Configurar sincronização
    ══════════════════════════════════════════════════════ -->
    <q-dialog v-model="configDialog" persistent>
      <q-card style="min-width:480px;max-width:95vw">

        <q-bar style="background:#1565c0;color:#fff">
          <q-icon name="cloud_sync" />
          <span class="q-ml-sm text-weight-bold">Sincronização com Dropbox</span>
          <q-space />
          <q-btn icon="close" flat dense round color="white" @click="configDialog = false" />
        </q-bar>

        <q-tabs v-model="configTab" dense align="left" class="q-px-md q-pt-sm">
          <q-tab name="link"       icon="link"     label="Link Dropbox"  />
          <q-tab name="agendador"  icon="schedule" label="Automático"    />
        </q-tabs>
        <q-separator />

        <q-tab-panels v-model="configTab" animated>

          <!-- ── Aba: Link Dropbox ── -->
          <q-tab-panel name="link">
            <p class="text-body2 text-grey-7 q-mb-md">
              Crie um link compartilhado da planilha no Dropbox e cole abaixo.
              O sistema vai baixar e reimportar as notas com um clique.
            </p>

            <q-banner rounded class="bg-blue-1 q-mb-md text-caption text-blue-9">
              <template #avatar><q-icon name="info" color="blue-6" /></template>
              <b>Como obter o link:</b><br>
              No Dropbox, clique com o botão direito na planilha
              → <b>Compartilhar</b> → <b>Copiar link</b>.
              Cole o link abaixo (funciona com qualquer formato de link do Dropbox).
            </q-banner>

            <q-input
              v-model="dropboxUrlEdit"
              label="Link da planilha no Dropbox"
              outlined dense
              placeholder="https://www.dropbox.com/scl/fi/..."
              clearable
            />

            <div class="row justify-end q-gutter-sm q-mt-md">
              <q-btn flat label="Cancelar" @click="configDialog = false" />
              <q-btn
                label="Salvar"
                color="blue-7"
                unelevated
                :disable="!dropboxUrlEdit?.trim()"
                @click="salvarUrl"
              />
              <q-btn
                label="Salvar e Sincronizar"
                icon="sync"
                color="primary"
                unelevated
                :disable="!dropboxUrlEdit?.trim()"
                :loading="syncingDropbox"
                @click="salvarESincronizar"
              />
            </div>
          </q-tab-panel>

          <!-- ── Aba: Agendador automático ── -->
          <q-tab-panel name="agendador">
            <p class="text-body2 text-grey-7 q-mb-sm">
              Configure o Windows para rodar a importação automaticamente todo dia,
              sem precisar abrir o sistema.
            </p>

            <q-banner rounded class="bg-green-1 q-mb-md text-caption text-green-9">
              <template #avatar><q-icon name="check_circle" color="green-6" /></template>
              Como a planilha já fica sincronizada localmente pelo Dropbox Desktop,
              o agendador lê o arquivo local e atualiza o banco automaticamente.
            </q-banner>

            <div class="section-sub q-mb-xs">Execute uma vez no PowerShell (como administrador):</div>
            <div class="code-block q-mb-md">{{ psCommand }}</div>
            <q-btn
              label="Copiar comando"
              icon="content_copy"
              flat dense color="primary"
              @click="copiarComando"
            />

            <q-separator class="q-my-md" />

            <div class="section-sub q-mb-xs">O que o agendador faz:</div>
            <ul class="text-body2 text-grey-7">
              <li>Executa todo dia às <b>07:00</b> antes do expediente</li>
              <li>Lê a planilha do Dropbox local</li>
              <li>Atualiza as 711 notas no banco automaticamente</li>
              <li>Não afeta notas que já estão "Em Andamento" ou "Concluído"</li>
            </ul>

            <div class="section-sub q-mb-xs q-mt-sm">Para remover o agendamento:</div>
            <div class="code-block">Unregister-ScheduledTask -TaskName "CGB-SyncNotas" -Confirm:$false</div>
          </q-tab-panel>

        </q-tab-panels>

      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useNotasStore } from 'stores/notas'
import { supabase } from 'boot/supabase'

const $q    = useQuasar()
const store = useNotasStore()

const fileRef        = ref(null)
const filtro         = ref('')
const configDialog   = ref(false)
const configTab      = ref('link')
const dropboxUrlEdit = ref('')
const syncingDropbox = ref(false)

// URL salva no localStorage + banco de dados
const DROPBOX_KEY = 'cgb_dropbox_url'
const dropboxUrl  = ref(localStorage.getItem(DROPBOX_KEY) || '')

// Carrega do banco se não estiver no localStorage
onMounted(async () => {
  if (!dropboxUrl.value) {
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'dropbox_url')
      .maybeSingle()
    if (data?.valor) {
      dropboxUrl.value = data.valor
      localStorage.setItem(DROPBOX_KEY, data.valor)
    }
  }
})

const psCommand = `$action  = New-ScheduledTaskAction \`
  -Execute "bun" \`
  -Argument "run import-notas.js" \`
  -WorkingDirectory "C:\\Clientes\\sistema-apontamento"
$trigger = New-ScheduledTaskTrigger -Daily -At "07:00AM"
Register-ScheduledTask \`
  -TaskName "CGB-SyncNotas" \`
  -Action $action -Trigger $trigger \`
  -RunLevel Highest -Force`

const cols = [
  { name: 'base',         label: 'BASE',        field: 'base',         align: 'left',   sortable: true },
  { name: 'pep',          label: 'PEP',          field: 'pep',          align: 'left',   sortable: true },
  { name: 'nota',         label: 'NOTA',         field: 'nota',         align: 'left',   sortable: true },
  { name: 'postes',       label: 'POSTES',       field: 'postes',       align: 'center', sortable: true },
  { name: 'qtd_clientes', label: 'QTD CLIENTES', field: 'qtd_clientes', align: 'center', sortable: true },
  { name: 'ativo',        label: 'STATUS',       field: 'ativo',        align: 'center' }
]

const notasFiltradas = computed(() => {
  if (!filtro.value?.trim()) return store.notas
  const q = filtro.value.trim().toLowerCase()
  return store.notas.filter(n =>
    n.nota?.toLowerCase().includes(q) ||
    n.base?.toLowerCase().includes(q) ||
    n.pep?.toLowerCase().includes(q)
  )
})

function abrirConfigDialog () {
  dropboxUrlEdit.value = dropboxUrl.value
  configTab.value = 'link'
  configDialog.value = true
}

async function salvarUrl () {
  const url = dropboxUrlEdit.value?.trim()
  if (!url) return
  dropboxUrl.value = url
  localStorage.setItem(DROPBOX_KEY, url)
  await supabase.from('configuracoes').upsert({ chave: 'dropbox_url', valor: url }, { onConflict: 'chave' })
  configDialog.value = false
  $q.notify({ type: 'positive', message: 'Link Dropbox salvo!', timeout: 2000 })
}

async function salvarESincronizar () {
  const url = dropboxUrlEdit.value?.trim()
  if (!url) return
  dropboxUrl.value = url
  localStorage.setItem(DROPBOX_KEY, url)
  await supabase.from('configuracoes').upsert({ chave: 'dropbox_url', valor: url }, { onConflict: 'chave' })
  configDialog.value = false
  await executarSync()
}

// Converte qualquer link Dropbox para download direto com CORS liberado
function toDirectUrl (raw) {
  let url = raw.trim()
  // dl.dropboxusercontent.com tem Access-Control-Allow-Origin: *
  // www.dropbox.com bloqueia CORS no navegador
  url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
  // Garante dl=1 (download direto, sem redirecionamento)
  url = url.replace('dl=0', 'dl=1')
  if (!url.includes('dl=')) {
    url += (url.includes('?') ? '&' : '?') + 'dl=1'
  }
  return url
}

async function executarSync () {
  if (!dropboxUrl.value) { abrirConfigDialog(); return }
  syncingDropbox.value = true
  try {
    // Edge Function faz o download server-side — sem restrição CORS
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-proxy`
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ url: dropboxUrl.value })
    })

    const payload = await res.json()
    if (payload.error) throw new Error(payload.error)

    // Decodifica base64 → File
    const binary = atob(payload.b64)
    const bytes  = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const file = new File([bytes], 'dropbox.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    const { error, count } = await store.importarXlsx(file)
    if (error) throw new Error(error.message)

    $q.notify({ type: 'positive', message: `${count} notas sincronizadas do Dropbox!`, icon: 'cloud_done' })
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: 'Erro ao sincronizar: ' + e.message,
      timeout: 7000
    })
  } finally {
    syncingDropbox.value = false
  }
}

function triggerUpload () { fileRef.value?.click() }

async function onFile (e) {
  const file = e.target.files[0]
  if (!file) return
  e.target.value = ''
  const { error, count } = await store.importarXlsx(file)
  if (error) {
    $q.notify({ type: 'negative', message: 'Erro na importação: ' + error.message, timeout: 5000 })
  } else {
    $q.notify({ type: 'positive', message: `${count} nota${count !== 1 ? 's' : ''} importada${count !== 1 ? 's' : ''} com sucesso!` })
  }
}

async function copiarComando () {
  try {
    await navigator.clipboard.writeText(psCommand)
    $q.notify({ type: 'positive', message: 'Comando copiado!', timeout: 2000 })
  } catch {
    $q.notify({ type: 'warning', message: 'Selecione e copie manualmente o comando acima.' })
  }
}

store.fetchNotas()
</script>

<style scoped>
.banner-dropbox {
  background: #e3f2fd;
  color: #1565c0;
  border: 1px solid #90caf9;
}
.banner-url {
  font-size: 12px;
  font-family: monospace;
  color: #0d47a1;
  word-break: break-all;
}
.section-sub {
  font-size: 12px;
  font-weight: 700;
  color: #546e7a;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.code-block {
  background: #1e1e2e;
  color: #a9b1d6;
  font-family: monospace;
  font-size: 12px;
  border-radius: 8px;
  padding: 12px 16px;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}
</style>
