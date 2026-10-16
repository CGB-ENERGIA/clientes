import * as XLSX from 'xlsx'

export const ROTULO_PROGRAMACAO = {
  PROGRAMADA: 'Programada',
  ANDAMENTO: 'Andamento',
  CONCLUIDA: 'Concluída',
  REPROGRAMAR: 'Reprogramar',
  CANCELAR: 'Cancelar'
}

const normalizar = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
const texto = v => String(v ?? '').trim()

function dataISO (v) {
  if (v instanceof Date && !isNaN(v)) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  const m = String(v ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

const maisRecentePrimeiro = (a, b) => (b.data_programada || '').localeCompare(a.data_programada || '')

// Cada linha da planilha é um cliente (conta contrato) dentro da nota. Por cliente vale a situação mais recente
// (ignorando cancelamentos); a nota fica CONCLUÍDA só quando todos os clientes concluíram.
function resumirNota (linhas) {
  const porCliente = new Map()
  for (const l of linhas) {
    const chave = l.conta || l.cliente || '-'
    if (!porCliente.has(chave)) porCliente.set(chave, [])
    porCliente.get(chave).push(l)
  }

  // Cliente que já teve visita em andamento e agora tem nova visita programada continua em andamento
  const atuais = []
  for (const grupo of porCliente.values()) {
    const validas = grupo.filter(l => l.status !== 'CANCELAR').sort(maisRecentePrimeiro)
    if (!validas.length) continue
    const ultima = validas[0]
    const jaIniciado = validas.some(l => l.status === 'ANDAMENTO')
    const emCurso = jaIniciado && ['PROGRAMADA', 'REPROGRAMAR'].includes(ultima.status)
    atuais.push(emCurso ? { ...ultima, status: 'ANDAMENTO' } : ultima)
  }

  const base = [...linhas].sort(maisRecentePrimeiro)[0]
  if (!atuais.length) return { ...base, status: 'CANCELAR' }

  const status = atuais.every(l => l.status === 'CONCLUIDA') ? 'CONCLUIDA'
    : atuais.some(l => l.status === 'ANDAMENTO' || l.status === 'CONCLUIDA') ? 'ANDAMENTO'
    : atuais.some(l => l.status === 'REPROGRAMAR') ? 'REPROGRAMAR'
    : 'PROGRAMADA'
  const maisRecente = [...atuais].sort(maisRecentePrimeiro)[0]
  return { ...base, status, data_programada: maisRecente.data_programada }
}

export function lerProgramacao (buffer) {
  const wb = XLSX.read(buffer, { cellDates: true })
  const ws = wb.Sheets.BASE
  if (!ws) throw new Error('A planilha não tem a aba "BASE".')

  // A linha 1 é um título; o cabeçalho real está na linha 2
  const linhas = XLSX.utils.sheet_to_json(ws, { defval: '', range: 1 })
  const porNota = new Map()
  let lidas = 0
  let ignoradas = 0

  for (const r of linhas) {
    const nota = texto(r.NOTA).replace(/\.0+$/, '')
    if (!nota) continue
    lidas++
    const status = normalizar(r.STATUS)
    if (!ROTULO_PROGRAMACAO[status]) { ignoradas++; continue }
    if (!porNota.has(nota)) porNota.set(nota, [])
    porNota.get(nota).push({
      status,
      data_programada: dataISO(r.DATA),
      pep: texto(r.PEP),
      municipio: texto(r.LOCAL),
      equipe: texto(r.EQUIPE),
      supervisor: texto(r.SUPERVISOR),
      motivo: texto(r.MOTIVO),
      observacao: texto(r['OBSERVAÇÃO']),
      conta: texto(r['CONTA CONTRATO']),
      cliente: texto(r['NOME CLIENTE'])
    })
  }

  const registros = []
  for (const [nota, grupo] of porNota) {
    const r = resumirNota(grupo)
    registros.push({
      nota,
      status: r.status,
      data_programada: r.data_programada,
      pep: r.pep,
      municipio: r.municipio,
      equipe: r.equipe,
      supervisor: r.supervisor,
      motivo: r.motivo,
      observacao: r.observacao,
      linhas: grupo.length
    })
  }

  return { registros, lidas, ignoradas }
}

export async function hashArquivo (buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}
