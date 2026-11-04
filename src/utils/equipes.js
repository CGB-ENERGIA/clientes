// Equipes que podem ser escolhidas nas telas de campo
export const EQUIPES = ['MA-BCB-M001M', 'MA-BCB-O007M', 'MA-BCB-O009M', 'MULTIRÃO']

// Nome guardado por versões antigas do app: "MA-BCB-O007" é a mesma equipe que "MA-BCB-O007M"
export function normalizarEquipe (nome) {
  const e = String(nome ?? '').trim().toUpperCase()
  return e === 'MA-BCB-O007' ? 'MA-BCB-O007M' : e
}

// Lista do campo de escolha: as equipes fixas, mais o nome atual se vier de fora da lista (para não sumir)
export function opcoesEquipe (atual) {
  return !atual || EQUIPES.includes(atual) ? EQUIPES : [...EQUIPES, atual]
}
