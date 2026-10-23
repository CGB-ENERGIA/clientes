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

      <label class="eq2-label q-mt-md">Aguardando medidor</label>
      <input v-model="busca" class="eq2-input" placeholder="Buscar nota, SAP ou município" />

      <div v-if="carregando" class="eq2-vazio">Carregando notas…</div>
      <div v-else-if="!notasFiltradas.length" class="eq2-vazio">Nenhuma nota aguardando medidor.</div>
      <button v-for="n in notasFiltradas" :key="n.nota" class="eq2-card" type="button" @click="abrirNota(n)">
        <div class="eq2-card-top">
          <b>{{ n.projeto_info_sap || n.nota }}</b>
          <span class="eq2-chip">{{ n.postes }} {{ n.postes === 1 ? 'poste' : 'postes' }}</span>
        </div>
        <div class="eq2-card-sub">
          {{ n.municipio || n.base }} · {{ n.clientes_planilha?.length || 0 }} clientes
          <span v-if="n.rascunho"> · rascunho salvo</span>
        </div>
      </button>
    </section>

    <!-- Nota: serviço + clientes -->
    <section v-else class="eq2-bloco">
      <div class="eq2-nota">
        <div class="eq2-nota-sap">SAP {{ notaAtiva.projeto_info_sap || notaAtiva.nota }}</div>
        <div class="eq2-nota-sub">{{ notaAtiva.municipio || notaAtiva.base }} · {{ postesCampo }} postes registrados pela equipe</div>
      </div>

      <!-- Serviço: descrição + foto (no lugar de Registrar Poste) -->
      <div class="eq2-cartao">
        <div class="eq2-titulo">Serviço realizado</div>
        <label class="eq2-label">Descrição do serviço</label>
        <textarea v-model="descricao" class="eq2-input eq2-textarea" rows="3" placeholder="Descreva o serviço executado" />
        <label class="eq2-label q-mt-md">Fotos do serviço</label>
        <div v-if="fotosServico.length" class="eq2-fotos">
          <div v-for="(url, i) in fotosServico" :key="url" class="eq2-foto-item">
            <img :src="url" alt="Foto do serviço" />
            <button class="eq2-foto-x" type="button" aria-label="Remover foto" :disabled="enviando" @click="removerFotoServico(i)">
              <q-icon name="close" size="14px" />
            </button>
          </div>
        </div>
        <label class="eq2-foto">
          <span><q-icon name="photo_camera" size="24px" /> {{ fotosServico.length ? 'Adicionar outra foto' : 'Tirar foto do serviço' }}</span>
          <input type="file" accept="image/*" capture="environment" hidden :disabled="enviando" @change="fotoDoServico" />
        </label>
      </div>

      <!-- Clientes e medidores -->
      <div class="eq2-cartao">
        <div class="eq2-titulo">Clientes e medidores <small>{{ clientesProntos }} de {{ clientes.length }}</small></div>
        <div v-if="!clientes.length" class="eq2-vazio">Esta nota não tem clientes na planilha.</div>
        <div v-for="c in clientes" :key="c.chave" class="eq2-cliente" :class="{ 'eq2-cliente--ok': c.medidor && c.foto }">
          <div class="eq2-cliente-nome">{{ c.nome }}</div>
          <div class="eq2-cliente-sub">{{ [c.conta, c.endereco].filter(Boolean).join(' · ') }}</div>
          <div class="eq2-cliente-linha">
            <input v-model="c.medidor" class="eq2-input" placeholder="Nº do medidor" :disabled="enviando" />
            <label class="eq2-foto eq2-foto--mini" :class="{ 'eq2-foto--ok': c.foto }">
              <img v-if="c.foto" :src="c.foto" alt="Foto do medidor" />
              <q-icon v-else name="photo_camera" size="20px" />
              <input type="file" accept="image/*" capture="environment" hidden :disabled="enviando" @change="fotoDoMedidor(c, $event)" />
            </label>
          </div>
        </div>
      </div>

      <div class="eq2-acoes">
        <button class="eq2-btn eq2-btn--sec" type="button" :disabled="enviando" @click="salvar(false)">Salvar rascunho</button>
        <button class="eq2-btn eq2-btn--ok" type="button" :disabled="enviando || !prontoParaEnviar" @click="salvar(true)">
          <q-spinner v-if="enviando" size="18px" /> Enviar para auditoria
        </button>
      </div>
      <div v-if="!prontoParaEnviar" class="eq2-dica">Para enviar: descreva e fotografe o serviço e informe medidor e foto de cada cliente.</div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'boot/supabase'

