import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from 'boot/supabase'
import * as XLSX from 'xlsx'

const CACHE_KEY = 'cgb_notas_cache'

export const useNotasStore = defineStore('notas', () => {
  const notas      = ref([])
  const loading    = ref(false)
  const importando = ref(false)

  // Inicializa do cache (garante offline no campo)
  try {
    const c = localStorage.getItem(CACHE_KEY)
    if (c) notas.value = JSON.parse(c)
  } catch {}

  async function fetchNotas () {
    loading.value = true
    const { data, error } = await supabase
      .from('notas_servico')
      .select('*')
      .eq('ativo', true)
      .order('nota')
    if (!error && data) {
      notas.value = data
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    }
    loading.value = false
    return { error }
  }

  async function importarXlsx (file) {
    importando.value = true
    try {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf)

      // Planilha BASE BI tem cabeçalho na linha 2 e dados a partir da linha 3
      const sheetName = wb.SheetNames.includes('BASE BI') ? 'BASE BI' : wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]

      let records

      if (sheetName === 'BASE BI') {
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 })
        const cab = raw[1] // linha 2 = cabeçalho real
        const dados = raw.slice(2).map(row => {
          const obj = {}
          cab.forEach((col, i) => { if (col) obj[String(col).trim()] = row[i] ?? '' })
          return obj
        })

        const porNota2 = {}

        // Detecta colunas por busca flexível
        const normCol2 = s => String(s).toUpperCase().replace(/[\s_\-\.]+/g, '')
        const cols2 = dados[0] ? Object.keys(dados[0]) : []
        const colProjSap  = cols2.find(c => normCol2(c).includes('PROJETOINFOSAP') || normCol2(c) === 'PROJETOSAP') || ''
        const colLig      = cols2.find(c => normCol2(c).includes('LIGADOEMCAMPO')) || ''
        const colBx       = cols2.find(c => normCol2(c).includes('BAIXADO')) || ''
        const colPoste2    = cols2.find(c => normCol2(c) === 'POSTE' || normCol2(c) === 'POSTES' || normCol2(c) === 'POSTESINSTALADOS') || ''
        const colRetorno2  = cols2.find(c => normCol2(c) === 'RETORNO') || ''
        const colStatusCcs2 = cols2.find(c => normCol2(c) === 'STATUSCCS' || normCol2(c).includes('STATUSCCS')) || ''

        for (const r of dados) {
          const nota = String(r['NOTA'] || '').trim()
          if (!nota || isNaN(Number(nota))) continue

          // Rejeita apenas EXPURGO e SEM ACESSO — aceita NOTA VALIDADA e em branco
          const retorno2 = String(colRetorno2 ? (r[colRetorno2] ?? '') : '').trim().toUpperCase()
          if (colRetorno2 && (retorno2 === 'EXPURGO' || retorno2 === 'SEM ACESSO')) continue

          const projetoSap = String(colProjSap ? (r[colProjSap] ?? '') : '').trim()
          const ligado     = String(colLig       ? (r[colLig]        ?? '') : '').trim().toUpperCase() === 'SIM'
          const baixado    = String(colBx        ? (r[colBx]         ?? '') : '').trim().toUpperCase() === 'SIM'
          const statusCcs2 = String(colStatusCcs2 ? (r[colStatusCcs2] ?? '') : '').trim().toUpperCase()
          const postesVal  = colPoste2 ? Number(r[colPoste2] || 0) : 0

          let statusPlanilha
          if      (statusCcs2 === 'FINL')   statusPlanilha = 'concluido'
          else if (ligado  && baixado)       statusPlanilha = 'concluido'
          else if (ligado  && !baixado)      statusPlanilha = 'baixar_medidor'
          else                               statusPlanilha = 'pendente'

          if (!porNota2[nota]) {
            porNota2[nota] = {
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
            const jaExiste = porNota2[nota].clientes_planilha.some(c => c.conta_contrato === conta && c.nome === nome)
            if (!jaExiste) {
              porNota2[nota].clientes_planilha.push({ nome, conta_contrato: conta, endereco: end, bairro })
              porNota2[nota].qtd_clientes++
            }
          }
        }

        // Preserva status existente (concluido e em_andamento nunca regridem)
        const { data: existentes } = await supabase
          .from('notas_servico')
          .select('nota, status')
        const statusMap = {}
        for (const e of (existentes || [])) statusMap[e.nota] = e.status

        records = Object.values(porNota2).map(r => {
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
      } else {
        // Formato template simples: BASE, PEP, NOTA, POSTES, QTD_CLIENTES
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

        function col (row, ...nomes) {
          const keys = Object.keys(row)
          for (const n of nomes) {
            const k = keys.find(k => k.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') === n.toUpperCase().replace(/[^A-Z0-9]/g, ''))
            if (k !== undefined) return row[k]
          }
          return ''
        }

        records = rows.map(r => ({
          base:         String(col(r, 'BASE') || '').trim(),
          pep:          String(col(r, 'PEP') || '').trim(),
          nota:         String(col(r, 'NOTA') || '').trim(),
          postes:       Number(col(r, 'POSTES') || 0),
          qtd_clientes: Number(col(r, 'QTDCLIENTES', 'QTD_CLIENTES') || 0),
          ativo:        true
        })).filter(r => r.nota?.trim())
      }

      if (!records.length) {
        return { error: new Error('Nenhuma nota encontrada na planilha.'), count: 0 }
      }

      const { error } = await supabase
        .from('notas_servico')
        .upsert(records, { onConflict: 'nota' })

      if (!error) {
        // Desativa notas que saíram da planilha
        const notasImportadas = records.map(r => r.nota)
        const { data: todasAtivas } = await supabase
          .from('notas_servico')
          .select('nota')
          .eq('ativo', true)
        const orfas = (todasAtivas || []).map(r => r.nota).filter(n => !notasImportadas.includes(n))
        if (orfas.length > 0) {
          await supabase.from('notas_servico').update({ ativo: false }).in('nota', orfas)
        }
        await fetchNotas()
      }
      return { error, count: records.length }
    } catch (e) {
      return { error: e, count: 0 }
    } finally {
      importando.value = false
    }
  }

  const notasOptions = computed(() =>
    notas.value.map(n => ({
      value: n.nota,
      label: `${n.nota}  •  ${n.base}`,
      sublabel: `PEP ${n.pep}  |  ${n.postes} postes`,
      nota: n
    }))
  )

  function getNota (notaCode) {
    return notas.value.find(n => n.nota === notaCode)
  }

  async function atualizarStatus (nota, status) {
    const { error } = await supabase
      .from('notas_servico')
      .update({ status })
      .eq('nota', nota)
    if (!error) {
      const item = notas.value.find(n => n.nota === nota)
      if (item) item.status = status
      localStorage.setItem(CACHE_KEY, JSON.stringify(notas.value))
    }
    return { error }
  }

  async function buscarRegistrosCampo (nota) {
    const { data } = await supabase
      .from('campo_registros')
      .select('id, pg_numero, equipe, created_at, foto_url')
      .eq('nota', nota)
      .order('created_at', { ascending: true })
    return data ?? []
  }

  return { notas, loading, importando, fetchNotas, importarXlsx, notasOptions, getNota, atualizarStatus, buscarRegistrosCampo }
})
