<template>
  <canvas ref="canvas" class="map-canvas" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { gsap } from 'gsap'

const canvas = ref(null)
let ctx = null
let animFrame = null
let ro = null

const CITIES = [
  { name: 'CGB',              lat: -4.55, lon: -44.85, hub: true,  cgb: true  },
  { name: 'ITAPECURU\nMIRIM', lat: -3.40, lon: -44.36, hub: false, cgb: false },
  { name: 'BACABAL',          lat: -4.23, lon: -44.19, hub: false, cgb: false },
  { name: 'SANTA INÊS',       lat: -3.66, lon: -45.38, hub: false, cgb: false },
  { name: 'PEDREIRAS',        lat: -4.57, lon: -44.10, hub: false, cgb: false },
  { name: 'PRES. DUTRA',      lat: -5.29, lon: -44.49, hub: false, cgb: false },
  { name: 'BARRA DO\nCORDA',  lat: -5.50, lon: -45.25, hub: false, cgb: false }
]

const CONNECTIONS = [
  [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,3],[4,5],[5,6]
]

const MA_BORDER = [
  [-1.6,-48.8],[-1.3,-47.2],[-1.2,-45.5],[-1.5,-44.5],
  [-2.1,-43.3],[-2.9,-42.8],[-3.7,-42.4],[-4.6,-42.7],
  [-5.5,-43.3],[-6.5,-44.0],[-7.4,-44.5],[-8.8,-45.0],
  [-9.9,-45.5],[-10.0,-46.5],[-9.2,-47.5],[-8.0,-48.3],
  [-6.5,-48.7],[-4.5,-49.0],[-3.0,-49.3],[-1.9,-48.9]
]

const CENTER = { lat: -4.45, lon: -44.9 }

const pulseRings   = CITIES.map(() => ({ s: 1, a: 0.75 }))
const cgbGlow      = { a: 0.6 }
const particles    = []
const shootingStars = []
const ambient      = Array.from({ length: 70 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, size: 1, a: 0 }))

// ── Projeção ─────────────────────────────────────────────────────
function proj (lat, lon) {
  const w = canvas.value.width, h = canvas.value.height
  const scale = Math.min(w, h) * 0.26
  return {
    x: w / 2 + (lon - CENTER.lon) * scale,
    y: h / 2 - (lat - CENTER.lat) * scale * 1.15
  }
}
function screenCities () { return CITIES.map(c => ({ ...c, ...proj(c.lat, c.lon) })) }

// ── Bezier ───────────────────────────────────────────────────────
function qbez (t, p0, cp, p1) {
  const m = 1 - t
  return {
    x: m * m * p0.x + 2 * m * t * cp.x + t * t * p1.x,
    y: m * m * p0.y + 2 * m * t * cp.y + t * t * p1.y
  }
}
function ctrlPt (p0, p1, bend = 0.18) {
  const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2
  const dx = p1.x - p0.x, dy = p1.y - p0.y
  const len = Math.hypot(dx, dy) || 1
  return { x: mx - (dy / len) * len * bend, y: my + (dx / len) * len * bend }
}

// ── Grade hex ────────────────────────────────────────────────────
function drawHex () {
  const w = canvas.value.width, h = canvas.value.height
  const size = 38
  const cols = Math.ceil(w / (size * 1.5)) + 2
  const rows = Math.ceil(h / (size * Math.sqrt(3))) + 2
  ctx.strokeStyle = 'rgba(88,166,255,0.10)'
  ctx.lineWidth = 0.8
  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const ox = col * size * 1.5
      const oy = row * size * Math.sqrt(3) + (col % 2 === 0 ? 0 : size * Math.sqrt(3) / 2)
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i
        const px = ox + size * Math.cos(a), py = oy + size * Math.sin(a)
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    }
  }
}

