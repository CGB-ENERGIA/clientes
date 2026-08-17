<template>
  <div class="login-root">

    <!-- Wrapper garante que o canvas cobre toda a tela -->
    <div class="map-wrap">
      <MapBackground />
    </div>
    <!-- Overlay escuro geral -->
    <div class="global-overlay" />

    <!-- PAINEL ESQUERDO -->
    <div class="left-panel">
      <!-- Vinheta lateral -->
      <div class="vignette" />

      <!-- Conteúdo esquerdo -->
      <div class="left-content">
        <h1 class="left-title">CONTROLE DE<br /><span>CLIENTES</span></h1>
        <p class="left-desc">Gestão inteligente de apontamentos e atendimento de clientes para a equipe de campo.</p>

        <div class="left-stats">
          <div class="stat-item">
            <div class="stat-icon"><q-icon name="electrical_services" size="20px" /></div>
            <div>
              <div class="stat-val">100%</div>
              <div class="stat-lbl">Digital</div>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon"><q-icon name="speed" size="20px" /></div>
            <div>
              <div class="stat-val">Real-time</div>
              <div class="stat-lbl">Dados ao vivo</div>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon"><q-icon name="verified" size="20px" /></div>
            <div>
              <div class="stat-val">Seguro</div>
              <div class="stat-lbl">Criptografado</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Logo rodapé -->
      <div class="left-footer">CGB Energia · Sistema de Apontamento</div>
    </div>

    <!-- PAINEL DIREITO — formulário -->
    <div class="right-panel">
      <div class="form-card">

        <!-- Cabeçalho -->
        <div class="form-header">
          <img src="/logo.ico" class="form-logo" alt="CGB" />
          <div class="form-brand">CGB <span>Energia</span></div>
        </div>

        <h2 class="form-title">Bem-vindo de volta</h2>
        <p class="form-sub">Entre com sua conta para continuar</p>

        <!-- Formulário -->
        <form class="q-gutter-y-md" @submit.prevent="entrar">

          <div class="input-group">
            <label class="input-label">E-mail</label>
            <div class="input-wrap" :class="{ 'input-wrap--focus': focusEmail, 'input-wrap--error': emailError }">
              <q-icon name="email" size="18px" class="input-icon" />
              <input
                v-model="email"
                type="email"
                placeholder="seu@email.com"
                class="input-field"
                autocomplete="email"
                @focus="focusEmail = true"
                @blur="focusEmail = false; validarEmail()"
              />
            </div>
            <div v-if="emailError" class="input-error">{{ emailError }}</div>
          </div>

          <div class="input-group">
            <label class="input-label">Senha</label>
            <div class="input-wrap" :class="{ 'input-wrap--focus': focusSenha, 'input-wrap--error': senhaError }">
              <q-icon name="lock" size="18px" class="input-icon" />
              <input
                v-model="senha"
                :type="showSenha ? 'text' : 'password'"
                placeholder="••••••••"
                class="input-field"
                autocomplete="current-password"
                @focus="focusSenha = true"
                @blur="focusSenha = false"
              />
              <button type="button" class="input-eye" @click="showSenha = !showSenha" tabindex="-1">
                <q-icon :name="showSenha ? 'visibility_off' : 'visibility'" size="18px" />
              </button>
            </div>
            <div v-if="senhaError" class="input-error">{{ senhaError }}</div>
          </div>

          <!-- Erro geral -->
          <transition name="fade">
            <div v-if="loginError" class="error-banner">
              <q-icon name="error_outline" size="18px" class="q-mr-xs" />
              {{ loginError }}
            </div>
          </transition>

          <!-- Botão -->
          <button type="submit" class="btn-login" :disabled="loading" :class="{ 'btn-login--loading': loading }">
            <span v-if="!loading" class="btn-login-inner">
              <q-icon name="login" size="18px" />
              Entrar
            </span>
            <span v-else class="btn-login-inner">
              <q-circular-progress indeterminate size="18px" color="white" />
              Entrando…
            </span>
          </button>

        </form>

        <div class="form-footer">
          © {{ year }} CGB Energia · Todos os direitos reservados
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'stores/auth'
import MapBackground from 'components/MapBackground.vue'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const senha = ref('')
const showSenha = ref(false)
const loading = ref(false)
const loginError = ref('')
const emailError = ref('')
const senhaError = ref('')
const focusEmail = ref(false)
const focusSenha = ref(false)
const year = new Date().getFullYear()

function validarEmail () {
  emailError.value = email.value && !/\S+@\S+\.\S+/.test(email.value) ? 'E-mail inválido' : ''
}

async function entrar () {
  emailError.value = ''
  senhaError.value = ''
  loginError.value = ''

  if (!email.value.trim()) { emailError.value = 'Informe o e-mail'; return }
  if (!senha.value) { senhaError.value = 'Informe a senha'; return }

  loading.value = true
  const { error } = await auth.signIn(email.value.trim(), senha.value)
  loading.value = false

  if (error) {
    if (error.message.includes('Invalid login')) loginError.value = 'E-mail ou senha incorretos.'
    else loginError.value = error.message
  } else {
    router.push('/')
  }
}
</script>

<style scoped>
/* ── Root ── */
.login-root {
  position: relative;
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #060b14;
}

