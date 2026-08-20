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

      <!-- EQUIPE -->
      <div class="cl-field">
        <label class="cl-label">Nome da equipe <span class="cl-req">*</span></label>
        <div class="cl-input-wrap" :class="{ 'cl-input-wrap--err': erros.equipe }">
          <q-icon name="groups" size="20px" class="cl-icon" />
          <input
            v-model="form.equipe"
            class="cl-input"
            placeholder="EX: EQUIPE ALPHA"
            style="text-transform:uppercase"
            @input="form.equipe = form.equipe.toUpperCase()"
          />
        </div>
        <span v-if="erros.equipe" class="cl-err">{{ erros.equipe }}</span>
      </div>

      <!-- NOTA -->
      <div class="cl-field">
        <label class="cl-label">Nota de serviço <span class="cl-req">*</span></label>

        <!-- Loading -->
        <div v-if="carregando" class="cl-input-wrap">
          <q-icon name="hourglass_empty" size="20px" class="cl-icon" />
          <span class="cl-input" style="color:rgba(255,255,255,0.35)">Carregando notas...</span>
        </div>

        <!-- Sem notas no cache -->
        <div v-else-if="notas.length === 0" class="cl-sem-notas">
          <q-icon name="warning_amber" size="18px" />
          Nenhuma nota disponível offline. Conecte-se para carregar.
          <button class="cl-btn-mini" @click="recarregar">Tentar novamente</button>
        </div>

        <!-- Faixa de status de sync -->
        <div v-if="!carregando && notas.length > 0" class="cl-sync-bar">
          <div v-if="sincronizando" class="cl-sync-bar--loading">
            <q-spinner size="11px" /> Atualizando notas…
          </div>
          <div v-else class="cl-sync-bar--ok">
            <q-icon name="cloud_done" size="13px" />
            {{ notas.length }} notas · sincronizado {{ ultimoSync }}
          </div>
        </div>

        <!-- Busca com autocomplete -->
        <template v-else>
          <div class="cl-autocomplete" ref="autocompleteRef">
            <div class="cl-input-wrap" :class="{ 'cl-input-wrap--err': erros.nota }">
              <q-icon name="search" size="20px" class="cl-icon" />
              <input
                v-model="buscaNota"
                class="cl-input"
                placeholder="Digite nota ou PEP..."
                autocomplete="off"
                @input="onBusca"
                @focus="dropdownAberto = true"
                @blur="onBlur"
                @keydown.down.prevent="moverSelecao(1)"
                @keydown.up.prevent="moverSelecao(-1)"
                @keydown.enter.prevent="selecionarDestacado"
                @keydown.escape="fecharDropdown"
              />
              <q-icon v-if="buscaNota" name="close" size="16px" class="cl-clear" @mousedown.prevent="limparBusca" />
            </div>
            <!-- Lista de sugestões -->
            <div v-if="dropdownAberto && notasFiltradas.length" class="cl-dropdown">
              <div
                v-for="(n, idx) in notasFiltradas"
                :key="n.nota"
                class="cl-dropdown-item"
                :class="{ 'cl-dropdown-item--active': idx === itemDestacado }"
                @mousedown.prevent="selecionarNota(n)"
              >
                <span class="cl-di-nota">{{ n.projeto_info_sap || n.nota }}</span>
                <span class="cl-di-sep">—</span>
                <span class="cl-di-base">{{ n.base }}</span>
                <span class="cl-di-pep">{{ n.pep }}</span>
              </div>
            </div>
            <div v-else-if="dropdownAberto && buscaNota && !notasFiltradas.length" class="cl-dropdown">
              <div class="cl-dropdown-empty">Nenhuma nota encontrada</div>
            </div>
          </div>
          <span v-if="erros.nota" class="cl-err">{{ erros.nota }}</span>
        </template>

        <!-- Chips info do projeto selecionado -->
        <div v-if="notaInfo" class="cl-nota-info">
          <span class="cl-chip"><span class="cl-chip-label">SAP</span> {{ notaInfo.projeto_info_sap || notaInfo.nota }}</span>
          <span class="cl-chip"><span class="cl-chip-label">BASE</span> {{ notaInfo.base }}</span>
          <span class="cl-chip"><span class="cl-chip-label">PEP</span> {{ notaInfo.pep }}</span>
          <span class="cl-chip"><span class="cl-chip-label">NOTAS</span> {{ notaInfo.postes }}</span>
        </div>
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
import { reactive, ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCampoStore } from 'stores/campo'
import { useNotasStore } from 'stores/notas'

const router     = useRouter()
const store      = useCampoStore()
const notasStore = useNotasStore()
const ano        = new Date().getFullYear()
const carregando = ref(false)

const form  = reactive({ equipe: '', nota: '' })
const erros = reactive({ equipe: '', nota: '' })

const notas       = computed(() => notasStore.notas)
const notaInfo    = computed(() => notasStore.getNota(form.nota))
const sincronizando = ref(false)
const ultimoSync    = ref('')
let   syncInterval  = null

function formatarSyncTime (d) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── Autocomplete ──────────────────────────────────────────────────
const buscaNota      = ref('')
const dropdownAberto = ref(false)
const itemDestacado  = ref(-1)
const autocompleteRef = ref(null)

const notasFiltradas = computed(() => {
  const q = buscaNota.value.trim().toLowerCase()
  if (!q) return notas.value.slice(0, 20)
  return notas.value.filter(n =>
    n.nota.includes(q) ||
    (n.pep  && n.pep.toLowerCase().includes(q)) ||
    (n.base && n.base.toLowerCase().includes(q))
  ).slice(0, 30)
})

function onBusca () {
  form.nota = ''
  dropdownAberto.value = true
  itemDestacado.value = -1
}

