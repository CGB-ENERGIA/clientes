<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-4">
          <q-select
            v-model="form.base"
            :options="basesOptions"
            label="BASE"
            outlined dense emit-value map-options
            :rules="[v => !!v || 'Base é obrigatória']"
            ref="baseRef"
          />
        </div>
        <div class="col-12 col-sm-4">
          <q-input
            v-model="form.pep"
            label="PEP"
            outlined dense
            :rules="[v => !!v || 'PEP é obrigatório']"
            ref="pepRef"
          />
        </div>
        <div class="col-12 col-sm-4">
          <q-input
            v-model="form.nota"
            label="NOTA"
            outlined dense
            :rules="[v => !!v || 'NOTA é obrigatória']"
            ref="notaRef"
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-input
            v-model.number="form.postes"
            label="POSTES"
            type="number"
            outlined dense min="0"
            @update:model-value="ajustarPgLista"
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-input
            v-model.number="form.qtd_clientes_nota"
            label="QTD DE CLIENTES NOTA"
            type="number"
            outlined dense min="0"
            hint="Total de clientes previstos na nota"
            ref="qtdClientesNotaRef"
          />
        </div>
      </div>

      <!-- PG dinâmico -->
      <div v-if="form.postes > 0" class="q-mt-md">
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
        <q-btn
          label="NÃO"
          color="negative"
          outline
          style="min-width: 110px"
          @click="abrirNaoAtendidos"
        />
        <q-btn
          label="SIM"
          color="positive"
          unelevated
          style="min-width: 110px"
          @click="confirmarESalvar(true)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- ETAPA 2: Quem não foi atendido e por quê -->
  <q-dialog v-model="naoAtendidosDialog" persistent>
    <q-card style="min-width: 520px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 text-negative">Clientes não atendidos</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="cancelarNaoAtendidos" />
      </q-card-section>

      <q-card-section>
        <div class="text-caption text-grey-6 q-mb-md">
          Informe os clientes não atendidos e o motivo.
        </div>

        <div
          v-for="(item, i) in naoAtendidos"
          :key="i"
          class="row q-col-gutter-sm q-mb-sm items-center"
        >
          <div class="col-12 col-sm-5">
            <q-select
              v-model="item.cliente"
              :options="nomesClientes"
              label="Cliente"
              outlined dense
              use-input
              fill-input
              hide-selected
              input-debounce="0"
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

        <q-btn
          label="Adicionar"
          icon="add"
          color="secondary"
          flat dense
          class="q-mt-xs"
          @click="adicionarNaoAtendido"
        />
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn label="Cancelar" flat color="grey-7" @click="cancelarNaoAtendidos" />
        <q-btn
          label="Confirmar e Salvar"
          icon="save"
          color="primary"
          unelevated
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
import ClientesForm from './ClientesForm.vue'

const emit = defineEmits(['saved'])

const $q = useQuasar()
const store = useApontamentoStore()
const loading = ref(false)
const baseRef = ref(null)
const pepRef = ref(null)
const notaRef = ref(null)
const qtdClientesNotaRef = ref(null)

const basesOptions = [
  'BACABAL',
  'ITAPECURU MIRIM',
  'SANTA INES',
  'PEDREIRAS',
  'PRESIDENTE DUTRA',
  'BARRA DO CORDA'
]

const form = ref({ base: '', pep: '', nota: '', postes: 0, pg_numeros: [], clientes: [], qtd_clientes_nota: 0 })

// Dialogs
const confirmDialog = ref(false)
const naoAtendidosDialog = ref(false)
const naoAtendidos = ref([{ cliente: '', motivo: '' }])

const nomesClientes = computed(() =>
  form.value.clientes.map(c => c.nome).filter(n => n?.trim())
)

function ajustarPgLista (novoTotal) {
  const n = Number(novoTotal) || 0
  const atual = form.value.pg_numeros
  form.value.pg_numeros = n > atual.length
    ? [...atual, ...Array(n - atual.length).fill('')]
    : atual.slice(0, n)
}

function iniciarSalvamento () {
  baseRef.value?.validate()
  pepRef.value?.validate()
  notaRef.value?.validate()

  const erros = []

  if (!form.value.base) erros.push('BASE')
  if (!form.value.pep?.trim()) erros.push('PEP')
  if (!form.value.nota?.trim()) erros.push('NOTA')

  const qtdNota = Number(form.value.qtd_clientes_nota) || 0
  if (qtdNota <= 0) erros.push('QTD DE CLIENTES NOTA (deve ser maior que zero)')

  const postes = Number(form.value.postes) || 0
  if (postes <= 0) erros.push('POSTES (deve ser maior que zero)')

  const pgVazios = form.value.pg_numeros.slice(0, postes).some(v => !v?.trim())
  if (pgVazios) erros.push(`todos os Números de PG (${postes} obrigatório${postes > 1 ? 's' : ''})`)

  if (form.value.clientes.length === 0) {
    erros.push('pelo menos um CLIENTE')
  } else {
    const clienteInvalido = form.value.clientes.find(c => !c.nome?.trim() || !c.padrao?.trim())
    if (clienteInvalido) erros.push('Nome e Padrão de todos os clientes')
  }

  if (erros.length > 0) {
    $q.notify({
      type: 'warning',
      message: `Preencha: ${erros.join(', ')}.`,
      timeout: 4000
    })
    return
  }

  naoAtendidos.value = [{ cliente: '', motivo: '' }]
  confirmDialog.value = true
}

function abrirNaoAtendidos () {
  confirmDialog.value = false
  naoAtendidosDialog.value = true
}

function cancelarNaoAtendidos () {
  naoAtendidosDialog.value = false
}

function adicionarNaoAtendido () {
  naoAtendidos.value.push({ cliente: '', motivo: '' })
}

function removerNaoAtendido (i) {
  naoAtendidos.value.splice(i, 1)
}

function filtrarClientes (val, update) {
  update(() => {})
}

async function confirmarESalvar (todosAtendidos) {
  confirmDialog.value = false
  naoAtendidosDialog.value = false

  const naoAtendidosPayload = todosAtendidos
    ? []
    : naoAtendidos.value.filter(n => n.cliente && n.motivo)

  loading.value = true
  const { error } = await store.addApontamento({
    base: form.value.base,
    pep: form.value.pep.trim(),
    nota: form.value.nota.trim(),
    postes: Number(form.value.postes) || 0,
    pg_numeros: form.value.pg_numeros.filter(v => v?.trim()),
    clientes: form.value.clientes.filter(c => c.nome?.trim()),
    todos_atendidos: todosAtendidos,
    nao_atendidos: naoAtendidosPayload,
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
  form.value = { base: '', pep: '', nota: '', postes: 0, pg_numeros: [], clientes: [], qtd_clientes_nota: 0 }
  baseRef.value?.resetValidation()
  pepRef.value?.resetValidation()
  notaRef.value?.resetValidation()
}
</script>
