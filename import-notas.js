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
// Só entram no sistema as notas da equipe STC/GERE ou sem programação definida
const PROGRAMACOES_ACEITAS = new Set(['', 'EQUIPE STC/GERE'])

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

function lerCoordenada (v) {
  if (v === '' || v == null) return null
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) && n !== 0 ? n : null
}

for (const r of dados) {
  const nota = String(r['NOTA'] || '').trim()
  if (!nota || isNaN(Number(nota))) continue
  if (!PROGRAMACOES_ACEITAS.has(String(r['PROGRAMAÇÃO'] ?? '').trim().toUpperCase())) continue

  const retorno    = String(colRetorno    ? (r[colRetorno]    ?? '') : '').trim().toUpperCase()
  const projetoSap = String(colProjetoSap ? (r[colProjetoSap] ?? '') : '').trim()
  const ligado     = String(colLigado    ? (r[colLigado]    ?? '') : '').trim().toUpperCase() === 'SIM'
  const baixado    = String(colBaixado   ? (r[colBaixado]   ?? '') : '').trim().toUpperCase() === 'SIM'
  const statusCcs  = String(colStatusCcs ? (r[colStatusCcs] ?? '') : '').trim().toUpperCase()

  let statusPlanilha
  if      (retorno === 'EXPURGO')       statusPlanilha = 'expurgo'
  else if (retorno === 'SEM ACESSO')    statusPlanilha = 'sem_acesso'
  else if (statusCcs === 'FINL')        statusPlanilha = 'concluido'
  else if (ligado  && baixado)          statusPlanilha = 'concluido'
  else if (ligado  && !baixado)         statusPlanilha = 'aguardando_etapa2'
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
      status_planilha:   statusPlanilha,
      latitude:          lerCoordenada(r['LATITUDE']),
      longitude:         lerCoordenada(r['LONGITUDE'])
    }
  } else if (porNota[nota].latitude == null) {
    porNota[nota].latitude  = lerCoordenada(r['LATITUDE'])
    porNota[nota].longitude = lerCoordenada(r['LONGITUDE'])
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

const records = Object.values(porNota)
const contar = s => records.filter(r => r.status_planilha === s).length
console.log(`   ↳ ${contar('pendente')} pendente | ${contar('aguardando_etapa2')} aguardando-etapa2 | ${contar('baixar_medidor')} auditar | ${contar('concluido')} concluído | ${contar('expurgo')} expurgo | ${contar('sem_acesso')} sem acesso`)
console.log(`✅  ${records.length} notas encontradas`)

records.slice(0, 3).forEach(r => {
  const cls = r.clientes_planilha
  console.log(`   NOTA ${r.nota} | ${r.base} | PEP: ${r.pep || '—'} | ${cls.length} cliente(s)`)
  cls.forEach(c => console.log(`     → ${c.nome} (${c.conta_contrato})`))
})
if (records.length > 3) console.log(`   ... e mais ${records.length - 3}`)

// ── Importação (mesma função usada pelo sistema) ──────────────────
// A mesclagem acontece no banco numa única transação: status nunca regridem,
// notas com trabalho em andamento não são desativadas e há trava contra desativação em massa.
const forcar = process.argv.includes('--forcar')
console.log('\n🔄  Importando para o Supabase...')

const { data: rel, error } = await supabase.rpc('importar_notas', {
  p_registros: records,
  p_desativar_ausentes: true,
  p_forcar: forcar,
  p_origem: 'script'
})

if (error) {
  const m = error.message?.match(/DESATIVACAO_EM_MASSA:(\d+):(\d+)/)
  if (m) {
    console.error(`\n⛔  Bloqueado: a planilha desativaria ${m[1]} de ${m[2]} notas ativas. Nada foi alterado.`)
    console.error('   Confira o arquivo. Para importar mesmo assim: bun run import-notas -- --forcar\n')
  } else {
    console.error('\n❌  Erro na importação (nada foi alterado):', error.message, '\n')
  }
  process.exit(1)
}

console.log(`\n✅  Importação concluída: ${rel.total} notas · ${rel.novas} novas · ${rel.status_alterados} com status alterado`)
if (rel.preservados.length) console.log(`   ↳ ${rel.preservados.length} avanço(s) do sistema preservado(s)`)
if (rel.conflitos.length)   console.log(`   ⚠️  ${rel.conflitos.length} conflito(s) (concluída no sistema x Expurgo/Sem Acesso na planilha): ${rel.conflitos.map(c => c.nota).join(', ')}`)
if (rel.desativadas.length) console.log(`   ↳ ${rel.desativadas.length} nota(s) desativada(s) por saírem da planilha`)
if (rel.protegidas.length)  console.log(`   ↳ ${rel.protegidas.length} nota(s) fora da planilha mantidas ativas (trabalho em andamento)`)
console.log('')