const $q = useQuasar()

const EQUIPE_KEY = 'cgb_equipe2_nome'
const equipe = ref(localStorage.getItem(EQUIPE_KEY) || '')
const busca = ref('')
const carregando = ref(false)
const enviando = ref(false)
const notas = ref([])

const notaAtiva = ref(null)
const descricao = ref('')
const fotosServico = ref([])
const clientes = ref([])

const notasFiltradas = computed(() => {
  const q = busca.value.trim().toLowerCase()
  return notas.value.filter(n =>
    !q || [n.nota, n.projeto_info_sap, n.municipio, n.base].some(v => String(v ?? '').toLowerCase().includes(q))
  )
})

const postesCampo = computed(() => notaAtiva.value?.postes ?? 0)
const clientesProntos = computed(() => clientes.value.filter(c => c.medidor.trim() && c.foto).length)
const prontoParaEnviar = computed(() =>
  !!descricao.value.trim() && fotosServico.value.length > 0 && clientes.value.length > 0 && clientesProntos.value === clientes.value.length
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

function removerFotoServico (i) {
  fotosServico.value = fotosServico.value.filter((_, k) => k !== i)
}

async function fotoDoServico (e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  enviando.value = true
  try {
    const url = await enviarFoto(file, 'campo-fotos', `servico/${notaAtiva.value.nota}/${crypto.randomUUID()}.jpg`)
    fotosServico.value = [...fotosServico.value, url]
  } catch (err) {
    $q.notify({ type: 'negative', message: 'Não foi possível enviar a foto: ' + err.message, position: 'top' })
  } finally {
    enviando.value = false
  }
}

async function fotoDoMedidor (c, e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  enviando.value = true
  try {
    c.foto = await enviarFoto(file, 'medidores', `${notaAtiva.value.nota}/${crypto.randomUUID()}.jpg`)
  } catch (err) {
    $q.notify({ type: 'negative', message: 'Não foi possível enviar a foto: ' + err.message, position: 'top' })
  } finally {
    enviando.value = false
  }
}

async function abrirNota (n) {
  notaAtiva.value = n
  descricao.value = ''
  fotosServico.value = []
  clientes.value = (n.clientes_planilha || []).map((c, i) => ({
    chave: c.conta_contrato || `${i}`,
    nome: c.nome,
    conta: c.conta_contrato || '',
    endereco: [c.endereco, c.bairro].filter(Boolean).join(', '),
    medidor: '',
    foto: ''
  }))

  const { data } = await supabase.rpc('equipe2_carregar', { p_nota: n.nota })
  if (data?.descricao) descricao.value = data.descricao
  if (data?.fotos_servico?.length) fotosServico.value = data.fotos_servico
  for (const salvo of data?.clientes || []) {
    const c = clientes.value.find(x => x.conta && x.conta === salvo.conta_contrato)
    if (c) { c.medidor = salvo.num_medidor || ''; c.foto = salvo.foto_url || '' }
  }
}

function voltarLista () {
  notaAtiva.value = null
  carregarNotas()
}

async function salvar (concluir) {
  const payload = clientes.value.map(c => ({
    nome: c.nome,
    padrao: '',
    conta_contrato: c.conta || null,
    num_medidor: c.medidor.trim() || null,
    foto_url: c.foto || null
  }))
  enviando.value = true
  try {
    const { error } = await supabase.rpc('equipe2_salvar', {
      p_nota: notaAtiva.value.nota,
      p_descricao: descricao.value.trim(),
      p_fotos_servico: fotosServico.value,
      p_clientes: payload,
      p_concluir: concluir
    })
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

onMounted(carregarNotas)
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
