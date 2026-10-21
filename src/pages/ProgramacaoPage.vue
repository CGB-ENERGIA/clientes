<template>
  <q-page class="prog q-pa-md">
    <div class="prog-head">
      <div>
        <div class="prog-titulo">Programação semanal</div>
        <div class="prog-sub">{{ ultimaTexto }}</div>
      </div>
      <div class="prog-acoes">
        <q-btn
          v-if="dropboxUrl"
          unelevated no-caps color="primary" icon="cloud_sync" label="Sincronizar Dropbox"
          :loading="ocupado" :disable="ocupado"
          @click="sincronizarDropbox"
        />
        <q-btn v-else outline no-caps color="primary" icon="link" label="Configurar link Dropbox" @click="abrirConfig" />
        <q-btn
          outline no-caps color="primary" icon="upload_file" label="Importar planilha"
          :loading="ocupado" :disable="ocupado"
          @click="fileRef.click()"
        />
        <input ref="fileRef" type="file" accept=".xlsx,.xlsm" hidden @change="onArquivo" />
      </div>
    </div>

    <q-banner v-if="precisaAtualizar" rounded class="prog-alerta q-my-md">
      <template #avatar><q-icon name="update" color="orange-9" /></template>
      {{ ultimaImportacao ? 'A programação ainda não foi atualizada hoje.' : 'Nenhuma programação importada ainda.' }}
      Sincronize o Dropbox ou importe a planilha do dia.
    </q-banner>

    <q-tabs v-model="secao" dense no-caps active-color="primary" indicator-color="primary" align="left" class="q-mt-md prog-secoes">
      <q-tab name="painel" icon="insights" label="Painel" />
      <q-tab name="conferencia" icon="fact_check" label="Conferência" />
      <q-tab name="completa" icon="list_alt" label="Programação completa" />
    </q-tabs>

    <div v-if="secao === 'painel'" class="prog-painel q-mt-md">
      <div class="prog-painel-topo">
        <q-btn unelevated no-caps color="primary" icon="map" label="Mapa da programação" @click="mapaAberto = true" />
        <span class="prog-muted">{{ gruposMapa.length }} notas no mapa · {{ semCoordMapa }} obras sem ponto no mapa</span>
      </div>
      <div class="prog-kpis">
        <div class="prog-kpi prog-kpi--destaque">
          <div class="prog-kpi-n">{{ kpis.progresso }}%</div>
          <div class="prog-kpi-l">concluído · {{ kpis.concluidas }} de {{ kpis.total }}
            <ProgInfo titulo="Progresso" texto="Obras concluídas dividido pelo total de obras ativas. Canceladas não entram na conta." />
          </div>
          <div class="prog-barra-fundo"><i :style="{ width: kpis.progresso + '%' }" /></div>
        </div>
        <div class="prog-kpi prog-kpi--parada">
          <div class="prog-kpi-n">{{ kpis.paradas }}</div>
          <div class="prog-kpi-l">obras paradas
            <ProgInfo titulo="Obra parada" texto='O registro mais recente da obra é "Andamento", sem visita programada depois. Os dias são contados desde esse registro.' />
          </div>
        </div>
        <div class="prog-kpi prog-kpi--atraso">
          <div class="prog-kpi-n">{{ atrasadas.length }}</div>
          <div class="prog-kpi-l">visitas com data vencida
            <ProgInfo titulo="Visita vencida" texto="Visita programada com data anterior a hoje, que ainda não foi executada." />
          </div>
        </div>
        <div class="prog-kpi">
          <div class="prog-kpi-n">{{ proximas.length }}</div>
          <div class="prog-kpi-l">previstas nos próximos 7 dias
            <ProgInfo titulo="Próximos 7 dias" texto="Visitas programadas entre hoje e os próximos 7 dias." />
          </div>
        </div>
        <div class="prog-kpi">
          <div class="prog-kpi-n">{{ kpis.andamento }}</div>
          <div class="prog-kpi-l">em andamento
            <ProgInfo titulo="Em andamento" texto="Obras com status Andamento na programação. Inclui obras com parte concluída e visita nova agendada." :itens="GLOSSARIO_PROG" />
          </div>
        </div>
      </div>

      <div class="prog-card q-mt-md">
        <div class="prog-sec-titulo"><q-icon name="lightbulb" size="18px" /> Oportunidades</div>
        <div v-if="!oportunidades.length" class="prog-muted">Nenhuma ação pendente na programação.</div>
        <div v-for="(o, i) in oportunidades" :key="i" class="prog-insight" :class="`prog-insight--${o.tipo}`">
          <q-icon :name="o.icone" size="20px" />
          <div>
            <div class="prog-insight-titulo">{{ o.titulo }}</div>
            <div class="prog-insight-texto">{{ o.texto }}</div>
          </div>
        </div>
      </div>

      <div class="prog-duas q-mt-md">
        <div class="prog-card">
          <div class="prog-sec-titulo"><q-icon name="pause_circle" size="18px" /> Obras paradas
            <small>último registro é "Andamento"</small>
            <ProgInfo titulo="Obras paradas" texto="Obras cujo registro mais recente é Andamento, sem visita programada depois. Os dias são contados desde esse registro." />
          </div>
          <q-table
            flat dense
            :rows="paradas"
            :columns="colParadas"
            row-key="sap"
            :pagination="{ rowsPerPage: 8, sortBy: 'dias', descending: true }"
            no-data-label="Nenhuma obra parada"
          >
            <template #body-cell-dias="props">
              <q-td :props="props">
                <span class="prog-dias" :class="{ 'prog-dias--alerta': props.row.dias > 15 }">
                  {{ props.row.dias === null ? '—' : props.row.dias + ' d' }}
                </span>
              </q-td>
            </template>
          </q-table>
        </div>

        <div class="prog-card">
          <div class="prog-sec-titulo"><q-icon name="groups" size="18px" /> Por equipe
            <ProgInfo titulo="Por equipe" :itens="[['Obras', 'total de obras ativas da equipe.'], ['Concluídas', 'obras com status Concluída na programação.'], ['Paradas', 'obras paradas pela regra do painel.'], ['Progresso', 'concluídas sobre o total.']]" />
          </div>
          <q-markup-table flat dense separator="horizontal" class="prog-eq">
            <thead>
              <tr><th>Equipe</th><th>Obras</th><th>Concluídas</th><th>Paradas</th><th>Progresso</th></tr>
            </thead>
            <tbody>
              <tr v-for="e in porEquipe" :key="e.equipe">
                <td>{{ e.equipe }}</td>
                <td>{{ e.total }}</td>
                <td>{{ e.concluidas }}</td>
                <td>{{ e.paradas }}</td>
                <td>
                  <div class="prog-mini"><i :style="{ width: e.progresso + '%' }" /><span>{{ e.progresso }}%</span></div>
                </td>
              </tr>
            </tbody>
          </q-markup-table>
        </div>
      </div>

      <div class="prog-duas q-mt-md">
        <div class="prog-card">
          <div class="prog-sec-titulo"><q-icon name="event" size="18px" /> Visitas vencidas e próximas
            <ProgInfo titulo="Visitas vencidas e próximas" texto="Visitas programadas com data passada (em atraso) e as previstas para hoje ou para os próximos 7 dias." />
          </div>
          <q-table
            flat dense
            :rows="[...atrasadas, ...proximas]"
            :columns="colAgenda"
            row-key="sap"
            :pagination="{ rowsPerPage: 8 }"
            no-data-label="Nenhuma visita vencida ou nos próximos 7 dias"
          >
            <template #body-cell-situacao="props">
              <q-td :props="props" class="text-right">
                <span :class="props.row.dias > 0 ? 'prog-dias prog-dias--alerta' : 'prog-dias'">
                  {{ props.row.dias > 0 ? `${props.row.dias} d em atraso` : (props.row.dias === 0 ? 'hoje' : `em ${-props.row.dias} d`) }}
                </span>
              </q-td>
            </template>
          </q-table>
        </div>

        <div class="prog-card">
          <div class="prog-sec-titulo"><q-icon name="show_chart" size="18px" /> Ritmo entre importações
            <ProgInfo titulo="Ritmo" texto="Uma linha por dia, usando a última importação do dia. O número colorido é a variação de concluídas em relação à importação anterior." />
          </div>
          <div v-if="!ritmo.length" class="prog-muted">
            Sem histórico ainda. O ritmo aparece quando houver importações em dias diferentes.
          </div>
          <div v-for="r in ritmo.slice(0, 10)" :key="r.data_ref" class="prog-ritmo">
            <span class="prog-ritmo-dia">{{ formatarData(r.data_ref) }}</span>
            <b>{{ r.concluidas }}</b><span class="prog-muted"> concluídas</span>
            <span class="prog-delta" :class="{ 'prog-delta--pos': r.delta > 0, 'prog-delta--neg': r.delta < 0 }">
              {{ r.delta > 0 ? '+' : '' }}{{ r.delta }}
            </span>
            <span class="prog-muted">· {{ r.paradas }} paradas</span>
          </div>
        </div>
      </div>
    </div>

    <template v-if="secao === 'conferencia'">
    <div class="prog-tiles">
      <div v-for="t in tiles" :key="t.key" class="prog-tile" :class="`prog-tile--${t.key}`">
        <div class="prog-tile-n">{{ t.n }}</div>
        <div class="prog-tile-l">{{ t.label }} <ProgInfo :titulo="t.label" :texto="t.info" /></div>
      </div>
    </div>

    <div class="prog-barra q-mt-lg">
      <q-tabs v-model="aba" dense no-caps active-color="primary" indicator-color="primary" align="left" class="prog-abas">
        <q-tab name="aplicar" :label="`Atualizar (${contagem.aplicar})`" />
        <q-tab name="conferir" :label="`Conferir (${contagem.conferir})`" />
        <q-tab name="sem_correspondencia" :label="`Sem correspondência (${contagem.sem_correspondencia})`" />
      </q-tabs>
      <q-space />
      <q-input v-model="busca" dense outlined clearable placeholder="Buscar nota, município ou equipe" class="prog-busca">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-btn
        v-if="aba === 'aplicar' && contagem.aplicar"
        unelevated no-caps color="positive" icon="done_all" :label="`Aplicar ${contagem.aplicar}`"
        class="q-ml-sm"
        @click="confirmarAplicarTodas"
      />
    </div>

    <q-table
      flat bordered
      :rows="linhasAba"
      :columns="colunas"
      row-key="sap"
      :pagination="{ rowsPerPage: 25, sortBy: 'sap' }"
      no-data-label="Nada nesta lista"
      class="prog-tabela q-mt-sm"
    >
      <template #header-cell-prog="props">
        <q-th :props="props">
          {{ props.col.label }} <ProgInfo titulo="Status da programação" :itens="GLOSSARIO_PROG" />
        </q-th>
      </template>
      <template #header-cell-sis="props">
        <q-th :props="props">
          {{ props.col.label }} <ProgInfo titulo="Status do sistema" :itens="GLOSSARIO_SIS" />
        </q-th>
      </template>
      <template #body-cell-prog="props">
        <q-td :props="props">
          <span class="prog-chip" :class="`prog-chip--${props.row.status_programacao.toLowerCase()}`">
            {{ ROTULO_PROGRAMACAO[props.row.status_programacao] }}
          </span>
          <div v-if="props.row.data_programada" class="prog-data">{{ formatarData(props.row.data_programada) }}</div>
          <q-tooltip v-if="props.row.motivo || props.row.observacao" anchor="top middle" self="bottom middle">
            {{ [props.row.motivo, props.row.observacao].filter(Boolean).join(' · ') }}
          </q-tooltip>
        </q-td>
      </template>
      <template #body-cell-sis="props">
        <q-td :props="props">
          <template v-if="props.row.qtd > 1">
            <div class="prog-aviso">{{ props.row.qtd }} notas com este SAP · conferir</div>
            <div v-for="n in props.row.notas_sistema" :key="n.nota" class="prog-sis-linha">
              {{ n.nota }} · PEP {{ n.pep }} · {{ ROTULO_SISTEMA[n.status] }}
            </div>
          </template>
          <template v-else>
            <span v-if="props.row.status_sistema" class="prog-sis">{{ ROTULO_SISTEMA[props.row.status_sistema] }}</span>
            <span v-else class="prog-muted">—</span>
          </template>
        </q-td>
      </template>
      <template #body-cell-acao="props">
        <q-td :props="props" class="text-right">
          <q-btn
            v-if="props.row.acao === 'aplicar'"
            unelevated dense no-caps color="positive" label="Atualizar"
            :disable="aplicando === props.row.sap"
            :loading="aplicando === props.row.sap"
            @click="aplicarUma(props.row)"
          />
          <span v-else-if="props.row.acao === 'conferir'" class="prog-muted">
            {{ props.row.qtd > 1 ? 'Conferir ligações' : 'Conferir: situações diferentes' }}
          </span>
          <span v-else-if="props.row.acao === 'sem_correspondencia'" class="prog-muted">Não existe no sistema</span>
        </q-td>
      </template>
    </q-table>
    </template>

    <template v-if="secao === 'completa'">
      <div class="prog-barra q-mt-md">
        <q-input v-model="buscaCompleta" dense outlined clearable placeholder="Buscar nota, município, equipe ou supervisor" class="prog-busca">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
        <q-select v-model="equipeCompleta" dense outlined clearable emit-value map-options :options="equipesOpcoes" label="Equipe" class="prog-filtro" />
        <q-select v-model="statusCompleta" dense outlined clearable emit-value map-options :options="statusOpcoes" label="Programação" class="prog-filtro" />
        <q-input v-model="dataInicioCompleta" dense outlined clearable type="date" label="Data de" stack-label class="prog-filtro" />
        <q-input v-model="dataFimCompleta" dense outlined clearable type="date" label="Data até" stack-label class="prog-filtro" />
      </div>
      <div class="prog-muted q-mt-sm">{{ linhasCompletas.length }} de {{ linhas.length }} notas</div>

      <q-table
        flat bordered
        :rows="linhasCompletas"
        :columns="colCompletas"
        row-key="sap"
        :pagination="{ rowsPerPage: 50, sortBy: 'data' }"
        no-data-label="Nenhuma nota com esses filtros"
        class="prog-tabela q-mt-sm"
      >
        <template #body-cell-prog="props">
          <q-td :props="props">
            <span class="prog-chip" :class="`prog-chip--${props.row.status_programacao.toLowerCase()}`">
              {{ ROTULO_PROGRAMACAO[props.row.status_programacao] }}
            </span>
            <q-tooltip v-if="props.row.motivo || props.row.observacao" anchor="top middle" self="bottom middle">
              {{ [props.row.motivo, props.row.observacao].filter(Boolean).join(' · ') }}
            </q-tooltip>
          </q-td>
        </template>
        <template #body-cell-notaSap="props">
          <q-td :props="props">
            <div v-for="n in props.row.notas_sistema" :key="n.nota" class="prog-sis-linha">{{ n.nota }}</div>
            <span v-if="!props.row.notas_sistema?.length" class="prog-muted">—</span>
          </q-td>
        </template>
        <template #body-cell-sis="props">
          <q-td :props="props">
            <span v-if="props.row.status_sistema" class="prog-sis">{{ ROTULO_SISTEMA[props.row.status_sistema] }}</span>
            <span v-else class="prog-muted">—</span>
            <div v-if="props.row.qtd > 1" class="prog-aviso">{{ props.row.qtd }} notas com este SAP</div>
          </q-td>
        </template>
      </q-table>
    </template>

    <q-dialog v-model="configAberta">
      <q-card style="width: 460px; max-width: 94vw">
        <q-card-section>
          <div class="text-h6">Link da programação no Dropbox</div>
          <div class="text-caption text-grey-7">Crie um link compartilhado da planilha e cole abaixo.</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-input v-model="configUrl" outlined dense label="Link da planilha" placeholder="https://www.dropbox.com/scl/fi/..." />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn unelevated no-caps color="primary" label="Salvar" :disable="!configUrl.trim()" @click="salvarConfig" />
        </q-card-actions>
      </q-card>
    </q-dialog>
    <MapaNotas
      v-model="mapaAberto"
      esquema="programacao"
      :grupos="gruposMapa"
      :permitir-abrir="false"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { supabase, fetchAll } from 'boot/supabase'
