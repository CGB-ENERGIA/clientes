import { distanciaKm } from './rota'

export const urlPontoGoogle = (lat, lng) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`
export const linkCurto = (lat, lng) => `google.com/maps?q=${lat.toFixed(5)},${lng.toFixed(5)}`
export const urlWhatsApp = texto => `https://wa.me/?text=${encodeURIComponent(texto)}`

// Sequência de visita mais curta: vizinho mais próximo + refinamento 2-opt.
// Com `origem`, ela é o ponto de partida fixo (não entra no resultado).
export function ordenarRoteiro (paradas, origem = null) {
  if (paradas.length < 2 && !origem) return [...paradas]
  const nos = origem ? [origem, ...paradas] : [...paradas]
  const m = nos.length

  const D = Array.from({ length: m }, () => new Float64Array(m))
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) D[i][j] = D[j][i] = distanciaKm(nos[i], nos[j])
  }
  const custo = r => { let c = 0; for (let k = 1; k < r.length; k++) c += D[r[k - 1]][r[k]]; return c }

  const vizinho = ini => {
    const usado = new Uint8Array(m)
    const r = [ini]
    usado[ini] = 1
    for (let k = 1; k < m; k++) {
      const a = r[k - 1]
      let b = -1, d = Infinity
      for (let j = 0; j < m; j++) if (!usado[j] && D[a][j] < d) { d = D[a][j]; b = j }
      r.push(b)
      usado[b] = 1
    }
    return r
  }

  let inicios
  if (origem) inicios = [0]
  else if (m <= 80) inicios = Array.from({ length: m }, (_, i) => i)
  else {
    let o = 0
    for (let i = 1; i < m; i++) if (nos[i].lng < nos[o].lng) o = i
    inicios = [o]
  }

  let rota = null, menor = Infinity
  for (const ini of inicios) {
    const r = vizinho(ini)
    const c = custo(r)
    if (c < menor) { menor = c; rota = r }
  }

  // Caminho aberto: inverter o trecho [i..j] só troca as arestas nas pontas do trecho
  const base = origem ? 1 : 0
  let melhorou = true
  for (let passo = 0; melhorou && passo < 60; passo++) {
    melhorou = false
    for (let i = base; i < m - 1; i++) {
      for (let j = i + 1; j < m; j++) {
        const antes = (i > 0 ? D[rota[i - 1]][rota[i]] : 0) + (j < m - 1 ? D[rota[j]][rota[j + 1]] : 0)
        const depois = (i > 0 ? D[rota[i - 1]][rota[j]] : 0) + (j < m - 1 ? D[rota[i]][rota[j + 1]] : 0)
        if (depois < antes - 1e-9) {
          for (let a = i, b = j; a < b; a++, b--) { const t = rota[a]; rota[a] = rota[b]; rota[b] = t }
          melhorou = true
        }
      }
    }
  }

  return (origem ? rota.slice(1) : rota).map(i => nos[i])
}

// O Google Maps aceita no máximo 9 pontos intermediários por link: roteiros longos viram trechos encadeados
export function trechosGoogle (seq, { daPosicaoAtual = false, max = 10 } = {}) {
  const pts = seq.map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
  const trechos = []
  for (let ini = 0; ini < pts.length; ini += max - 1) {
    const fatia = pts.slice(ini, ini + max)
    const primeiro = ini === 0
    if (!primeiro && fatia.length < 2) break
    const semOrigem = primeiro && (daPosicaoAtual || fatia.length === 1)
    const resto = semOrigem ? fatia : fatia.slice(1)
    const vias = resto.slice(0, -1)
    let url = 'https://www.google.com/maps/dir/?api=1'
    if (!semOrigem) url += `&origin=${fatia[0]}`
    url += `&destination=${resto[resto.length - 1]}`
    if (vias.length) url += `&waypoints=${vias.join('%7C')}`
    url += '&travelmode=driving'
    trechos.push({ de: ini + 1, ate: ini + fatia.length, url })
  }
  return trechos
}