// ── Grade geográfica (lat/lon) ───────────────────────────────────
function drawCoordGrid () {
  const w = canvas.value.width, h = canvas.value.height
  ctx.save()
  ctx.font = '8px "Courier New", monospace'

  for (let lat = -10; lat <= 0; lat += 0.5) {
    const p = proj(lat, CENTER.lon)
    if (p.y < -5 || p.y > h + 5) continue
    ctx.strokeStyle = `rgba(88,166,255,${lat % 1 === 0 ? 0.18 : 0.07})`
    ctx.lineWidth = lat % 1 === 0 ? 0.8 : 0.4
    ctx.setLineDash(lat % 1 === 0 ? [4, 8] : [2, 12])
    ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke()
    if (lat % 1 === 0) {
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(88,166,255,0.45)'
      ctx.textAlign = 'left'
      ctx.fillText(`${Math.abs(lat).toFixed(0)}°S`, 8, p.y - 3)
    }
  }

  for (let lon = -50; lon <= -42; lon += 0.5) {
    const p = proj(CENTER.lat, lon)
    if (p.x < -5 || p.x > w + 5) continue
    ctx.strokeStyle = `rgba(88,166,255,${lon % 1 === 0 ? 0.18 : 0.07})`
    ctx.lineWidth = lon % 1 === 0 ? 0.8 : 0.4
    ctx.setLineDash(lon % 1 === 0 ? [4, 8] : [2, 12])
    ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke()
    if (lon % 1 === 0) {
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(88,166,255,0.45)'
      ctx.textAlign = 'center'
      ctx.fillText(`${Math.abs(lon)}°W`, p.x, h - 5)
    }
  }

  ctx.setLineDash([])
  ctx.restore()
}

// ── Malha de ruas ao redor de cada cidade ────────────────────────
function drawStreetGrid (sc) {
  sc.forEach((city, i) => {
    if (city.cgb) return
    const { x, y } = city
    const angle = (i * 17) * Math.PI / 180
    const radius = 55
    const block = 8

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.clip()

    // ruas menores
    ctx.strokeStyle = 'rgba(88,166,255,0.18)'
    ctx.lineWidth = 0.5
    for (let g = -radius; g <= radius; g += block) {
      ctx.beginPath(); ctx.moveTo(g, -radius); ctx.lineTo(g, radius); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-radius, g); ctx.lineTo(radius, g); ctx.stroke()
    }
    // avenidas principais
    ctx.strokeStyle = 'rgba(88,166,255,0.45)'
    ctx.lineWidth = 1.1
    for (const g of [-block * 2, 0, block * 2]) {
      ctx.beginPath(); ctx.moveTo(g, -radius); ctx.lineTo(g, radius); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-radius, g); ctx.lineTo(radius, g); ctx.stroke()
    }
    ctx.restore()
  })
}

// ── Blocos de edifícios ──────────────────────────────────────────
function drawBuildings (sc) {
  sc.forEach((city, idx) => {
    if (city.cgb) return
    const { x, y } = city
    for (let i = 0; i < 24; i++) {
      const angle = ((idx * 89 + i * 137.5) % 360) * Math.PI / 180
      const dist  = 18 + ((i * 23 + idx * 17) % 40)
      const bx = x + Math.cos(angle) * dist
      const by = y + Math.sin(angle) * dist
      const bw = 3 + ((i * 7  + idx * 3) % 10)
      const bh = 2 + ((i * 11 + idx * 5) % 8)
      const alpha = 0.10 + (i % 4) * 0.05
      ctx.fillStyle   = `rgba(88,166,255,${alpha})`
      ctx.strokeStyle = `rgba(88,166,255,${alpha * 2.5})`
      ctx.lineWidth = 0.4
      ctx.fillRect  (bx - bw / 2, by - bh / 2, bw, bh)
      ctx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh)
    }
  })
}

