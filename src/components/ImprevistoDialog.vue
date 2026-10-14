<template>
  <q-dialog :model-value="modelValue" position="bottom" @update:model-value="v => emit('update:modelValue', v)">
    <div class="imp-sheet">
      <div class="imp-title">
        <q-icon name="report_problem" size="22px" />
        Reportar imprevisto
      </div>

      <div class="imp-chips">
        <span class="imp-chip"><span class="imp-chip-label">EQUIPE</span> {{ equipe }}</span>
        <span class="imp-chip"><span class="imp-chip-label">NOTA</span> {{ nota?.projeto_info_sap || nota?.nota }}</span>
        <span v-if="nota?.base" class="imp-chip"><span class="imp-chip-label">BASE</span> {{ nota.base }}</span>
      </div>

      <div class="imp-label">Motivo da não execução <span class="imp-req">*</span></div>
      <div class="imp-motivos">
        <button
          v-for="m in MOTIVOS_IMPREVISTO"
          :key="m"
          type="button"
          class="imp-motivo"
          :class="{ 'imp-motivo--ativo': motivo === m }"
          @click="motivo = m"
        >
          {{ m }}
        </button>
      </div>

      <div class="imp-label">
        Observação <span v-if="motivo === 'Outro'" class="imp-req">*</span>
      </div>
      <textarea
        v-model="observacao"
        class="imp-textarea"
        rows="3"
        maxlength="500"
        :placeholder="motivo === 'Outro' ? 'Descreva o motivo' : 'Detalhes (opcional)'"
      />

      <div v-if="erro" class="imp-erro">{{ erro }}</div>

      <div class="imp-actions">
        <button type="button" class="imp-btn imp-btn--cancel" @click="emit('update:modelValue', false)">Cancelar</button>
        <button type="button" class="imp-btn imp-btn--ok" :disabled="enviando" @click="enviar">
          <q-spinner v-if="enviando" size="18px" />
          <q-icon v-else name="send" size="18px" />
          Enviar
        </button>
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useCampoStore, MOTIVOS_IMPREVISTO } from 'stores/campo'

const props = defineProps({
  modelValue: Boolean,
  equipe: { type: String, default: '' },
  nota: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'enviado'])

const store      = useCampoStore()
const motivo     = ref('')
const observacao = ref('')
const erro       = ref('')
const enviando   = ref(false)

watch(() => props.modelValue, aberto => {
  if (aberto) { motivo.value = ''; observacao.value = ''; erro.value = '' }
})

async function enviar () {
  if (!motivo.value) { erro.value = 'Selecione o motivo.'; return }
  if (motivo.value === 'Outro' && !observacao.value.trim()) { erro.value = 'Descreva o motivo na observação.'; return }
  enviando.value = true
  const { enviado } = await store.reportarImprevisto({
    nota: props.nota.nota,
    base: props.nota.base,
    pep: props.nota.pep,
    equipe: props.equipe,
    motivo: motivo.value,
    observacao: observacao.value.trim()
  })
  enviando.value = false
  emit('update:modelValue', false)
  emit('enviado', { enviado })
}
</script>

<style scoped>
.imp-sheet {
  width: 100%;
  max-width: 520px;
  background: #0e1e35;
  color: #fff;
  border-radius: 20px 20px 0 0;
  padding: 20px 18px calc(18px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.imp-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 800; color: #ffb74d; }
.imp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.imp-chip {
  display: flex; align-items: center; gap: 5px;
  background: rgba(25,118,210,0.18); border: 1px solid rgba(25,118,210,0.3);
  border-radius: 8px; padding: 3px 9px;
  font-size: 12px; color: #90caf9; font-weight: 600;
}
.imp-chip-label { font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; }
.imp-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.5); letter-spacing: 0.08em; text-transform: uppercase; }
.imp-req { color: #ef9a9a; }
.imp-motivos { display: flex; flex-wrap: wrap; gap: 8px; }
.imp-motivo {
  padding: 9px 12px; border-radius: 12px;
  border: 1.5px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.8);
  font-family: inherit; font-size: 13px; font-weight: 600;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.imp-motivo--ativo { border-color: #ff9800; background: rgba(255,152,0,0.18); color: #ffcc80; }
.imp-textarea {
  width: 100%; box-sizing: border-box;
  background: rgba(255,255,255,0.05);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 12px; padding: 10px 12px;
  color: #fff; font-family: inherit; font-size: 14px;
  outline: none; resize: none;
}
.imp-textarea:focus { border-color: #ff9800; }
.imp-erro { font-size: 12px; color: #ef9a9a; }
.imp-actions { display: flex; gap: 10px; margin-top: 4px; }
.imp-btn {
  flex: 1; padding: 14px; border-radius: 14px; border: none;
  font-family: inherit; font-size: 15px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.imp-btn--cancel { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.7); }
.imp-btn--ok { background: linear-gradient(135deg, #e65100, #f57c00); color: #fff; }
.imp-btn--ok:disabled { opacity: 0.7; }
</style>
