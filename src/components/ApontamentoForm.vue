<template>
  <q-card flat bordered>
    <q-card-section>

      <!-- Seleção de NOTA -->
      <div class="row q-col-gutter-md q-mb-sm">
        <div class="col-12 col-sm-6">
          <q-select
            v-model="notaSelecionada"
            :options="notasOpts"
            label="NOTA DE SERVIÇO *"
            outlined dense
            use-input
            input-debounce="0"
            @filter="filtrarNotas"
            @update:model-value="onNotaSelecionada"
            :loading="notasStore.loading"
            no-data-label="Nenhuma nota disponível — importe uma planilha em Gestão de Notas"
            ref="notaRef"
            :rules="[v => !!v || 'Selecione uma nota']"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label class="text-weight-bold">{{ scope.opt.value }}</q-item-label>
                  <q-item-label caption>{{ scope.opt.sublabel }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-chip dense size="sm" color="blue-1" text-color="blue-8">{{ scope.opt.nota?.base }}</q-chip>
                </q-item-section>
              </q-item>
            </template>
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey-6 text-caption">
                  Nenhuma nota — vá em <strong>Gestão de Notas</strong> e importe a planilha
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </div>

        <!-- Info auto-preenchidos -->
        <div class="col-12 col-sm-6" v-if="notaInfo">
          <div class="nota-info-bar row q-gutter-sm">
            <div class="nota-info-chip">
              <span class="nota-info-label">BASE</span>
              <span class="nota-info-val">{{ notaInfo.base }}</span>
            </div>
            <div class="nota-info-chip">
              <span class="nota-info-label">PEP</span>
              <span class="nota-info-val">{{ notaInfo.pep }}</span>
            </div>
            <div class="nota-info-chip">
              <span class="nota-info-label">POSTES</span>
              <span class="nota-info-val">{{ notaInfo.postes }}</span>
            </div>
            <div class="nota-info-chip">
              <span class="nota-info-label">CLIENTES NOTA</span>
              <span class="nota-info-val">{{ notaInfo.qtd_clientes }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- PG dinâmico (gerado a partir de postes da nota) -->
      <div v-if="form.postes > 0" class="q-mt-sm q-mb-md">
        <div class="text-subtitle2 text-grey-7 q-mb-sm">
          NÚMEROS DE PG
          <span class="text-caption text-grey-5 q-ml-xs">({{ form.postes }} poste{{ form.postes > 1 ? 's' : '' }})</span>
        </div>
        <div class="row q-col-gutter-sm">
          <div v-for="i in form.postes" :key="i" class="col-6 col-sm-4 col-md-3 col-lg-2">
            <q-input v-model="form.pg_numeros[i - 1]" :label="`PG ${i}`" outlined dense />
          </div>
        </div>
      </div>

      <q-separator class="q-my-md" />

      <div class="text-subtitle2 text-grey-7 q-mb-sm">CLIENTES</div>
      <ClientesForm v-model="form.clientes" />
    </q-card-section>

    <q-card-actions align="right" class="q-px-md q-pb-md">
      <q-btn label="Limpar" flat color="grey-7" dense @click="limpar" />
      <q-btn
        label="Salvar Apontamento"
        icon="save"
        color="primary"
        unelevated
        :loading="loading"
        @click="iniciarSalvamento"
      />
    </q-card-actions>
  </q-card>

  <!-- ETAPA 1: Todos atendidos? -->
  <q-dialog v-model="confirmDialog" persistent>
    <q-card style="min-width: 380px">
      <q-card-section class="text-center q-pt-lg">
        <q-icon name="help_outline" color="primary" size="48px" />
        <div class="text-h6 q-mt-sm">TODOS OS CLIENTES ATENDIDOS?</div>
      </q-card-section>
      <q-card-actions align="center" class="q-pb-lg q-gutter-md">
        <q-btn label="NÃO" color="negative" outline style="min-width:110px" @click="abrirNaoAtendidos" />
        <q-btn label="SIM" color="positive" unelevated style="min-width:110px" @click="confirmarESalvar(true)" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- ETAPA 2: Quem não foi atendido -->
  <q-dialog v-model="naoAtendidosDialog" persistent>
    <q-card style="min-width: 520px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 text-negative">Clientes não atendidos</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="cancelarNaoAtendidos" />
      </q-card-section>
      <q-card-section>
        <div class="text-caption text-grey-6 q-mb-md">Informe os clientes não atendidos e o motivo.</div>
        <div v-for="(item, i) in naoAtendidos" :key="i" class="row q-col-gutter-sm q-mb-sm items-center">
          <div class="col-12 col-sm-5">
            <q-select
              v-model="item.cliente"
              :options="nomesClientes"
              label="Cliente"
              outlined dense
              use-input fill-input hide-selected input-debounce="0"
              @filter="filtrarClientes"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="item.motivo" label="Motivo" outlined dense />
          </div>
          <div class="col-auto">
            <q-btn icon="delete" color="negative" flat round dense @click="removerNaoAtendido(i)" />
          </div>
        </div>
        <q-btn label="Adicionar" icon="add" color="secondary" flat dense class="q-mt-xs" @click="adicionarNaoAtendido" />
      </q-card-section>
      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn label="Cancelar" flat color="grey-7" @click="cancelarNaoAtendidos" />
        <q-btn
          label="Confirmar e Salvar"
          icon="save" color="primary" unelevated
          :disable="naoAtendidos.some(n => !n.cliente || !n.motivo)"
          @click="confirmarESalvar(false)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useApontamentoStore } from 'stores/apontamento'
import { useNotasStore } from 'stores/notas'
import ClientesForm from './ClientesForm.vue'

const emit = defineEmits(['saved'])

const $q          = useQuasar()
const store       = useApontamentoStore()
const notasStore  = useNotasStore()
const loading     = ref(false)
const notaRef     = ref(null)

// ── Nota selecionada ──────────────────────────────────────────────
const notaSelecionada = ref(null)
const notasOpts       = ref(notasStore.notasOptions)
const notaInfo        = ref(null)

function filtrarNotas (val, update) {
  update(() => {
    if (!val.trim()) {
      notasOpts.value = notasStore.notasOptions
    } else {
      const q = val.toLowerCase()
      notasOpts.value = notasStore.notasOptions.filter(o =>
        o.value.toLowerCase().includes(q) ||
        o.nota?.base?.toLowerCase().includes(q) ||
        o.nota?.pep?.toLowerCase().includes(q)
      )
    }
  })
}

function onNotaSelecionada (opt) {
  if (!opt) { notaInfo.value = null; return }
  const n = opt.nota
  notaInfo.value = n
  form.value.postes          = Number(n.postes)          || 0
  form.value.qtd_clientes_nota = Number(n.qtd_clientes)  || 0
  form.value.pg_numeros = Array(form.value.postes).fill('')
}

// ── Form ─────────────────────────────────────────────────────────
const form = ref({ postes: 0, pg_numeros: [], clientes: [], qtd_clientes_nota: 0 })

const confirmDialog      = ref(false)
const naoAtendidosDialog = ref(false)
const naoAtendidos       = ref([{ cliente: '', motivo: '' }])

const nomesClientes = computed(() =>
  form.value.clientes.map(c => c.nome).filter(n => n?.trim())
)

function iniciarSalvamento () {
  notaRef.value?.validate()

  const erros = []
  if (!notaSelecionada.value) erros.push('NOTA DE SERVIÇO')
  if (!form.value.postes || form.value.postes <= 0) erros.push('POSTES (nota sem postes definidos)')

  const postes = Number(form.value.postes) || 0
  if (postes > 0) {
    const pgVazios = form.value.pg_numeros.slice(0, postes).some(v => !v?.trim())
    if (pgVazios) erros.push(`todos os Números de PG (${postes} obrigatório${postes > 1 ? 's' : ''})`)
  }

  if (form.value.clientes.length === 0) {
    erros.push('pelo menos um CLIENTE')
  } else {
    const invalido = form.value.clientes.find(c => !c.nome?.trim() || !c.padrao?.trim())
    if (invalido) erros.push('Nome e Padrão de todos os clientes')
  }

  if (erros.length > 0) {
    $q.notify({ type: 'warning', message: `Preencha: ${erros.join(', ')}.`, timeout: 4000 })
    return
  }

  naoAtendidos.value = [{ cliente: '', motivo: '' }]
  confirmDialog.value = true
}

function abrirNaoAtendidos     () { confirmDialog.value = false; naoAtendidosDialog.value = true }
function cancelarNaoAtendidos  () { naoAtendidosDialog.value = false }
function adicionarNaoAtendido  () { naoAtendidos.value.push({ cliente: '', motivo: '' }) }
function removerNaoAtendido (i) { naoAtendidos.value.splice(i, 1) }
function filtrarClientes (val, update) { update(() => {}) }

async function confirmarESalvar (todosAtendidos) {
  confirmDialog.value = false
  naoAtendidosDialog.value = false

  const n = notaInfo.value
  const naoAtendidosPayload = todosAtendidos
    ? []
    : naoAtendidos.value.filter(x => x.cliente && x.motivo)

  loading.value = true
  const { error } = await store.addApontamento({
    base:             n.base,
    pep:              n.pep,
    nota:             n.nota,
    postes:           Number(form.value.postes) || 0,
    pg_numeros:       form.value.pg_numeros.filter(v => v?.trim()),
    clientes:         form.value.clientes.filter(c => c.nome?.trim()),
    todos_atendidos:  todosAtendidos,
    nao_atendidos:    naoAtendidosPayload,
    qtd_clientes_nota: Number(form.value.qtd_clientes_nota) || 0
  })
  loading.value = false

  if (error) {
    $q.notify({ type: 'negative', message: 'Erro ao salvar: ' + error.message })
  } else {
    $q.notify({ type: 'positive', message: 'Apontamento salvo com sucesso!' })
    limpar()
    emit('saved')
  }
}

function limpar () {
  notaSelecionada.value = null
  notaInfo.value = null
  form.value = { postes: 0, pg_numeros: [], clientes: [], qtd_clientes_nota: 0 }
  notaRef.value?.resetValidation()
  notasOpts.value = notasStore.notasOptions
}
</script>

<style scoped>
.nota-info-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  height: 100%;
  padding: 4px 0;
}
.nota-info-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--accent-light, #e3f2fd);
  border-radius: 8px;
  padding: 4px 10px;
  min-width: 72px;
}
.nota-info-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--accent, #1976d2);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
}
.nota-info-val {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary, #0d1b2a);
  line-height: 1.4;
}
</style>
