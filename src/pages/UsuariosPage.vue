<template>
  <q-page class="usr q-pa-md">
    <div class="usr-head">
      <div>
        <div class="usr-titulo">Usuários</div>
        <div class="usr-sub">{{ usuarios.length }} {{ usuarios.length === 1 ? 'usuário' : 'usuários' }} cadastrados</div>
      </div>
      <q-btn unelevated no-caps color="primary" icon="person_add" label="Novo usuário" @click="abrirNovo" />
    </div>

    <q-table
      flat bordered
      :rows="usuarios"
      :columns="colunas"
      row-key="id"
      :loading="carregando"
      :pagination="{ rowsPerPage: 20, sortBy: 'email' }"
      no-data-label="Nenhum usuário"
      class="q-mt-md"
    >
      <template #body-cell-perfil="props">
        <q-td :props="props">
          <q-select
            :model-value="props.row.role"
            :options="opcoesPerfil(props.row)"
            emit-value map-options dense outlined options-dense
            :disable="!podeEditar(props.row) || salvandoId === props.row.id"
            style="min-width: 150px"
            @update:model-value="v => alterarPerfil(props.row, v)"
          />
        </q-td>
      </template>
      <template #body-cell-eu="props">
        <q-td :props="props">
          <q-badge v-if="props.row.id === meuId" color="primary" label="você" />
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="dialogAberto" persistent>
      <q-card style="width: 420px; max-width: 94vw">
        <q-card-section>
          <div class="text-h6">Novo usuário</div>
          <div class="text-caption text-grey-7">O usuário entra com o e-mail e a senha definidos aqui.</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="form.email" outlined dense label="E-mail" type="email" autocomplete="off" />
          <q-input v-model="form.senha" outlined dense label="Senha inicial" type="password" hint="Mínimo de 8 caracteres" autocomplete="new-password" />
          <q-select
            v-model="form.perfil"
            :options="opcoesCriacao"
            emit-value map-options outlined dense label="Perfil"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated no-caps color="primary" label="Criar"
            :loading="salvando" :disable="!formValido"
            @click="criarUsuario"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { supabase } from 'boot/supabase'
import { useAuthStore } from 'stores/auth'

const $q = useQuasar()
const router = useRouter()
const auth = useAuthStore()

const PERFIS = [
  { value: 'viewer', label: 'Visualizador' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Superadmin' }
]

const usuarios = ref([])
const carregando = ref(false)
const salvando = ref(false)
const salvandoId = ref(null)
const meuId = ref(null)
const dialogAberto = ref(false)
const form = reactive({ email: '', senha: '', perfil: 'viewer' })

const colunas = [
  { name: 'email', label: 'E-mail', field: 'email', align: 'left', sortable: true },
  { name: 'eu', label: '', field: 'id', align: 'left' },
  { name: 'perfil', label: 'Perfil', field: 'role', align: 'left' }
]

const opcoesCriacao = computed(() =>
  PERFIS.filter(p => p.value !== 'superadmin' || auth.isSuperadmin)
)

const formValido = computed(() =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && form.senha.length >= 8
)

// Superadmin edita qualquer perfil, exceto o próprio. Admin não mexe em superadmin nem no próprio perfil.
function podeEditar (linha) {
  if (linha.id === meuId.value) return false
  if (linha.role === 'superadmin') return auth.isSuperadmin
  return true
}

function opcoesPerfil (linha) {
  return PERFIS.filter(p => p.value !== 'superadmin' || auth.isSuperadmin)
}

async function chamar (body) {
  const { data, error } = await supabase.functions.invoke('criar-usuario', { body })
  if (error) {
    let msg = error.message
    try { msg = (await error.context.json()).error ?? msg } catch { /* mantém a mensagem padrão */ }
    throw new Error(msg)
  }
  return data
}

async function carregar () {
  carregando.value = true
  try {
    const data = await chamar({ acao: 'listar' })
    usuarios.value = data.usuarios
    meuId.value = data.meuId
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message, position: 'top' })
  } finally {
    carregando.value = false
  }
}

function abrirNovo () {
  Object.assign(form, { email: '', senha: '', perfil: 'viewer' })
  dialogAberto.value = true
}

async function criarUsuario () {
  salvando.value = true
  try {
    await chamar({ acao: 'criar', email: form.email, senha: form.senha, perfil: form.perfil })
    dialogAberto.value = false
    $q.notify({ type: 'positive', message: 'Usuário criado.', position: 'top' })
    await carregar()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message, position: 'top', timeout: 5000 })
  } finally {
    salvando.value = false
  }
}

async function alterarPerfil (linha, perfil) {
  if (perfil === linha.role) return
  salvandoId.value = linha.id
  try {
    await chamar({ acao: 'perfil', id: linha.id, perfil })
    $q.notify({ type: 'positive', message: `Perfil de ${linha.email} atualizado.`, position: 'top' })
    await carregar()
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message, position: 'top', timeout: 5000 })
  } finally {
    salvandoId.value = null
  }
}

onMounted(() => {
  if (!auth.isAdmin) { router.replace('/'); return }
  carregar()
})
</script>

<style scoped>
.usr-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; }
.usr-titulo { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
.usr-sub { font-size: 13px; color: #64748b; margin-top: 2px; }
</style>
