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