/* Wrapper do mapa cobre toda a tela */
.map-wrap {
  position: absolute;
  inset: 0;
  z-index: 0;
}

/* Overlay mínimo — só para suavizar arestas */
.global-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: rgba(6,11,20,0.10);
}

/* ══════════════════════════════
   PAINEL ESQUERDO
══════════════════════════════ */
.left-panel {
  flex: 1;
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  background: transparent;
}

/* Vinheta lateral mínima */
.vignette {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background:
    linear-gradient(to right, rgba(6,11,20,0.08) 0%, transparent 30%, transparent 70%, rgba(6,11,20,0.55) 100%);
}

/* Conteúdo esquerdo */
.left-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 48px;
  position: relative;
  z-index: 2;
}

.left-logo {
  height: 56px; width: auto; object-fit: contain;
  margin-bottom: 28px;
  filter: drop-shadow(0 4px 20px rgba(255,202,40,0.35));
}

.left-title {
  font-size: clamp(28px, 3.5vw, 44px);
  font-weight: 900;
  color: #fff;
  letter-spacing: 0.04em;
  line-height: 1.15;
  margin: 0 0 16px;
}
.left-title span {
  background: linear-gradient(90deg, #ffca28, #ff8f00);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}

.left-desc {
  font-size: 14px;
  color: rgba(255,255,255,0.5);
  line-height: 1.7;
  max-width: 380px;
  margin: 0 0 36px;
}

.left-stats {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 10px 16px;
  backdrop-filter: blur(10px);
}
.stat-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: rgba(255,202,40,0.12);
  color: #ffca28;
  display: flex; align-items: center; justify-content: center;
}
.stat-val  { font-size: 13px; font-weight: 700; color: #fff; }
.stat-lbl  { font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 1px; }

.left-footer {
  padding: 20px 48px;
  font-size: 11px;
  color: rgba(255,255,255,0.2);
  position: relative; z-index: 2;
  letter-spacing: 0.05em;
}

/* ══════════════════════════════
   PAINEL DIREITO
══════════════════════════════ */
.right-panel {
  width: 440px;
  flex-shrink: 0;
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8,16,32,0.88);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-left: 1px solid rgba(255,255,255,0.07);
  padding: 24px;
}

.form-card {
  width: 100%;
  max-width: 360px;
}

.form-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 32px;
}
.form-logo {
  height: 34px; width: auto; object-fit: contain;
}
.form-brand {
  font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 0.5px;
}
.form-brand span { color: #ffca28; }

.form-title {
  font-size: 26px; font-weight: 800;
  color: #fff; margin: 0 0 6px;
}
.form-sub {
  font-size: 13px; color: rgba(255,255,255,0.4);
  margin: 0 0 28px;
}

/* Inputs */
.input-group { display: flex; flex-direction: column; gap: 6px; }
.input-label {
  font-size: 12px; font-weight: 600;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.06em; text-transform: uppercase;
}
.input-wrap {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,0.04);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 0 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input-wrap--focus {
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25,118,210,0.18);
}
.input-wrap--error {
  border-color: #c62828;
  box-shadow: 0 0 0 3px rgba(198,40,40,0.14);
}
.input-icon { color: rgba(255,255,255,0.3); flex-shrink: 0; }
.input-field {
  flex: 1; border: none; background: transparent;
  color: #fff; font-size: 14px;
  padding: 13px 0;
  outline: none;
  font-family: inherit;
}
.input-field::placeholder { color: rgba(255,255,255,0.2); }
.input-eye {
  border: none; background: transparent;
  color: rgba(255,255,255,0.3); cursor: pointer;
  padding: 0; display: flex; align-items: center;
  transition: color 0.2s;
}
.input-eye:hover { color: rgba(255,255,255,0.7); }
.input-error { font-size: 11px; color: #ef9a9a; margin-top: 2px; }

/* Error banner */
.error-banner {
  display: flex; align-items: center;
  background: rgba(198,40,40,0.12);
  border: 1px solid rgba(198,40,40,0.3);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px; color: #ef9a9a;
}

/* Botão login */
.btn-login {
  width: 100%;
  padding: 14px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #1565c0, #1976d2);
  color: #fff;
  font-size: 15px; font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(21,101,192,0.4);
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
  letter-spacing: 0.3px;
}
.btn-login:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 28px rgba(21,101,192,0.55);
}
.btn-login:active:not(:disabled) { transform: translateY(0); }
.btn-login:disabled { opacity: 0.7; cursor: not-allowed; }
.btn-login-inner { display: flex; align-items: center; justify-content: center; gap: 8px; }

/* Rodapé */
.form-footer {
  margin-top: 36px;
  text-align: center;
  font-size: 11px;
  color: rgba(255,255,255,0.18);
  letter-spacing: 0.04em;
}

/* Fade */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.fade-enter-from { opacity: 0; transform: translateY(-6px); }
.fade-leave-to   { opacity: 0; transform: translateY(-6px); }

/* ── Responsivo ── */
@media (max-width: 860px) {
  .left-panel { display: none; }
  .right-panel {
    width: 100%; border-left: none;
    background: rgba(6,11,20,0.80);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
}
@media (max-width: 480px) {
  .right-panel { padding: 20px 16px; align-items: flex-start; padding-top: 60px; }
  .form-card { max-width: 100%; }
}
</style>
