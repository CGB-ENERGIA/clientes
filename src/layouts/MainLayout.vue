<template>
  <q-layout view="hHh lpR fFf">

    <!-- HEADER -->
    <q-header class="header-modern">
      <q-toolbar class="header-toolbar">

        <!-- Logo -->
        <div class="header-brand row items-center no-wrap">
          <img src="/logo.ico" class="brand-logo q-mr-sm" alt="CGB" />
          <div class="brand-sep q-mr-sm gt-xs" />
          <div class="column no-wrap gt-xs">
            <span class="brand-title">CONTROLE DE CLIENTES</span>
            <span class="brand-sub">CGB Energia</span>
          </div>
        </div>

        <q-space />

        <!-- Nav desktop -->
        <nav class="header-nav row items-center gt-sm">
          <template v-for="(item, i) in navItems" :key="item.to">
            <div v-if="i > 0" class="nav-divider" />
            <router-link :to="item.to" custom v-slot="{ isActive, navigate }">
              <button class="nav-btn" :class="{ 'nav-btn--active': isActive }" @click="navigate">
                <span class="nav-btn-inner">
                  <q-icon :name="item.icon" size="16px" />
                  <span>{{ item.label }}</span>
                </span>
                <span v-if="isActive" class="nav-indicator" />
              </button>
            </router-link>
          </template>
        </nav>

        <!-- Usuário logado -->
        <div class="user-info gt-xs q-ml-md row items-center no-wrap" style="gap:8px">
          <div class="user-avatar">
            {{ userInitial }}
          </div>
          <div class="column no-wrap gt-sm">
            <span class="user-email">{{ auth.user?.email?.split('@')[0] }}</span>
            <span class="user-role" :class="roleClass">{{ roleLabel }}</span>
          </div>
        </div>

        <!-- Logout -->
        <q-btn flat round dense icon="logout" color="white" class="q-ml-sm" size="sm" @click="logout">
          <q-tooltip>Sair</q-tooltip>
        </q-btn>

        <!-- Dark toggle -->
        <div class="theme-toggle q-ml-sm" @click="toggleDark" title="Alternar tema">
          <div class="toggle-track" :class="{ 'toggle-track--dark': isDark }">
            <q-icon name="light_mode" size="12px" class="toggle-icon toggle-icon--light" />
            <div class="toggle-thumb" :class="{ 'toggle-thumb--dark': isDark }" />
            <q-icon name="dark_mode" size="12px" class="toggle-icon toggle-icon--dark" />
          </div>
        </div>

        <!-- Hamburger mobile -->
        <q-btn flat round dense icon="menu" color="white" class="lt-md q-ml-sm" @click="drawer = !drawer" />
      </q-toolbar>
    </q-header>

    <!-- Drawer mobile -->
    <q-drawer v-model="drawer" side="right" overlay behavior="mobile"
      :width="220" class="drawer-modern">
      <div class="q-pa-md">
        <div class="text-caption text-weight-bold q-mb-md" style="color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase">Menu</div>
        <q-list>
          <q-item
            v-for="item in navItems" :key="item.to"
            :to="item.to"
            :exact="item.to === '/'"
            clickable v-ripple
            active-class="drawer-item--active"
            class="drawer-item rounded-borders q-mb-xs"
            @click="drawer = false"
          >
            <q-item-section avatar>
              <q-icon :name="item.icon" size="20px" />
            </q-item-section>
            <q-item-section>{{ item.label }}</q-item-section>
          </q-item>
        </q-list>
      </div>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

  </q-layout>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'stores/auth'

const $q = useQuasar()
const router = useRouter()
const auth = useAuthStore()
const isDark = computed(() => $q.dark.isActive)
const drawer = ref(false)

const userInitial = computed(() => {
  const e = auth.user?.email ?? ''
  return e.charAt(0).toUpperCase()
})

const roleLabel = computed(() => {
  const map = { superadmin: 'Superadmin', admin: 'Admin', viewer: 'Visualizador' }
  return map[auth.role] ?? auth.role
})

