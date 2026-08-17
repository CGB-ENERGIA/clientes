<template>
  <div>
    <div
      v-for="(cliente, i) in modelValue"
      :key="i"
      class="row q-col-gutter-sm q-mb-sm items-center"
    >
      <div class="col-12 col-sm-4">
        <q-input
          :model-value="cliente.nome"
          label="Nome do Cliente"
          outlined
          dense
          @update:model-value="val => update(i, 'nome', val)"
        />
      </div>
      <div class="col-12 col-sm-3">
        <q-select
          :model-value="cliente.padrao"
          :options="padraoOptions"
          label="Padrão"
          outlined
          dense
          emit-value
          map-options
          clearable
          @update:model-value="val => update(i, 'padrao', val)"
        />
      </div>
      <div class="col-12 col-sm-4">
        <q-input
          :model-value="cliente.conta_contrato"
          label="Conta Contrato / CPF (opcional)"
          outlined
          dense
          @update:model-value="val => update(i, 'conta_contrato', val)"
        />
      </div>
      <div class="col-auto">
        <q-btn icon="delete" color="negative" flat round dense @click="remover(i)" />
      </div>
    </div>

    <q-btn label="Adicionar Cliente" icon="add" color="secondary" flat dense @click="adicionar" />
  </div>
</template>

<script setup>
const padraoOptions = ['PP', '5 M', '7 M']

const props = defineProps({
  modelValue: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue'])

function adicionar () {
  emit('update:modelValue', [
    ...props.modelValue,
    { nome: '', padrao: '', conta_contrato: '' }
  ])
}

function remover (index) {
  const list = [...props.modelValue]
  list.splice(index, 1)
  emit('update:modelValue', list)
}

function update (index, field, val) {
  const list = props.modelValue.map((c, i) =>
    i === index ? { ...c, [field]: val ?? '' } : c
  )
  emit('update:modelValue', list)
}
</script>
