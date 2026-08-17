<template>
  <div class="campo-login">

    <!-- Cabeçalho -->
    <div class="cl-header">
      <img src="/logo.ico" class="cl-logo" alt="CGB" />
      <div class="cl-brand">CGB <span>Campo</span></div>
      <p class="cl-sub">Registro de postes em campo</p>
    </div>

    <!-- Formulário -->
    <div class="cl-form">

      <!-- BASE -->
      <div class="cl-field">
        <label class="cl-label">Base de operação</label>
        <div class="cl-select-wrap" :class="{ 'cl-select-wrap--err': erros.base }">
          <q-icon name="location_on" size="20px" class="cl-icon" />
          <select v-model="form.base" class="cl-select">
            <option value="" disabled>Selecione a base</option>
            <option v-for="b in BASES" :key="b" :value="b">{{ b }}</option>
          </select>
          <q-icon name="expand_more" size="18px" class="cl-chevron" />
        </div>
        <span v-if="erros.base" class="cl-err">{{ erros.base }}</span>
      </div>

      <!-- PEP -->
      <div class="cl-field">
        <label class="cl-label">PEP</label>
        <div class="cl-input-wrap">
          <q-icon name="tag" size="20px" class="cl-icon" />
          <input v-model="form.pep" class="cl-input" placeholder="Ex: P-2024-001" />
        </div>
      </div>

      <!-- NOTA -->
      <div class="cl-field">
        <label class="cl-label">Nota de serviço</label>
        <div class="cl-input-wrap">
          <q-icon name="description" size="20px" class="cl-icon" />
          <input v-model="form.nota" class="cl-input" placeholder="Ex: NS-00123" />
        </div>
      </div>

      <!-- EQUIPE -->
      <div class="cl-field">
        <label class="cl-label">Nome da equipe <span class="cl-req">*</span></label>
        <div class="cl-input-wrap" :class="{ 'cl-input-wrap--err': erros.equipe }">
          <q-icon name="groups" size="20px" class="cl-icon" />
          <input v-model="form.equipe" class="cl-input" placeholder="Ex: Equipe Alpha" />
        </div>
        <span v-if="erros.equipe" class="cl-err">{{ erros.equipe }}</span>
      </div>

      <!-- Botão -->
      <button class="cl-btn" @click="iniciar">
        <q-icon name="play_arrow" size="22px" />
        Iniciar Turno
      </button>

    </div>

    <!-- Rodapé -->
    <div class="cl-footer">© {{ ano }} CGB Energia</div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCampoStore } from 'stores/campo'

const router = useRouter()
const store  = useCampoStore()
const ano    = new Date().getFullYear()

const BASES = ['BACABAL','ITAPECURU MIRIM','SANTA INÊS','PEDREIRAS','PRESIDENTE DUTRA','BARRA DO CORDA']

const form = reactive({ base: '', pep: '', nota: '', equipe: '' })
const erros = reactive({ base: '', equipe: '' })

function validar () {
  erros.base   = form.base   ? '' : 'Selecione a base'
  erros.equipe = form.equipe ? '' : 'Informe o nome da equipe'
  return !erros.base && !erros.equipe
}

function iniciar () {
  if (!validar()) return
  store.iniciarSessao({ ...form })
  router.push('/campo/registro')
}

// Se já tem sessão ativa, vai direto
if (store.sessao) router.replace('/campo/registro')
</script>

<style scoped>
.campo-login {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, #060b14 0%, #0a1628 60%, #060b14 100%);
  padding: 0 20px;
  overflow-y: auto;
}

/* ── Header ── */
.cl-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 0 32px;
  gap: 6px;
}
.cl-logo {
  height: 52px; width: auto; object-fit: contain;
  filter: drop-shadow(0 4px 16px rgba(255,202,40,0.3));
  margin-bottom: 10px;
}
.cl-brand {
  font-size: 26px; font-weight: 900; color: #fff; letter-spacing: 1px;
}
.cl-brand span { color: #ffca28; }
.cl-sub {
  font-size: 12px; color: rgba(255,255,255,0.4);
  letter-spacing: 0.08em; margin: 0;
}

/* ── Form ── */
.cl-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 440px;
  width: 100%;
  margin: 0 auto;
}

.cl-field { display: flex; flex-direction: column; gap: 7px; }
.cl-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.5); letter-spacing: 0.08em; text-transform: uppercase; }
.cl-req   { color: #ef9a9a; }

.cl-input-wrap, .cl-select-wrap {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,0.05);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  padding: 0 16px;
  transition: border-color 0.2s;
}
.cl-input-wrap:focus-within  { border-color: #1976d2; box-shadow: 0 0 0 3px rgba(25,118,210,0.15); }
.cl-input-wrap--err          { border-color: #c62828 !important; }
.cl-select-wrap              { position: relative; }
.cl-select-wrap--err         { border-color: #c62828; }

.cl-icon    { color: rgba(255,255,255,0.3); flex-shrink: 0; }
.cl-chevron { color: rgba(255,255,255,0.3); margin-left: auto; flex-shrink: 0; pointer-events: none; }

.cl-input {
  flex: 1; border: none; background: transparent;
  color: #fff; font-size: 15px; padding: 15px 0;
  outline: none; font-family: inherit;
}
.cl-input::placeholder { color: rgba(255,255,255,0.2); }

.cl-select {
  flex: 1; border: none; background: transparent;
  color: #fff; font-size: 15px; padding: 15px 0;
  outline: none; font-family: inherit;
  appearance: none; -webkit-appearance: none;
  cursor: pointer;
}
.cl-select option { background: #0a1628; color: #fff; }

.cl-err { font-size: 11px; color: #ef9a9a; padding-left: 4px; }

/* ── Botão ── */
.cl-btn {
  margin-top: 8px;
  width: 100%; padding: 18px;
  border-radius: 16px; border: none;
  background: linear-gradient(135deg, #1565c0, #1976d2);
  color: #fff; font-size: 17px; font-weight: 800;
  font-family: inherit; letter-spacing: 0.5px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  box-shadow: 0 6px 28px rgba(21,101,192,0.45);
  transition: transform 0.15s, box-shadow 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.cl-btn:active { transform: scale(0.97); box-shadow: 0 2px 12px rgba(21,101,192,0.3); }

/* ── Footer ── */
.cl-footer {
  padding: 24px;
  text-align: center;
  font-size: 11px;
  color: rgba(255,255,255,0.15);
}
</style>
