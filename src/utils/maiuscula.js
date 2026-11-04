// Diretiva v-maiuscula: tudo o que for digitado no campo vira CAIXA ALTA (mantém o cursor no lugar).
// Uso: <input v-model="x" v-maiuscula />   (importar como `vMaiuscula` no <script setup>)
export const vMaiuscula = {
  mounted (el) {
    const campo = el.matches('input,textarea') ? el : el.querySelector('input,textarea')
    if (!campo) return
    el.__maiuscula = (e) => {
      if (e.isComposing) return
      const atual = campo.value
      const alto = atual.toUpperCase()
      if (atual === alto) return
      const ini = campo.selectionStart
      const fim = campo.selectionEnd
      campo.value = alto
      try { campo.setSelectionRange(ini, fim) } catch { /* tipos sem seleção */ }
      // v-model já leu o texto minúsculo: avisa de novo com o valor em caixa alta
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    }
    campo.addEventListener('input', el.__maiuscula)
    el.__maiusculaCampo = campo
  },
  beforeUnmount (el) {
    el.__maiusculaCampo?.removeEventListener('input', el.__maiuscula)
  }
}

export const maiusculo = (v) => String(v ?? '').toUpperCase()
