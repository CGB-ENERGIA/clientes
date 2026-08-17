<template>
  <div class="campo-root">

    <!-- ── HEADER ─────────────────────────────────────────────── -->
    <header class="cp-header">
      <div class="cp-session">
        <div class="cp-session-tag">{{ store.sessao?.base }}</div>
        <div class="cp-session-info">
          <span v-if="store.sessao?.pep">PEP: <strong>{{ store.sessao.pep }}</strong></span>
          <span v-if="store.sessao?.nota">NOTA: <strong>{{ store.sessao.nota }}</strong></span>
          <span>Equipe: <strong>{{ store.sessao?.equipe }}</strong></span>
        </div>
      </div>

      <div class="cp-header-right">
        <!-- Status online/offline -->
        <div class="cp-online" :class="store.online ? 'cp-online--ok' : 'cp-online--off'">
          <span class="cp-online-dot" />
          {{ store.online ? 'Online' : 'Offline' }}
        </div>
        <!-- Fila pendente -->
        <div v-if="store.fila.length > 0" class="cp-badge">
          <q-icon name="sync" size="14px" :class="{ 'spin': store.sincronizando }" />
          {{ store.fila.length }}
        </div>
        <!-- Encerrar -->
        <button class="cp-exit" @click="encerrar">
          <q-icon name="logout" size="20px" />
        </button>
      </div>
    </header>

    <!-- ── ÁREA DE REGISTRO ───────────────────────────────────── -->
    <main class="cp-main">

      <!-- CARD de novo registro -->
      <div class="cp-card" v-if="!fotoPreview">

        <h2 class="cp-card-title">Registrar Poste</h2>

        <!-- PG input -->
        <div class="cp-pg-wrap">
          <label class="cp-pg-label">Número do PG</label>
          <input
            v-model="pg"
            class="cp-pg-input"
            placeholder="Ex: PG-0001"
            type="text"
            inputmode="text"
            maxlength="20"
            @keyup.enter="abrirCamera"
          />
        </div>

        <!-- Botão câmera (grande, toque fácil) -->
        <button class="cp-camera-btn" @click="abrirCamera" :disabled="!pg.trim()">
          <div class="cp-camera-icon">
            <q-icon name="photo_camera" size="40px" />
          </div>
          <span>{{ pg.trim() ? 'Tirar Foto do Poste' : 'Digite o PG primeiro' }}</span>
        </button>

        <!-- Input file oculto (abre câmera nativa) -->
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden-input"
          @change="onFotoCapturada"
        />

      </div>

      <!-- PREVIEW da foto -->
      <div class="cp-preview-card" v-else>
        <div class="cp-preview-pg">PG: <strong>{{ pg }}</strong></div>
        <img :src="fotoPreview" class="cp-preview-img" alt="foto do poste" />
        <div class="cp-preview-actions">
          <button class="cp-btn-refazer" @click="refazerFoto">
            <q-icon name="replay" size="20px" /> Refazer
          </button>
          <button class="cp-btn-salvar" @click="salvar" :disabled="salvando">
            <q-circular-progress v-if="salvando" indeterminate size="20px" color="white" />
            <q-icon v-else name="check_circle" size="20px" />
            {{ salvando ? 'Salvando…' : 'Salvar' }}
          </button>
        </div>
      </div>

    </main>

    <!-- ── LISTA DE REGISTROS ─────────────────────────────────── -->
    <section class="cp-list" v-if="store.registros.length > 0">
      <div class="cp-list-header">
        <span>Registros desta sessão</span>
        <span class="cp-list-count">{{ store.registros.length }}</span>
      </div>

      <div class="cp-list-scroll">
        <div
          v-for="reg in store.registros"
          :key="reg.id"
          class="cp-reg-item"
        >
          <img
            v-if="reg.foto_b64 || reg.foto_url"
            :src="reg.foto_url || reg.foto_b64"
            class="cp-reg-thumb"
            alt=""
          />
          <div class="cp-reg-thumb cp-reg-thumb--empty" v-else>
            <q-icon name="image_not_supported" size="20px" />
          </div>

          <div class="cp-reg-info">
            <div class="cp-reg-pg">{{ reg.pg_numero }}</div>
            <div class="cp-reg-time">{{ formatarHora(reg.created_at) }}</div>
          </div>

          <div class="cp-reg-status" :class="reg.sync ? 'cp-reg-status--ok' : 'cp-reg-status--pend'">
            <q-icon :name="reg.sync ? 'cloud_done' : 'cloud_upload'" size="18px" />
          </div>
        </div>
      </div>
    </section>

    <!-- Empty state -->
    <div class="cp-empty" v-else>
      <q-icon name="camera_alt" size="48px" class="cp-empty-icon" />
      <p>Nenhum registro nesta sessão.<br />Cadastre o primeiro poste acima.</p>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useCampoStore } from 'stores/campo'

