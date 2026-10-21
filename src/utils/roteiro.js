import { distanciaKm } from './rota'

export const urlPontoGoogle = (lat, lng) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`
export const linkCurto = (lat, lng) => `google.com/maps?q=${lat.toFixed(5)},${lng.toFixed(5)}`
export const urlWhatsApp = texto => `https://wa.me/?text=${encodeURIComponent(texto)}`

// Sequência de visita mais curta: vizinho mais próximo + refinamento 2-opt.
// `origem` e `destino` são pontos fixos de partida e chegada: não entram no resultado.
export function ordenarRoteiro (paradas, origem = null, destino = null) {
  if (!paradas.length) return []
  if (paradas.length < 2 && !origem && !destino) return [...paradas]
  const nos = [...(origem ? [origem] : []), ...paradas, ...(destino ? [destino] : [])]
  const m = nos.length
  const fim = destino ? m - 1 : -1            // o destino fixo é sempre o último da rota
  const ultimo = destino ? m - 2 : m - 1      // último índice que ainda pode trocar de lugar

  const D = Array.from({ length: m }, () => new Float64Array(m))
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) D[i][j] = D[j][i] = distanciaKm(nos[i], nos[j])
  }
  const custo = r => { let c = 0; for (let k = 1; k < r.length; k++) c += D[r[k - 1]][r[k]]; return c }

  const vizinho = ini => {
    const usado = new Uint8Array(m)
    const r = [ini]
    usado[ini] = 1
    if (fim >= 0) usado[fim] = 1
    const cabe = fim >= 0 ? m - 1 : m
    for (let k = 1; k < cabe; k++) {
      const a = r[k - 1]
      let b = -1, d = Infinity
      for (let j = 0; j < m; j++) if (!usado[j] && D[a][j] < d) { d = D[a][j]; b = j }
      r.push(b)
      usado[b] = 1
    }
    if (fim >= 0) r.push(fim)
    return r
  }

  let inicios
  if (origem) inicios = [0]
  else if (ultimo + 1 <= 80) inicios = Array.from({ length: ultimo + 1 }, (_, i) => i)
  else {
    let o = 0
    for (let i = 1; i <= ultimo; i++) if (nos[i].lng < nos[o].lng) o = i
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
    for (let i = base; i < ultimo; i++) {
      for (let j = i + 1; j <= ultimo; j++) {
        const antes = (i > 0 ? D[rota[i - 1]][rota[i]] : 0) + (j < m - 1 ? D[rota[j]][rota[j + 1]] : 0)
        const depois = (i > 0 ? D[rota[i - 1]][rota[j]] : 0) + (j < m - 1 ? D[rota[i]][rota[j + 1]] : 0)
        if (depois < antes - 1e-9) {
          for (let a = i, b = j; a < b; a++, b--) { const t = rota[a]; rota[a] = rota[b]; rota[b] = t }
          melhorou = true
        }
      }
    }
  }

  return rota.slice(origem ? 1 : 0, fim >= 0 ? rota.length - 1 : rota.length).map(i => nos[i])
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