import ProgInfo from 'components/ProgInfo.vue'
import MapaNotas from 'components/MapaNotas.vue'
import { useNotasStore } from 'stores/notas'
import { lerProgramacao, hashArquivo, ROTULO_PROGRAMACAO } from 'src/utils/programacao'

const $q = useQuasar()
const notasStore = useNotasStore()

const CONFIG_KEY = 'dropbox_programacao_url'
const NOME_ARQUIVO = 'PROGRAMAÇÃO SEMANAL EQUIPE PLA.xlsx'
const ROTULO_SISTEMA = {
  pendente: 'Não Iniciado',
  em_andamento: 'Andamento',
  aguardando_etapa2: 'Aguardando Etapa 2',
  baixar_medidor: 'Auditar',
  concluido: 'Concluído',
  expurgo: 'Expurgo',
  sem_acesso: 'Sem Acesso'
}

const linhas = ref([])
const tendencia = ref([])
const secao = ref('painel')
const ultimaImportacao = ref(null)
const dropboxUrl = ref('')
const ocupado = ref(false)
const aplicando = ref(null)
const aba = ref('aplicar')
const busca = ref('')
const fileRef = ref(null)
const configAberta = ref(false)
const configUrl = ref('')

const colunas = [
  { name: 'sap', label: 'Nota SAP', field: 'sap', align: 'left', sortable: true },
  { name: 'municipio', label: 'Município', field: 'municipio', align: 'left', sortable: true },
  { name: 'equipe', label: 'Equipe', field: 'equipe', align: 'left', sortable: true },
  { name: 'prog', label: 'Programação', field: 'status_programacao', align: 'left', sortable: true },
  { name: 'sis', label: 'Sistema', field: 'status_sistema', align: 'left' },
  { name: 'acao', label: '', field: 'acao', align: 'right' }
]