// ── Contornos topográficos ───────────────────────────────────────
function drawTerrain () {
  const w = canvas.value.width, h = canvas.value.height
  const zones = [
    { rx: 0.48, ry: 0.44, rw: 0.22, rh: 0.13, rot: 0.2 },
    { rx: 0.63, ry: 0.58, rw: 0.15, rh: 0.09, rot: -0.3 },
    { rx: 0.37, ry: 0.63, rw: 0.17, rh: 0.08, rot: 0.1 }
  ]
  ctx.setLineDash([3, 7])
  zones.forEach(({ rx, ry, rw, rh, rot }) => {
    for (let ring = 1; ring <= 5; ring++) {
      ctx.strokeStyle = `rgba(88,166,255,${0.03 / ring})`
      ctx.lineWidth = 0.4
      ctx.beginPath()
      ctx.ellipse(w * rx, h * ry, w * rw * ring * 0.32, h * rh * ring * 0.32, rot, 0, Math.PI * 2)
      ctx.stroke()
    }
  })
  ctx.setLineDash([])
}

// ── Borda do Maranhão ────────────────────────────────────────────
function drawBorder () {
  const pts = MA_BORDER.map(([lat, lon]) => proj(lat, lon))
  ctx.save()
  ctx.strokeStyle = 'rgba(88,166,255,0.55)'
  ctx.lineWidth = 1.6
  ctx.setLineDash([5, 9])
  ctx.shadowColor = 'rgba(88,166,255,0.9)'
  ctx.shadowBlur = 22
  ctx.beginPath()
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
  ctx.closePath()
  ctx.stroke()
  ctx.setLineDash([])
  ctx.shadowBlur = 0
  ctx.restore()

  ctx.save()
  const region = new Path2D()
  pts.forEach((p, i) => i === 0 ? region.moveTo(p.x, p.y) : region.lineTo(p.x, p.y))
  region.closePath()
  ctx.fillStyle = 'rgba(21,101,192,0.10)'
  ctx.fill(region)
  ctx.restore()
}

// ── Conexões entre cidades ───────────────────────────────────────
function drawConnections (sc, time) {
  CONNECTIONS.forEach(([a, b]) => {
    const p0 = sc[a], p1 = sc[b], cp = ctrlPt(p0, p1)
    const isHub = a === 0 || b === 0
    const g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y)
    const c = isHub ? '255,202,40' : '88,166,255'
    g.addColorStop(0,   `rgba(${c},0.10)`)
    g.addColorStop(0.5, `rgba(${c},0.65)`)
    g.addColorStop(1,   `rgba(${c},0.10)`)
    ctx.strokeStyle = g
    ctx.lineWidth = isHub ? 2.0 : 1.2
    ctx.setLineDash([3, 7])
    ctx.lineDashOffset = -(time * 22) % 20
    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.quadraticCurveTo(cp.x, cp.y, p1.x, p1.y)
    ctx.stroke()
    ctx.setLineDash([])
  })
}

// ── Partículas nas conexões ──────────────────────────────────────
function drawParticles () {
  particles.forEach(p => {
    if (p.a <= 0.02) return
    const { x, y } = p
    const c = p.gold ? '255,202,40' : '88,166,255'
    const gr = ctx.createRadialGradient(x, y, 0, x, y, 7)
    gr.addColorStop(0, `rgba(${c},${p.a * 0.9})`)
    gr.addColorStop(1, 'transparent')
    ctx.fillStyle = gr
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = `rgba(255,255,255,${p.a})`
    ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill()
  })
}

