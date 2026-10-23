// Gera uma imagem (PNG) com as quantidades de postes do período, pronta para o WhatsApp.
// Desenho feito no próprio navegador, sem serviços externos.

const LARGURA = 1080
const ALTURA = 1350
const ESCURO = '#0a1628'
const AZUL = '#1d4ed8'
const AZUL_CLARO = '#38bdf8'
const CEU = '#e0f2fe'
const LARANJA = '#f97316'
const VERDE = '#16a34a'
const TEXTO = '#0f172a'
const CINZA = '#64748b'
const MAX_POSTES_DESENHADOS = 24

const fonte = (tamanho, peso = 'normal') => `${peso} ${tamanho}px Arial, Helvetica, sans-serif`

function dataBr (iso) {
  return iso ? iso.split('-').reverse().join('/') : ''
}

function arredondar (ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function textoCentralizado (ctx, texto, x, y, tamanho, cor, peso = 'normal') {
  ctx.font = fonte(tamanho, peso)
  ctx.fillStyle = cor
  ctx.textAlign = 'center'
  ctx.fillText(texto, x, y)
  ctx.textAlign = 'left'
}

// Poste de concreto com cruzeta e isoladores
function desenharPoste (ctx, x, base, altura) {
  const topo = base - altura
  const largura = altura * 0.09

  ctx.fillStyle = '#e2e8f0'
  ctx.beginPath()
  ctx.moveTo(x - largura * 0.5, base)
  ctx.lineTo(x - largura * 0.32, topo)
  ctx.lineTo(x + largura * 0.32, topo)
  ctx.lineTo(x + largura * 0.5, base)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = Math.max(1, altura * 0.006)
  for (let k = 1; k < 6; k++) {
    const yy = base - (altura * k) / 6
    const meia = largura * (0.5 - 0.18 * (k / 6))
    ctx.beginPath()
    ctx.moveTo(x - meia, yy)
    ctx.lineTo(x + meia, yy)
    ctx.stroke()
  }

  const cruzeta = largura * 3.4
  const yCruzeta = topo + altura * 0.1
  ctx.fillStyle = '#64748b'
  ctx.fillRect(x - cruzeta / 2, yCruzeta, cruzeta, Math.max(3, altura * 0.04))

  ctx.fillStyle = '#f8fafc'
  for (const dx of [-cruzeta * 0.42, cruzeta * 0.42]) {
    ctx.beginPath()
    ctx.arc(x + dx, yCruzeta - altura * 0.025, Math.max(2.5, altura * 0.03), 0, Math.PI * 2)
    ctx.fill()
  }
}

// Fio entre dois postes, com a flexão natural do cabo
function desenharFio (ctx, x1, y1, x2, y2) {
  const flexa = Math.abs(x2 - x1) * 0.06 + 6
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.quadraticCurveTo((x1 + x2) / 2, Math.max(y1, y2) + flexa, x2, y2)
  ctx.stroke()
}

function desenharIlustracao (ctx, total, topo, base) {
  // Céu e chão
  const grad = ctx.createLinearGradient(0, topo, 0, base)
  grad.addColorStop(0, CEU)
  grad.addColorStop(1, '#f1f5f9')
  ctx.fillStyle = grad
  ctx.fillRect(0, topo, LARGURA, base - topo)
  ctx.fillStyle = '#bbf7d0'
  ctx.fillRect(0, base, LARGURA, ALTURA - base)

  if (!total) {
    textoCentralizado(ctx, 'Nenhum poste neste período', LARGURA / 2, (topo + base) / 2, 40, CINZA, 'bold')
    return
  }

  const quantos = Math.min(total, MAX_POSTES_DESENHADOS)
  const margem = 70
  const passo = (LARGURA - margem * 2) / Math.max(1, quantos - 1)
  const altura = quantos > 14 ? 230 : 280
  const yBase = base - 30
  const pontos = []

  for (let i = 0; i < quantos; i++) {
    const x = quantos === 1 ? LARGURA / 2 : margem + i * passo
    const alturaPoste = altura * (0.94 + ((i * 37) % 7) / 100)
    desenharPoste(ctx, x, yBase, alturaPoste)
    pontos.push({ x, y: yBase - alturaPoste + alturaPoste * 0.1 + 4, w: alturaPoste * 0.075 * 3.4 })
  }

  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i]
    const b = pontos[i + 1]
    desenharFio(ctx, a.x + a.w * 0.42, a.y, b.x - b.w * 0.42, b.y)
    desenharFio(ctx, a.x + a.w * 0.42, a.y + 14, b.x - b.w * 0.42, b.y + 14)
  }

}

