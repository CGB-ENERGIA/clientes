<template>
  <q-page>
    <div class="q-gutter-y-md">

      <!-- ── Barra de busca + atualizar ───────────────────────────── -->
      <div class="row items-end q-gutter-sm">
        <div class="col-auto">
          <div class="page-titulo">Notas de serviço</div>
          <div class="page-sub">{{ subtituloAtualizacao }}</div>
        </div>
        <q-space />
        <!-- Toggle grade / lista -->
        <q-btn-toggle
          v-model="vista"
          class="vista-toggle"
          unelevated dense no-caps
          :options="[
            { value: 'grid', icon: 'grid_view', attrs: { 'aria-label': 'Ver em cards' } },
            { value: 'list', icon: 'view_list', attrs: { 'aria-label': 'Ver em lista' } }
          ]"
          color="transparent"
          text-color="grey-7"
          toggle-color="primary"
        />
        <q-btn
          label="Mapa" icon="map" no-caps dense outline color="primary"
          class="btn-mapa" @click="mapaAberto = true"
        >
          <q-tooltip>Abrir mapa das notas ({{ notasFiltradas.length }} no filtro atual)</q-tooltip>
        </q-btn>
        <q-btn icon="refresh" flat round dense color="grey-7" aria-label="Atualizar notas" :loading="notasStore.loading" @click="notasStore.fetchNotas()">
          <q-tooltip>Atualizar notas</q-tooltip>
        </q-btn>
      </div>

      <!-- ── Tabs de status ────────────────────────────────────────── -->
      <div class="status-tabs">
        <button
          v-for="t in tabs"
          :key="t.val"
          class="stab"
          :class="['stab--' + t.val, { 'stab--active': tabAtual === t.val }]"
          @click="tabAtual = t.val"
        >
          <span class="stab-icon"><q-icon :name="t.icon" size="15px" /></span>
          <span class="stab-label">{{ t.label }}</span>
          <span class="stab-count">{{ t.count }}</span>
        </button>
        <q-btn flat round dense size="sm" icon="info_outline" color="grey-6" class="self-center">
          <q-tooltip>O que significa cada status?</q-tooltip>
          <q-menu anchor="bottom right" self="top right" class="status-legenda-menu">
            <div class="status-legenda">
              <div class="status-legenda-title">Status das notas</div>
              <div v-for="s in statusLegenda" :key="s.val" class="status-legenda-item">
                <q-icon :name="s.icon" :color="s.color" size="18px" />
                <div>
                  <div class="status-legenda-label">{{ s.label }}</div>
                  <div class="status-legenda-desc">{{ s.desc }}</div>
                </div>
              </div>
            </div>
          </q-menu>
        </q-btn>
      </div>

      <!-- ── Origem (somente na aba Concluídos) ───────────────────── -->
      <div v-if="tabAtual === 'concluido'" class="origem-tabs">
        <span class="origem-tabs-label">Origem:</span>
        <button
          v-for="o in origemOpcoes"
          :key="o.val"
          class="origem-tab"
          :class="{ 'origem-tab--active': origemConcluidos === o.val }"
          @click="origemConcluidos = o.val"
        >
          <q-icon :name="o.icon" size="14px" />
          {{ o.label }}
          <span class="origem-tab-count">{{ o.count }}</span>
          <q-tooltip>{{ o.tip }}</q-tooltip>
        </button>
      </div>

      <!-- ── Filtros ──────────────────────────────────────────────── -->
      <div class="filtros-bar">
        <q-input
          v-model="filtro"
          dense outlined
          placeholder="Buscar nota, SAP, PEP ou cliente"
          style="min-width:280px;flex:1"
          clearable
        >
          <template #prepend><q-icon name="search" size="16px" /></template>
        </q-input>

        <q-select
          v-model="filtroBase"
          :options="basesOptions"
          label="Base"
          dense outlined
          clearable
          emit-value map-options
          style="min-width:170px"
        >
          <template #prepend><q-icon name="location_on" size="16px" /></template>
        </q-select>

        <q-select
          v-model="filtroPostes"
          :options="postesOptions"
          label="Postes"
          dense outlined
          clearable
          emit-value map-options
          style="min-width:140px"
        >
          <template #prepend><q-icon name="electrical_services" size="16px" /></template>
        </q-select>

        <q-select
          v-model="filtroClientes"
          :options="clientesOptions"
          label="Clientes"
          dense outlined
          clearable
          emit-value map-options
          style="min-width:140px"
        >
          <template #prepend><q-icon name="people" size="16px" /></template>
        </q-select>

        <q-select
          v-model="filtroStatus"
          :options="statusOptions"
          label="Status"
          dense outlined
          clearable
          emit-value map-options
          style="min-width:160px"
        >
          <template #prepend><q-icon name="flag" size="16px" /></template>
        </q-select>

        <q-select
          v-model="ordemInicio"
          :options="ordemOptions"
          label="Ordem (início PWA)"
          dense outlined clearable
          emit-value map-options
          style="min-width:180px"
        >
          <template #prepend><q-icon name="swap_vert" size="16px" /></template>
        </q-select>

        <q-input
          v-model="dataInicio"
          type="date"
          label="Início no PWA"
          dense outlined clearable
          style="min-width:170px"
        >
          <template #prepend><q-icon name="event" size="16px" /></template>
        </q-input>

        <div class="filtros-rodape">
        <button
          v-if="filtro || filtroBase || filtroPostes || filtroClientes || filtroStatus || ordemInicio || dataInicio"
          type="button" class="btn-limpar" aria-label="Limpar filtros" @click="limparFiltros"
        >
          <q-icon name="filter_alt_off" size="18px" />
          <q-tooltip>Limpar filtros</q-tooltip>
        </button>

        <button
          type="button" class="chip-toggle chip-toggle--ok" :class="{ 'chip-toggle--on': somenteValidadas }"
          :aria-pressed="somenteValidadas" @click="somenteValidadas = !somenteValidadas"
        >
          <q-icon name="verified" size="15px" />
          Validadas
          <q-tooltip>Exibir apenas notas validadas (oculta Expurgo e Sem Acesso)</q-tooltip>
        </button>

        <button
          type="button" class="chip-toggle chip-toggle--warn" :class="{ 'chip-toggle--on': somenteImprevistos }"
          :aria-pressed="somenteImprevistos" @click="somenteImprevistos = !somenteImprevistos"
        >
          <q-icon name="report_problem" size="15px" />
          Imprevistos
          <span v-if="totalImprevistos" class="chip-toggle-n">({{ totalImprevistos }})</span>
          <q-tooltip>Exibir apenas notas com imprevisto reportado pelo campo</q-tooltip>
        </button>

        <div class="filtros-count self-center">
          <strong>{{ notasFiltradas.length }}</strong> de {{ notasStore.notas.length }} notas
          <ProgInfo titulo="Contagem da lista" texto="Cada linha é um projeto SAP. Notas que dividem o mesmo PROJETO SAP aparecem juntas em uma linha. O número depois de de é o total de notas carregadas." />
        </div>
        </div>
      </div>

      <!-- ── Loading inicial ───────────────────────────────────────── -->
      <div v-if="notasStore.loading && !notasStore.notas.length" class="text-center q-py-xl txt-suave">
        <q-spinner size="40px" color="primary" /><div class="q-mt-sm">Carregando...</div>
      </div>

      <!-- ── Empty state ───────────────────────────────────────────── -->
      <div v-else-if="!notasFiltradas.length" class="card-modern q-pa-xl text-center txt-suave">
        <q-icon name="table_chart" size="48px" class="q-mb-sm" />
        <div class="text-subtitle1">
          {{ filtro ? 'Nenhuma nota encontrada para "' + filtro + '"' : semNotasMsg }}
        </div>
        <q-btn v-if="!filtro && !notasStore.notas.length" label="Importar planilha" icon="upload_file" color="primary" flat class="q-mt-md" to="/notas" />
      </div>

      <!-- ── Vista Lista ──────────────────────────────────────────── -->
      <div v-else-if="vista === 'list'" class="lista-notas">

        <!-- Cabeçalho -->
        <div class="lista-header">
          <div>NOTA</div>
          <div>PROJETO SAP</div>
          <div>PEP</div>
          <div>BASE</div>
          <div>CLIENTE</div>
          <div>P / C</div>
          <div class="lista-header-status">
            STATUS
            <q-icon name="info_outline" size="14px" class="cursor-pointer">
              <q-tooltip>O que significa cada status?</q-tooltip>
              <q-menu anchor="bottom middle" self="top middle" class="status-legenda-menu">
                <div class="status-legenda">
                  <div class="status-legenda-title">Status das notas</div>
                  <div v-for="s in statusLegenda" :key="s.val" class="status-legenda-item">
                    <q-icon :name="s.icon" :color="s.color" size="18px" />
                    <div>
                      <div class="status-legenda-label">{{ s.label }}</div>
                      <div class="status-legenda-desc">{{ s.desc }}</div>
                    </div>
                  </div>
                </div>
              </q-menu>
            </q-icon>
          </div>
          <div></div>
        </div>

        <div
          v-for="n in notasFiltradas"
          :key="n.nota"
          class="lista-row"
          :class="'lista-row--' + n.status"
          @click="abrirDialog(n)"
        >
          <div class="lista-num">
            <template v-if="n._notas?.length > 1">
              <span>{{ n.projeto_info_sap || n.nota }}</span>
              <span class="lista-num-badge">{{ n._notas.length }} notas</span>
            </template>
            <template v-else>{{ n._notas?.[0]?.nota ?? n.nota }}</template>
          </div>
          <div class="lista-projeto">{{ n.projeto_info_sap || '—' }}</div>
          <div class="lista-pep">{{ n.pep || '—' }}</div>
          <div class="lista-base"><span class="nc-badge-base">{{ n.base }}</span></div>
          <div class="lista-cliente">
            <template v-if="n.clientes_planilha?.length">
              <span class="lista-cliente-nome">{{ n.clientes_planilha[0].nome }}</span>
              <span v-if="n.clientes_planilha.length > 1" class="lista-cliente-mais">+{{ n.clientes_planilha.length - 1 }}</span>
            </template>
            <span v-else class="txt-suave">—</span>
          </div>
          <div class="lista-info">
            <span :class="n.postes > 1 ? 'info-destaque info-destaque--poste' : ''">
              <q-icon name="electrical_services" size="13px" /> {{ n.postes }}
            </span>
            <span :class="n.qtd_clientes > 1 ? 'info-destaque info-destaque--cliente' : ''">
              <q-icon name="people" size="13px" /> {{ n.qtd_clientes }}
            </span>
          </div>
          <div class="lista-status">
            <span class="nc-status" :class="'nc-status--' + n.status">
              <span class="nc-status-dot" />{{ labelStatus(n.status) }}
            </span>
            <span v-if="n._equipeInicio" class="lista-equipe">
              <q-icon name="groups" size="12px" /> {{ n._equipeInicio }} · {{ formatarDataCurta(n._inicio) }}
            </span>
            <span v-if="n._imprevistos.length" class="badge-imprevisto">
              <q-icon name="report_problem" size="11px" /> Imprevisto
              <q-tooltip class="text-body2">{{ resumoImprevisto(n._imprevistos[0]) }}</q-tooltip>
            </span>
            <span v-if="n._rascunho" class="badge-rascunho">
              Rascunho
              <q-tooltip>Etapa 2 salva para continuar depois</q-tooltip>
            </span>
            <span v-if="n._apagada" class="badge-apagada">
              Apagada
              <q-icon name="close" size="11px" class="badge-apagada-x" @click.stop="removerBadge(n)">
                <q-tooltip>Remover marca "Apagada"</q-tooltip>
              </q-icon>
            </span>
          </div>
          <div class="lista-acao">
            <!-- Grupo com múltiplas notas -->
            <q-btn
              v-if="n._notas?.length > 1"
              label="Ver notas"
              icon="folder_open"
              color="deep-purple-6"
              unelevated dense size="xs"
              text-color="white"
              @click.stop="abrirDialog(n)"
            />
            <!-- Nota individual -->
            <template v-else>
              <q-btn
                v-if="n.status === 'em_andamento'"
                label="Registrar"
                icon="construction"
                color="warning"
                unelevated dense size="xs"
                text-color="white"
                @click.stop="abrirDialog(n)"
              />
              <q-btn
                v-else-if="n.status === 'baixar_medidor'"
                label="Registrar"
                icon="speed"
                color="blue-7"
                unelevated dense size="xs"
                text-color="white"
                @click.stop="abrirDialog(n)"
              />
              <q-btn
                v-else-if="n.status === 'concluido'"
                label="Ver"
                icon="visibility"
                color="positive"
                outline dense size="xs"
                @click.stop="abrirDialog(n)"
              />
              <q-btn
                v-else
                label="Abrir"
                outline dense size="xs"
                color="blue-grey-5"
                @click.stop="abrirDialog(n)"
              />
            </template>
            <q-btn
              v-if="['em_andamento', 'aguardando_etapa2', 'baixar_medidor', 'concluido'].includes(n.status)"
              icon="delete_outline"
              color="negative"
              flat round dense size="sm"
              @click.stop="confirmarApagar(n)"
            >
              <q-tooltip>Apagar e devolver para Não Iniciado</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>

      <!-- ── Grade de notas ────────────────────────────────────────── -->
      <div v-else class="nota-grid">
        <div
          v-for="n in notasFiltradas"
          :key="n.nota"
          class="nota-card"
          :class="'nota-card--' + n.status"
          @click="abrirDialog(n)"
        >
          <!-- Linha superior: número + badges -->
          <div class="nc-top">
            <div class="nc-num">
              {{ n.nota }}
              <span v-if="n.projeto_info_sap" class="nc-projeto-sap">SAP {{ n.projeto_info_sap }}</span>
            </div>
            <div class="nc-badges">
              <span class="nc-badge-base">{{ n.base }}</span>
              <span class="nc-status" :class="'nc-status--' + n.status">
                <span class="nc-status-dot" />
                {{ labelStatus(n.status) }}
              </span>
              <span v-if="n._imprevistos.length" class="badge-imprevisto">
                <q-icon name="report_problem" size="11px" /> Imprevisto
                <q-tooltip class="text-body2">{{ resumoImprevisto(n._imprevistos[0]) }}</q-tooltip>
              </span>
              <span v-if="n._rascunho" class="badge-rascunho">
                Rascunho
                <q-tooltip>Etapa 2 salva para continuar depois</q-tooltip>
              </span>
              <span v-if="n._apagada" class="badge-apagada">
                Apagada
                <q-icon name="close" size="11px" class="badge-apagada-x" @click.stop="removerBadge(n)">
                  <q-tooltip>Remover marca "Apagada"</q-tooltip>
                </q-icon>
              </span>
            </div>
          </div>

          <!-- Info secundária -->
          <div class="nc-info">
            <span><q-icon name="tag" size="12px" /> {{ n.pep }}</span>
            <span><q-icon name="electrical_services" size="12px" /> {{ n.postes }} postes</span>
            <span><q-icon name="people" size="12px" /> {{ n.qtd_clientes }} clientes</span>
          </div>

          <!-- Mensagem contextual por status -->
          <div class="nc-msg" :class="'nc-msg--' + n.status">
            <template v-if="n.status === 'pendente'">
              <q-icon name="schedule" size="13px" /> Aguardando início
            </template>
            <template v-else-if="n.status === 'em_andamento'">
              <q-icon name="construction" size="13px" /> Campo em andamento — aguardando a equipe finalizar
            </template>
            <template v-else-if="n.status === 'baixar_medidor'">
              <q-icon name="speed" size="13px" /> Registre o Nº do medidor e a foto
            </template>
            <template v-else-if="n.status === 'expurgo'">
              <q-icon name="block" size="13px" /> Expurgo — nota não será executada
            </template>
            <template v-else-if="n.status === 'sem_acesso'">
              <q-icon name="do_not_disturb_on" size="13px" /> Equipe sem acesso ao local
            </template>
            <template v-else>
              <q-icon name="check_circle" size="13px" /> Concluído
            </template>
          </div>

          <!-- Botão de ação -->
          <div class="nc-footer">
            <q-btn
              v-if="n.status === 'em_andamento'"
              label="Ver Registros"
              icon="construction"
              color="warning"
              unelevated dense size="sm"
              text-color="white"
              @click.stop="abrirDialog(n)"
            />
            <q-btn
              v-else-if="n.status === 'baixar_medidor'"
              label="Registrar Medidor"
              icon="speed"
              color="blue-7"
              unelevated dense size="sm"
              text-color="white"
              @click.stop="abrirDialog(n)"
            />
            <q-btn
              v-else-if="n.status === 'concluido'"
              label="Ver / Editar"
              icon="visibility"
              color="positive"
              outline dense size="sm"
              @click.stop="abrirDialog(n)"
            />
            <span v-else class="nc-hint">Não iniciado</span>
            <q-btn
              v-if="['em_andamento', 'aguardando_etapa2', 'baixar_medidor', 'concluido'].includes(n.status)"
              icon="delete_outline"
              color="negative"
              flat round dense size="sm"
              class="q-ml-auto"
              @click.stop="confirmarApagar(n)"
            >
              <q-tooltip>Apagar e devolver para Não Iniciado</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>

    </div>

    <!-- ══════════════════════════════════════════════════════════════
         DIALOG — Grupo de notas (mesmo Projeto SAP)
    ══════════════════════════════════════════════════════════════ -->
    <q-dialog v-model="dialogGrupo">
      <q-card style="min-width:520px;max-width:95vw">
        <q-bar style="background:#311b92;color:#fff;min-height:44px">
          <q-icon name="folder_special" size="16px" />
          <span class="q-ml-sm" style="font-size:14px;font-weight:700">
            SAP {{ grupoAtivo?.projeto_info_sap }}
          </span>
          <q-chip dense color="deep-purple-3" text-color="deep-purple-10" size="sm" class="q-ml-sm">
            {{ grupoAtivo?._notas?.length }} notas
          </q-chip>
          <q-space />
          <q-btn icon="close" flat dense round color="white" v-close-popup />
        </q-bar>

        <!-- Info do grupo -->
        <div class="grupo-info-bar">
          <div class="grupo-info-chip">
            <q-icon name="location_on" size="13px" />
            <span>{{ grupoAtivo?.base }}</span>
          </div>
          <div class="grupo-info-chip grupo-info-chip--pep">
            <q-icon name="tag" size="13px" />
            <span>{{ grupoAtivo?.pep || '—' }}</span>
          </div>
          <div class="grupo-info-chip grupo-info-chip--postes">
            <q-icon name="electrical_services" size="13px" />
            <span>{{ grupoAtivo?._notas?.[0]?.postes ?? 0 }} postes</span>
          </div>
        </div>

        <q-card-section class="q-pa-md q-pt-sm">
          <div class="grupo-lista">
            <div
              v-for="n in grupoAtivo?._notas"
              :key="n.nota"
              class="grupo-item"
              :class="'grupo-item--' + n.status"
            >
              <div class="grupo-item-left">
                <div class="grupo-item-nota">{{ n.nota }}</div>
                <div class="grupo-item-info">
                  <span><q-icon name="people" size="11px" /> {{ n.qtd_clientes }} cliente{{ n.qtd_clientes !== 1 ? 's' : '' }}</span>
                </div>
              </div>
              <span class="nc-status" :class="'nc-status--' + n.status">
                <span class="nc-status-dot" />{{ labelStatus(n.status) }}
              </span>
              <q-btn
                label="Abrir"
                icon="open_in_new"
                dense size="sm"
                color="primary"
                unelevated
                @click="abrirNotaDialog(n)"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <MapaNotas v-model="mapaAberto" :grupos="notasFiltradas" :base-inicial="filtroBase" @abrir="abrirDoMapa" />

    <!-- Dialog editar registro de campo (PG e fotos) -->
    <q-dialog v-model="editRegDialog">
      <q-card style="width: 520px; max-width: 95vw">
        <q-bar style="background:#0a1628;color:#fff;min-height:42px">
          <q-icon name="edit" size="16px" />
          <span class="q-ml-sm text-weight-bold" style="font-size:13px">Editar registro do PG {{ editReg?.pg_numero }}</span>
          <q-space />
          <q-btn icon="close" flat dense round color="white" v-close-popup />
        </q-bar>
        <q-card-section class="q-gutter-sm">
          <q-input
            v-model="editRegPg"
            outlined dense
            label="Número do PG (8 dígitos)"
            mask="########"
            :rules="[() => editRegPgValido || 'Informe exatamente 8 dígitos']"
          />
          <div class="text-caption text-grey-8">Fotos deste poste (a primeira é a principal)</div>
          <div class="row q-col-gutter-sm">
            <div v-for="(url, i) in editRegFotos" :key="url + i" class="col-auto medidor-thumb-wrap">
              <img :src="url" class="medidor-thumb" title="Ver foto ampliada" @click="verFoto(url)" />
              <q-btn
                icon="close" round dense unelevated size="6px"
                color="negative" class="medidor-thumb-remove"
                @click="editRegFotos.splice(i, 1)"
              >
                <q-tooltip>Remover foto</q-tooltip>
              </q-btn>
            </div>
            <div v-if="!editRegFotos.length" class="col-12 txt-suave">Sem fotos neste registro.</div>
          </div>
          <q-btn
            flat dense no-caps color="primary" icon="add_a_photo" label="Adicionar foto"
            :loading="editRegSalvando"
            @click="editRegFotoInput.click()"
          />
          <input ref="editRegFotoInput" type="file" accept="image/*" hidden @change="onFotoEscolhida" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated no-caps color="primary" label="Salvar"
            :disable="!editRegPgValido || editRegSalvando"
            :loading="editRegSalvando"
            @click="salvarEdicaoRegistro"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialog preview foto medidor -->
    <q-dialog v-model="fotoDialog">
      <q-card style="max-width:95vw">
        <q-bar style="background:#0a1628;color:#fff;min-height:42px">
          <q-icon name="photo_camera" size="16px" />
          <span class="q-ml-sm text-weight-bold" style="font-size:13px">{{ fotoDialogTitulo }}</span>
          <q-space />
          <q-btn icon="close" flat dense round color="white" v-close-popup />
        </q-bar>
        <q-card-section class="q-pa-sm">
          <img :src="fotoDialogLista[fotoDialogIdx]" style="max-width:100%;max-height:75vh;display:block;margin:0 auto;border-radius:8px" />
        </q-card-section>
        <q-card-actions v-if="fotoDialogLista.length > 1" align="between" class="items-center q-pt-none">
          <q-btn flat round icon="chevron_left" :disable="fotoDialogIdx === 0" @click="fotoDialogIdx--" />
          <span class="text-caption text-grey-8">
            {{ fotoDialogIdx === 0 ? 'Foto principal' : `Adicional ${fotoDialogIdx}` }} · {{ fotoDialogIdx + 1 }} de {{ fotoDialogLista.length }}
          </span>
          <q-btn flat round icon="chevron_right" :disable="fotoDialogIdx >= fotoDialogLista.length - 1" @click="fotoDialogIdx++" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ══════════════════════════════════════════════════════════════
         DIALOG — Etapa 2: Registro de clientes (escritório)
    ══════════════════════════════════════════════════════════════ -->
    <q-dialog v-model="dialog" maximized transition-show="slide-up" transition-hide="slide-down">
      <q-card class="dlg">

        <!-- Topo: identidade da nota -->
        <header class="dlg-topo">
          <div class="dlg-topo-txt">
            <div class="dlg-passo">Etapa 2</div>
            <div class="dlg-titulo">Registro de clientes</div>
          </div>
          <q-space />
          <q-btn-dropdown
            flat no-caps dense
            class="dlg-status"
            :label="'Status: ' + labelStatus(notaAtiva?.status)"
            icon="tune"
          >
            <q-list dense>
              <q-item
                v-for="s in statusOpcoes"
                :key="s.val"
                clickable v-close-popup
                @click="alterarStatus(s.val)"
              >
                <q-item-section avatar>
                  <q-icon :name="s.icon" :color="s.color" size="16px" />
                </q-item-section>
                <q-item-section>{{ s.label }}</q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
          <q-btn icon="close" flat round dense class="dlg-fechar" aria-label="Fechar" @click="dialog = false" />
        </header>

        <!-- Dados da nota -->
        <div class="dlg-meta">
          <div class="meta">
            <span class="meta-lbl">Projeto SAP</span>
            <span class="meta-val meta-val--destaque">{{ notaAtiva?.projeto_info_sap || notaAtiva?.nota }}</span>
          </div>
          <div v-if="notaAtiva?.notas_lista?.length" class="meta">
            <span class="meta-lbl">Notas</span>
            <span class="meta-val">{{ notaAtiva.notas_lista.join(' · ') }}</span>
          </div>
          <div class="meta">
            <span class="meta-lbl">Base</span>
            <span class="meta-val">{{ notaAtiva?.base || '—' }}</span>
          </div>
          <div class="meta">
            <span class="meta-lbl">PEP</span>
            <span class="meta-val meta-val--mono">{{ notaAtiva?.pep || '—' }}</span>
          </div>
          <div class="meta">
            <span class="meta-lbl">Postes</span>
            <span class="meta-val"><q-icon name="electrical_services" size="15px" class="meta-ico meta-ico--ambar" /> {{ notaAtiva?.postes }}</span>
          </div>
          <div class="meta">
            <span class="meta-lbl">Clientes previstos</span>
            <span class="meta-val"><q-icon name="people" size="15px" class="meta-ico meta-ico--verde" /> {{ notaAtiva?.qtd_clientes }}</span>
          </div>
        </div>

        <!-- Input de foto (oculto) -->
        <input ref="fotoInput" type="file" accept="image/*" multiple hidden @change="onFotoSelecionada" />

        <!-- Conteúdo com rolagem -->
        <div class="dlg-corpo">
          <div class="dlg-grade">

            <!-- ── Coluna principal: Etapa 2 ── -->
            <main class="dlg-principal">

              <div v-for="imp in imprevistosNotaAtiva" :key="imp.id" class="aviso aviso--alerta">
                <q-icon name="report_problem" size="22px" class="aviso-ico" />
                <div class="aviso-txt">
                  <div class="aviso-titulo">Imprevisto reportado pelo campo: {{ imp.motivo }}</div>
                  <div v-if="imp.observacao" class="aviso-corpo">{{ imp.observacao }}</div>
                  <div class="aviso-meta">{{ imp.equipe }} · {{ formatarDataCompleta(imp.created_at) }}</div>
                </div>
                <q-btn
                  label="Resolvido" icon="check" no-caps outline dense color="deep-orange"
                  class="btn-pill" @click="resolverImprevisto(imp)"
                >
                  <q-tooltip>Marcar imprevisto como resolvido (remove o selo)</q-tooltip>
                </q-btn>
              </div>

              <div v-if="notaAtiva && !podeConcluir" class="aviso aviso--info">
                <q-icon name="info" size="22px" class="aviso-ico" />
                <div class="aviso-txt">
                  <div class="aviso-corpo aviso-corpo--forte">
                    <template v-if="notaAtiva.status === 'em_andamento'">
                      Nota em <b>Andamento</b>: aguardando a equipe tocar em <b>"Finalizar nota"</b> no app de campo.
                    </template>
                    <template v-else>
                      Nota em <b>{{ labelStatus(notaAtiva.status) }}</b>.
                    </template>
                    Você pode preencher e salvar como rascunho; a conclusão é liberada quando a nota estiver em <b>Aguardando Etapa 2</b> ou <b>Auditar</b>.
                  </div>
                </div>
                <q-btn
                  v-if="['pendente', 'em_andamento'].includes(notaAtiva.status)"
                  label="Enviar para Etapa 2" icon="speed" no-caps outline dense color="primary"
                  class="btn-pill" @click="alterarStatus('aguardando_etapa2')"
                >
                  <q-tooltip>Use quando a equipe concluiu o campo mas não finalizou pelo app</q-tooltip>
                </q-btn>
              </div>

              <div v-if="notaAtiva?.status === 'baixar_medidor'" class="aviso aviso--info">
                <q-icon name="speed" size="22px" class="aviso-ico" />
                <div class="aviso-txt"><div class="aviso-corpo aviso-corpo--forte">Preencha o <b>Nº do medidor</b> e a <b>foto</b> de cada cliente para concluir.</div></div>
              </div>

              <!-- Serviço registrado pela Equipe 2 -->
              <section v-if="temServicoEquipe2" class="bloco">
                <div class="bloco-cab">
                  <span class="bloco-titulo"><q-icon name="build" size="18px" /> Serviço registrado pela Equipe 2</span>
                </div>
                <div class="bloco-corpo">
                  <q-input
                    v-model="servicoEquipe2.descricao"
                    type="textarea" autogrow outlined dense
                    label="Descrição do serviço"
                  />
                  <div class="fotos-linha">
                    <div v-for="(url, i) in servicoEquipe2.fotos" :key="url" class="foto-quadro">
                      <img :src="url" alt="Foto do serviço" />
                      <q-btn round dense size="xs" icon="close" color="negative" class="foto-quadro-x" aria-label="Remover foto" @click="removerFotoServico(i)" />
                    </div>
                    <button type="button" class="foto-add foto-add--grande" :disabled="servicoSalvando" @click="fotoServicoInput?.click()">
                      <q-icon name="add_a_photo" size="24px" />
                      <span>Adicionar foto</span>
                    </button>
                    <input ref="fotoServicoInput" type="file" accept="image/*" hidden @change="e => { adicionarFotoServico(e.target.files?.[0]); e.target.value = '' }" />
                  </div>
                  <div>
                    <q-btn unelevated color="primary" label="Salvar serviço" icon="save" no-caps class="btn-pill" :loading="servicoSalvando" @click="salvarServico" />
                  </div>
                </div>
              </section>

              <!-- Clientes -->
              <section class="bloco">
                <div class="bloco-cab">
                  <span class="bloco-titulo"><q-icon name="people" size="18px" /> Clientes atendidos</span>
                  <q-btn label="Adicionar cliente" icon="add" no-caps outline dense color="primary" class="btn-pill" @click="adicionarCliente" />
                </div>

                <div v-if="!clientes.length" class="vazio-bloco">
                  <q-icon name="person_add" size="34px" />
                  <div class="vazio-bloco-titulo">Nenhum cliente adicionado</div>
                  <div class="vazio-bloco-sub">Use "Adicionar cliente" para começar.</div>
                </div>

                <div class="cli-lista">
                  <div v-for="(c, i) in clientes" :key="i" class="cli" :class="{ 'cli--nao': !c.atendido }">
                    <div class="cli-topo">
                      <span class="cli-n">{{ i + 1 }}</span>
                      <div v-if="c.origem === 'planilha'" class="cli-origem">
                        <q-icon name="table_chart" size="14px" />
                        <span class="cli-origem-lbl">Planilha</span>
                        <span v-if="c._endereco" class="cli-end">{{ c._endereco }}{{ c._bairro ? ' — ' + c._bairro : '' }}</span>
                      </div>
                      <q-space />
                      <div class="seg" role="group" aria-label="Situação do cliente">
                        <button type="button" class="seg-op seg-op--ok" :class="{ 'seg-op--on': c.atendido }" :aria-pressed="c.atendido" @click="c.atendido = true">
                          <q-icon name="check_circle" size="16px" /> Atendido
                        </button>
                        <button type="button" class="seg-op seg-op--nao" :class="{ 'seg-op--on': !c.atendido }" :aria-pressed="!c.atendido" @click="c.atendido = false">
                          <q-icon name="cancel" size="16px" /> Não atendido
                        </button>
                      </div>
                      <q-btn icon="delete_outline" flat round dense color="grey-7" aria-label="Remover cliente" @click="removerCliente(i)">
                        <q-tooltip>Remover cliente</q-tooltip>
                      </q-btn>
                    </div>

                    <div class="cli-campos">
                      <q-input v-model="c.nome" label="Nome do cliente" outlined dense class="cli-c-nome" />
                      <q-select v-model="c.padrao" :options="padraoOptions" label="Padrão" outlined dense emit-value map-options clearable class="cli-c-padrao" />
                      <q-input v-model="c.conta_contrato" label="Conta / CPF" outlined dense class="cli-c-conta" />

                      <q-input
                        v-model="c.num_medidor"
                        label="Nº do medidor *"
                        outlined dense
                        class="cli-c-medidor"
                        :error="tentouSalvar && !c.num_medidor?.trim()"
                        error-message="Obrigatório"
                        hide-bottom-space
                      >
                        <template #prepend><q-icon name="speed" size="16px" /></template>
                      </q-input>

                      <div class="cli-c-fotos">
                        <div class="fotos-linha">
                          <button
                            type="button" class="foto-add"
                            :class="{ 'foto-add--erro': tentouSalvar && !c.fotos.length, 'foto-add--ok': c.fotos.length }"
                            @click="selecionarFoto(i)"
                          >
                            <q-icon name="add_a_photo" size="20px" />
                            <span>{{ c.fotos.length ? 'Adicionar foto' : 'Foto do medidor *' }}</span>
                          </button>
                          <div v-for="(f, fi) in c.fotos" :key="f.preview" class="medidor-thumb-wrap">
                            <img :src="f.preview" class="medidor-thumb" title="Ver foto ampliada" alt="Foto do medidor" @click="verFoto(f.preview)" />
                            <q-btn
                              icon="close" round dense unelevated size="6px"
                              color="negative" class="medidor-thumb-remove" aria-label="Remover foto"
                              @click="removerFoto(c, fi)"
                            >
                              <q-tooltip>Remover foto</q-tooltip>
                            </q-btn>
                          </div>
                        </div>
                        <div v-if="tentouSalvar && !c.fotos.length" class="cli-erro">Foto obrigatória</div>
                      </div>

                      <q-input
                        v-if="!c.atendido"
                        v-model="c.motivo"
                        label="Motivo do não atendimento *"
                        outlined dense class="cli-c-motivo"
                        :rules="[v => !!v || 'Informe o motivo']"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </main>

            <!-- ── Coluna lateral: Etapa 1 (campo) ── -->
            <aside class="dlg-lateral">
              <section class="bloco bloco--lateral">
                <div class="bloco-cab">
                  <span class="bloco-titulo"><q-icon name="construction" size="18px" /> Etapa 1 · Registro de campo</span>
                  <q-btn
                    v-if="registrosCampo.length"
                    label="Apagar tudo" icon="delete_sweep" no-caps flat dense size="sm" color="negative"
                    @click="apagarRegistrosCampo"
                  />
                </div>

                <div v-if="carregandoCampo" class="vazio-bloco">
                  <q-spinner size="26px" color="primary" />
                  <div class="vazio-bloco-sub">Buscando registros do campo…</div>
                </div>

                <div v-else-if="!registrosCampo.length" class="vazio-bloco">
                  <q-icon name="engineering" size="34px" />
                  <div class="vazio-bloco-titulo">Nenhum registro do campo ainda</div>
                  <div class="vazio-bloco-sub">A equipe ainda não enviou os postes.</div>
                </div>

                <div v-else class="cmp">
                  <div class="cmp-stats">
                    <div class="cmp-stat">
                      <span class="cmp-stat-val">{{ campoStats.total }}</span>
                      <span class="cmp-stat-lbl">Postes</span>
                    </div>
                    <div class="cmp-stat">
                      <span class="cmp-stat-val">{{ campoStats.equipes }}</span>
                      <span class="cmp-stat-lbl">{{ campoStats.equipes === 1 ? 'Equipe' : 'Equipes' }}</span>
                    </div>
                    <div class="cmp-stat">
                      <span class="cmp-stat-val">{{ campoStats.comFoto }}<small>/{{ campoStats.total }}</small></span>
                      <span class="cmp-stat-lbl">Com foto</span>
                    </div>
                    <div class="cmp-stat">
                      <span class="cmp-stat-val cmp-stat-val--sm">{{ campoStats.ultimoRegistro }}</span>
                      <span class="cmp-stat-lbl">Último registro</span>
                    </div>
                  </div>

                  <div v-for="grupo in registrosCampoPorEquipe" :key="grupo.equipe" class="cmp-equipe">
                    <div class="cmp-equipe-cab">
                      <span class="cmp-equipe-nome"><q-icon name="groups" size="16px" /> {{ grupo.equipe }}</span>
                      <span class="pill pill--ambar">{{ grupo.registros.length }} PG{{ grupo.registros.length > 1 ? 's' : '' }}</span>
                    </div>

                    <div class="cmp-pgs">
                      <div v-for="r in grupo.registros" :key="r.id" class="cmp-pg">
                        <button
                          type="button" class="cmp-pg-foto" :class="{ 'cmp-pg-foto--vazia': !r.foto_url }"
                          :disabled="!r.foto_url" :aria-label="r.foto_url ? 'Ver fotos do poste' : 'Foto não enviada'"
                          @click="r.foto_url && verFotosPoste(r)"
                        >
                          <img v-if="r.foto_url" :src="r.foto_url" alt="Foto do poste" />
                          <q-icon v-else name="hide_image" size="20px" />
                          <span v-if="r.fotos_extras?.length" class="cmp-pg-mais">+{{ r.fotos_extras.length }}</span>
                        </button>
                        <div class="cmp-pg-info">
                          <div class="cmp-pg-num">PG {{ r.pg_numero }}</div>
                          <div class="cmp-pg-hora">{{ formatarDataCompleta(r.created_at) }}</div>
                        </div>
                        <q-btn flat round dense size="sm" icon="edit" color="primary" aria-label="Editar PG e fotos" @click="abrirEditarRegistro(r)">
                          <q-tooltip>Editar PG e fotos</q-tooltip>
                        </q-btn>
                        <q-btn flat round dense size="sm" icon="delete_outline" color="negative" aria-label="Apagar registro" @click="apagarRegistro(r)">
                          <q-tooltip>Apagar registro</q-tooltip>
                        </q-btn>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </aside>

          </div>
        </div>

        <!-- Rodapé fixo: resumo + ações -->
        <footer class="dlg-rodape">
          <div class="dlg-rodape-info">
            <template v-if="clientes.length">
              <span class="resumo resumo--ok"><q-icon name="check_circle" size="16px" /> {{ totalAtendidos }} atendido{{ totalAtendidos === 1 ? '' : 's' }}</span>
              <span v-if="totalNaoAtendidos" class="resumo resumo--nao"><q-icon name="cancel" size="16px" /> {{ totalNaoAtendidos }} não atendido{{ totalNaoAtendidos === 1 ? '' : 's' }}</span>
              <span class="resumo"><q-icon name="people" size="16px" /> {{ clientes.length }} no total</span>
            </template>
            <span v-if="rascunhoEm" class="resumo resumo--rascunho"><q-icon name="edit_note" size="16px" /> Rascunho salvo em {{ formatarDataCompleta(rascunhoEm) }}</span>
          </div>
          <q-btn label="Cancelar" flat no-caps color="grey-7" class="btn-pill" @click="dialog = false" />
          <q-btn
            v-if="notaAtiva?.status !== 'concluido'"
            label="Salvar e continuar depois"
            icon="save" no-caps outline color="primary" class="btn-pill"
            :loading="salvando === 'rascunho'"
            :disable="!clientes.length || !!salvando"
            @click="salvar(true)"
          >
            <q-tooltip>Guarda o que já foi preenchido sem concluir a nota</q-tooltip>
          </q-btn>
          <div>
            <q-btn
              label="Salvar e concluir"
              icon="check_circle" no-caps unelevated color="positive" class="btn-pill btn-concluir"
              :loading="salvando === 'concluir'"
              :disable="!clientes.length || !!salvando || !podeConcluir"
              @click="salvar(false)"
            />
            <q-tooltip v-if="!podeConcluir" class="text-body2">
              Só notas em "Aguardando Etapa 2" ou "Auditar" podem ser concluídas. Esta nota está em "{{ labelStatus(notaAtiva?.status) }}".
            </q-tooltip>
          </div>
        </footer>

      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup>