const buscaCompleta = ref('')
const equipeCompleta = ref(null)
const statusCompleta = ref(null)
const dataInicioCompleta = ref(null)
const dataFimCompleta = ref(null)

const equipesOpcoes = computed(() => [...new Set(linhas.value.map(l => l.equipe).filter(Boolean))]
  .sort()
  .map(e => ({ label: e, value: e })))
const statusOpcoes = Object.entries(ROTULO_PROGRAMACAO).map(([value, label]) => ({ label, value }))

const linhasCompletas = computed(() => {
  const q = buscaCompleta.value.trim().toLowerCase()
  return linhas.value.filter(l =>
    (!equipeCompleta.value || l.equipe === equipeCompleta.value) &&
    (!statusCompleta.value || l.status_programacao === statusCompleta.value) &&
    (!dataInicioCompleta.value || (l.data_programada && l.data_programada >= dataInicioCompleta.value)) &&
    (!dataFimCompleta.value || (l.data_programada && l.data_programada <= dataFimCompleta.value)) &&
    (!q || [l.sap, l.municipio, l.equipe, l.supervisor, ...(l.notas_sistema ?? []).map(n => n.nota)].some(v => String(v ?? '').toLowerCase().includes(q)))
  )
})

const colCompletas = [
  { name: 'data', label: 'Data', field: 'data_programada', align: 'left', sortable: true, format: formatarData },
  { name: 'sap', label: 'Projeto SAP', field: 'sap', align: 'left', sortable: true },
  { name: 'notaSap', label: 'Nota SAP', field: 'notas_sistema', align: 'left' },
  { name: 'municipio', label: 'Município', field: 'municipio', align: 'left', sortable: true },
  { name: 'equipe', label: 'Equipe', field: 'equipe', align: 'left', sortable: true },
  { name: 'supervisor', label: 'Supervisor', field: 'supervisor', align: 'left', sortable: true },
  { name: 'prog', label: 'Programação', field: 'status_programacao', align: 'left', sortable: true },
  { name: 'sis', label: 'Sistema', field: 'status_sistema', align: 'left', sortable: true },
  { name: 'ultimo', label: 'Último registro', field: 'ultimo_evento', align: 'left', sortable: true, format: formatarData }
]

