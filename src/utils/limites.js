import { union } from '@turf/union'
import { featureCollection } from '@turf/helpers'

// Nomes da planilha que diferem do cadastro do IBGE
const APELIDOS = {
  'GOVERNADOR LUIS ROCHA': 'GOVERNADOR LUIZ ROCHA'
}

export function chaveMunicipio (nome) {
  const k = String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/['’`]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^GOV /, 'GOVERNADOR ')
  return APELIDOS[k] ?? k
}

let malha = null

// Malha municipal do Maranhão (IBGE), servida pelo próprio app em /geo
export function carregarMalha () {
  if (!malha) {
    malha = fetch('/geo/municipios-ma.json')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then(gj => new Map(gj.features.map(f => [chaveMunicipio(f.properties.nome), f])))
      .catch(e => { malha = null; throw e })
  }
  return malha
}

export async function limitesDe (municipios) {
  const porChave = await carregarMalha()
  const vistos = new Set()
  const features = []
  const naoEncontrados = []
  for (const m of municipios) {
    const k = chaveMunicipio(m)
    if (!k || vistos.has(k)) continue
    vistos.add(k)
    const f = porChave.get(k)
    if (f) features.push(f)
    else naoEncontrados.push(m)
  }
  let contorno = null
  if (features.length === 1) contorno = features[0]
  else if (features.length > 1) {
    try { contorno = union(featureCollection(features)) } catch { contorno = null }
  }
  return { features, contorno, naoEncontrados }
}