import { ref, computed, reactive, onUnmounted } from 'vue'
import { usarEstadoPersistido } from 'src/utils/estadoPersistido'
import { useQuasar } from 'quasar'
import { useNotasStore } from 'stores/notas'
import { useApontamentoStore } from 'stores/apontamento'
import { supabase } from 'boot/supabase'
import MapaNotas from 'components/MapaNotas.vue'
import ProgInfo from 'components/ProgInfo.vue'

const $q         = useQuasar()
const notasStore = useNotasStore()
const subtituloAtualizacao = computed(() => {
  const d = notasStore.atualizadoEm
  if (!d) return notasStore.loading ? 'Carregando notas…' : 'Notas do último acesso'
  return 'Atualizado às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
})
const apStore    = useApontamentoStore()

// ── Filtros, tabs e vista ─────────────────────────────────────────
const filtro         = ref('')
const filtroBase     = ref(null)
const filtroPostes   = ref(null)
const filtroClientes = ref(null)
const filtroStatus   = ref(null)
const tabAtual       = ref('todas')
const vista          = ref('list')

const postesOptions = [
  { label: '1 poste',   value: '1' },
  { label: '2 postes',  value: '2' },
  { label: '3+ postes', value: '3+' },
]

const clientesOptions = [
  { label: '1 cliente',   value: '1' },
  { label: '2 clientes',  value: '2' },
  { label: '3+ clientes', value: '3+' },
]

