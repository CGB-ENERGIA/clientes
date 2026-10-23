import { watch } from 'vue'

// Guarda no navegador os filtros e abas de uma tela e os restaura ao recarregar.
// `chave` identifica a tela; `estado` é um objeto { nome: ref }.
export function usarEstadoPersistido (chave, estado) {
  const chaveStorage = `estado:${chave}`
  try {
    const salvo = JSON.parse(localStorage.getItem(chaveStorage) || '{}')
    for (const [nome, ref] of Object.entries(estado)) {
      if (salvo[nome] !== undefined) ref.value = salvo[nome]
    }
  } catch {
    // Sem acesso ao armazenamento local: a tela abre no estado inicial
  }
  watch(
    () => Object.fromEntries(Object.entries(estado).map(([nome, ref]) => [nome, ref.value])),
    valores => {
      try { localStorage.setItem(chaveStorage, JSON.stringify(valores)) } catch {
        // Sem acesso ao armazenamento local: o estado só vale até recarregar
      }
    },
    { deep: true }
  )
}
