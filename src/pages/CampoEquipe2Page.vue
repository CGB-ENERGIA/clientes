<template>
  <div class="eq2">
    <header class="eq2-head">
      <button v-if="notaAtiva" class="eq2-voltar" type="button" aria-label="Voltar" @click="voltarLista">
        <q-icon name="arrow_back" size="20px" />
      </button>
      <div class="eq2-brand">CGB <span>Campo</span> · Equipe 2</div>
    </header>

    <!-- Lista: só notas em andamento -->
    <section v-if="!notaAtiva" class="eq2-bloco">
      <label class="eq2-label">Nome da equipe</label>
      <input v-model="equipe" class="eq2-input" placeholder="Ex: EQUIPE BETA" style="text-transform:uppercase" @input="equipe = equipe.toUpperCase()" @change="guardarEquipe" />

      <label class="eq2-label q-mt-md">Obras para a equipe 2</label>
      <input v-model="busca" class="eq2-input" placeholder="Buscar nota, SAP ou município" />
      <div class="eq2-filtros">
        <button
          v-for="f in FILTROS" :key="f.val" type="button" class="eq2-filtro"
          :class="{ 'eq2-filtro--on': filtroLista === f.val }"
          @click="filtroLista = f.val"
        >
          {{ f.label }} <b>{{ contagemFiltro(f.val) }}</b>
        </button>
      </div>

      <div v-if="carregando" class="eq2-vazio">Carregando obras…</div>
      <div v-else-if="!notasFiltradas.length" class="eq2-vazio">Nenhuma obra encontrada.</div>
      <button v-for="n in notasFiltradas" :key="n.nota" class="eq2-card" type="button" @click="abrirNota(n)">
        <div class="eq2-card-top">
          <b>{{ n.projeto_info_sap || n.nota }}</b>
          <span class="eq2-chip">{{ n.postes }} {{ n.postes === 1 ? 'poste' : 'postes' }}</span>
        </div>
        <div class="eq2-card-sub">
          {{ n.municipio || n.base }} · {{ n.clientes_planilha?.length || 0 }} clientes
          <span v-if="n.rascunho"> · rascunho salvo</span>
        </div>
        <div class="eq2-tags">
          <span v-if="n.prog_data" class="eq2-tag eq2-tag--prog">
            Programada {{ dataCurta(n.prog_data) }}<template v-if="n.prog_equipe"> · {{ n.prog_equipe }}</template>
          </span>
          <span class="eq2-tag" :class="n.postes ? 'eq2-tag--ok' : 'eq2-tag--pend'">
            {{ n.postes ? 'Etapa 1 feita' : 'Etapa 1 pendente' }}
          </span>
        </div>
      </button>
    </section>

    <!-- Nota: serviço + clientes -->
    <section v-else class="eq2-bloco">
      <div class="eq2-nota">
        <div class="eq2-nota-sap">SAP {{ notaAtiva.projeto_info_sap || notaAtiva.nota }}</div>
        <div class="eq2-nota-sub">
          {{ notaAtiva.municipio || notaAtiva.base }} · Etapa 1: {{ postesCampo }} {{ postesCampo === 1 ? 'poste' : 'postes' }}
        </div>
        <div v-if="notaAtiva.pgs?.length" class="eq2-tags">
          <span v-for="pg in notaAtiva.pgs" :key="pg" class="eq2-tag">PG {{ pg }}</span>
        </div>
        <div v-if="notaAtiva.prog_data" class="eq2-nota-sub">
          Programada para {{ dataCurta(notaAtiva.prog_data) }}<template v-if="notaAtiva.prog_equipe"> · {{ notaAtiva.prog_equipe }}</template>
          <template v-if="notaAtiva.prog_postes != null"> · {{ notaAtiva.prog_postes }} postes previstos</template>
        </div>
        <div v-if="!postesCampo" class="eq2-nota-sub">Etapa 1 ainda não registrada pela equipe de campo.</div>
      </div>

      <!-- Serviços realizados: cada um com uma descrição e uma foto -->
      <div class="eq2-cartao">
        <div class="eq2-titulo">Serviços realizados <small>{{ servicosProntos }} de {{ servicos.length }}</small></div>
        <div v-for="(s, i) in servicos" :key="s.chave" class="eq2-servico">
          <div class="eq2-servico-topo">
            <span class="eq2-label">Serviço {{ i + 1 }}</span>
            <button v-if="servicos.length > 1" class="eq2-remover" type="button" :disabled="enviando" @click="removerServico(i)">
              Remover serviço
            </button>
          </div>
          <textarea v-model="s.descricao" class="eq2-input eq2-textarea" rows="3" placeholder="Descreva o serviço executado" />
          <div v-if="s.foto" class="eq2-fotos">
            <div class="eq2-foto-item">
              <img :src="s.foto" alt="Foto do serviço" />
              <button class="eq2-foto-x" type="button" aria-label="Remover foto" :disabled="enviando" @click="s.foto = ''">
                <q-icon name="close" size="14px" />
              </button>
            </div>
          </div>
          <label class="eq2-foto">
            <span><q-icon name="photo_camera" size="24px" /> {{ s.foto ? 'Trocar foto' : 'Tirar foto do serviço' }}</span>
            <input type="file" accept="image/*" capture="environment" hidden :disabled="enviando" @change="fotoDoServico(s, $event)" />
          </label>
        </div>
        <button class="eq2-btn eq2-btn--sec eq2-add" type="button" :disabled="enviando" @click="adicionarServico">
          <q-icon name="add" size="18px" /> Adicionar serviço
        </button>
      </div>

      <!-- Clientes e medidores -->
      <div class="eq2-cartao">
        <div class="eq2-titulo">Clientes e medidores <small>{{ clientesProntos }} de {{ clientes.length }}</small></div>
        <div v-if="!clientes.length" class="eq2-vazio">Esta nota não tem clientes na planilha.</div>
        <div v-for="c in clientes" :key="c.chave" class="eq2-cliente" :class="{ 'eq2-cliente--ok': c.medidor.trim() && c.fotos.length }">
          <div class="eq2-cliente-nome">
            {{ c.nome }}
            <span v-if="c.adicional" class="eq2-tag eq2-tag--prog">Adicional</span>
          </div>
          <div class="eq2-cliente-sub">{{ [c.conta, c.endereco].filter(Boolean).join(' · ') }}</div>
          <div class="eq2-cliente-linha">
            <input v-model="c.medidor" class="eq2-input" placeholder="Nº do medidor" :disabled="enviando" />
            <label class="eq2-foto eq2-foto--mini" :class="{ 'eq2-foto--ok': c.fotos.length }" title="Tirar foto">
              <q-icon name="photo_camera" size="20px" />
              <input type="file" accept="image/*" capture="environment" hidden :disabled="enviando" @change="fotosDoMedidor(c, $event)" />
            </label>
            <label class="eq2-foto eq2-foto--mini" title="Escolher várias fotos da galeria">
              <q-icon name="photo_library" size="20px" />
              <input type="file" accept="image/*" multiple hidden :disabled="enviando" @change="fotosDoMedidor(c, $event)" />
            </label>
          </div>
          <div v-if="c.fotos.length" class="eq2-fotos">
            <div v-for="(url, fi) in c.fotos" :key="url" class="eq2-foto-item">
              <img :src="url" alt="Foto do medidor" />
              <button class="eq2-foto-x" type="button" aria-label="Remover foto" :disabled="enviando" @click="removerFotoMedidor(c, fi)">
                <q-icon name="close" size="14px" />
              </button>
            </div>
          </div>
          <button v-if="c.adicional" class="eq2-remover" type="button" :disabled="enviando" @click="removerCliente(c)">
            Remover este cliente adicional
          </button>
        </div>

        <!-- Cliente adicional: que não está na planilha -->
        <div v-if="novoCliente" class="eq2-cliente eq2-novo">
          <div class="eq2-cliente-nome">Novo cliente adicional</div>
          <input v-model="novoCliente.nome" class="eq2-input" placeholder="Nome do cliente *" style="text-transform:uppercase" />
          <input v-model="novoCliente.conta" class="eq2-input" placeholder="Conta contrato (opcional)" inputmode="numeric" />
          <input v-model="novoCliente.endereco" class="eq2-input" placeholder="Endereço (opcional)" />
          <div class="eq2-acoes">
            <button class="eq2-btn eq2-btn--sec" type="button" @click="novoCliente = null">Cancelar</button>
            <button class="eq2-btn eq2-btn--ok" type="button" :disabled="!novoCliente.nome.trim()" @click="adicionarCliente">Adicionar</button>
          </div>
        </div>
        <button v-else class="eq2-btn eq2-btn--sec eq2-add" type="button" :disabled="enviando" @click="novoCliente = { nome: '', conta: '', endereco: '' }">
          <q-icon name="person_add" size="18px" /> Adicionar cliente adicional
        </button>
      </div>

      <div class="eq2-acoes">
        <button class="eq2-btn eq2-btn--sec" type="button" :disabled="enviando" @click="salvar(false)">Salvar rascunho</button>
        <button class="eq2-btn eq2-btn--ok" type="button" :disabled="enviando || !prontoParaEnviar" @click="salvar(true)">
          <q-spinner v-if="enviando" size="18px" /> Enviar para auditoria
        </button>
      </div>
      <div v-if="!prontoParaEnviar" class="eq2-dica">Para enviar: cada serviço precisa de descrição e foto, e cada cliente de medidor e foto.</div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'boot/supabase'
