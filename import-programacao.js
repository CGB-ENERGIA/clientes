#!/usr/bin/env bun
/**
 * Importa a programação semanal (planilha da supervisão) e aplica as mudanças seguras no sistema.
 * Uso: bun run import-programacao.js "C:\Users\...\PROGRAMAÇÃO SEMANAL EQUIPE PLA.xlsx"
 *      (ou defina PROGRAMACAO_ARQUIVO no .env)
 *
 * Requer no .env:
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_KEY=...   ← Settings > API > service_role (secret)
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { lerProgramacao, hashArquivo } from './src/utils/programacao.js'

const env = {}
readFileSync('.env', 'utf8').split('\n').forEach(ln => {
  const i = ln.indexOf('=')
  if (i > 0) env[ln.slice(0, i).trim()] = ln.slice(i + 1).trim()
})

const SUPABASE_URL = env.VITE_SUPABASE_URL || ''
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY || ''
const ARQUIVO = process.argv[2] || env.PROGRAMACAO_ARQUIVO || ''

if (!SUPABASE_URL || !SERVICE_KEY || SERVICE_KEY === 'COLE_AQUI') {
  console.error('❌  VITE_SUPABASE_URL e SUPABASE_SERVICE_KEY precisam estar no .env')
  process.exit(1)
}
if (!ARQUIVO) {
  console.error('❌  Informe o caminho da planilha: bun run import-programacao.js "caminho\\arquivo.xlsx"')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const buffer = readFileSync(ARQUIVO)
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

const { registros, lidas, ignoradas } = lerProgramacao(arrayBuffer)
const hash = await hashArquivo(arrayBuffer)
const nomeArquivo = ARQUIVO.split(/[\\/]/).pop()

const { data: ultima } = await supabase
  .from('programacao_importacoes')
  .select('hash, criado_em')
  .order('criado_em', { ascending: false })
  .limit(1)
  .maybeSingle()

if (ultima?.hash === hash) {
  console.log(`ℹ️  Planilha sem alterações desde ${new Date(ultima.criado_em).toLocaleString('pt-BR')}. Só reaplicando.`)
} else {
  const { data: rel, error } = await supabase.rpc('importar_programacao', {
    p_registros: registros, p_origem: 'agendador', p_arquivo: nomeArquivo, p_hash: hash
  })
  if (error) {
    console.error('❌  Erro na importação (nada foi alterado):', error.message)
    process.exit(1)
  }
  console.log(`✅  Programação: ${rel.notas} notas gravadas · ${rel.removidas} removidas por saírem da planilha`)
}

const { data: ap, error: erroAplicar } = await supabase.rpc('aplicar_programacao', { p_saps: null })
if (erroAplicar) {
  console.error('❌  Erro ao aplicar:', erroAplicar.message)
  process.exit(1)
}

console.log(`   ↳ ${lidas} linhas lidas${ignoradas ? ` · ${ignoradas} com status desconhecido` : ''}`)
console.log(`   ↳ ${ap.aplicados} nota(s) atualizada(s) no sistema`)
console.log('   ↳ Conferir e sem correspondência ficam na tela Programação\n')
