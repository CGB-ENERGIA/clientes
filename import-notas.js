#!/usr/bin/env bun
/**
 * Importação direta da planilha ACOMPANHAMENTO PLA PAT 1.xlsx
 * Uso: bun run import-notas
 *
 * Requer no .env:
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_KEY=...   ← Settings > API > service_role (secret)
 */
import { readFileSync } from 'fs'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

// ── .env ──────────────────────────────────────────────────────────
const env = {}
readFileSync('.env', 'utf8').split('\n').forEach(ln => {
  const i = ln.indexOf('=')
  if (i > 0) env[ln.slice(0, i).trim()] = ln.slice(i + 1).trim()
})

const SUPABASE_URL = env.VITE_SUPABASE_URL || ''
const SERVICE_KEY  = env.SUPABASE_SERVICE_KEY || ''

if (!SUPABASE_URL) {
  console.error('❌  VITE_SUPABASE_URL não encontrado no .env')
  process.exit(1)
}
if (!SERVICE_KEY || SERVICE_KEY === 'COLE_AQUI') {
  console.error(`
❌  SUPABASE_SERVICE_KEY não configurado no .env

   1. Abra: https://supabase.com/dashboard/project/_/settings/api
   2. Copie a chave "service_role" (secret)
   3. Adicione ao arquivo .env:
      SUPABASE_SERVICE_KEY=eyJ...
   4. Rode novamente: bun run import-notas
`)
  process.exit(1)
}

// service_role bypassa RLS — ideal para scripts de importação
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Lê planilha ───────────────────────────────────────────────────
const PLANILHA = 'C:\\Users\\Italo\\Dropbox\\Acompanhamento 2018\\01. ACOMPANHAMENTO OBRAS\\ACOMPANHAMENTO PLA PAT 1.xlsx'

console.log('\n📂  Lendo planilha...')
const wb  = XLSX.readFile(PLANILHA)
const ws  = wb.Sheets['BASE BI']
const raw = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 })

// Cabeçalho real na linha 2 (índice 1), dados a partir da linha 3 (índice 2)
const cab   = raw[1]
// Normaliza nome de coluna para comparação
const norm = s => String(s).toUpperCase().replace(/[\s_\-\.]+/g, '')

// Detecta colunas por busca flexível (ignora espaços, underscores, maiúsculas)
const colProjetoSap = cab.find(c => norm(c).includes('PROJETOINFOSAP') || norm(c) === 'PROJETOSAP') || ''
const colLigado     = cab.find(c => norm(c).includes('LIGADOEMCAMPO') || norm(c).includes('LIGADO')) || ''
const colBaixado    = cab.find(c => norm(c).includes('BAIXADO')) || ''
const colPoste      = cab.find(c => norm(c) === 'POSTE' || norm(c) === 'POSTES' || norm(c) === 'POSTESINSTALADOS') || ''
const colRetorno    = cab.find(c => norm(c) === 'RETORNO') || ''
const colStatusCcs  = cab.find(c => norm(c) === 'STATUSCCS' || norm(c) === 'STATUS_CCS' || norm(c).includes('STATUSCCS')) || ''

console.log(`   PROJETO INFO SAP → coluna: "${colProjetoSap || '⚠️ NÃO ENCONTRADA'}"`)
console.log(`   LIGADO EM CAMPO? → coluna: "${colLigado     || '⚠️ NÃO ENCONTRADA'}"`)
console.log(`   BAIXADO?         → coluna: "${colBaixado    || '⚠️ NÃO ENCONTRADA'}"`)
console.log(`   POSTE            → coluna: "${colPoste      || '⚠️ NÃO ENCONTRADA'}"`)
console.log(`   RETORNO          → coluna: "${colRetorno    || '⚠️ NÃO ENCONTRADA'}"`)
console.log(`   Todas as colunas: ${cab.filter(Boolean).map(c => `"${c}"`).join(' | ')}`)

// Amostra de 3 linhas
const amostra = raw.slice(2, 5).map(row => {
  const obj = {}
  cab.forEach((col, i) => { if (col) obj[String(col).trim()] = row[i] ?? '' })
  return obj
})
amostra.forEach((obj, i) => {
  console.log(`   linha ${i+3}: NOTA="${obj['NOTA']}" | PROJETO="${obj[colProjetoSap] ?? '—'}" | PEP="${obj['PEP'] ?? '—'}"`)
})

const dados = raw.slice(2).map(row => {
  const obj = {}
  cab.forEach((col, i) => { if (col) obj[String(col).trim()] = row[i] ?? '' })
  return obj
})

// Agrupa por NOTA (1 linha por NOTA), capturando PROJETO INFO SAP como campo extra
const porNota = {}

