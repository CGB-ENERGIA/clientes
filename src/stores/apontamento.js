import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from 'boot/supabase'

export const useApontamentoStore = defineStore('apontamento', () => {
  const apontamentos = ref([])
  const loading = ref(false)

  const filtros = ref({
    pep: '',
    nota: '',
    dataInicio: '',
    dataFim: ''
  })

  const apontamentosFiltrados = computed(() => {
    return apontamentos.value.filter(a => {
      const matchPep = !filtros.value.pep ||
        a.pep.toLowerCase().includes(filtros.value.pep.toLowerCase())

      const matchNota = !filtros.value.nota ||
        a.nota.toLowerCase().includes(filtros.value.nota.toLowerCase())

      const dataAp = a.created_at ? a.created_at.substring(0, 10) : ''
      const matchInicio = !filtros.value.dataInicio || dataAp >= filtros.value.dataInicio
      const matchFim = !filtros.value.dataFim || dataAp <= filtros.value.dataFim

      return matchPep && matchNota && matchInicio && matchFim
    })
  })

  const totais = computed(() => {
    const postes = apontamentosFiltrados.value.reduce((sum, a) => sum + (a.postes || 0), 0)
    const clientes = apontamentosFiltrados.value.reduce((sum, a) => sum + (a.clientes || []).length, 0)
    return { postes, clientes }
  })

  async function fetchApontamentos () {
    loading.value = true
    const { data, error } = await supabase
      .from('apontamentos')
      .select('*, clientes(*)')
      .order('created_at', { ascending: false })
    if (!error) apontamentos.value = data || []
    loading.value = false
    return { error }
  }

  async function addApontamento ({ base, pep, nota, postes, pg_numeros, clientes, todos_atendidos, nao_atendidos, qtd_clientes_nota }) {
    const { data: ap, error } = await supabase
      .from('apontamentos')
      .insert({ base, pep, nota, postes, pg_numeros, todos_atendidos, nao_atendidos, qtd_clientes_nota })
      .select()
      .single()

    if (error) return { error }

    if (clientes.length > 0) {
      const { error: ce } = await supabase.from('clientes').insert(
        clientes.map(c => ({
          nome: c.nome,
          padrao: c.padrao || '',
          conta_contrato: c.conta_contrato || null,
          apontamento_id: ap.id
        }))
      )
      if (ce) return { error: ce }
    }

    await fetchApontamentos()
    return { error: null }
  }

  async function updateApontamento (id, { base, pep, nota, postes, pg_numeros, clientes, todos_atendidos, nao_atendidos, qtd_clientes_nota }) {
    const { error } = await supabase
      .from('apontamentos')
      .update({ base, pep, nota, postes, pg_numeros, todos_atendidos, nao_atendidos, qtd_clientes_nota })
      .eq('id', id)

    if (error) return { error }

    await supabase.from('clientes').delete().eq('apontamento_id', id)

    if (clientes.length > 0) {
      await supabase.from('clientes').insert(
        clientes.map(c => ({
          nome: c.nome,
          padrao: c.padrao || '',
          conta_contrato: c.conta_contrato || null,
          apontamento_id: id
        }))
      )
    }

    await fetchApontamentos()
    return { error: null }
  }

  async function deleteApontamento (id) {
    const { error } = await supabase.from('apontamentos').delete().eq('id', id)
    if (!error) apontamentos.value = apontamentos.value.filter(a => a.id !== id)
    return { error }
  }

  return {
    apontamentos,
    loading,
    filtros,
    apontamentosFiltrados,
    totais,
    fetchApontamentos,
    addApontamento,
    updateApontamento,
    deleteApontamento
  }
})
