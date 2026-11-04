<template>
  <div ref="raiz" class="sel" :class="{ 'sel--aberto': aberto, 'sel--erro': erro, 'sel--cheio': !!modelValue }">
    <button
      type="button" class="sel-gatilho" aria-haspopup="listbox" :aria-expanded="aberto"
      :disabled="disabled" @click="alternar" @keydown="teclado"
    >
      <q-icon v-if="icone" :name="icone" size="20px" class="sel-icone" />
      <span class="sel-texto" :class="{ 'sel-texto--vazio': !modelValue }">{{ modelValue || placeholder }}</span>
      <q-icon name="expand_more" size="20px" class="sel-seta" />
    </button>

    <transition name="sel-fade">
      <ul v-if="aberto" class="sel-lista" role="listbox">
        <li
          v-for="(o, i) in itens" :key="o.valor || '_vazio'"
          class="sel-op" role="option"
          :class="{ 'sel-op--ativo': i === destaque, 'sel-op--marcado': o.valor === modelValue, 'sel-op--limpar': !o.valor }"
          :aria-selected="o.valor === modelValue"
          @mouseenter="destaque = i" @click="escolher(o.valor)"
        >
          <span>{{ o.rotulo }}</span>
          <q-icon v-if="o.valor && o.valor === modelValue" name="check" size="18px" />
        </li>
      </ul>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  opcoes: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Escolha' },
  icone: { type: String, default: '' },
  erro: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'change'])

const raiz = ref(null)
const aberto = ref(false)
const destaque = ref(-1)

// Primeira linha limpa a escolha (mostra o texto do placeholder)
const itens = computed(() => [{ valor: '', rotulo: props.placeholder }, ...props.opcoes.map(o => ({ valor: o, rotulo: o }))])

function abrir () {
  aberto.value = true
  destaque.value = Math.max(itens.value.findIndex(o => o.valor === props.modelValue), 0)
  nextTick(() => raiz.value?.querySelector('.sel-op--ativo')?.scrollIntoView({ block: 'nearest' }))
}
function fechar () { aberto.value = false }
function alternar () { aberto.value ? fechar() : abrir() }

function escolher (v) {
  fechar()
  if (v === props.modelValue) return
  emit('update:modelValue', v)
  emit('change', v)
}

function teclado (e) {
  if (e.key === 'Escape') { fechar(); return }
  if (!aberto.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir() }
    return
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); destaque.value = Math.min(destaque.value + 1, itens.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); destaque.value = Math.max(destaque.value - 1, 0) }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(itens.value[destaque.value]?.valor ?? '') }
  else if (e.key === 'Tab') fechar()
  nextTick(() => raiz.value?.querySelector('.sel-op--ativo')?.scrollIntoView({ block: 'nearest' }))
}

function foraDoSeletor (e) {
  if (aberto.value && raiz.value && !raiz.value.contains(e.target)) fechar()
}
onMounted(() => document.addEventListener('pointerdown', foraDoSeletor))
onBeforeUnmount(() => document.removeEventListener('pointerdown', foraDoSeletor))
</script>

<style scoped>
.sel { position: relative; width: 100%; }
.sel-gatilho {
  width: 100%; display: flex; align-items: center; gap: 10px; box-sizing: border-box;
  background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.12); border-radius: 14px;
  color: #fff; font: inherit; font-size: 15px; padding: 14px 16px; cursor: pointer; text-align: left;
  transition: border-color .2s, box-shadow .2s;
}
.sel-gatilho:focus-visible, .sel--aberto .sel-gatilho { outline: none; border-color: #1976d2; box-shadow: 0 0 0 3px rgba(25,118,210,0.18); }
.sel--erro .sel-gatilho { border-color: #c62828; }
.sel-gatilho:disabled { opacity: .55; cursor: not-allowed; }
.sel-icone { color: rgba(255,255,255,0.35); flex-shrink: 0; }
.sel-texto { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.sel-texto--vazio { color: rgba(255,255,255,0.4); font-weight: 400; }
.sel-seta { margin-left: auto; color: rgba(255,255,255,0.35); transition: transform .2s; flex-shrink: 0; }
.sel--aberto .sel-seta { transform: rotate(180deg); color: #64b5f6; }

.sel-lista {
  position: absolute; z-index: 50; left: 0; right: 0; top: calc(100% + 6px);
  margin: 0; padding: 6px; list-style: none; max-height: 260px; overflow-y: auto;
  background: #0f1d33; border: 1px solid rgba(100,181,246,0.25); border-radius: 14px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.55);
}
.sel-op {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 12px 12px; border-radius: 10px; font-size: 15px; color: rgba(255,255,255,0.88); cursor: pointer;
}
.sel-op--limpar { color: rgba(255,255,255,0.4); font-size: 13.5px; }
.sel-op--ativo { background: rgba(25,118,210,0.22); color: #fff; }
.sel-op--marcado { color: #64b5f6; font-weight: 700; }

.sel-fade-enter-active, .sel-fade-leave-active { transition: opacity .15s, transform .15s; }
.sel-fade-enter-from, .sel-fade-leave-to { opacity: 0; transform: translateY(-4px); }
@media (prefers-reduced-motion: reduce) { .sel-fade-enter-active, .sel-fade-leave-active, .sel-seta { transition: none; } }
</style>