const router  = useRouter()
const $q      = useQuasar()
const store   = useCampoStore()

if (!store.sessao) router.replace('/campo')

const pg          = ref('')
const fotoPreview = ref(null)
const fotoB64     = ref(null)
const fotoMime    = ref('image/jpeg')
const salvando    = ref(false)
const fileInput   = ref(null)

function abrirCamera () {
  if (!pg.value.trim()) return
  fileInput.value?.click()
}

function onFotoCapturada (e) {
  const file = e.target.files?.[0]
  if (!file) return
  fotoMime.value = file.type || 'image/jpeg'

  // Redimensiona para max 1280px antes de armazenar (economiza espaço offline)
  const reader = new FileReader()
  reader.onload = ev => {
    const img = new Image()
    img.onload = () => {
      const MAX = 1280
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else       { w = Math.round(w * MAX / h); h = MAX }
      }
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      const b64 = c.toDataURL('image/jpeg', 0.82)
      fotoB64.value    = b64
      fotoPreview.value = b64
    }
    img.src = ev.target.result
  }
  reader.readAsDataURL(file)
  // Limpa o input para permitir repetir a mesma foto
  e.target.value = ''
}

function refazerFoto () {
  fotoPreview.value = null
  fotoB64.value     = null
  fileInput.value?.click()
}

async function salvar () {
  if (!pg.value.trim() || !fotoB64.value) return
  salvando.value = true
  try {
    await store.salvarRegistro({
      pg: pg.value.trim(),
      fotoB64: fotoB64.value,
      fotoMime: fotoMime.value
    })
    $q.notify({ type: 'positive', message: `PG ${pg.value} salvo!`, position: 'top', timeout: 1800 })
    pg.value = ''
    fotoPreview.value = null
    fotoB64.value = null
  } finally {
    salvando.value = false
  }
}

function encerrar () {
  $q.dialog({
    title: 'Encerrar turno?',
    message: 'Você será redirecionado para a tela inicial.',
    cancel: true, ok: 'Encerrar', color: 'negative'
  }).onOk(() => {
    store.encerrarSessao()
    router.push('/campo')
  })
}

function formatarHora (iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
/* ── Root ── */
.campo-root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #060d1a;
  color: #fff;
  font-family: inherit;
  max-width: 520px;
  margin: 0 auto;
}

/* ── Header ── */
.cp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #0a1628;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  gap: 10px;
  flex-shrink: 0;
}
.cp-session { flex: 1; min-width: 0; }
.cp-session-tag {
  display: inline-block;
  font-size: 10px; font-weight: 800;
  color: #ffca28; letter-spacing: 0.1em; text-transform: uppercase;
  background: rgba(255,202,40,0.12);
  border: 1px solid rgba(255,202,40,0.25);
  border-radius: 6px; padding: 2px 8px;
  margin-bottom: 4px;
}
.cp-session-info {
  display: flex; flex-wrap: wrap; gap: 6px 12px;
  font-size: 11px; color: rgba(255,255,255,0.5);
}
.cp-session-info strong { color: rgba(255,255,255,0.85); }

.cp-header-right {
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
}