// ── Estrelas cadentes ─────────────────────────────────────────────
function drawShootingStars () {
  shootingStars.forEach(star => {
    if (star.a <= 0.02) return
    const { x, y, angle, length, a } = star
    const tailX = x - Math.cos(angle) * length
    const tailY = y - Math.sin(angle) * length
    const g = ctx.createLinearGradient(tailX, tailY, x, y)
    g.addColorStop(0,   'transparent')
    g.addColorStop(0.6, `rgba(160,210,255,${a * 0.5})`)
    g.addColorStop(1,   `rgba(255,255,255,${a * 0.9})`)
    ctx.strokeStyle = g
    ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(x, y); ctx.stroke()
    const tg = ctx.createRadialGradient(x, y, 0, x, y, 5)
    tg.addColorStop(0, `rgba(255,255,255,${a * 0.9})`)
    tg.addColorStop(1, 'transparent')
    ctx.fillStyle = tg
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill()
  })
}

// ── Nodo CGB especial ─────────────────────────────────────────────
function drawCGB (city, pr, time) {
  const { x, y } = city

  // Anel externo rotativo com ticks (como radar)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(time * 0.22)
  const outerR = 110
  ctx.strokeStyle = 'rgba(255,202,40,0.1)'
  ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.arc(0, 0, outerR, 0, Math.PI * 2); ctx.stroke()
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2
    const isMaj = i % 6 === 0
    const inner = isMaj ? outerR - 10 : i % 3 === 0 ? outerR - 6 : outerR - 3
    ctx.strokeStyle = `rgba(255,202,40,${isMaj ? 0.4 : 0.12})`
    ctx.lineWidth = isMaj ? 1.2 : 0.4
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner)
    ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR)
    ctx.stroke()
  }
  ctx.restore()

  // Anel interno rotativo inverso (tracejado)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-time * 0.35)
  const innerR = 80
  ctx.strokeStyle = 'rgba(255,202,40,0.07)'
  ctx.lineWidth = 0.5
  ctx.setLineDash([5, 9])
  ctx.beginPath(); ctx.arc(0, 0, innerR, 0, Math.PI * 2); ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // Anéis pulsantes duplos
  for (let ring = 0; ring < 2; ring++) {
    const rs = pr.s + ring * 0.5
    const ra = pr.a * (1 - ring * 0.4)
    ctx.strokeStyle = `rgba(255,202,40,${ra})`
    ctx.lineWidth = 1.8 - ring * 0.6
    ctx.beginPath(); ctx.arc(x, y, 24 * rs, 0, Math.PI * 2); ctx.stroke()
  }

  // Glow radial dourado
  const gr = ctx.createRadialGradient(x, y, 2, x, y, 120)
  gr.addColorStop(0,    `rgba(255,202,40,${cgbGlow.a * 0.85})`)
  gr.addColorStop(0.35, `rgba(255,150,0,${cgbGlow.a * 0.30})`)
  gr.addColorStop(0.7,  `rgba(255,100,0,${cgbGlow.a * 0.08})`)
  gr.addColorStop(1,    'transparent')
  ctx.fillStyle = gr
  ctx.beginPath(); ctx.arc(x, y, 120, 0, Math.PI * 2); ctx.fill()

  // Ponto central
  ctx.shadowColor = '#ffca28'; ctx.shadowBlur = 22
  ctx.fillStyle = '#ffca28'
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0

  // Texto CGB
  ctx.save()
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = '#ffca28'; ctx.shadowBlur = 32
  ctx.font = 'bold 26px "Inter", sans-serif'
  ctx.fillStyle = `rgba(255,220,80,${0.25 + cgbGlow.a * 0.2})`
  ctx.fillText('CGB', x, y - 46)
  ctx.shadowBlur = 12
  ctx.font = 'bold 22px "Inter", sans-serif'
  ctx.fillStyle = `rgba(255,215,60,${0.65 + cgbGlow.a * 0.35})`
  ctx.fillText('CGB', x, y - 46)
  const uw = 34
  const lg = ctx.createLinearGradient(x - uw, y - 33, x + uw, y - 33)
  lg.addColorStop(0, 'transparent')
  lg.addColorStop(0.5, `rgba(255,202,40,${cgbGlow.a * 0.85})`)
  lg.addColorStop(1, 'transparent')
  ctx.strokeStyle = lg; ctx.lineWidth = 1; ctx.shadowBlur = 4
  ctx.beginPath(); ctx.moveTo(x - uw, y - 33); ctx.lineTo(x + uw, y - 33); ctx.stroke()
  ctx.shadowBlur = 0
  ctx.restore()
}