const contagem = computed(() => {
  const c = { aplicar: 0, conferir: 0, sem_correspondencia: 0, ok: 0 }
  for (const l of linhas.value) c[l.acao] = (c[l.acao] || 0) + 1
  return c
})

const tiles = computed(() => [
  { key: 'aplicar', n: contagem.value.aplicar, label: 'Para atualizar', info: 'Mudança segura que o sistema aplica sozinho, como Não Iniciado para Andamento.' },
  { key: 'conferir', n: contagem.value.conferir, label: 'Para conferir', info: 'Situação que pede decisão da supervisão, como SAP repetido no sistema ou status divergente.' },
  { key: 'sem_correspondencia', n: contagem.value.sem_correspondencia, label: 'Sem correspondência', info: 'Obra da programação que não existe no sistema com esse SAP.' },
  { key: 'ok', n: contagem.value.ok, label: 'Em dia', info: 'Programação e sistema estão alinhados.' }
])

const GLOSSARIO_PROG = [
  ['Programada', 'visita agendada pela supervisão. A obra ainda não começou.'],
  ['Andamento', 'a obra já começou, mas ainda tem ligações pendentes ou uma visita nova agendada.'],
  ['Concluída', 'todas as ligações da obra foram executadas.'],
  ['Reprogramar', 'a visita foi remarcada pela supervisão.'],
  ['Cancelar', 'a obra saiu da programação. Não entra no progresso.']
]