const basesOptions = computed(() =>
  [...new Set(notasStore.notas.map(n => n.base).filter(Boolean))].sort().map(b => ({ label: b, value: b }))
)

const statusOptions = [
  { label: 'Não Iniciado',   value: 'pendente'       },
  { label: 'Andamento',      value: 'em_andamento'   },
  { label: 'Aguardando Etapa 2', value: 'aguardando_etapa2' },
  { label: 'Auditar', value: 'baixar_medidor' },
  { label: 'Concluído',      value: 'concluido'      },
  { label: 'Expurgo',        value: 'expurgo'        },
  { label: 'Sem Acesso',     value: 'sem_acesso'     },
]

const ordemInicio = ref(null)
const dataInicio  = ref(null)
const ordemOptions = [
  { label: 'Mais recentes', value: 'recentes' },
  { label: 'Mais antigos',  value: 'antigos'  }
]

function diaLocal (iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatarDataCurta (iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function limparFiltros () {
  filtro.value           = ''
  filtroBase.value       = null
  filtroPostes.value     = null
  filtroClientes.value   = null
  filtroStatus.value     = null
  ordemInicio.value      = null
  dataInicio.value       = null
  somenteValidadas.value = false
  somenteImprevistos.value = false
}

// ── Prioridade de status (menor índice = mais urgente) ───────────
const STATUS_PRIO = ['em_andamento', 'aguardando_etapa2', 'baixar_medidor', 'pendente', 'expurgo', 'sem_acesso', 'concluido']

// ── Agrupa notas pelo PROJETO SAP (ou nota individual se não tiver) ─
const todasAgrupadas = computed(() => {
  const grupos = new Map()
  for (const n of notasStore.notas) {
    const key = n.projeto_info_sap?.trim() || n.nota
    if (!grupos.has(key)) {
      grupos.set(key, {
        _key:            key,
        _notas:          [],
        nota:            n.nota,
        projeto_info_sap: n.projeto_info_sap,
        base:            n.base,
        pep:             n.pep,
        postes:          0,
        qtd_clientes:    0,
        clientes_planilha: [],
        status:          'concluido',
      })
    }
    const g = grupos.get(key)
    g._notas.push(n)
    // postes = infraestrutura física compartilhada → usa o maior valor do grupo
    g.postes = Math.max(g.postes, Number(n.postes) || 0)
    // clientes = soma (cada nota pode ter clientes distintos)
    g.qtd_clientes += Number(n.qtd_clientes) || 0
    for (const c of (n.clientes_planilha || [])) {
      const id = c.conta_contrato?.trim()
      if (!id || !g.clientes_planilha.some(e => e.conta_contrato?.trim() === id)) {
        g.clientes_planilha.push(c)
      }
    }
    if (STATUS_PRIO.indexOf(n.status) < STATUS_PRIO.indexOf(g.status)) {
      g.status = n.status
    }
  }
  const viaPwa = notasStore.notasViaPwa
  for (const g of grupos.values()) {
    g._viaPwa   = g._notas.some(n => viaPwa.has(n.nota))
    g._apagada  = g._notas.some(n => n.apagada)
    g._rascunho = g.status !== 'concluido' && g._notas.some(n => notasStore.notasComRascunho.has(n.nota))
    g._imprevistos = g._notas.flatMap(n => notasStore.imprevistosAbertos.get(n.nota) || [])
    const inicios = g._notas.map(n => notasStore.campoInicio.get(n.nota)).filter(Boolean)
    const primeiro = inicios.reduce((a, b) => (!a || b.inicio < a.inicio ? b : a), null)
    g._inicio       = primeiro?.inicio ?? null
    g._equipeInicio = primeiro?.equipe ?? ''
  }
  return [...grupos.values()]
})

const somenteValidadas = ref(false)
const somenteImprevistos = ref(false)
const totalImprevistos = computed(() => todasAgrupadas.value.filter(g => g._imprevistos.length).length)

const imprevistosNotaAtiva = computed(() =>
  notaAtiva.value ? (notasStore.imprevistosAbertos.get(notaAtiva.value.nota) || []) : []
)

async function resolverImprevisto (imp) {
  const { error } = await notasStore.resolverImprevistos([imp.id])
  if (error) $q.notify({ type: 'negative', message: 'Erro ao resolver imprevisto: ' + error.message })
  else $q.notify({ type: 'positive', message: 'Imprevisto marcado como resolvido.' })
}

function resumoImprevisto (i) {
  return `${i.motivo}${i.observacao ? ' — ' + i.observacao : ''} · ${i.equipe} · ${formatarData(i.created_at)}`
}

// ── Origem dos concluídos: feitos pelo PWA x já concluídos na planilha ─
const origemConcluidos = ref('todas')

// Ao recarregar, volta para os filtros e a aba que o usuário estava usando
usarEstadoPersistido('apontamento', {
  filtro, filtroBase, filtroPostes, filtroClientes, filtroStatus,
  tabAtual, vista, ordemInicio, dataInicio, somenteValidadas, somenteImprevistos, origemConcluidos
})
const origemOpcoes = computed(() => {
  const concl = todasAgrupadas.value.filter(g => g.status === 'concluido')
  const pwa = concl.filter(g => g._viaPwa).length
  return [
    { val: 'todas', label: 'Todos',              icon: 'apps',         count: concl.length,       tip: 'Todas as notas concluídas' },
    { val: 'pwa',   label: 'Via PWA',            icon: 'smartphone',   count: pwa,                tip: 'Concluídas com registros de campo feitos pelo app CGB Campo' },
    { val: 'banco', label: 'Já vieram concluídas', icon: 'cloud_download', count: concl.length - pwa, tip: 'Já constavam como concluídas na planilha importada, sem registros pelo app' },
  ]
})

const contadores = computed(() => {
  const gs = todasAgrupadas.value
  return {
    todas:          gs.length,
    pendente:       gs.filter(g => g.status === 'pendente').length,
    em_andamento:   gs.filter(g => g.status === 'em_andamento').length,
    aguardando_etapa2: gs.filter(g => g.status === 'aguardando_etapa2').length,
    baixar_medidor: gs.filter(g => g.status === 'baixar_medidor').length,
    concluido:      gs.filter(g => g.status === 'concluido').length,
    expurgo:        gs.filter(g => g.status === 'expurgo').length,
    sem_acesso:     gs.filter(g => g.status === 'sem_acesso').length,
  }
})

const tabs = computed(() => [
  { val: 'todas',          label: 'Geral',          icon: 'apps',         count: contadores.value.todas },
  { val: 'pendente',       label: 'Não Iniciado',   icon: 'schedule',     count: contadores.value.pendente },
  { val: 'em_andamento',   label: 'Andamento',      icon: 'construction', count: contadores.value.em_andamento },
  { val: 'aguardando_etapa2', label: 'Aguardando Etapa 2', icon: 'hourglass_empty', count: contadores.value.aguardando_etapa2 },
  { val: 'baixar_medidor', label: 'Auditar', icon: 'speed',        count: contadores.value.baixar_medidor },
  { val: 'concluido',      label: 'Concluídos',     icon: 'check_circle', count: contadores.value.concluido }
])

const notasFiltradas = computed(() => {
  let lista = tabAtual.value === 'todas'
    ? todasAgrupadas.value
    : todasAgrupadas.value.filter(g => g.status === tabAtual.value)

  if (tabAtual.value === 'concluido' && origemConcluidos.value !== 'todas') {
    const pwa = origemConcluidos.value === 'pwa'
    lista = lista.filter(g => g._viaPwa === pwa)
  }

  if (somenteValidadas.value) {
    lista = lista.filter(g => g.status !== 'expurgo' && g.status !== 'sem_acesso')
  }

  if (somenteImprevistos.value) lista = lista.filter(g => g._imprevistos.length)

  const q = filtro.value?.trim().toLowerCase()
  if (q) lista = lista.filter(g =>
    g._notas.some(n =>
      [
        n.nota, n.projeto_info_sap, n.pep, n.base, n.municipio,
        ...(n.clientes_planilha ?? []).flatMap(c => [c.nome, c.conta_contrato, c.endereco, c.bairro])
      ].some(v => String(v ?? '').toLowerCase().includes(q))
    )
  )

  if (filtroBase.value) lista = lista.filter(g => g.base === filtroBase.value)

  if (filtroPostes.value) {
    if (filtroPostes.value === '3+') lista = lista.filter(g => g.postes >= 3)
    else lista = lista.filter(g => String(g.postes) === filtroPostes.value)
  }

  if (filtroClientes.value) {
    if (filtroClientes.value === '3+') lista = lista.filter(g => g.qtd_clientes >= 3)
    else lista = lista.filter(g => String(g.qtd_clientes) === filtroClientes.value)
  }

  if (filtroStatus.value) lista = lista.filter(g => g.status === filtroStatus.value)

  if (dataInicio.value) lista = lista.filter(g => g._inicio && diaLocal(g._inicio) === dataInicio.value)

  if (ordemInicio.value) {
    const sinal = ordemInicio.value === 'recentes' ? -1 : 1
    lista = [...lista].sort((a, b) => {
      if (!a._inicio && !b._inicio) return 0
      if (!a._inicio) return 1
      if (!b._inicio) return -1
      return sinal * (a._inicio < b._inicio ? -1 : a._inicio > b._inicio ? 1 : 0)
    })
  }

  return lista
})

const semNotasMsg = computed(() => {
  if (!notasStore.notas.length) return 'Nenhuma nota importada ainda.'
  const labels = {
    pendente:       'Não Iniciadas',
    em_andamento:   'em Andamento',
    aguardando_etapa2: 'aguardando a Etapa 2',
    baixar_medidor: 'para auditoria',
    concluido:      'Concluídas',
    expurgo:        'com Expurgo',
    sem_acesso:     'Sem Acesso',
  }
  return `Nenhuma nota ${labels[tabAtual.value] ?? ''} no momento.`
})

const statusOpcoes = [
  { val: 'pendente',       label: 'Não Iniciado',   icon: 'schedule',     color: 'grey-6'  },
  { val: 'em_andamento',   label: 'Andamento',      icon: 'construction', color: 'orange'  },
  { val: 'aguardando_etapa2', label: 'Aguardando Etapa 2', icon: 'hourglass_empty', color: 'purple' },
  { val: 'baixar_medidor', label: 'Auditar', icon: 'speed',        color: 'blue'    },
  { val: 'concluido',      label: 'Concluído',      icon: 'check_circle', color: 'positive'},
]

const statusLegenda = [
  { val: 'pendente',       label: 'Não Iniciado',   icon: 'schedule',     color: 'grey-6',   desc: 'Nota importada, mas a equipe de campo ainda não registrou nenhum poste.' },
  { val: 'em_andamento',   label: 'Andamento',      icon: 'construction', color: 'orange',   desc: 'A equipe registrou postes pelo app de campo ou pausou com "Concluir mais tarde". Aguarda a equipe finalizar a nota.' },
  { val: 'aguardando_etapa2', label: 'Aguardando Etapa 2', icon: 'hourglass_empty', color: 'purple', desc: 'Campo finalizado no app. Falta a equipe 2 registrar a descrição, as fotos do serviço, o Nº do medidor e a foto de cada cliente.' },
  { val: 'baixar_medidor', label: 'Auditar', icon: 'speed',        color: 'blue',     desc: 'Campo finalizado no app (ou cliente ligado na planilha). Falta registrar o Nº do medidor e a foto de cada cliente.' },
  { val: 'concluido',      label: 'Concluído',      icon: 'check_circle', color: 'positive', desc: 'Medidores registrados na Etapa 2 (ou finalizado no CCS). Nenhuma ação pendente.' },
  { val: 'expurgo',        label: 'Expurgo',        icon: 'block',        color: 'negative', desc: 'Nota marcada como EXPURGO na planilha. Não será executada.' },
  { val: 'sem_acesso',     label: 'Sem Acesso',     icon: 'do_not_disturb_on', color: 'deep-orange', desc: 'A equipe não conseguiu acesso ao local (retorno SEM ACESSO na planilha).' },
]

async function alterarStatus (novoStatus) {
  if (!notaAtiva.value) return
  const { error } = await notasStore.atualizarStatus(notaAtiva.value.nota, novoStatus)
  if (!error) {
    notaAtiva.value = { ...notaAtiva.value, status: novoStatus }
    $q.notify({ type: 'positive', message: `Status alterado para "${labelStatus(novoStatus)}"`, position: 'top', timeout: 2000 })
  }
}

// ── Editar registro de campo: PG (8 dígitos) e fotos ──
const editRegDialog = ref(false)
const editReg = ref(null)
const editRegPg = ref('')
const editRegFotos = ref([])
const editRegSalvando = ref(false)
const editRegFotoInput = ref(null)
const editRegPgValido = computed(() => /^[0-9]{8}$/.test(editRegPg.value || ''))

function abrirEditarRegistro (r) {
  editReg.value = r
  editRegPg.value = r.pg_numero
  editRegFotos.value = [r.foto_url, ...(r.fotos_extras || [])].filter(Boolean)
  editRegDialog.value = true
}

async function enviarFotoRegistro (file) {
  const nome = `registro/${editReg.value.nota}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('campo-fotos').upload(nome, file, {
    contentType: file.type || 'image/jpeg', upsert: false
  })
  if (error) throw error
  return supabase.storage.from('campo-fotos').getPublicUrl(nome).data.publicUrl
}

async function onFotoEscolhida (e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  editRegSalvando.value = true
  try {
    editRegFotos.value.push(await enviarFotoRegistro(file))
  } catch (err) {
    $q.notify({ type: 'negative', message: 'Não foi possível enviar a foto: ' + err.message, position: 'top', timeout: 5000 })
  } finally {
    editRegSalvando.value = false
  }
}

async function salvarEdicaoRegistro () {
  const r = editReg.value
  if (!r || !editRegPgValido.value) return
  const novoPg = editRegPg.value
  const fotos = editRegFotos.value
  editRegSalvando.value = true
  try {
    // Troca do PG também atualiza o apontamento da nota (função de correção)
    if (novoPg !== r.pg_numero) {
      const { error } = await supabase.rpc('implantacao_corrigir_pg', {
        p_nota: r.nota, p_pg_atual: r.pg_numero, p_pg_novo: novoPg
      })
      if (error) throw error
    }
    const { error: erroFotos } = await supabase.from('campo_registros').update({
      foto_url: fotos[0] ?? null,
      fotos_extras: fotos.slice(1)
    }).eq('id', r.id)
    if (erroFotos) throw erroFotos

    Object.assign(r, { pg_numero: novoPg, foto_url: fotos[0] ?? null, fotos_extras: fotos.slice(1) })
    editRegDialog.value = false
    $q.notify({ type: 'positive', message: 'Registro atualizado', position: 'top', timeout: 2000 })
  } catch (err) {
    const msg = err.message?.includes('PG_JA_EXISTE') ? 'Este PG já existe nesta nota.' : 'Não foi possível salvar: ' + err.message
    $q.notify({ type: 'negative', message: msg, position: 'top', timeout: 5000 })
  } finally {
    editRegSalvando.value = false
  }
}

async function apagarRegistro (reg) {
  $q.dialog({
    title: 'Apagar registro?',
    message: `Remove o PG ${reg.pg_numero} dos registros de campo.`,
    cancel: true, ok: { label: 'Apagar', color: 'negative' }
  }).onOk(async () => {
    const { error } = await supabase.from('campo_registros').delete().eq('id', reg.id)
    if (!error) {
      registrosCampo.value = registrosCampo.value.filter(r => r.id !== reg.id)
      $q.notify({ type: 'positive', message: 'Registro removido.', position: 'top', timeout: 1800 })
    }
  })
}

async function apagarRegistrosCampo () {
  const nota = notaAtiva.value?.nota
  if (!nota) return

  // Busca os IDs direto do banco para não depender do carregamento local
  const { data: regsDB, error: fetchErr } = await supabase
    .from('campo_registros')
    .select('id')
    .eq('nota', nota)

  if (fetchErr) {
    $q.notify({ type: 'negative', message: `Erro ao buscar registros: ${fetchErr.message}`, position: 'top', timeout: 3000 })
    return
  }

  const ids = (regsDB || []).map(r => r.id)
  if (!ids.length) {
    $q.notify({ type: 'info', message: 'Nenhum registro de campo encontrado para esta nota.', position: 'top', timeout: 2000 })
    return
  }

  $q.dialog({
    title: 'Apagar todos os registros de campo?',
    message: `Remove todos os ${ids.length} registros de campo desta nota. Esta ação não pode ser desfeita.`,
    cancel: true, ok: { label: 'Apagar tudo', color: 'negative' }
  }).onOk(async () => {
    const { error } = await supabase.from('campo_registros').delete().in('id', ids)
    if (!error) {
      registrosCampo.value = []
      $q.notify({ type: 'positive', message: `${ids.length} registro(s) de campo removido(s).`, position: 'top', timeout: 2000 })
    } else {
      $q.notify({ type: 'negative', message: `Erro ao apagar: ${error.message}`, position: 'top', timeout: 3000 })
    }
  })
}

function labelStatus (s) {
  return {
    pendente:       'Não Iniciado',
    em_andamento:   'Andamento',
    aguardando_etapa2: 'Aguardando Etapa 2',
    baixar_medidor: 'Auditar',
    concluido:      'Concluído',
    expurgo:        'Expurgo',
    sem_acesso:     'Sem Acesso',
  }[s] ?? s
}

// ── Dialog grupo (múltiplas notas no mesmo SAP) ───────────────────
const dialogGrupo = ref(false)
const grupoAtivo  = ref(null)

// ── Dialog ────────────────────────────────────────────────────────
const dialog          = ref(false)
const notaAtiva       = ref(null)
const registrosCampo  = ref([])
const carregandoCampo = ref(false)
const salvando        = ref(false)
const clientes        = reactive([])
const padraoOptions   = ['PP', '5 M', '7 M']

// Foto medidor
const fotoInput        = ref(null)
const clienteIndexFoto = ref(null)
const fotoDialogLista  = ref([])
const fotoDialogIdx    = ref(0)
const fotoDialogTitulo = ref('Foto do Medidor')
const fotoDialog       = ref(false)
const objectUrls       = []
const tentouSalvar     = ref(false)
const apontamentoId    = ref(null)
const rascunhoEm       = ref(null)
const servicoEquipe2   = ref({ descricao: '', fotos: [] })
const servicoSalvando  = ref(false)
const fotoServicoInput = ref(null)

const temServicoEquipe2 = computed(() =>
  !!notaAtiva.value && ['aguardando_etapa2', 'baixar_medidor', 'concluido'].includes(notaAtiva.value.status)
)

async function adicionarFotoServico (file) {
  if (!file || !notaAtiva.value) return
  servicoSalvando.value = true
  try {
    const caminho = `servico/${notaAtiva.value.nota}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from('campo-fotos').upload(caminho, file, {
      contentType: file.type || 'image/jpeg', upsert: true
    })
    if (error) throw error
    servicoEquipe2.value.fotos.push(supabase.storage.from('campo-fotos').getPublicUrl(caminho).data.publicUrl)
  } catch (e) {
    $q.notify({ type: 'negative', message: 'Não foi possível enviar a foto: ' + e.message, position: 'top' })
  } finally {
    servicoSalvando.value = false
  }
}

function removerFotoServico (i) {
  servicoEquipe2.value.fotos.splice(i, 1)
}

async function salvarServico () {
  if (!apontamentoId.value) {
    $q.notify({ type: 'warning', message: 'Esta nota ainda não tem a Etapa 2 registrada.', position: 'top' })
    return
  }
  servicoSalvando.value = true
  const { error } = await supabase.from('apontamentos').update({
    descricao_servico: servicoEquipe2.value.descricao.trim() || null,
    fotos_servico: servicoEquipe2.value.fotos
  }).eq('id', apontamentoId.value)
  servicoSalvando.value = false
  $q.notify({
    type: error ? 'negative' : 'positive',
    message: error ? 'Erro ao salvar o serviço: ' + error.message : 'Serviço atualizado.',
    position: 'top'
  })
}

onUnmounted(() => objectUrls.forEach(u => URL.revokeObjectURL(u)))

const campoStats = computed(() => {
  const regs = registrosCampo.value
  const ultimo = regs.length
    ? [...regs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
    : null
  return {
    total: regs.length,
    comFoto: regs.filter(r => r.foto_url).length,
    equipes: new Set(regs.map(r => r.equipe).filter(Boolean)).size,
    ultimoRegistro: ultimo ? formatarData(ultimo.created_at) : '—'
  }
})

const registrosCampoPorEquipe = computed(() => {
  const grupos = {}
  for (const r of [...registrosCampo.value].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) {
    const eq = r.equipe?.trim() || 'Sem equipe'
    if (!grupos[eq]) grupos[eq] = []
    grupos[eq].push(r)
  }
  return Object.entries(grupos).map(([equipe, registros]) => ({ equipe, registros }))
})
const totalAtendidos    = computed(() => clientes.filter(c => c.atendido).length)
const totalNaoAtendidos = computed(() => clientes.filter(c => !c.atendido).length)

// Abre diálogo correto: grupo (múltiplas notas) ou nota individual
const mapaAberto = ref(false)

function abrirDoMapa (nota) {
  mapaAberto.value = false
  abrirNotaDialog(nota)
}

function abrirDialog (g) {
  if (g._notas && g._notas.length > 1) {
    grupoAtivo.value = g
    dialogGrupo.value = true
  } else {
    abrirNotaDialog(g._notas?.[0] ?? g)
  }
}

async function abrirNotaDialog (nota) {
  dialogGrupo.value = false
  notaAtiva.value = nota
  clientes.splice(0, clientes.length)
  registrosCampo.value = []
  tentouSalvar.value = false
  apontamentoId.value = null
  rascunhoEm.value = null
  dialog.value = true

  carregandoCampo.value = true
  const [regs, salvo] = await Promise.all([
    notasStore.buscarRegistrosCampo(nota.nota),
    apStore.buscarPorNota(nota.nota)
  ])
  registrosCampo.value = regs
  carregandoCampo.value = false

  servicoEquipe2.value = {
    descricao: salvo?.descricao_servico ?? '',
    fotos: [...(salvo?.fotos_servico ?? [])]
  }
  if (salvo) {
    apontamentoId.value = salvo.id
    rascunhoEm.value = salvo.rascunho ? salvo.atualizado_em : null
    const motivos = new Map((salvo.nao_atendidos || []).map(x => [x.cliente, x.motivo]))
    ;(salvo.clientes || []).forEach(c => {
      const urls = c.fotos_urls?.length ? c.fotos_urls : (c.foto_url ? [c.foto_url] : [])
      clientes.push({
        nome: c.nome || '',
        padrao: c.padrao || '',
        conta_contrato: c.conta_contrato || '',
        num_medidor: c.num_medidor || '',
        fotos: urls.map(u => ({ file: null, preview: u, url: u })),
        atendido: !motivos.has(c.nome),
        motivo: motivos.get(c.nome) || ''
      })
    })
    return
  }

  const da_planilha = Array.isArray(nota.clientes_planilha) ? nota.clientes_planilha : []
  da_planilha.forEach(c => clientes.push({
    nome: c.nome || '',
    padrao: '',
    conta_contrato: c.conta_contrato || '',
    num_medidor: '',
    fotos: [],
    atendido: true,
    motivo: '',
    origem: 'planilha',
    _endereco: c.endereco || '',
    _bairro: c.bairro || ''
  }))
}

function adicionarCliente () {
  clientes.push({ nome: '', padrao: '', conta_contrato: '', num_medidor: '', fotos: [], atendido: true, motivo: '' })
}

function selecionarFoto (i) {
  clienteIndexFoto.value = i
  fotoInput.value.value = ''
  fotoInput.value.click()
}

function onFotoSelecionada (e) {
  const files = Array.from(e.target.files || [])
  if (!files.length || clienteIndexFoto.value === null) return
  const c = clientes[clienteIndexFoto.value]
  for (const file of files) {
    const url = URL.createObjectURL(file)
    objectUrls.push(url)
    c.fotos.push({ file, preview: url, url: null })
  }
}

function removerFoto (c, fi) {
  const [f] = c.fotos.splice(fi, 1)
  if (f?.file) URL.revokeObjectURL(f.preview)
}

function verFoto (url) {
  fotoDialogLista.value = [url]
  fotoDialogIdx.value = 0
  fotoDialogTitulo.value = 'Foto do Medidor'
  fotoDialog.value = true
}

function verFotosPoste (r) {
  fotoDialogLista.value = [r.foto_url, ...(r.fotos_extras || [])].filter(Boolean)
  fotoDialogIdx.value = 0
  fotoDialogTitulo.value = `Fotos do PG ${r.pg_numero}`
  fotoDialog.value = true
}
function removerCliente (i) { clientes.splice(i, 1) }

function confirmarApagar (g) {
  const lista = g._notas.map(n => n.nota)
  const alvo  = lista.length > 1 ? `as ${lista.length} notas do projeto ${g.projeto_info_sap}` : `a nota ${lista[0]}`
  $q.dialog({
    title: 'Apagar trabalho da nota',
    message: `Isto vai apagar postes registrados em campo, clientes, números de medidor e fotos de ${alvo}. ` +
             'Para qual status ela deve voltar? Não Iniciado volta sem nenhuma marcação. Esta ação não pode ser desfeita.',
    options: {
      type: 'radio',
      model: 'pendente',
      items: [
        { label: 'Não Iniciado (sem marcação)', value: 'pendente' },
        { label: 'Andamento', value: 'em_andamento' },
        { label: 'Aguardando Etapa 2', value: 'aguardando_etapa2' },
        { label: 'Auditar', value: 'baixar_medidor' },
        { label: 'Concluído', value: 'concluido' },
        { label: 'Expurgo', value: 'expurgo' },
        { label: 'Sem Acesso', value: 'sem_acesso' }
      ]
    },
    cancel: { label: 'Cancelar', flat: true, color: 'grey-7' },
    ok: { label: 'Apagar', color: 'negative', unelevated: true },
    persistent: true
  }).onOk(async (destino) => {
    const { error } = await notasStore.apagarNotas(lista, { destino })
    if (error) {
      $q.notify({ type: 'negative', message: 'Erro ao apagar: ' + error.message })
      return
    }
    apStore.fetchApontamentos()
    $q.notify({ type: 'positive', message: lista.length > 1 ? 'Notas apagadas.' : `Nota ${lista[0]} apagada.`, icon: 'delete' })
  })
}

async function removerBadge (g) {
  const lista = g._notas.filter(n => n.apagada).map(n => n.nota)
  const { error } = await notasStore.removerMarcaApagada(lista)
  if (error) $q.notify({ type: 'negative', message: 'Erro ao remover marca: ' + error.message })
}

const podeConcluir = computed(() => ['aguardando_etapa2', 'baixar_medidor', 'concluido'].includes(notaAtiva.value?.status))

async function salvar (rascunho = false) {
  const n = notaAtiva.value
  if (!rascunho && !podeConcluir.value) return

  const erros = []
  if (!clientes.length) { erros.push('pelo menos um cliente') }
  else {
    if (clientes.some(c => !c.nome?.trim()))                            erros.push('nome de todos os clientes')
    if (clientes.some(c => !c.num_medidor?.trim()))                     erros.push('número do medidor de todos os clientes')
    if (clientes.some(c => !c.fotos.length))                           erros.push('foto do medidor de todos os clientes')
    if (clientes.filter(c => !c.atendido).some(c => !c.motivo?.trim())) erros.push('motivo dos não atendidos')
  }

  if (erros.length && !rascunho) {
    tentouSalvar.value = true
    $q.notify({ type: 'warning', message: `Preencha: ${erros.join(', ')}.`, timeout: 5000 })
    return
  }

  salvando.value = rascunho ? 'rascunho' : 'concluir'

  // Upload de fotos dos medidores
  for (const c of clientes) {
    for (const f of c.fotos) {
      if (f.url || !(f.file instanceof File)) continue
      const ext  = f.file.name.split('.').pop() || 'jpg'
      const path = `${n.nota}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: ue } = await supabase.storage
        .from('medidores')
        .upload(path, f.file, { upsert: false })
      if (ue) {
        $q.notify({ type: 'negative', message: 'Erro ao enviar foto do medidor: ' + ue.message })
        salvando.value = false
        return
      }
      f.url = supabase.storage.from('medidores').getPublicUrl(path).data.publicUrl
    }
  }

  const naoAtendidosList = clientes
    .filter(c => !c.atendido)
    .map(c => ({ cliente: c.nome, motivo: c.motivo }))

  const dados = {
    base:              n.base,
    pep:               n.pep,
    nota:              n.nota,
    postes:            registrosCampo.value.length || Number(n.postes) || 0,
    pg_numeros:        registrosCampo.value.map(r => r.pg_numero),
    rascunho,
    clientes:          clientes.map(c => ({ nome: c.nome.trim(), padrao: c.padrao ?? '', conta_contrato: c.conta_contrato ?? '', num_medidor: c.num_medidor ?? '', fotos_urls: c.fotos.map(f => f.url) })),
    todos_atendidos:   clientes.every(c => c.atendido),
    nao_atendidos:     naoAtendidosList,
    qtd_clientes_nota: Number(n.qtd_clientes) || 0
  }
  const { error, id } = apontamentoId.value
    ? await apStore.updateApontamento(apontamentoId.value, dados)
    : await apStore.addApontamento(dados)

  if (error) {
    $q.notify({ type: 'negative', message: 'Erro ao salvar: ' + error.message })
    salvando.value = false
    return
  }

  if (rascunho) {
    if (id) apontamentoId.value = id
    rascunhoEm.value = new Date().toISOString()
    notasStore.notasComRascunho = new Set([...notasStore.notasComRascunho, n.nota])
    salvando.value = false
    dialog.value = false
    $q.notify({ type: 'info', message: `Nota ${n.nota}: rascunho salvo. Continue quando quiser.`, icon: 'save' })
    return
  }

  await notasStore.atualizarStatus(n.nota, 'concluido')
  notasStore.notasComRascunho = new Set([...notasStore.notasComRascunho].filter(x => x !== n.nota))

  salvando.value = false
  dialog.value = false
  $q.notify({ type: 'positive', message: `Nota ${n.nota} concluída!`, icon: 'check_circle' })
}

function formatarData (iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatarDataCompleta (iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// Carrega ao montar
notasStore.fetchNotas()
</script>

<style scoped>
/* ── Tabs de status ── */
.status-tabs {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.stab {
  --c: #64748b; --c-ink: #475569; --c-ring: rgba(100,116,139,0.18);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px 9px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.2s, box-shadow 0.2s, color 0.2s, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.stab:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); color: var(--text-primary); }
.stab:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }
.stab-icon { display: flex; align-items: center; color: var(--c); }
.stab-count {
  min-width: 28px;
  text-align: center;
  background: color-mix(in srgb, var(--c) 12%, transparent);
  color: var(--c-ink);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  transition: background 0.2s, color 0.2s;
}
.stab--active {
  border-color: var(--c);
  color: var(--text-primary);
  box-shadow: 0 0 0 3px var(--c-ring), var(--shadow-sm);
}
.stab--active .stab-count { background: var(--c-ink); color: #fff; }
.stab--todas             { --c: #1976d2; --c-ink: #1565c0; --c-ring: rgba(25,118,210,0.16); }
.stab--pendente          { --c: #78909c; --c-ink: #546e7a; --c-ring: rgba(120,144,156,0.20); }
.stab--em_andamento      { --c: #f59e0b; --c-ink: #b45309; --c-ring: rgba(245,158,11,0.20); }
.stab--aguardando_etapa2 { --c: #8b5cf6; --c-ink: #6d28d9; --c-ring: rgba(139,92,246,0.18); }
.stab--baixar_medidor    { --c: #2563eb; --c-ink: #1d4ed8; --c-ring: rgba(37,99,235,0.16); }
.stab--concluido         { --c: #16a34a; --c-ink: #15803d; --c-ring: rgba(22,163,74,0.18); }
.body--dark .stab--todas             { --c-ink: #7db8ff; }
.body--dark .stab--pendente          { --c-ink: #b0bec5; }
.body--dark .stab--em_andamento      { --c-ink: #fbbf24; }
.body--dark .stab--aguardando_etapa2 { --c-ink: #c4b5fd; }
.body--dark .stab--baixar_medidor    { --c-ink: #93c5fd; }
.body--dark .stab--concluido         { --c-ink: #86efac; }
.body--dark .stab--active .stab-count { color: #0d1117; }
@media (prefers-reduced-motion: reduce) { .stab, .stab-count { transition: none; } .stab:hover { transform: none; } }

/* ── Barra superior: troca de vista, mapa, atualizar ── */
.vista-toggle {
  padding: 3px; border-radius: 12px;
  background: var(--bg-card); border: 1px solid var(--border); box-shadow: var(--shadow-sm);
}
.vista-toggle :deep(.q-btn) { border-radius: 9px; min-width: 36px; }
.btn-mapa { border-radius: 12px; padding: 0 14px; min-height: 38px; font-weight: 700; letter-spacing: 0.02em; }

/* ── Imprevistos reportados pelo campo ── */
.badge-imprevisto {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
  padding: 1px 8px;
  border-radius: 20px;
  background: #fbe9e7;
  border: 1px solid #ff8a65;
  color: #d84315;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  cursor: default;
}
.lista-status .badge-imprevisto { margin-left: 0; }

/* ── Marca de rascunho (Etapa 2 para continuar depois) ── */
.badge-rascunho {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  padding: 1px 8px;
  border-radius: 20px;
  background: #fff3e0;
  border: 1px solid #ffb74d;
  color: #e65100;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.lista-status .badge-rascunho { margin-left: 0; }

/* ── Marca de nota apagada ── */
.badge-apagada {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
  padding: 1px 4px 1px 8px;
  border-radius: 20px;
  background: #e53935;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.badge-apagada-x {
  cursor: pointer;
  border-radius: 50%;
  padding: 1px;
}
.badge-apagada-x:hover { background: rgba(255,255,255,0.3); }

/* ── Sub-abas de origem dos concluídos ── */
.origem-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.origem-tabs-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary, #546e7a);
  margin-right: 2px;
}
.origem-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1.5px solid var(--border-color, #e0e0e0);
  background: var(--bg-card, #fff);
  color: var(--text-secondary, #546e7a);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.origem-tab-count {
  background: rgba(0,0,0,0.08);
  border-radius: 20px;
  padding: 0 7px;
  font-size: 11px;
  font-weight: 700;
}
.origem-tab--active { border-color: #388e3c; background: #e8f5e9; color: #1b5e20; }

/* ── Grid de notas ── */
.nota-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 12px;
}

.nota-card {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: box-shadow 0.25s cubic-bezier(0.22, 1, 0.36, 1), transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.nota-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }

.nc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.nc-num { font-size: 20px; font-weight: 800; color: var(--text-primary, #0d1b2a); }
.nc-badges { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }

.nc-badge-base {
  font-size: 10px; font-weight: 700;
  background: #e3f2fd; color: #1565c0;
  border-radius: 999px; padding: 3px 10px; letter-spacing: 0.02em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: inline-block; max-width: 100%;
}

.nc-status {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 700;
  border-radius: 6px; padding: 2px 8px;
  letter-spacing: 0.04em;
}
.nc-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.body--dark .nc-badge-base { background: rgba(88,166,255,0.14); color: #7db8ff; }
.body--dark .nc-status { background: rgba(255,255,255,0.07) !important; }
.body--dark .nc-status--pendente { color: #b0bec5; }
.body--dark .nc-status--em_andamento { color: #fbbf24; }
.body--dark .nc-status--baixar_medidor { color: #93c5fd; }
.body--dark .nc-status--aguardando_etapa2, .body--dark .nc-status--sem_acesso { color: #c4b5fd; }
.body--dark .nc-status--concluido { color: #86efac; }
.body--dark .nc-status--expurgo { color: #fca5a5; }
.nc-status--pendente       { background: #f5f5f5;  color: #616161; }
.nc-status--em_andamento   { background: #fff3e0;  color: #e65100; }
.nc-status--baixar_medidor { background: #e3f2fd;  color: #1565c0; }
.nc-status--aguardando_etapa2 { background: #f3e5f5; color: #6a1b9a; }
.nc-status--concluido      { background: #e8f5e9;  color: #2e7d32; }
.nc-status--expurgo        { background: #fce4ec;  color: #b71c1c; }
.nc-status--sem_acesso     { background: #f3e5f5;  color: #6a1b9a; }

.nc-info {
  display: flex; flex-wrap: wrap; gap: 6px 12px;
  font-size: 12px; color: var(--text-muted, #607d8b);
}
.nc-info span { display: flex; align-items: center; gap: 3px; }

.nc-msg {
  font-size: 12px; font-weight: 600;
  display: flex; align-items: center; gap: 5px;
  padding: 6px 10px; border-radius: 8px;
}
.nc-msg--pendente       { background: #f5f5f5;  color: #616161; }
.nc-msg--em_andamento   { background: #fff8e1;  color: #e65100; }
.nc-msg--baixar_medidor { background: #e3f2fd;  color: #1565c0; }
.nc-msg--concluido      { background: #e8f5e9;  color: #2e7d32; }
.nc-msg--expurgo        { background: #ffebee;  color: #c62828; }
.nc-msg--sem_acesso     { background: #fbe9e7;  color: #d84315; }

.nc-footer { display: flex; align-items: center; justify-content: flex-end; margin-top: 2px; }
.nc-hint { font-size: 11px; color: var(--text-muted, #9e9e9e); }

/* ── Filtros ── */
.filtros-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
}
.filtros-bar :deep(.q-field--outlined .q-field__control) {
  background: var(--bg-card-alt);
  border-radius: 10px !important;
  transition: box-shadow 0.2s;
}
.filtros-bar :deep(.q-field--outlined .q-field__control:before) { border-color: var(--border) !important; }
.filtros-bar :deep(.q-field--outlined:hover .q-field__control:before) { border-color: rgba(100,116,139,0.45) !important; }
.filtros-bar :deep(.q-field--outlined.q-field--focused .q-field__control) { box-shadow: 0 0 0 3px var(--accent-light); }
.filtros-bar :deep(.q-field__prepend .q-icon) { color: var(--text-muted); }
.filtros-bar :deep(.q-field__label) { color: var(--text-secondary); }
.filtros-count {
  font-size: 12px; font-weight: 600; white-space: nowrap;
  font-variant-numeric: tabular-nums; color: var(--text-muted);
}
.filtros-count strong { color: var(--text-primary); font-weight: 700; }
.filtros-count { margin-left: 6px; padding-left: 16px; border-left: 1px solid var(--border); line-height: 22px; }

.chip-toggle {
  --c: #64748b;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent; color: var(--text-secondary);
  font-family: inherit; font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.chip-toggle:hover { background: var(--bg-card-alt); color: var(--text-primary); }
.chip-toggle:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }
.chip-toggle--ok   { --c: #16a34a; }
.chip-toggle--warn { --c: #ea580c; }
.chip-toggle--on {
  color: var(--c);
  border-color: color-mix(in srgb, var(--c) 55%, transparent);
  background: color-mix(in srgb, var(--c) 12%, transparent);
}
.chip-toggle-n { font-variant-numeric: tabular-nums; }
.filtros-rodape {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%;
  padding-top: 12px; margin-top: 2px; border-top: 1px solid var(--border);
}
.btn-limpar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 10px;
  border: 1px solid var(--border); background: transparent; color: var(--text-secondary); cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.btn-limpar:hover { background: var(--bg-card-alt); color: var(--text-primary); }
.btn-limpar:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* ── Vista lista ── */
.lista-notas {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-variant-numeric: tabular-nums;
}
.lista-header {
  display: grid;
  grid-template-columns: 130px 110px 220px 150px 1fr 90px 130px 110px;
  gap: 12px;
  padding: 12px 16px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  margin-bottom: 4px;
  text-align: center;
  /* Fica fixo logo abaixo da barra de navegação ao rolar a lista */
  position: sticky;
  top: 59px;
  z-index: 5;
  box-shadow: var(--shadow-md);
}
.lista-header > div { text-align: center; }
.lista-header-status { display: flex; align-items: center; justify-content: center; gap: 4px; }

.status-legenda { padding: 12px 14px; max-width: 340px; display: flex; flex-direction: column; gap: 10px; }
.status-legenda-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #546e7a; }
.status-legenda-item { display: flex; align-items: flex-start; gap: 10px; }
.status-legenda-label { font-size: 13px; font-weight: 700; }
.status-legenda-desc { font-size: 12px; color: #546e7a; line-height: 1.35; }
.lista-row {
  --st: #94a3b8;
  display: grid;
  grid-template-columns: 130px 110px 220px 150px 1fr 90px 130px 110px;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: box-shadow 0.25s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.lista-row:hover { box-shadow: var(--shadow-md); border-color: color-mix(in srgb, var(--st) 45%, var(--border)); transform: translateY(-1px); }
.lista-row--pendente          { --st: #94a3b8; }
.lista-row--em_andamento      { --st: #f59e0b; }
.lista-row--aguardando_etapa2 { --st: #8b5cf6; }
.lista-row--baixar_medidor    { --st: #2563eb; }
.lista-row--concluido         { --st: #16a34a; }
.lista-row--expurgo           { --st: #dc2626; }
.lista-row--sem_acesso        { --st: #ea580c; }
@media (prefers-reduced-motion: reduce) { .lista-row { transition: none; } .lista-row:hover { transform: none; } }

.lista-num {
  display: flex; align-items: center; justify-content: center; gap: 9px;
  font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
  color: var(--text-primary, #0d1b2a);
}
.lista-num::before {
  content: ''; flex-shrink: 0; width: 8px; height: 8px; border-radius: 50%;
  background: var(--st); box-shadow: 0 0 0 3px color-mix(in srgb, var(--st) 20%, transparent);
}
.lista-base { text-align: center; }
.lista-pep  { text-align: center; font-size: 12px; font-weight: 600; color: #7b1fa2; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
:root[data-theme="dark"] .lista-pep,
.body--dark .lista-pep  { color: #ce93d8; }
.lista-info { display: flex; gap: 10px; font-size: 12px; color: var(--text-muted, #607d8b); justify-content: center; }
.lista-info span { display: flex; align-items: center; gap: 3px; border-radius: 8px; padding: 2px 7px; }
.info-destaque { font-weight: 700; }
.info-destaque--poste  { background: rgba(245,158,11,0.14); color: #b45309; }
.info-destaque--cliente { background: rgba(22,163,74,0.13); color: #15803d; }
.body--dark .info-destaque--poste  { color: #fbbf24; }
.body--dark .info-destaque--cliente { color: #86efac; }
.lista-status { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px; }
.lista-status .badge-apagada { margin-left: 0; }
.lista-equipe { display: inline-flex; align-items: center; gap: 3px; width: 100%; justify-content: center; font-size: 11px; font-weight: 700; color: #5d4037; background: #fff8e1; border-radius: 8px; padding: 2px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.body--dark .lista-equipe { background: rgba(255,202,40,0.12); color: #ffe082; }
.lista-acao { display: flex; justify-content: center; align-items: center; gap: 4px; }
.lista-acao :deep(.q-btn:not(.q-btn--round)) { border-radius: 999px; padding: 3px 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; }

@media (max-width: 700px) {
  .lista-row {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto auto;
  }
  .lista-pep { grid-column: 1 / -1; }
  .lista-info { grid-column: 1 / -1; }
}

/* ══════════ Etapa 2 — tela de registro de clientes ══════════ */
.dlg { display: flex; flex-direction: column; max-height: 100dvh; background: var(--bg-page); color: var(--text-primary); }
.body--dark .q-dialog .q-card.dlg { background: var(--bg-page) !important; }

/* Topo */
.dlg-topo {
  display: flex; align-items: center; gap: 12px; flex-shrink: 0;
  padding: 14px 24px; color: #fff;
  background: linear-gradient(180deg, #0d1c34 0%, #0a1628 100%);
  box-shadow: 0 1px 0 rgba(255,202,40,0.12);
}
.dlg-passo { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #ffca28; }
.dlg-titulo { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.2; }
.dlg-status { color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.16); border-radius: 10px; padding: 0 10px; }
.dlg-status:hover { background: rgba(255,255,255,0.08); color: #fff; }
.dlg-fechar { color: rgba(255,255,255,0.8); }
.dlg-fechar:hover { color: #fff; background: rgba(255,255,255,0.1); }

/* Dados da nota */
.dlg-meta {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 56px; flex-shrink: 0;
  padding: 14px 24px; background: var(--bg-card); border-bottom: 1px solid var(--border);
}
.meta { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 3px; min-width: 0; }
.meta-lbl { font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-secondary); }
.meta-val { font-size: 14px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; gap: 5px; }
.meta-val--destaque { color: var(--accent); }
.meta-val--mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; }
.meta-ico--ambar { color: #b45309; }
.meta-ico--verde { color: #15803d; }

/* Corpo: coluna principal (Etapa 2) + lateral (Etapa 1) */
.dlg-corpo { flex: 1; overflow-y: auto; padding: 22px 24px 28px; }
.dlg-grade {
  display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 20px;
  max-width: 1480px; margin: 0 auto; align-items: start;
}
.dlg-principal { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.dlg-lateral { position: sticky; top: 0; max-height: calc(100dvh - 250px); display: flex; }
@media (max-width: 1100px) {
  .dlg-grade { grid-template-columns: minmax(0, 1fr); }
  .dlg-lateral { position: static; max-height: none; order: 2; }
}

/* Avisos */
.aviso {
  --c: #2563eb; display: flex; align-items: center; gap: 14px;
  padding: 12px 16px; border-radius: 14px;
  background: color-mix(in srgb, var(--c) 9%, var(--bg-card)); border: 1px solid color-mix(in srgb, var(--c) 24%, transparent);
}
.aviso--alerta { --c: #ea580c; }
.aviso-ico { color: var(--c); flex-shrink: 0; }
.aviso-txt { flex: 1; min-width: 0; }
.aviso-titulo { font-size: 13.5px; font-weight: 700; color: var(--text-primary); }
.aviso-corpo { font-size: 13px; color: var(--text-secondary); margin-top: 2px; line-height: 1.5; }
.aviso-corpo--forte { color: var(--text-primary); margin-top: 0; }
.aviso-meta { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }

/* Blocos (seções) */
.bloco { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow-sm); min-width: 0; }
.bloco-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--border); }
.bloco-titulo { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 800; letter-spacing: -0.005em; color: var(--text-primary); }
.bloco-titulo .q-icon { color: var(--accent); }
.bloco-corpo { display: flex; flex-direction: column; gap: 14px; padding: 18px; }
.bloco--lateral { width: 100%; display: flex; flex-direction: column; overflow: hidden; }
.bloco--lateral .bloco-cab { flex-shrink: 0; }
.bloco--lateral .cmp { overflow-y: auto; }

.vazio-bloco { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 34px 16px; color: var(--text-secondary); text-align: center; }
.vazio-bloco-titulo { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-top: 6px; }
.vazio-bloco-sub { font-size: 12.5px; }

/* Campos do diálogo */
.dlg :deep(.q-field--outlined .q-field__control) { background: var(--bg-card-alt); border-radius: 10px !important; }
.dlg :deep(.q-field--outlined .q-field__control:before) { border-color: var(--border) !important; }
.dlg :deep(.q-field--outlined:hover .q-field__control:before) { border-color: rgba(100,116,139,0.45) !important; }
.dlg :deep(.q-field--outlined.q-field--focused .q-field__control) { box-shadow: 0 0 0 3px var(--accent-light); }
.dlg :deep(.q-field__label) { color: var(--text-secondary); }
.dlg :deep(.q-field__prepend .q-icon) { color: var(--text-muted); }

/* Fotos */
.fotos-linha { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.foto-add {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 16px;
  border: 1.5px dashed color-mix(in srgb, var(--text-muted) 55%, transparent); border-radius: 12px; background: transparent;
  color: var(--text-secondary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.foto-add:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.foto-add:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.foto-add--ok { border-style: solid; border-color: color-mix(in srgb, var(--accent) 40%, transparent); color: var(--accent); }
.foto-add--erro { border-color: #dc2626; color: #dc2626; background: rgba(220,38,38,0.06); }
.foto-add--grande { flex-direction: column; width: 140px; height: 100px; text-align: center; }
.foto-add:disabled { opacity: 0.55; cursor: not-allowed; }
.foto-quadro { position: relative; width: 100px; height: 100px; }
.foto-quadro img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; border: 1px solid var(--border); }
.foto-quadro-x { position: absolute; top: 4px; right: 4px; }
.cli-erro { margin-top: 4px; font-size: 11.5px; color: #dc2626; }

/* Cartão de cliente */
.cli-lista { display: flex; flex-direction: column; gap: 14px; padding: 18px; }
.cli-lista:empty { display: none; }
.cli { border: 1px solid var(--border); border-radius: 14px; background: var(--bg-card); transition: border-color 0.2s, box-shadow 0.2s; }
.cli:focus-within { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); box-shadow: 0 0 0 3px var(--accent-light); }
.cli--nao { border-color: color-mix(in srgb, #dc2626 35%, var(--border)); background: color-mix(in srgb, #dc2626 4%, var(--bg-card)); }
.cli-topo { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
.cli-n {
  flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
  font-size: 12px; font-weight: 800; color: var(--accent); background: var(--accent-light); font-variant-numeric: tabular-nums;
}
.cli-origem { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12.5px; color: var(--text-secondary); }
.cli-origem-lbl { font-weight: 700; color: var(--accent); }
.cli-end { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 12px; background: var(--bg-card-alt); border: 1px solid var(--border); }
.seg-op {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 0; border-radius: 9px; background: transparent;
  color: var(--text-secondary); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; transition: background 0.2s, color 0.2s;
}
.seg-op:hover { color: var(--text-primary); }
.seg-op:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.seg-op--ok.seg-op--on { background: #15803d; color: #fff; }
.seg-op--nao.seg-op--on { background: #dc2626; color: #fff; }

.cli-campos { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 12px; padding: 14px; align-items: start; }
.cli-c-nome { grid-column: span 6; }
.cli-c-padrao { grid-column: span 2; }
.cli-c-conta { grid-column: span 4; }
.cli-c-medidor { grid-column: span 4; }
.cli-c-fotos { grid-column: span 8; display: flex; flex-direction: column; justify-content: center; min-height: 40px; }
.cli-c-motivo { grid-column: span 12; }
@media (max-width: 900px) {
  .cli-c-nome, .cli-c-padrao, .cli-c-conta, .cli-c-medidor, .cli-c-fotos { grid-column: span 12; }
}

/* Etapa 1 (lateral) */
.cmp { display: flex; flex-direction: column; gap: 16px; padding: 16px 18px 18px; }
.cmp-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.cmp-stat { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: var(--bg-card-alt); min-width: 0; }
.cmp-stat-val { font-size: 18px; font-weight: 800; line-height: 1.1; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.cmp-stat-val small { font-size: 12px; font-weight: 700; color: var(--text-muted); }
.cmp-stat-val--sm { font-size: 12.5px; font-weight: 700; line-height: 1.35; }
.cmp-stat-lbl { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cmp-equipe-cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.cmp-equipe-nome { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-secondary); }
.cmp-pgs { display: flex; flex-direction: column; gap: 6px; }
.cmp-pg { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 8px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-card); }
.cmp-pg:hover { background: var(--bg-card-alt); }
.cmp-pg-foto {
  position: relative; flex-shrink: 0; width: 48px; height: 48px; padding: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
  background: var(--bg-card-alt); display: grid; place-items: center; cursor: zoom-in; color: var(--text-muted);
}
.cmp-pg-foto--vazia { cursor: default; }
.cmp-pg-foto img { width: 100%; height: 100%; object-fit: cover; }
.cmp-pg-foto:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cmp-pg-mais { position: absolute; right: 2px; bottom: 2px; padding: 0 5px; border-radius: 8px; background: rgba(0,0,0,0.68); color: #fff; font-size: 10px; font-weight: 800; }
.cmp-pg-info { flex: 1; min-width: 0; }
.cmp-pg-num { font-size: 13.5px; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmp-pg-hora { font-size: 11.5px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }

/* Rodapé */
.dlg-rodape {
  display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-shrink: 0; flex-wrap: wrap;
  padding: 12px 24px; background: var(--bg-card); border-top: 1px solid var(--border); box-shadow: 0 -8px 24px -16px rgba(15,23,42,0.25);
}
.dlg-rodape-info { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 18px; margin-right: auto; min-width: 0; }
.resumo { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.resumo--ok { color: #15803d; }
.resumo--nao { color: #dc2626; }
.resumo--rascunho { font-weight: 600; color: #b45309; }
.body--dark .resumo--ok { color: #86efac; }
.body--dark .resumo--rascunho { color: #fbbf24; }
.btn-concluir { min-width: 170px; }
.btn-concluir.disabled, .btn-concluir[disabled] { opacity: 1 !important; background: var(--bg-card-alt) !important; color: var(--text-secondary) !important; border: 1px solid var(--border); }
@media (max-width: 700px) {
  .dlg-topo, .dlg-meta, .dlg-corpo, .dlg-rodape { padding-left: 14px; padding-right: 14px; }
  .dlg-rodape-info { flex-basis: 100%; }
}







/* ── Badge SAP no card ── */
.nc-projeto-sap {
  display: block;
  font-size: 10px; font-weight: 600;
  color: #7e57c2;
  margin-top: 2px;
  letter-spacing: 0.02em;
}
/* ── Coluna PROJETO na lista ── */
.lista-projeto {
  font-size: 12px; color: #6d3fb8; font-weight: 600;
  text-align: center;
}
.body--dark .lista-projeto { color: #c4b0f0; }
/* ── Badge count de notas no grupo ── */
.lista-num-badge {
  display: inline-block;
  font-size: 10px; font-weight: 700;
  background: #ede7f6; color: #4527a0;
  border-radius: 10px; padding: 1px 7px;
  margin-left: 6px; vertical-align: middle;
  white-space: nowrap;
}

/* ── Dialog grupo ── */
.grupo-info-bar {
  display: flex; flex-wrap: wrap; gap: 8px;
  padding: 10px 16px;
  background: #ede7f6;
  border-bottom: 1px solid #d1c4e9;
}
.grupo-info-chip {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 12px; border-radius: 20px;
  background: #fff; border: 1.5px solid #b39ddb;
  font-size: 12px; font-weight: 700; color: #4527a0;
}
.grupo-info-chip--pep  { border-color: #7e57c2; background: #f3e5f5; color: #6a1b9a; }
.grupo-info-chip--postes { border-color: #f57c00; background: #fff3e0; color: #e65100; }

.grupo-lista { display: flex; flex-direction: column; gap: 8px; }
.grupo-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 12px;
  border: 2px solid #e8eaf6;
  background: #fafafa;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.grupo-item:hover { box-shadow: 0 2px 10px rgba(0,0,0,0.08); border-color: #b39ddb; }
.grupo-item-left { flex: 1; min-width: 0; }
.grupo-item-nota { font-size: 16px; font-weight: 800; color: #0d1b2a; }
.grupo-item-info {
  display: flex; gap: 8px; margin-top: 2px;
  font-size: 11px; color: #546e7a;
}
.grupo-item-info span { display: flex; align-items: center; gap: 3px; }

/* ── Coluna CLIENTE na lista ── */
.lista-cliente {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  min-width: 0;
}
.lista-cliente-nome {
  font-size: 11px; color: var(--text-primary, #0d1b2a);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  min-width: 0;
}
.lista-cliente-mais {
  font-size: 10px; font-weight: 700;
  background: #e8eaf6; color: #3949ab;
  border-radius: 10px; padding: 1px 6px; flex-shrink: 0;
  white-space: nowrap;
}








/* ── Foto medidor ── */
.medidor-thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 6px;
  border: 2px solid #90caf9;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.medidor-thumb:hover { transform: scale(1.08); box-shadow: 0 3px 12px rgba(0,0,0,0.2); }
.medidor-thumb-wrap { position: relative; }
.medidor-thumb-remove {
  position: absolute;
  top: 0;
  right: 0;
}
</style>
