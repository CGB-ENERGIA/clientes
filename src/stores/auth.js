import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from 'boot/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const profile = ref(null)
  const loading = ref(false)

  const role = computed(() => profile.value?.role ?? 'viewer')
  const isSuperadmin = computed(() => role.value === 'superadmin')
  const isAdmin = computed(() => ['superadmin', 'admin'].includes(role.value))

  async function fetchProfile (uid) {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', uid)
      .single()
    profile.value = data ?? null
  }

  async function init () {
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    if (user.value) await fetchProfile(user.value.id)

    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      if (user.value) await fetchProfile(user.value.id)
      else profile.value = null
    })
  }

  async function signIn (email, password) {
    loading.value = true
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) {
      user.value = data.user
      await fetchProfile(data.user.id)
    }
    loading.value = false
    return { error }
  }

  async function signOut () {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
  }

  return { user, profile, role, isSuperadmin, isAdmin, loading, init, signIn, signOut }
})