const GLOSSARIO_SIS = [
  ['Não Iniciado', 'nenhum poste registrado ainda.'],
  ['Andamento', 'a equipe começou a obra no campo.'],
  ['Auditar', 'obra executada em campo. Falta dar baixa do medidor.'],
  ['Concluído', 'obra finalizada no sistema.'],
  ['Expurgo', 'nota expurgada. A obra não será executada.'],
  ['Sem Acesso', 'não foi possível acessar o local.']
]

const linhasAba = computed(() => {
  const q = busca.value.trim().toLowerCase()
  return linhas.value.filter(l =>
    l.acao === aba.value &&
    (!q || [l.sap, l.municipio, l.equipe].some(v => String(v ?? '').toLowerCase().includes(q)))
  )
})

const ativas = computed(() => linhas.value.filter(l => l.status_programacao !== 'CANCELAR'))

function diasDesde (iso) {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((hoje - d) / 86400000)
}

const kpis = computed(() => {
  const k = { total: ativas.value.length, concluidas: 0, andamento: 0, programadas: 0, paradas: 0 }
  for (const l of ativas.value) {
    if (l.status_programacao === 'CONCLUIDA') k.concluidas++
    if (l.status_programacao === 'ANDAMENTO') k.andamento++
    if (l.status_programacao === 'PROGRAMADA') k.programadas++
    if (l.ultimo_status === 'ANDAMENTO') k.paradas++
  }
  k.progresso = k.total ? Math.round(k.concluidas / k.total * 100) : 0
  return k
})

// Parada: o registro mais recente da obra é "Andamento" (não há visita programada depois)
const paradas = computed(() => ativas.value
  .filter(l => l.ultimo_status === 'ANDAMENTO')
  .map(l => ({ ...l, dias: diasDesde(l.ultimo_evento) }))
  .sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1)))

const atrasadas = computed(() => ativas.value
  .filter(l => l.status_programacao === 'PROGRAMADA' && diasDesde(l.data_programada) > 0)
  .map(l => ({ ...l, dias: diasDesde(l.data_programada) }))
  .sort((a, b) => b.dias - a.dias))

const proximas = computed(() => ativas.value
  .filter(l => {
    const d = diasDesde(l.data_programada)
    return l.status_programacao === 'PROGRAMADA' && d !== null && d <= 0 && d >= -7
  })
  .map(l => ({ ...l, dias: diasDesde(l.data_programada) }))
  .sort((a, b) => b.dias - a.dias))