for (const r of dados) {
  const nota = String(r['NOTA'] || '').trim()
  if (!nota || isNaN(Number(nota))) continue

  // Só importa linhas com RETORNO = "NOTA VALIDADA"
  const retorno = String(colRetorno ? (r[colRetorno] ?? '') : '').trim().toUpperCase()
  if (colRetorno && retorno !== 'NOTA VALIDADA') continue

  const projetoSap = String(colProjetoSap ? (r[colProjetoSap] ?? '') : '').trim()
  const ligado     = String(colLigado    ? (r[colLigado]    ?? '') : '').trim().toUpperCase() === 'SIM'
  const baixado    = String(colBaixado   ? (r[colBaixado]   ?? '') : '').trim().toUpperCase() === 'SIM'
  const statusCcs  = String(colStatusCcs ? (r[colStatusCcs] ?? '') : '').trim().toUpperCase()

  let statusPlanilha
  if      (statusCcs === 'FINL')        statusPlanilha = 'concluido'
  else if (ligado  && baixado)          statusPlanilha = 'concluido'
  else if (ligado  && !baixado)         statusPlanilha = 'baixar_medidor'
  else                                  statusPlanilha = 'pendente'

  const postesVal = colPoste ? Number(r[colPoste] || 0) : 0

  if (!porNota[nota]) {
    porNota[nota] = {
      nota,
      projeto_info_sap:  projetoSap,
      base:              String(r['BASE']      || '').trim(),
      pep:               String(r['PEP']       || '').trim(),
      municipio:         String(r['MUNICIPIO'] || '').trim(),
      postes:            postesVal || 1,
      qtd_clientes:      0,
      clientes_planilha: [],
      ativo:             true,
      _statusPlanilha:   statusPlanilha
    }
  }

  const nome   = String(r['NOME_CLIENTE']   || '').trim()
  const conta  = String(r['CONTA_CONTRATO'] || '').trim()
  const end    = String(r['ENDERECO']       || '').trim()
  const bairro = String(r['BAIRRO']         || '').trim()

  if (nome) {
    const jaExiste = porNota[nota].clientes_planilha.some(c => c.conta_contrato === conta && c.nome === nome)
    if (!jaExiste) {
      porNota[nota].clientes_planilha.push({ nome, conta_contrato: conta, endereco: end, bairro })
      porNota[nota].qtd_clientes++
    }
  }
}

// Preserva status 'concluido' de notas já finalizadas
console.log('🔍  Verificando status existentes...')
const { data: existentes } = await supabase
  .from('notas_servico')
  .select('nota, status')
const statusMap = {}
for (const e of (existentes || [])) statusMap[e.nota] = e.status

const qtdPendente  = Object.values(porNota).filter(r => r._statusPlanilha === 'pendente').length
const qtdLigar     = Object.values(porNota).filter(r => r._statusPlanilha === 'ligar_campo').length
const qtdBaixar    = Object.values(porNota).filter(r => r._statusPlanilha === 'baixar_medidor').length
const qtdConcluido = Object.values(porNota).filter(r => r._statusPlanilha === 'concluido').length
console.log(`   ↳ ${qtdPendente} pendente | ${qtdLigar} ligar-campo | ${qtdBaixar} baixar-medidor | ${qtdConcluido} concluído`)
console.log(`   ↳ ${Object.keys(porNota).length} notas`)

const records = Object.values(porNota).map(r => {
  const statusPlanilha = r._statusPlanilha
  const { _statusPlanilha, ...rest } = r
  const statusAtual = statusMap[r.nota]
  let status
  if (statusAtual === 'concluido') {
    status = 'concluido'
  } else if (statusAtual === 'em_andamento' && statusPlanilha !== 'concluido') {
    status = 'em_andamento'
  } else {
    status = statusPlanilha
  }
  return { ...rest, status }
})
console.log(`✅  ${records.length} notas encontradas`)

records.slice(0, 3).forEach(r => {
  const cls = r.clientes_planilha
  console.log(`   NOTA ${r.nota} | ${r.base} | PEP: ${r.pep || '—'} | ${cls.length} cliente(s)`)
  cls.forEach(c => console.log(`     → ${c.nome} (${c.conta_contrato})`))
})
if (records.length > 3) console.log(`   ... e mais ${records.length - 3}`)

// ── Upsert em lotes ───────────────────────────────────────────────
console.log('\n🔄  Importando para o Supabase...')

const LOTE = 50
let importadas = 0
let erros = 0

for (let i = 0; i < records.length; i += LOTE) {
  const lote = records.slice(i, i + LOTE)

  const { error } = await supabase
    .from('notas_servico')
    .upsert(lote, { onConflict: 'nota' })

  if (error) {
    erros++
    if (erros === 1) console.error('\n⚠️  Erro em lote:', error.message)
    // Continua mesmo com erro para tentar os demais lotes
  }

  importadas += lote.length
  process.stdout.write(`\r   ${importadas}/${records.length} notas...`)
}

// ── Desativa notas que não estão mais na planilha ────────────────
console.log('🧹  Verificando notas órfãs...')
const notasImportadas = new Set(records.map(r => r.nota))

// Busca todas as notas ativas no banco
const { data: todasAtivas } = await supabase
  .from('notas_servico')
  .select('nota')
  .eq('ativo', true)

const orfas = (todasAtivas || []).map(r => r.nota).filter(n => !notasImportadas.has(n))

if (orfas.length > 0) {
  console.log(`   ↳ ${orfas.length} nota(s) não encontrada(s) na planilha: ${orfas.slice(0, 5).join(', ')}${orfas.length > 5 ? '...' : ''}`)
  const { error: errOrfas } = await supabase
    .from('notas_servico')
    .update({ ativo: false })
    .in('nota', orfas)
  if (!errOrfas) console.log(`   ↳ Desativadas com sucesso.`)
  else console.warn('   ⚠️  Erro ao desativar:', errOrfas.message)
} else {
  console.log('   ↳ Nenhuma nota órfã encontrada.')
}

console.log(`\n`)

if (erros === 0) {
  console.log(`✅  Importação concluída! ${records.length} notas no banco.`)
  console.log(`   Abra o sistema para ver as notas.\n`)
} else {
  console.log(`⚠️  Concluído com ${erros} lote(s) com erro.`)
  console.log(`   Verifique se as colunas "municipio" e "clientes_planilha" existem.`)
  console.log(`   Execute setup.sql no Supabase SQL Editor e tente novamente.\n`)
}
