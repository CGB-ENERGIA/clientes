import { route } from 'quasar/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'
import routes from './routes'

export default route(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(process.env.VUE_ROUTER_BASE)
  })

  router.beforeEach(async (to, _from, next) => {
    // Importação dinâmica para evitar dependência circular no boot
    const { useAuthStore } = await import('stores/auth')
    const { pinia } = await import('boot/pinia')
    const auth = useAuthStore(pinia)

    if (!auth.user) await auth.init()

    if (to.meta.requiresAuth && !auth.user) {
      next('/login')
    } else if (to.path === '/login' && auth.user) {
      next('/')
    } else {
      next()
    }
  })

  return router
})