const porEquipe = computed(() => {
  const m = new Map()
  for (const l of ativas.value) {
    const e = l.equipe || '—'
    if (!m.has(e)) m.set(e, { equipe: e, total: 0, concluidas: 0, paradas: 0 })
    const r = m.get(e)
    r.total++
    if (l.status_programacao === 'CONCLUIDA') r.concluidas++
    if (l.ultimo_status === 'ANDAMENTO') r.paradas++
  }
  return [...m.values()]
    .map(r => ({ ...r, progresso: r.total ? Math.round(r.concluidas / r.total * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
})

const pendentesPorMunicipio = computed(() => {
  const m = new Map()
  for (const l of ativas.value) {
    if (l.status_programacao === 'CONCLUIDA' || !l.municipio) continue
    m.set(l.municipio, (m.get(l.municipio) || 0) + 1)
  }
  return [...m].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])
})

const ritmo = computed(() => tendencia.value
  .map((t, i, arr) => ({ ...t, delta: i ? t.concluidas - arr[i - 1].concluidas : 0 }))
  .reverse())

const oportunidades = computed(() => {
  const lista = []
  const longas = paradas.value.filter(p => p.dias > 15)
  if (longas.length) {
    lista.push({
      tipo: 'alerta', icone: 'pause_circle',
      titulo: `${longas.length} obras paradas há mais de 15 dias`,
      texto: `A mais antiga é a nota ${longas[0].sap}, parada há ${longas[0].dias} dias.`
    })
  }
  if (atrasadas.value.length) {
    lista.push({
      tipo: 'alerta', icone: 'schedule',
      titulo: `${atrasadas.value.length} visitas com data vencida`,
      texto: 'A data passou e a obra segue programada. Reagende ou confirme a execução.'
    })
  }
  if (proximas.value.length) {
    lista.push({
      tipo: 'ok', icone: 'event_available',
      titulo: `${proximas.value.length} visitas nos próximos 7 dias`,
      texto: 'Confirme equipe e material antes da data.'
    })
  }
  for (const [mun, n] of pendentesPorMunicipio.value.slice(0, 3)) {
    lista.push({
      tipo: 'oportunidade', icone: 'route',
      titulo: `${mun}: ${n} obras pendentes`,
      texto: 'Obras pendentes no mesmo município, boas para sair juntas numa mesma ida.'
    })
  }
  return lista
})

const colParadas = [
  { name: 'sap', label: 'Nota SAP', field: 'sap', align: 'left', sortable: true },
  { name: 'municipio', label: 'Município', field: 'municipio', align: 'left', sortable: true },
  { name: 'equipe', label: 'Equipe', field: 'equipe', align: 'left' },
  { name: 'ultimo', label: 'Último registro', field: 'ultimo_evento', align: 'left', format: formatarData },
  { name: 'dias', label: 'Parada há', field: 'dias', align: 'right', sortable: true }
]

const colAgenda = [
  { name: 'sap', label: 'Nota SAP', field: 'sap', align: 'left' },
  { name: 'municipio', label: 'Município', field: 'municipio', align: 'left' },
  { name: 'equipe', label: 'Equipe', field: 'equipe', align: 'left' },
  { name: 'data', label: 'Data prevista', field: 'data_programada', align: 'left', format: formatarData },
  { name: 'situacao', label: 'Situação', field: 'dias', align: 'right' }
]

// Liga cada obra da programação às notas do sistema pelo SAP, para desenhar no mapa com o status da planilha
const notasPorSap = computed(() => {
  const m = new Map()
  for (const n of notasStore.notas) {
    if (!n.projeto_info_sap) continue
    if (!m.has(n.projeto_info_sap)) m.set(n.projeto_info_sap, [])
    m.get(n.projeto_info_sap).push(n)
  }
  return m
})

const gruposMapa = computed(() => {
  const out = []
  for (const l of linhas.value) {
    for (const n of notasPorSap.value.get(l.sap) ?? []) {
      if (n.latitude == null || n.longitude == null) continue
      out.push({
        nota: n.nota,
        projeto_info_sap: l.sap,
        base: n.base,
        pep: n.pep,
        municipio: n.municipio || l.municipio,
        postes: n.postes,
        qtd_clientes: n.qtd_clientes,
        status: l.status_programacao,
        data_programada: l.data_programada,
        equipe: l.equipe,
        latitude: n.latitude,
        longitude: n.longitude
      })
    }
  }
  return out
})

const semCoordMapa = computed(() => linhas.value.length - new Set(gruposMapa.value.map(g => g.projeto_info_sap)).size)

const precisaAtualizar = computed(() =>
  !ultimaImportacao.value || new Date(ultimaImportacao.value.criado_em).toDateString() !== new Date().toDateString()
)

const ultimaTexto = computed(() => {
  const u = ultimaImportacao.value
  if (!u) return 'Nenhuma programação importada'
  const quando = new Date(u.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const origem = u.origem === 'dropbox' ? 'Dropbox' : u.origem === 'agendador' ? 'agendador' : 'importação manual'
  return `Última atualização: ${quando} (${origem}) · ${u.notas} notas`
})

function formatarData (iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

async function carregar () {
  const [{ data: v }, { data: imp }, { data: cfg }, { data: tend }] = await Promise.all([
    fetchAll(() => supabase.from('programacao_comparativo').select('*').order('sap')),
    supabase.from('programacao_importacoes').select('*').order('criado_em', { ascending: false }).limit(1),
    supabase.from('configuracoes').select('valor').eq('chave', CONFIG_KEY).maybeSingle(),
    supabase.rpc('programacao_tendencia')
  ])
  linhas.value = v || []
  ultimaImportacao.value = imp?.[0] || null
  dropboxUrl.value = cfg?.valor || ''
  tendencia.value = tend || []
}

// Qualquer caminho de importação passa por aqui: grava a programação e aplica as mudanças seguras
async function importarBuffer (buffer, { origem, arquivo }) {
  ocupado.value = true
  try {
    const { registros, lidas, ignoradas } = lerProgramacao(buffer)
    const hash = await hashArquivo(buffer)
    const { error } = await supabase.rpc('importar_programacao', {
      p_registros: registros, p_origem: origem, p_arquivo: arquivo, p_hash: hash
    })
    if (error) throw error
    const { data: ap, error: erroAplicar } = await supabase.rpc('aplicar_programacao', { p_saps: null })
    if (erroAplicar) throw erroAplicar
    await Promise.all([carregar(), notasStore.fetchNotas()])
    const atualizadas = ap?.aplicados ?? 0
    $q.notify({
      type: 'positive', icon: 'event_available', position: 'top', timeout: 4500,
      message: `${registros.length} notas na programação (${lidas} linhas)` +
        (atualizadas ? ` · ${atualizadas} atualizadas no sistema` : '') +
        (ignoradas ? ` · ${ignoradas} linhas com status desconhecido` : '')
    })
  } catch (e) {
    $q.notify({ type: 'negative', message: 'Erro na importação: ' + e.message, position: 'top', timeout: 6000 })
  } finally {
    ocupado.value = false
  }
}

async function onArquivo (e) {
  const file = e.target.files[0]
  if (!file) return
  e.target.value = ''
  await importarBuffer(await file.arrayBuffer(), { origem: 'upload', arquivo: file.name })
}

async function sincronizarDropbox () {
  if (!dropboxUrl.value) { abrirConfig(); return }
  ocupado.value = true
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ url: dropboxUrl.value })
    })
    const payload = await res.json()
    if (payload.error) throw new Error(payload.error)
    const binario = atob(payload.b64)
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
    ocupado.value = false
    await importarBuffer(bytes.buffer, { origem: 'dropbox', arquivo: NOME_ARQUIVO })
  } catch (e) {
    ocupado.value = false
    $q.notify({ type: 'negative', message: 'Erro ao sincronizar: ' + e.message, position: 'top', timeout: 6000 })
  }
}

