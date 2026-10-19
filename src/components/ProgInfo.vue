<template>
  <q-btn
    flat round dense size="xs" icon="info" color="grey-6" class="prog-info"
    :aria-label="`Explicação: ${titulo}`"
    @click.stop
  >
    <q-popup-proxy anchor="bottom middle" self="top middle" :breakpoint="0">
      <div class="prog-info-box">
        <div class="prog-info-titulo">{{ titulo }}</div>
        <div v-if="texto" class="prog-info-texto">{{ texto }}</div>
        <div v-for="[rotulo, desc] in itens" :key="rotulo" class="prog-info-item">
          <b>{{ rotulo }}</b> {{ desc }}
        </div>
      </div>
    </q-popup-proxy>
  </q-btn>
</template>

<script setup>
defineProps({
  titulo: { type: String, required: true },
  texto: { type: String, default: '' },
  itens: { type: Array, default: () => [] }
})
</script>

<style scoped>
.prog-info { vertical-align: middle; margin-left: 2px; }
.prog-info-box { padding: 12px 14px; max-width: 300px; font-size: 12.5px; line-height: 1.45; }
.prog-info-titulo { font-weight: 800; font-size: 13px; margin-bottom: 6px; }
.prog-info-texto { color: #475569; margin-bottom: 6px; }
.prog-info-item { margin-top: 4px; color: #334155; }
.prog-info-item b { color: #0f172a; }
.body--dark .prog-info-texto, .body--dark .prog-info-item { color: #cbd5e1; }
</style>