.cp-online {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
  border-radius: 20px; padding: 4px 10px;
}
.cp-online--ok  { background: rgba(0,200,83,0.15); color: #00c853; }
.cp-online--off { background: rgba(239,83,80,0.15); color: #ef5350; }
.cp-online-dot  { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

.cp-badge {
  display: flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 700;
  background: rgba(255,152,0,0.2); color: #ff9800;
  border-radius: 20px; padding: 3px 8px;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.cp-exit {
  border: none; background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.5);
  border-radius: 10px; padding: 8px;
  cursor: pointer; display: flex; align-items: center;
  transition: background 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.cp-exit:active { background: rgba(255,255,255,0.14); }

/* ── Main ── */
.cp-main {
  padding: 20px 16px;
  flex-shrink: 0;
}

/* Novo registro card */
.cp-card {
  background: #0e1e35;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 24px 20px;
  display: flex; flex-direction: column; gap: 20px;
}
.cp-card-title {
  font-size: 18px; font-weight: 800;
  color: #fff; margin: 0;
}

.cp-pg-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; text-transform: uppercase; }
.cp-pg-wrap  { display: flex; flex-direction: column; gap: 8px; }
.cp-pg-input {
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 2px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  color: #fff; font-size: 22px; font-weight: 700;
  padding: 14px 18px;
  outline: none; font-family: inherit;
  letter-spacing: 1px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.cp-pg-input::placeholder { color: rgba(255,255,255,0.2); font-weight: 400; font-size: 16px; }
.cp-pg-input:focus { border-color: #1976d2; box-shadow: 0 0 0 3px rgba(25,118,210,0.18); }

/* Botão câmera */
.cp-camera-btn {
  width: 100%;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 28px 20px;
  border-radius: 18px; border: 2px dashed rgba(25,118,210,0.4);
  background: rgba(25,118,210,0.07);
  color: #1976d2;
  cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 600;
  transition: background 0.2s, border-color 0.2s, transform 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.cp-camera-btn:disabled {
  color: rgba(255,255,255,0.2);
  border-color: rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.03);
  cursor: not-allowed;
}
.cp-camera-btn:not(:disabled):active {
  transform: scale(0.97);
  background: rgba(25,118,210,0.15);
}
.cp-camera-icon {
  width: 72px; height: 72px; border-radius: 50%;
  background: rgba(25,118,210,0.15);
  display: flex; align-items: center; justify-content: center;
}

.hidden-input { display: none; }

/* Preview da foto */
.cp-preview-card {
  background: #0e1e35;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 20px;
  display: flex; flex-direction: column; gap: 16px;
}
.cp-preview-pg {
  font-size: 13px; color: rgba(255,255,255,0.5);
}
.cp-preview-pg strong { color: #fff; font-size: 18px; }
.cp-preview-img {
  width: 100%; border-radius: 14px; object-fit: cover;
  max-height: 300px;
  background: #0a1628;
}
.cp-preview-actions { display: flex; gap: 12px; }

.cp-btn-refazer, .cp-btn-salvar {
  flex: 1; padding: 16px;
  border-radius: 14px; border: none;
  font-family: inherit; font-size: 15px; font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.12s;
}
.cp-btn-refazer:active, .cp-btn-salvar:active { transform: scale(0.96); }

.cp-btn-refazer {
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.7);
}
.cp-btn-salvar {
  background: linear-gradient(135deg, #1b5e20, #2e7d32);
  color: #fff;
  box-shadow: 0 4px 20px rgba(46,125,50,0.4);
}
.cp-btn-salvar:disabled { opacity: 0.7; cursor: not-allowed; }

/* ── Lista de registros ── */
.cp-list {
  flex: 1;
  padding: 0 16px 24px;
}
.cp-list-header {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.4);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin-bottom: 12px;
}
.cp-list-count {
  background: rgba(255,255,255,0.1);
  border-radius: 20px; padding: 2px 10px;
  font-size: 12px; color: rgba(255,255,255,0.6);
}

.cp-list-scroll {
  display: flex; flex-direction: column; gap: 10px;
}

.cp-reg-item {
  display: flex; align-items: center; gap: 12px;
  background: #0e1e35;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 12px 14px;
}
.cp-reg-thumb {
  width: 52px; height: 52px; border-radius: 10px;
  object-fit: cover; flex-shrink: 0;
  background: rgba(255,255,255,0.05);
}
.cp-reg-thumb--empty {
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.2);
}
.cp-reg-info { flex: 1; min-width: 0; }
.cp-reg-pg   { font-size: 16px; font-weight: 700; color: #fff; }
.cp-reg-time { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }

.cp-reg-status { flex-shrink: 0; }
.cp-reg-status--ok   { color: #00c853; }
.cp-reg-status--pend { color: #ff9800; }

/* ── Empty ── */
.cp-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; padding: 40px 20px;
  color: rgba(255,255,255,0.25); text-align: center; font-size: 13px;
}
.cp-empty-icon { color: rgba(255,255,255,0.12); }
</style>