function abrirConfig () {
  configUrl.value = dropboxUrl.value
  configAberta.value = true
}

async function salvarConfig () {
  const url = configUrl.value.trim()
  const { error } = await supabase.from('configuracoes').upsert({ chave: CONFIG_KEY, valor: url }, { onConflict: 'chave' })
  if (error) {
    $q.notify({ type: 'negative', message: 'Não foi possível salvar o link: ' + error.message, position: 'top' })
    return
  }
  dropboxUrl.value = url
  configAberta.value = false
  sincronizarDropbox()
}

async function aplicarUma (linha) {
  aplicando.value = linha.sap
  const { error } = await supabase.rpc('aplicar_programacao', { p_saps: [linha.sap] })
  aplicando.value = null
  if (error) {
    $q.notify({ type: 'negative', message: 'Erro ao atualizar: ' + error.message, position: 'top' })
    return
  }
  await Promise.all([carregar(), notasStore.fetchNotas()])
}

function confirmarAplicarTodas () {
  $q.dialog({
    title: `Atualizar ${contagem.value.aplicar} notas no sistema?`,
    message: 'Só avança o status (ex.: Não Iniciado → Andamento). Nada que já esteja concluído, expurgado ou sem acesso é alterado.',
    cancel: { label: 'Voltar', flat: true },
    ok: { label: 'Atualizar', color: 'positive', unelevated: true }
  }).onOk(async () => {
    const { data, error } = await supabase.rpc('aplicar_programacao', { p_saps: null })
    if (error) {
      $q.notify({ type: 'negative', message: 'Erro ao atualizar: ' + error.message, position: 'top' })
      return
    }
    await Promise.all([carregar(), notasStore.fetchNotas()])
    $q.notify({ type: 'positive', message: `${data?.aplicados ?? 0} notas atualizadas.`, position: 'top' })
  })
}

const mapaAberto = ref(false)

onMounted(() => {
  carregar()
  notasStore.fetchNotas()
})
</script>