import { usarEstadoPersistido } from 'src/utils/estadoPersistido'

const $q = useQuasar()

const EQUIPE_KEY = 'cgb_equipe2_nome'
const equipe = ref(localStorage.getItem(EQUIPE_KEY) || '')
const busca = ref('')
const carregando = ref(false)
const enviando = ref(false)
const notas = ref([])

const notaAtiva = ref(null)
// Serviços realizados: cada um com uma descrição e uma foto
const novoServico = () => ({ chave: `srv-${crypto.randomUUID()}`, descricao: '', foto: '' })
const servicos = ref([novoServico()])
const servicosProntos = computed(() => servicos.value.filter(s => s.descricao.trim() && s.foto).length)
// Campos antigos do apontamento (lidos pelo desktop): descrição junta e todas as fotos
const descricaoFinal = computed(() => {
  const itens = servicos.value.map(s => s.descricao.trim()).filter(Boolean)
  return itens.length > 1 ? itens.map((d, i) => `${i + 1}) ${d}`).join('\n') : (itens[0] || '')
})
const fotosFinal = computed(() => servicos.value.map(s => s.foto).filter(Boolean))
function adicionarServico () { servicos.value.push(novoServico()) }
function removerServico (i) { servicos.value = servicos.value.filter((_, k) => k !== i) }
const clientes = ref([])

