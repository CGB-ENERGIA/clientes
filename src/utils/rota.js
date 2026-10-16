export function temCoordenada (n) {
  return Number.isFinite(n?.latitude) && Number.isFinite(n?.longitude)
}

export function urlGoogleMaps (lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
}

export function urlWaze (lat, lng) {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
}

// No celular os links abrem o app de navegação instalado (Google Maps / Waze)
export function iniciarDeslocamento (n, app = 'google') {
  if (!temCoordenada(n)) return false
  const url = app === 'waze' ? urlWaze(n.latitude, n.longitude) : urlGoogleMaps(n.latitude, n.longitude)
  window.open(url, '_blank', 'noopener')
  return true
}

export function distanciaKm (a, b) {
  const R = 6371
  const rad = x => x * Math.PI / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatarDistancia (km) {
  if (km == null) return ''
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`
}

export function formatarDuracao (min) {
  if (min == null) return ''
  const m = Math.max(1, Math.round(min))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h} h ${String(m % 60).padStart(2, '0')} min`
}

// Rota de carro passando por vários pontos, na ordem dada (com o tempo e a distância de cada trecho)
export async function buscarRotaMulti (pontos, signal) {
  const coords = pontos.map(p => `${p.lng},${p.lat}`).join(';')
  const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, { signal })
  if (!resp.ok) throw new Error(`OSRM ${resp.status}`)
  const json = await resp.json()
  const r = json.routes?.[0]
  if (json.code !== 'Ok' || !r) throw new Error(json.message || 'Rota não encontrada')
  return {
    pontos: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    km: r.distance / 1000,
    minutos: r.duration / 60,
    pernas: r.legs.map(l => ({ km: l.distance / 1000, minutos: l.duration / 60 }))
  }
}

// Rota de carro pelo servidor público do OSRM (dados do OpenStreetMap)
export async function buscarRota (origem, destino, signal) {
  const url = 'https://router.project-osrm.org/route/v1/driving/' +
    `${origem.lng},${origem.lat};${destino.lng},${destino.lat}?overview=full&geometries=geojson`
  const resp = await fetch(url, { signal })
  if (!resp.ok) throw new Error(`OSRM ${resp.status}`)
  const json = await resp.json()
  const r = json.routes?.[0]
  if (json.code !== 'Ok' || !r) throw new Error(json.message || 'Rota não encontrada')
  return {
    pontos: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    km: r.distance / 1000,
    minutos: r.duration / 60
  }
}
