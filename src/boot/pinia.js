import { boot } from 'quasar/wrappers'
import { createPinia } from 'pinia'

export const pinia = createPinia()

export default boot(({ app }) => {
  app.use(pinia)
})