// Escolha das obras: todas, só as programadas na planilha, ou só as que já têm Etapa 1
const FILTROS = [
  { val: 'todas', label: 'Todas' },
  { val: 'programadas', label: 'Programadas' },
  { val: 'etapa1', label: 'Etapa 1 feita' }
]
const filtroLista = ref('todas')
const passaFiltro = (n, f) => f === 'programadas' ? !!n.prog_data : f === 'etapa1' ? n.postes > 0 : true
const contagemFiltro = f => notas.value.filter(n => passaFiltro(n, f)).length
const dataCurta = iso => {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const notasFiltradas = computed(() => {
  const q = (busca.value ?? '').trim().toLowerCase()
  return notas.value.filter(n =>
    passaFiltro(n, filtroLista.value) &&
    (!q || [n.nota, n.projeto_info_sap, n.municipio, n.base].some(v => String(v ?? '').toLowerCase().includes(q)))
  )
})

const postesCampo = computed(() => notaAtiva.value?.postes ?? 0)
const clientesProntos = computed(() => clientes.value.filter(c => c.medidor.trim() && c.fotos.length).length)

// Cliente adicional: que não está na planilha da nota (formulário aberto quando preenchido)
const novoCliente = ref(null)
function adicionarCliente () {
  const nome = novoCliente.value.nome.trim().toUpperCase()
  if (!nome) return
  clientes.value.push({
    chave: `extra-${crypto.randomUUID()}`,
    nome,
    conta: novoCliente.value.conta.trim(),
    endereco: novoCliente.value.endereco.trim(),
    medidor: '',
    fotos: [],
    adicional: true
  })
  novoCliente.value = null
}
function removerCliente (c) {
  clientes.value = clientes.value.filter(x => x.chave !== c.chave)
}
const prontoParaEnviar = computed(() =>
  servicos.value.length > 0 && servicosProntos.value === servicos.value.length &&
  clientes.value.length > 0 && clientesProntos.value === clientes.value.length
)

const MENSAGENS = {
  NOTA_NAO_AGUARDANDO_ETAPA2: 'Esta nota já foi concluída ou não está disponível para a equipe 2.',
  SEM_POSTES_REGISTRADOS: 'Esta nota ainda não tem postes registrados pela equipe de campo.',
  SERVICO_INCOMPLETO: 'Informe a descrição e a foto do serviço.',
  CLIENTES_INCOMPLETOS: 'Ainda faltam clientes desta nota.',
  MEDIDOR_OU_FOTO_FALTANDO: 'Informe o medidor e a foto de todos os clientes.'
}

function guardarEquipe () {
  try { localStorage.setItem(EQUIPE_KEY, equipe.value.trim()) } catch { /* sem armazenamento local */ }
}

async function carregarNotas () {
  carregando.value = true
  const { data, error } = await supabase.rpc('equipe2_listar')
  if (error) $q.notify({ type: 'negative', message: 'Não foi possível carregar as notas: ' + error.message, position: 'top' })
  notas.value = data || []
  carregando.value = false
}

async function enviarFoto (file, bucket, caminho) {
  const { error } = await supabase.storage.from(bucket).upload(caminho, file, {
    contentType: file.type || 'image/jpeg', upsert: true
  })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(caminho).data.publicUrl
}

async function fotoDoServico (s, e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  enviando.value = true
  try {
    s.foto = await enviarFoto(file, 'campo-fotos', `servico/${notaAtiva.value.nota}/${crypto.randomUUID()}.jpg`)
  } catch (err) {
    $q.notify({ type: 'negative', message: 'Não foi possível enviar a foto: ' + err.message, position: 'top' })
  } finally {
    enviando.value = false
  }
}

// Várias fotos por cliente: tirar uma a uma pela câmera, ou escolher várias da galeria
async function fotosDoMedidor (c, e) {
  const arquivos = [...(e.target.files || [])]
  e.target.value = ''
  if (!arquivos.length) return
  enviando.value = true
  try {
    for (const file of arquivos) {
      const url = await enviarFoto(file, 'medidores', `${notaAtiva.value.nota}/${crypto.randomUUID()}.jpg`)
      c.fotos = [...c.fotos, url]
    }
  } catch (err) {
    $q.notify({ type: 'negative', message: 'Não foi possível enviar a foto: ' + err.message, position: 'top' })
  } finally {
    enviando.value = false
  }
}

function removerFotoMedidor (c, i) {
  c.fotos = c.fotos.filter((_, k) => k !== i)
}

async function abrirNota (n) {
  notaAtiva.value = n
  servicos.value = [novoServico()]
  clientes.value = (n.clientes_planilha || []).map((c, i) => ({
    chave: c.conta_contrato || `${i}`,
    nome: c.nome,
    conta: c.conta_contrato || '',
    endereco: [c.endereco, c.bairro].filter(Boolean).join(', '),
    medidor: '',
    fotos: []
  }))
  novoCliente.value = null

  const { data } = await supabase.rpc('equipe2_carregar', { p_nota: n.nota })
  if (Array.isArray(data?.servicos) && data.servicos.length) {
    servicos.value = data.servicos.map(s => ({ chave: `srv-${crypto.randomUUID()}`, descricao: s.descricao || '', foto: s.foto || '' }))
  } else if (data?.descricao || data?.fotos_servico?.length) {
    // Rascunho antigo, sem lista de serviços: a primeira foto fica com a descrição e as demais viram serviços sem descrição
    const fotos = data.fotos_servico?.length ? data.fotos_servico : ['']
    servicos.value = fotos.map((f, i) => ({ chave: `srv-${crypto.randomUUID()}`, descricao: i === 0 ? (data.descricao || '') : '', foto: f }))
  }
  for (const salvo of data?.clientes || []) {
    const fotos = salvo.fotos_urls?.length ? salvo.fotos_urls : (salvo.foto_url ? [salvo.foto_url] : [])
    if (salvo.adicional) {
      clientes.value.push({
        chave: `extra-${crypto.randomUUID()}`,
        nome: salvo.nome,
        conta: salvo.conta_contrato || '',
        endereco: salvo.endereco || '',
        medidor: salvo.num_medidor || '',
        fotos,
        adicional: true
      })
      continue
    }
    const c = clientes.value.find(x => x.conta && x.conta === salvo.conta_contrato)
    if (c) { c.medidor = salvo.num_medidor || ''; c.fotos = fotos }
  }
}

function voltarLista () {
  notaAtiva.value = null
  limparAberta()
  carregarNotas()
}

async function salvar (concluir) {
  const payload = clientes.value.map(c => ({
    nome: c.nome,
    padrao: '',
    conta_contrato: c.conta || null,
    num_medidor: c.medidor.trim() || null,
    foto_url: c.fotos[0] || null,
    fotos_urls: c.fotos,
    endereco: c.endereco || null,
    adicional: !!c.adicional
  }))
  enviando.value = true
  try {
    const base = {
      p_nota: notaAtiva.value.nota,
      p_descricao: descricaoFinal.value,
      p_fotos_servico: fotosFinal.value,
      p_clientes: payload,
      p_concluir: concluir
    }
    let { error } = await supabase.rpc('equipe2_salvar', {
      ...base,
      p_servicos: servicos.value.map(s => ({ descricao: s.descricao.trim(), foto: s.foto }))
    })
    // Banco ainda sem a lista de serviços (SQL não rodado): salva no formato antigo
    if (error?.code === 'PGRST202') ({ error } = await supabase.rpc('equipe2_salvar', base))
    if (error) throw error
    $q.notify({
      type: 'positive', position: 'top',
      message: concluir ? 'Enviado para auditoria.' : 'Rascunho salvo.'
    })
    if (concluir) voltarLista()
  } catch (err) {
    const codigo = String(err.message || '').match(/[A-Z_]{6,}/)?.[0]
    $q.notify({ type: 'negative', position: 'top', timeout: 5000, message: MENSAGENS[codigo] || 'Não foi possível salvar: ' + err.message })
  } finally {
    enviando.value = false
  }
}

// Ao recarregar, volta para a busca e o filtro da lista e para a nota que estava aberta, com o que já foi preenchido
usarEstadoPersistido('equipe2', { busca, filtroLista })

const ABERTA_KEY = 'cgb_equipe2_aberta'
function lerAberta () {
  try { return JSON.parse(localStorage.getItem(ABERTA_KEY) || 'null') } catch { return null }
}
function limparAberta () {
  try { localStorage.removeItem(ABERTA_KEY) } catch { /* sem armazenamento local */ }
}
watch([notaAtiva, servicos, clientes], () => {
  if (!notaAtiva.value) return
  try {
    localStorage.setItem(ABERTA_KEY, JSON.stringify({
      nota: notaAtiva.value.nota,
      servicos: servicos.value,
      clientes: clientes.value
    }))
  } catch { /* sem armazenamento local */ }
}, { deep: true })

async function restaurarAberta () {
  const salvo = lerAberta()
  await carregarNotas()
  if (!salvo?.nota) return
  const n = notas.value.find(x => x.nota === salvo.nota)
  if (!n) { limparAberta(); return }
  await abrirNota(n)
  if (Array.isArray(salvo.servicos) && salvo.servicos.length) servicos.value = salvo.servicos
  if (Array.isArray(salvo.clientes) && salvo.clientes.length) clientes.value = salvo.clientes
}

onMounted(restaurarAberta)
</script>

<style scoped>
.eq2 { min-height: 100dvh; background: linear-gradient(160deg, #060b14 0%, #0a1628 60%, #060b14 100%); color: #fff; padding: 16px; font-family: inherit; }
.eq2-head { display: flex; align-items: center; gap: 10px; padding: 6px 0 14px; }
.eq2-voltar { width: 38px; height: 38px; border-radius: 50%; border: none; background: rgba(255,255,255,0.08); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.eq2-brand { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
.eq2-brand span { color: #ffca28; }
.eq2-bloco { max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
.eq2-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.5); letter-spacing: 0.08em; text-transform: uppercase; }
.eq2-input { width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.12); border-radius: 12px; color: #fff; padding: 12px 14px; font: inherit; font-size: 15px; outline: none; }
.eq2-input:focus { border-color: #1976d2; }
.eq2-textarea { resize: vertical; }
.eq2-vazio { color: rgba(255,255,255,0.45); font-size: 14px; padding: 14px 0; text-align: center; }
.eq2-card { width: 100%; text-align: left; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 14px; color: #fff; cursor: pointer; font: inherit; }
.eq2-card:active { transform: scale(0.99); }
.eq2-card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 16px; }
.eq2-chip { font-size: 12px; font-weight: 700; background: rgba(255,202,40,0.15); color: #ffca28; padding: 3px 9px; border-radius: 10px; white-space: nowrap; }
.eq2-card-sub { font-size: 12.5px; color: rgba(255,255,255,0.55); margin-top: 4px; }
.eq2-servico { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.eq2-servico-topo { display: flex; justify-content: space-between; align-items: center; }
.eq2-add { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 8px; }
.eq2-novo { display: flex; flex-direction: column; gap: 8px; border-style: dashed; }
.eq2-remover { background: none; border: 0; color: #ef9a9a; font: inherit; font-size: 12.5px; text-align: left; padding: 6px 0 0; cursor: pointer; }
.eq2-filtros { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0 6px; }
.eq2-filtro { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.75); border-radius: 18px; padding: 6px 12px; font: inherit; font-size: 13px; cursor: pointer; }
.eq2-filtro b { margin-left: 4px; color: #ffca28; }
.eq2-filtro--on { background: rgba(100,181,246,0.2); border-color: rgba(100,181,246,0.6); color: #fff; }
.eq2-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.eq2-tag { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 10px; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); }
.eq2-tag--prog { background: rgba(100,181,246,0.18); color: #90caf9; }
.eq2-tag--ok { background: rgba(102,187,106,0.18); color: #a5d6a7; }
.eq2-tag--pend { background: rgba(255,202,40,0.15); color: #ffca28; }
.eq2-nota { background: rgba(10,22,40,0.7); border: 1px solid rgba(100,181,246,0.35); border-radius: 14px; padding: 12px 14px; }
.eq2-nota-sap { font-size: 18px; font-weight: 800; }
.eq2-nota-sub { font-size: 12.5px; color: rgba(255,255,255,0.55); margin-top: 2px; }
.eq2-cartao { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.eq2-titulo { font-size: 14px; font-weight: 800; display: flex; justify-content: space-between; align-items: baseline; }
.eq2-titulo small { font-size: 12px; color: rgba(255,255,255,0.5); font-weight: 700; }
.eq2-foto { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 110px; border-radius: 14px; border: 2px dashed rgba(255,255,255,0.18); color: rgba(255,255,255,0.6); cursor: pointer; overflow: hidden; font-size: 14px; }
.eq2-foto img { width: 100%; max-height: 260px; object-fit: cover; display: block; }
.eq2-fotos { display: flex; flex-wrap: wrap; gap: 8px; }
.eq2-foto-item { position: relative; width: 96px; height: 96px; border-radius: 12px; overflow: hidden; border: 2px solid #43a047; }
.eq2-foto-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.eq2-foto-x { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(0,0,0,0.6); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.eq2-foto--mini { min-height: 46px; width: 56px; flex-shrink: 0; border-radius: 12px; }
.eq2-foto--mini img { height: 46px; }
.eq2-cliente { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.eq2-cliente--ok .eq2-cliente-nome::after { content: ' ✓'; color: #66bb6a; }
.eq2-cliente-nome { font-weight: 700; font-size: 14px; }
.eq2-cliente-sub { font-size: 12px; color: rgba(255,255,255,0.5); }
.eq2-cliente-linha { display: flex; gap: 8px; align-items: center; }
.eq2-acoes { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.eq2-btn { width: 100%; border: none; border-radius: 14px; padding: 14px; font: inherit; font-size: 15px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; color: #fff; }
.eq2-btn:disabled { opacity: 0.45; cursor: default; }
.eq2-btn--sec { background: rgba(255,255,255,0.08); }
.eq2-btn--ok { background: linear-gradient(135deg, #2e7d32, #43a047); }
.eq2-dica { font-size: 12px; color: rgba(255,255,255,0.45); text-align: center; }
</style>