function selecionarNota (n) {
  form.nota    = n.nota
  buscaNota.value = `${n.projeto_info_sap || n.nota} — ${n.base}`
  dropdownAberto.value = false
  itemDestacado.value  = -1
  erros.nota = ''
}

function moverSelecao (dir) {
  if (!dropdownAberto.value) { dropdownAberto.value = true; return }
  const max = notasFiltradas.value.length - 1
  itemDestacado.value = Math.min(Math.max(itemDestacado.value + dir, 0), max)
}

function selecionarDestacado () {
  if (itemDestacado.value >= 0 && notasFiltradas.value[itemDestacado.value]) {
    selecionarNota(notasFiltradas.value[itemDestacado.value])
  }
}

function fecharDropdown () {
  dropdownAberto.value = false
  itemDestacado.value  = -1
}

function onBlur () {
  setTimeout(fecharDropdown, 150)
}

function limparBusca () {
  buscaNota.value = ''
  form.nota = ''
  dropdownAberto.value = true
  itemDestacado.value  = -1
}

function validar () {
  erros.equipe = form.equipe.trim() ? '' : 'Informe o nome da equipe'
  erros.nota   = form.nota          ? '' : 'Selecione uma nota de serviço'
  return !erros.equipe && !erros.nota
}

function iniciar () {
  if (!validar()) return
  const n = notaInfo.value
  store.iniciarSessao({
    equipe: form.equipe.trim().toUpperCase(),
    nota:   form.nota,
    base:   n?.base  ?? '',
    pep:    n?.pep   ?? '',
    postes: n?.postes ?? 0
  })
  router.push('/campo/registro')
}

async function sincronizarNotas (silencioso = false) {
  if (!navigator.onLine) return
  if (!silencioso) carregando.value = notas.value.length === 0
  sincronizando.value = true
  await notasStore.fetchNotas()
  sincronizando.value = false
  carregando.value    = false
  ultimoSync.value    = formatarSyncTime(new Date())
}

async function recarregar () {
  await sincronizarNotas(false)
}

onMounted(async () => {
  if (store.sessao) { router.replace('/campo/registro'); return }
  // Sempre sincroniza quando online (mostra cache enquanto carrega)
  await sincronizarNotas(notas.value.length > 0)
  // Atualiza a cada 2 minutos enquanto a tela estiver aberta
  syncInterval = setInterval(() => sincronizarNotas(true), 120_000)
})

onUnmounted(() => {
  if (syncInterval) clearInterval(syncInterval)
})
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
  padding: 40px 0 28px;
  gap: 6px;
}
.cl-logo {
  height: 52px; width: auto; object-fit: contain;
  filter: drop-shadow(0 4px 16px rgba(255,202,40,0.3));
  margin-bottom: 10px;
}
.cl-brand { font-size: 26px; font-weight: 900; color: #fff; letter-spacing: 1px; }
.cl-brand span { color: #ffca28; }
.cl-sub { font-size: 12px; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; margin: 0; }

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
.cl-input-wrap--err, .cl-select-wrap--err { border-color: #c62828 !important; }
.cl-select-wrap { position: relative; }

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
  appearance: none; -webkit-appearance: none; cursor: pointer;
}
.cl-select option { background: #0a1628; color: #fff; }

.cl-err { font-size: 11px; color: #ef9a9a; padding-left: 4px; }

/* ── Faixa de sync ── */
.cl-sync-bar {
  margin-top: -2px;
  font-size: 11px;
  display: flex;
  align-items: center;
}
.cl-sync-bar--loading {
  display: flex; align-items: center; gap: 5px;
  color: rgba(255,255,255,0.4);
}
.cl-sync-bar--ok {
  display: flex; align-items: center; gap: 5px;
  color: rgba(0,200,83,0.7);
}

/* ── Autocomplete ── */
.cl-autocomplete { position: relative; }

.cl-clear {
  color: rgba(255,255,255,0.3);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s;
}
.cl-clear:hover { color: rgba(255,255,255,0.7); }

.cl-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0; right: 0;
  background: #0f1e35;
  border: 1.5px solid rgba(25,118,210,0.35);
  border-radius: 14px;
  max-height: 240px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.cl-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.12s;
}
.cl-dropdown-item:last-child { border-bottom: none; }
.cl-dropdown-item:hover,
.cl-dropdown-item--active { background: rgba(25,118,210,0.18); }

.cl-di-nota { font-size: 15px; font-weight: 700; color: #fff; min-width: 52px; }
.cl-di-sep  { color: rgba(255,255,255,0.25); }
.cl-di-base { font-size: 13px; color: rgba(255,255,255,0.65); flex: 1; }
.cl-di-pep  { font-size: 11px; color: #64b5f6; font-weight: 600; white-space: nowrap; }

.cl-dropdown-empty {
  padding: 16px;
  text-align: center;
  color: rgba(255,255,255,0.35);
  font-size: 13px;
}

/* ── Info da nota ── */
.cl-nota-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}
.cl-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(25,118,210,0.18);
  border: 1px solid rgba(25,118,210,0.3);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 13px;
  color: #90caf9;
  font-weight: 600;
}
.cl-chip-label {
  font-size: 9px;
  font-weight: 800;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* ── Sem notas ── */
.cl-sem-notas {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: rgba(255,160,0,0.08);
  border: 1px solid rgba(255,160,0,0.2);
  border-radius: 14px;
  color: #ffb74d;
  font-size: 13px;
  text-align: center;
}
.cl-btn-mini {
  padding: 6px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255,183,77,0.4);
  background: transparent;
  color: #ffb74d;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  margin-top: 4px;
}

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