<style scoped>
.prog-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; }
.prog-titulo { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
.prog-sub { font-size: 13px; color: #64748b; margin-top: 2px; }
.prog-acoes { display: flex; flex-wrap: wrap; gap: 8px; }
.prog-alerta { background: #fff3e0; color: #7c4a03; }

.prog-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 16px; }
.prog-tile {
  border-radius: 14px; padding: 14px 16px; background: #f8fafc;
  border-left: 4px solid #cbd5e1;
}
.prog-tile-n { font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; }
.prog-tile-l { font-size: 12px; font-weight: 600; color: #64748b; }
.prog-tile--aplicar { border-left-color: #43a047; }
.prog-tile--conferir { border-left-color: #fb8c00; }
.prog-tile--sem_correspondencia { border-left-color: #90a4ae; }
.prog-tile--ok { border-left-color: #1e88e5; }

.prog-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.prog-busca { min-width: 260px; }
.prog-filtro { min-width: 180px; }

.prog-chip {
  display: inline-block; font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 10px;
  background: #e2e8f0; color: #334155;
}
.prog-chip--concluida { background: #e8f5e9; color: #2e7d32; }
.prog-chip--andamento { background: #fff3e0; color: #e65100; }
.prog-chip--programada { background: #e3f2fd; color: #1565c0; }
.prog-chip--reprogramar { background: #f3e5f5; color: #6a1b9a; }
.prog-chip--cancelar { background: #eceff1; color: #546e7a; }
.prog-data { font-size: 11.5px; color: #64748b; margin-top: 2px; }
.prog-sis { font-size: 13px; font-weight: 600; }
.prog-aviso { font-size: 11.5px; color: #b26a00; font-weight: 600; }
.prog-sis-linha { font-size: 12px; color: #334155; font-variant-numeric: tabular-nums; }

.prog-painel-topo { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 12px; }
.prog-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
.prog-kpi { border-radius: 14px; padding: 14px 16px; background: #fff; box-shadow: 0 1px 3px rgba(15,23,42,0.06); }
.prog-kpi-n { font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; }
.prog-kpi-l { font-size: 12px; font-weight: 600; color: #64748b; }
.prog-kpi--destaque { background: linear-gradient(135deg, #1d4ed8, #1e88e5); color: #fff; }
.prog-kpi--destaque .prog-kpi-l { color: rgba(255,255,255,0.8); }
.prog-kpi--parada { border-left: 4px solid #e65100; }
.prog-kpi--atraso { border-left: 4px solid #c62828; }
.prog-barra-fundo { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.25); margin-top: 8px; overflow: hidden; }
.prog-barra-fundo i { display: block; height: 100%; background: #fff; border-radius: 3px; }

.prog-card { background: #fff; border-radius: 16px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(15,23,42,0.06); min-width: 0; }
.prog-duas { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 12px; }
.prog-sec-titulo { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 800; margin-bottom: 10px; }
.prog-sec-titulo small { font-weight: 500; color: #64748b; margin-left: 4px; }

.prog-insight { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; margin-bottom: 8px; background: #f8fafc; }
.prog-insight:last-child { margin-bottom: 0; }
.prog-insight-titulo { font-weight: 700; font-size: 14px; }
.prog-insight-texto { font-size: 12.5px; color: #64748b; }
.prog-insight--alerta { background: #fff3e0; }
.prog-insight--alerta > .q-icon { color: #e65100; }
.prog-insight--ok { background: #e8f5e9; }
.prog-insight--ok > .q-icon { color: #2e7d32; }
.prog-insight--oportunidade { background: #e3f2fd; }
.prog-insight--oportunidade > .q-icon { color: #1565c0; }

.prog-dias { font-weight: 700; font-variant-numeric: tabular-nums; color: #334155; }
.prog-dias--alerta { color: #c62828; }

.prog-eq { width: 100%; }
.prog-eq th { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
.prog-mini { position: relative; height: 18px; border-radius: 9px; background: #eef2f9; min-width: 90px; overflow: hidden; }
.prog-mini i { position: absolute; left: 0; top: 0; bottom: 0; background: #43a047; border-radius: 9px; }
.prog-mini span { position: relative; font-size: 11.5px; font-weight: 700; line-height: 18px; padding-left: 6px; }

.prog-ritmo { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
.prog-ritmo:last-child { border-bottom: none; }
.prog-ritmo-dia { font-weight: 700; min-width: 76px; }
.prog-delta { font-weight: 700; font-size: 12px; padding: 1px 7px; border-radius: 9px; background: #eef2f9; color: #64748b; }
.prog-delta--pos { background: #e8f5e9; color: #2e7d32; }
.prog-delta--neg { background: #ffebee; color: #c62828; }

.body--dark .prog-kpi, .body--dark .prog-card { background: #111c2e; }
.body--dark .prog-insight { background: #0f1a2b; }
.body--dark .prog-eq th { color: #94a3b8; }
.prog-muted { color: #94a3b8; font-size: 12.5px; }

.body--dark .prog-sub { color: #94a3b8; }
.body--dark .prog-tile { background: #111c2e; }
.body--dark .prog-tile-l { color: #94a3b8; }
.body--dark .prog-alerta { background: #3a2a10; color: #ffcc80; }
</style>