function desenharCartao (ctx, x, y, w, h, numero, rotulo, cor) {
  ctx.save()
  ctx.shadowColor = 'rgba(15, 23, 42, 0.12)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 6
  ctx.fillStyle = '#ffffff'
  arredondar(ctx, x, y, w, h, 26)
  ctx.fill()
  ctx.restore()
  textoCentralizado(ctx, numero, x + w / 2, y + 90, 70, cor, 'bold')
  textoCentralizado(ctx, rotulo, x + w / 2, y + 138, 26, CINZA, 'bold')
}

function desenharEquipes (ctx, equipes, y) {
  textoCentralizado(ctx, 'Produção por equipe', LARGURA / 2, y, 36, TEXTO, 'bold')
  if (!equipes.length) {
    textoCentralizado(ctx, 'Sem produção registrada', LARGURA / 2, y + 60, 28, CINZA)
    return
  }
  const maior = Math.max(...equipes.map(e => e.postes), 1)
  const x = 90
  const largura = LARGURA - 180
  equipes.slice(0, 7).forEach((e, i) => {
    const yy = y + 50 + i * 74
    ctx.font = fonte(28, 'bold')
    ctx.fillStyle = TEXTO
    ctx.fillText(e.equipe, x, yy)
    ctx.textAlign = 'right'
    ctx.fillText(`${e.postes.toLocaleString('pt-BR')} postes`, x + largura, yy)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#e2e8f0'
    arredondar(ctx, x, yy + 12, largura, 22, 11)
    ctx.fill()
    const proporcao = Math.max(0.04, e.postes / maior)
    const grad = ctx.createLinearGradient(x, 0, x + largura, 0)
    grad.addColorStop(0, AZUL)
    grad.addColorStop(1, AZUL_CLARO)
    ctx.fillStyle = grad
    arredondar(ctx, x, yy + 12, largura * proporcao, 22, 11)
    ctx.fill()
  })
}

// Recebe os dados de implDados (ProgramacaoPage) e o período, e devolve um Blob PNG
export async function gerarImagemImplantacao (dados, periodo) {
  const canvas = document.createElement('canvas')
  canvas.width = LARGURA
  canvas.height = ALTURA
  const ctx = canvas.getContext('2d')

  const total = dados?.total_postes ?? 0
  const clientes = dados?.total_clientes ?? 0
  const apontados = dados?.total_apontados ?? 0
  const antigos = dados?.total_antigos ?? 0
  const dias = dados?.dias ?? []
  const diasComProducao = dias.length

  const porEquipe = new Map()
  for (const d of dias) {
    for (const e of d.equipes ?? []) {
      porEquipe.set(e.equipe, (porEquipe.get(e.equipe) ?? 0) + (Number(e.postes) || 0))
    }
  }
  const equipes = [...porEquipe.entries()]
    .map(([equipe, postes]) => ({ equipe, postes }))
    .sort((a, b) => b.postes - a.postes)

  // Cabeçalho escuro com o número principal
  ctx.fillStyle = ESCURO
  ctx.fillRect(0, 0, LARGURA, 300)
  ctx.fillStyle = LARANJA
  ctx.fillRect(0, 300, LARGURA, 8)
  textoCentralizado(ctx, 'Implantação de postes', LARGURA / 2, 70, 52, '#ffffff', 'bold')
  textoCentralizado(ctx, `${dataBr(periodo.inicio)} a ${dataBr(periodo.fim)}`, LARGURA / 2, 116, 30, AZUL_CLARO)
  textoCentralizado(ctx, total.toLocaleString('pt-BR'), LARGURA / 2, 252, 130, '#ffffff', 'bold')
  textoCentralizado(ctx, total === 1 ? 'poste implantado' : 'postes implantados', LARGURA / 2, 292, 30, '#cbd5e1')

  // Ilustração dos postes
  desenharIlustracao(ctx, total, 308, 640)

  // Cartões de números
  const cw = 300
  const gap = (LARGURA - 90 - cw * 3) / 2
  desenharCartao(ctx, 45, 680, cw, 170, clientes.toLocaleString('pt-BR'), 'clientes atendidos', AZUL)
  desenharCartao(ctx, 45 + cw + gap, 680, cw, 170, diasComProducao.toLocaleString('pt-BR'), 'dias com produção', AZUL)
  desenharCartao(ctx, 45 + (cw + gap) * 2, 680, cw, 170, apontados.toLocaleString('pt-BR'), 'postes apontados', VERDE)

  // Equipes
  desenharEquipes(ctx, equipes, 900)

  // Rodapé
  ctx.fillStyle = ESCURO
  ctx.fillRect(0, ALTURA - 110, LARGURA, 110)
  const agora = new Date()
  const quando = agora.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  textoCentralizado(ctx, `CGB Energia · gerado em ${quando}`, LARGURA / 2, ALTURA - 54, 28, '#ffffff', 'bold')
  if (antigos) {
    textoCentralizado(ctx, `${antigos} poste(s) antigo(s) não contabilizados`, LARGURA / 2, ALTURA - 22, 22, '#94a3b8')
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Não foi possível gerar a imagem'))), 'image/png')
  })
}