// ── Nodos das cidades ─────────────────────────────────────────────
function drawCities (sc, time) {
  sc.forEach((city, i) => {
    if (city.cgb) { drawCGB(city, pulseRings[i], time); return }

    const { x, y } = city
    const pr = pulseRings[i]
    const nodeR = 6

    ctx.strokeStyle = `rgba(88,166,255,${pr.a})`
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(x, y, nodeR * pr.s, 0, Math.PI * 2); ctx.stroke()

    const gr = ctx.createRadialGradient(x, y, nodeR, x, y, nodeR * 5)
    gr.addColorStop(0, 'rgba(88,166,255,0.18)'); gr.addColorStop(1, 'transparent')
    ctx.fillStyle = gr
    ctx.beginPath(); ctx.arc(x, y, nodeR * 5, 0, Math.PI * 2); ctx.fill()

    ctx.shadowColor = '#58a6ff'; ctx.shadowBlur = 28
    ctx.fillStyle = '#1976d2'
    ctx.beginPath(); ctx.arc(x, y, nodeR, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(88,166,255,0.95)'; ctx.lineWidth = 1.8
    ctx.beginPath(); ctx.arc(x, y, nodeR, 0, Math.PI * 2); ctx.stroke()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill()

    // Label
    const lines = city.name.split('\n')
    ctx.font = '10px "Inter", sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.shadowColor = '#000'; ctx.shadowBlur = 4
    lines.forEach((ln, li) => ctx.fillText(ln, x, y + nodeR + 13 + li * 12))

    // Overlay de coordenadas (pisca suavemente)
    const blink = Math.sin(time * 0.9 + i * 1.4) > 0.2
    if (blink) {
      ctx.font = '7px "Courier New", monospace'
      ctx.fillStyle = 'rgba(88,166,255,0.3)'
      ctx.textAlign = 'left'
      ctx.fillText(`${Math.abs(city.lat).toFixed(2)}°S`, x + 12, y - 4)
      ctx.fillText(`${Math.abs(city.lon).toFixed(2)}°W`, x + 12, y + 6)
    }
    ctx.shadowBlur = 0
  })
}

// ── Scanner (ondas do CGB) ────────────────────────────────────────
function drawScanner (sc, time) {
  const hub = sc[0]
  const T = 3.5
  for (let wave = 0; wave < 3; wave++) {
    const t = ((time / T + wave / 3) % 1)
    const r = t * 210
    const a = (1 - t) * 0.65
    ctx.strokeStyle = `rgba(255,202,40,${a})`
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(hub.x, hub.y, r, 0, Math.PI * 2); ctx.stroke()
  }
}

// ── Scanline ──────────────────────────────────────────────────────
function drawScanline (time) {
  const w = canvas.value.width, h = canvas.value.height
  const y = ((time * 30) % (h + 80)) - 40
  const g = ctx.createLinearGradient(0, y - 40, 0, y + 40)
  g.addColorStop(0,   'transparent')
  g.addColorStop(0.4, 'rgba(88,166,255,0.016)')
  g.addColorStop(0.5, 'rgba(88,166,255,0.045)')
  g.addColorStop(0.6, 'rgba(88,166,255,0.016)')
  g.addColorStop(1,   'transparent')
  ctx.fillStyle = g
  ctx.fillRect(0, y - 40, w, 80)
}

// ── Cantos decorativos ────────────────────────────────────────────
function drawCorners () {
  const w = canvas.value.width, h = canvas.value.height
  const sz = 22, off = 12
  const corners = [[off, off, 1, 1], [w - off, off, -1, 1], [off, h - off, 1, -1], [w - off, h - off, -1, -1]]
  ctx.strokeStyle = 'rgba(88,166,255,0.65)'
  ctx.lineWidth = 1.8
  corners.forEach(([x, y, dx, dy]) => {
    ctx.beginPath()
    ctx.moveTo(x + dx * sz, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * sz)
    ctx.stroke()
  })
}

// ── HUD de dados ──────────────────────────────────────────────────
function drawHUD (time) {
  const w = canvas.value.width, h = canvas.value.height
  ctx.save()
  ctx.font = '8px "Courier New", monospace'

  // Topo direito
  const now = new Date()
  const ts  = now.toISOString().replace('T', ' ').substring(0, 19)
  ctx.fillStyle = 'rgba(88,166,255,0.65)'
  ctx.textAlign = 'right'
  ctx.fillText(`SYS ${ts}Z`,            w - 14, 18)
  ctx.fillText('LAT -4.45° · LON -44.90°', w - 14, 30)
  ctx.fillText('MA · BR · DATUM WGS84',    w - 14, 42)

  // Inferior esquerdo
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(88,166,255,0.50)'
  ctx.fillText('CGB ENERGIA — CONTROLE OPERACIONAL DE CAMPO', 14, h - 22)
  ctx.fillText(`BASES: ${CITIES.length - 1}  ·  ROTAS: ${CONNECTIONS.length}  ·  MARANHÃO`, 14, h - 10)

  // Barra de status pulsante
  const pulse = 0.5 + Math.abs(Math.sin(time * 1.2)) * 0.5
  ctx.fillStyle = `rgba(0,230,118,${pulse})`
  ctx.fillRect(14, h - 34, 6, 6)
  ctx.fillStyle = 'rgba(88,166,255,0.25)'
  ctx.textAlign = 'left'
  ctx.fillText('ONLINE', 24, h - 29)

  ctx.restore()
}

// ── Partículas ambiente ───────────────────────────────────────────
function drawAmbient (dt) {
  const w = canvas.value.width, h = canvas.value.height
  ambient.forEach(p => {
    p.x += p.vx * dt; p.y += p.vy * dt
    if (p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
      p.x = Math.random() * w; p.y = Math.random() * h
    }
    ctx.fillStyle = `rgba(88,166,255,${p.a * 0.6})`
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
  })
}

// ── Loop de render ────────────────────────────────────────────────
let last = 0
function render (ts) {
  if (!canvas.value) return
  const time = ts / 1000
  const dt = Math.min(time - last, 0.05)
  last = time

  const w = canvas.value.width, h = canvas.value.height
  ctx.clearRect(0, 0, w, h)

  const sc = screenCities()

  drawCoordGrid()
  drawHex()
  drawTerrain()
  drawBorder()
  drawStreetGrid(sc)
  drawBuildings(sc)
  drawConnections(sc, time)
  drawScanline(time)
  drawAmbient(dt)
  drawParticles()
  drawShootingStars()
  drawCities(sc, time)
  drawScanner(sc, time)
  drawCorners()
  drawHUD(time)

  animFrame = requestAnimationFrame(render)
}

// ── GSAP: pulso dos nodos ─────────────────────────────────────────
function pulseCycle (i) {
  pulseRings[i].s = 1; pulseRings[i].a = 0.75
  gsap.to(pulseRings[i], {
    s: 4, a: 0,
    duration: CITIES[i].hub ? 2 : 2.8,
    ease: 'power2.out',
    delay: i * 0.45,
    onComplete: () => pulseCycle(i)
  })
}

// ── GSAP: partículas nas conexões ─────────────────────────────────
function spawnParticles (sc) {
  CONNECTIONS.forEach(([a, b]) => {
    const p0 = sc[a], p1 = sc[b], cp = ctrlPt(p0, p1)
    const isHub = a === 0 || b === 0
    const count = isHub ? 3 : 2
    for (let k = 0; k < count; k++) {
      const obj  = { t: 0 }
      const part = { x: p0.x, y: p0.y, a: 0, gold: isHub, p0, cp, p1 }
      particles.push(part)
      gsap.to(obj, {
        t: 1,
        duration: 2.2 + Math.random() * 2.5,
        ease: 'none', repeat: -1,
        delay: k * 1.1 + Math.random() * 1.5,
        onUpdate () {
          const pos = qbez(obj.t, p0, cp, p1)
          part.x = pos.x; part.y = pos.y
          const t = obj.t
          part.a = t < 0.12 ? t / 0.12 : t > 0.88 ? (1 - t) / 0.12 : 1
        }
      })
    }
  })
}

// ── GSAP: estrelas cadentes ───────────────────────────────────────
function spawnShootingStars () {
  function spawn () {
    if (!canvas.value) return
    const w = canvas.value.width, h = canvas.value.height
    const angle  = (8 + Math.random() * 22) * Math.PI / 180
    const startX = Math.random() * w * 0.55
    const startY = Math.random() * h * 0.28
    const dist   = 280 + Math.random() * 220
    const length = 55 + Math.random() * 75

    const obj  = { p: 0 }
    const star = { x: startX, y: startY, angle, length, a: 0 }
    shootingStars.push(star)

    gsap.to(obj, {
      p: 1,
      duration: 0.65 + Math.random() * 0.45,
      ease: 'power2.in',
      onUpdate () {
        const p = obj.p
        star.x = startX + Math.cos(angle) * dist * p
        star.y = startY + Math.sin(angle) * dist * p
        star.a = p < 0.18 ? p / 0.18 : p > 0.72 ? (1 - p) / 0.28 : 1
      },
      onComplete () {
        const idx = shootingStars.indexOf(star)
        if (idx !== -1) shootingStars.splice(idx, 1)
        gsap.delayedCall(2.5 + Math.random() * 4.5, spawn)
      }
    })
  }

  gsap.delayedCall(1.5, spawn)
  gsap.delayedCall(5.5, spawn)
}

// ── GSAP: partículas ambiente ─────────────────────────────────────
function initAmbient () {
  const w = canvas.value.width, h = canvas.value.height
  ambient.forEach(p => {
    p.x = Math.random() * w; p.y = Math.random() * h
    p.size = Math.random() * 1.2 + 0.4
    p.a = Math.random() * 0.5 + 0.1
    const sp = Math.random() * 18 + 4, ang = Math.random() * Math.PI * 2
    p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp
    gsap.to(p, { a: Math.random() * 0.4 + 0.05, duration: Math.random() * 4 + 2, repeat: -1, yoyo: true, ease: 'sine.inOut' })
  })
}

// ── Resize ────────────────────────────────────────────────────────
function resize () {
  if (!canvas.value) return
  canvas.value.width  = canvas.value.offsetWidth
  canvas.value.height = canvas.value.offsetHeight
}

// ── Lifecycle ─────────────────────────────────────────────────────
onMounted(() => {
  ctx = canvas.value.getContext('2d')
  resize()
  initAmbient()
  CITIES.forEach((_, i) => pulseCycle(i))
  spawnParticles(screenCities())
  spawnShootingStars()
  animFrame = requestAnimationFrame(render)
  gsap.to(cgbGlow, { a: 0.95, duration: 1.8, ease: 'sine.inOut', repeat: -1, yoyo: true })
  ro = new ResizeObserver(() => {
    resize()
    particles.length = 0
    spawnParticles(screenCities())
  })
  ro.observe(canvas.value.parentElement)
})

onUnmounted(() => {
  cancelAnimationFrame(animFrame)
  ro?.disconnect()
  gsap.killTweensOf([...pulseRings, ...ambient, cgbGlow])
})
</script>

<style scoped>
.map-canvas {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  display: block;
}
</style>