const roleClass = computed(() => {
  if (auth.role === 'superadmin') return 'role--super'
  if (auth.role === 'admin') return 'role--admin'
  return 'role--viewer'
})

function toggleDark () { $q.dark.toggle() }
async function logout () {
  await auth.signOut()
  router.push('/login')
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/historico', label: 'Histórico', icon: 'history' },
  { to: '/', label: 'Apontamento', icon: 'assignment' }
]
</script>

<style scoped>
/* ── Header ── */
.header-modern {
  background: #0a1628;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 2px 20px rgba(0,0,0,0.4);
}
.header-toolbar {
  padding: 0 16px;
  min-height: 58px;
}
@media (min-width: 600px) { .header-toolbar { padding: 0 24px; } }

/* ── Marca ── */
.brand-logo {
  display: block; flex-shrink: 0;
  height: 36px; width: auto; object-fit: contain;
}
.brand-sep {
  width: 1px; height: 28px;
  background: rgba(255,255,255,0.12); flex-shrink: 0;
}
.brand-title {
  font-size: 13px; font-weight: 800; color: #fff; letter-spacing: 1px; line-height: 1.3;
}
.brand-sub {
  font-size: 9px; font-weight: 600; color: #ffca28;
  letter-spacing: 2px; text-transform: uppercase; opacity: 0.85;
}

/* ── Nav desktop ── */
.header-nav { gap: 0; }
.nav-divider { width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 2px; }
.nav-btn {
  position: relative;
  display: inline-flex; flex-direction: column; align-items: center;
  padding: 8px 14px;
  border: none; background: transparent;
  color: rgba(255,255,255,0.45);
  font-family: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer; transition: color 0.2s; outline: none; letter-spacing: 0.2px;
}
.nav-btn-inner { display: flex; align-items: center; gap: 5px; }
.nav-btn:hover { color: rgba(255,255,255,0.85); }
.nav-btn--active { color: #fff; font-weight: 700; }
.nav-indicator {
  position: absolute; bottom: -1px; left: 18%; width: 64%; height: 3px;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(90deg, #ffca28, #ff8f00);
  box-shadow: 0 0 8px rgba(255,160,0,0.55);
}

/* ── Toggle ── */
.theme-toggle { cursor: pointer; user-select: none; }
.toggle-track {
  position: relative; width: 50px; height: 26px; border-radius: 99px;
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
  display: flex; align-items: center; padding: 0 5px; justify-content: space-between;
  transition: background 0.3s;
}
.toggle-track--dark { background: rgba(88,166,255,0.18); border-color: rgba(88,166,255,0.3); }
.toggle-icon { z-index: 1; transition: opacity 0.2s; }
.toggle-icon--light { color: #ffca28; opacity: 1; }
.toggle-icon--dark  { color: #90caf9; opacity: 0.4; }
.toggle-track--dark .toggle-icon--light { opacity: 0.4; }
.toggle-track--dark .toggle-icon--dark  { opacity: 1; }
.toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 20px; height: 20px; border-radius: 50%;
  background: #ffca28; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  transition: left 0.25s cubic-bezier(.4,0,.2,1), background 0.3s;
}
.toggle-thumb--dark { left: calc(100% - 22px); background: #90caf9; }

/* ── Usuário ── */
.user-info { cursor: default; }
.user-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, #1565c0, #1976d2);
  border: 2px solid rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: #fff;
  flex-shrink: 0;
}
.user-email { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.85); line-height: 1.2; }
.user-role  { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; line-height: 1; }
.role--super  { color: #ffca28; }
.role--admin  { color: #80cbc4; }
.role--viewer { color: rgba(255,255,255,0.35); }

/* ── Drawer mobile ── */
.drawer-modern { background: var(--bg-card) !important; }
.drawer-item { border-radius: 8px !important; color: var(--text-secondary) !important; }
.drawer-item--active { background: var(--accent-light) !important; color: var(--accent) !important; font-weight: 700 !important; }
</style>
