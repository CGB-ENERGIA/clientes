<template>
  <q-page>
    <div class="q-gutter-y-md">

      <!-- ── Barra de busca + atualizar ───────────────────────────── -->
      <div class="row items-center q-gutter-sm">
        <div class="section-title col-auto q-mb-none">
          <q-icon name="assignment" size="15px" /> Notas de Serviço
        </div>
        <q-space />
        <!-- Toggle grade / lista -->
        <q-btn-toggle
          v-model="vista"
          dense flat
          :options="[
            { value: 'grid', icon: 'grid_view' },
            { value: 'list', icon: 'view_list' }
          ]"
          color="grey-6"
          toggle-color="primary"
        />
        <q-btn icon="map" flat round dense color="primary" @click="mapaAberto = true">
          <q-tooltip>Abrir mapa das notas ({{ notasFiltradas.length }} no filtro atual)</q-tooltip>
        </q-btn>
        <q-btn icon="refresh" flat round dense color="grey-6" :loading="notasStore.loading" @click="notasStore.fetchNotas()">
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
          placeholder="Buscar nota ou PEP..."
          style="min-width:200px;flex:1"
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

        <q-btn
          v-if="filtro || filtroBase || filtroPostes || filtroClientes || filtroStatus || ordemInicio || dataInicio"
          flat dense icon="filter_alt_off"
          color="grey-6" size="sm"
          @click="limparFiltros"
        >
          <q-tooltip>Limpar filtros</q-tooltip>
        </q-btn>

        <q-btn
          :outline="somenteValidadas"
          :flat="!somenteValidadas"
          dense
          :color="somenteValidadas ? 'positive' : 'grey-6'"
          size="sm"
          class="q-px-sm"
          @click="somenteValidadas = !somenteValidadas"
        >
          <q-icon name="verified" size="14px" class="q-mr-xs" />
          VALIDADAS
          <q-tooltip>Exibir apenas notas validadas (oculta Expurgo e Sem Acesso)</q-tooltip>
        </q-btn>

        <q-btn
          :outline="somenteImprevistos"
          :flat="!somenteImprevistos"
          dense
          :color="somenteImprevistos ? 'deep-orange' : 'grey-6'"
          size="sm"
          class="q-px-sm"
          @click="somenteImprevistos = !somenteImprevistos"
        >
          <q-icon name="report_problem" size="14px" class="q-mr-xs" />
          IMPREVISTOS
          <span v-if="totalImprevistos" class="q-ml-xs">({{ totalImprevistos }})</span>
          <q-tooltip>Exibir apenas notas com imprevisto reportado pelo campo</q-tooltip>
        </q-btn>

        <div class="filtros-count text-grey-6 text-caption self-center q-ml-auto">
          {{ notasFiltradas.length }} de {{ notasStore.notas.length }}
          <ProgInfo titulo="Contagem da lista" texto="Cada linha é um projeto SAP. Notas que dividem o mesmo PROJETO SAP aparecem juntas em uma linha. O número depois de de é o total de notas carregadas." />
        </div>
      </div>

      <!-- ── Loading inicial ───────────────────────────────────────── -->
      <div v-if="notasStore.loading && !notasStore.notas.length" class="text-center q-py-xl text-grey-5">
        <q-spinner size="40px" color="primary" /><div class="q-mt-sm">Carregando...</div>
      </div>

      <!-- ── Empty state ───────────────────────────────────────────── -->
      <div v-else-if="!notasFiltradas.length" class="card-modern q-pa-xl text-center text-grey-5">
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
            <span v-else class="text-grey-5">—</span>
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
                flat dense size="xs"
                color="grey-5"
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
      <q-card class="dialog-card">

        <!-- Header -->
        <q-bar class="dialog-bar">
          <q-icon name="people" color="white" size="18px" />
          <span class="dialog-bar-title q-ml-sm">Etapa 2 — Registro de Clientes</span>
          <q-space />
          <q-btn icon="close" flat round dense color="white" @click="dialog = false" />
        </q-bar>

        <!-- Chips da nota -->
        <div class="dialog-nota-header">
          <q-chip dense color="primary" text-color="white" icon="folder_special">SAP {{ notaAtiva?.projeto_info_sap || notaAtiva?.nota }}</q-chip>
          <template v-if="notaAtiva?.notas_lista?.length">
            <q-chip v-for="nt in notaAtiva.notas_lista" :key="nt" dense color="grey-3" text-color="grey-8" icon="description" size="sm">{{ nt }}</q-chip>
          </template>
          <q-chip dense color="blue-1" text-color="blue-8">{{ notaAtiva?.base }}</q-chip>
          <q-chip dense color="grey-2" text-color="grey-8">PEP {{ notaAtiva?.pep }}</q-chip>
          <q-chip dense color="orange-1" text-color="orange-9" icon="electrical_services">{{ notaAtiva?.postes }} postes</q-chip>
          <q-chip dense color="teal-1" text-color="teal-9" icon="people">{{ notaAtiva?.qtd_clientes }} clientes previstos</q-chip>
          <q-chip v-if="notaAtiva?.status === 'em_andamento'" dense color="amber-2" text-color="amber-9" icon="construction">
            Campo em andamento — veja os postes registrados abaixo
          </q-chip>
          <q-chip v-if="notaAtiva?.status === 'baixar_medidor'" dense color="blue-1" text-color="blue-9" icon="speed">
            Preencha Nº medidor + foto de cada cliente para concluir
          </q-chip>
          <!-- Alterar status manualmente -->
          <q-space />
          <q-btn-dropdown
            flat dense size="sm"
            :label="'Status: ' + labelStatus(notaAtiva?.status)"
            icon="tune"
            color="grey-7"
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
        </div>

        <q-separator />

        <!-- Input de foto (oculto) -->
        <input ref="fotoInput" type="file" accept="image/*" multiple hidden @change="onFotoSelecionada" />

        <!-- Conteúdo scrollável -->
        <q-card-section class="dialog-scroll">

          <div v-for="imp in imprevistosNotaAtiva" :key="imp.id" class="imprevisto-banner">
            <q-icon name="report_problem" size="22px" color="deep-orange" />
            <div class="imprevisto-banner-txt">
              <div class="imprevisto-banner-title">Imprevisto reportado pelo campo: {{ imp.motivo }}</div>
              <div v-if="imp.observacao" class="imprevisto-banner-obs">{{ imp.observacao }}</div>
              <div class="imprevisto-banner-meta">{{ imp.equipe }} · {{ formatarDataCompleta(imp.created_at) }}</div>
            </div>
            <q-btn
              label="Resolvido"
              icon="check"
              color="deep-orange"
              outline dense size="sm"
              @click="resolverImprevisto(imp)"
            >
              <q-tooltip>Marcar imprevisto como resolvido (remove o selo)</q-tooltip>
            </q-btn>
          </div>

          <div v-if="notaAtiva && !podeConcluir" class="fluxo-banner">
            <q-icon name="info" size="20px" color="orange-9" />
            <div class="fluxo-banner-txt">
              <template v-if="notaAtiva.status === 'em_andamento'">
                Nota em <b>Andamento</b>: aguardando a equipe tocar em <b>"Finalizar nota"</b> no app de campo.
              </template>
              <template v-else>
                Nota em <b>{{ labelStatus(notaAtiva.status) }}</b>.
              </template>
              Você pode preencher e salvar como rascunho; a conclusão é liberada quando a nota estiver em <b>Aguardando Etapa 2</b> ou <b>Auditar</b>.
            </div>
            <q-btn
              v-if="['pendente', 'em_andamento'].includes(notaAtiva.status)"
              label="Enviar para Etapa 2"
              icon="speed"
              color="blue-7"
              outline dense size="sm"
              @click="alterarStatus('aguardando_etapa2')"
            >
              <q-tooltip>Use quando a equipe concluiu o campo mas não finalizou pelo app</q-tooltip>
            </q-btn>
          </div>

          <div v-if="temServicoEquipe2" class="etapa-section">
            <div class="etapa-label">
              <q-icon name="build" size="16px" />
              Serviço registrado pela Equipe 2
            </div>
            <div class="q-pa-sm column q-gutter-sm">
              <q-input
                v-model="servicoEquipe2.descricao"
                type="textarea" autogrow outlined dense
                label="Descrição do serviço"
              />
              <div class="row q-gutter-sm">
                <div v-for="(url, i) in servicoEquipe2.fotos" :key="url" style="position: relative">
                  <img :src="url" alt="Foto do serviço" style="width: 110px; height: 110px; object-fit: cover; border-radius: 10px" />
                  <q-btn round dense size="xs" icon="close" color="negative" style="position: absolute; top: 4px; right: 4px" @click="removerFotoServico(i)" />
                </div>
                <q-btn outline color="primary" icon="add_a_photo" label="Adicionar foto" :loading="servicoSalvando" no-caps style="height: 110px; width: 130px" @click="fotoServicoInput?.click()" />
                <input ref="fotoServicoInput" type="file" accept="image/*" hidden @change="e => { adicionarFotoServico(e.target.files?.[0]); e.target.value = '' }" />
              </div>
              <div>
                <q-btn unelevated color="primary" label="Salvar serviço" icon="save" no-caps :loading="servicoSalvando" @click="salvarServico" />
              </div>
            </div>
          </div>

          <!-- ── Seção Campo (Etapa 1) ── -->
          <div class="etapa-section etapa-section--campo">
            <div class="etapa-label">
              <q-icon name="construction" size="16px" />
              Etapa 1 — Registro de Campo
              <q-space />
              <q-btn
                v-if="registrosCampo.length"
                label="Apagar tudo"
                icon="delete_sweep"
                color="negative"
                flat dense size="xs"
                @click="apagarRegistrosCampo"
              />
            </div>

            <div v-if="carregandoCampo" class="text-center q-pa-md text-grey-5">
              <q-spinner size="24px" color="amber" /> Buscando registros do campo...
            </div>

            <div v-else-if="!registrosCampo.length" class="campo-vazio">
              <q-icon name="warning_amber" size="20px" />
              Nenhum registro do campo ainda. A equipe ainda não enviou os postes.
            </div>

            <div v-else>
              <div class="campo-stats-grid">
                <div class="campo-stat-card">
                  <div class="campo-stat-icon campo-stat-icon--total">
                    <q-icon name="electrical_services" size="20px" />
                  </div>
                  <div class="campo-stat-body">
                    <span class="campo-stat-val">{{ campoStats.total }}</span>
                    <span class="campo-stat-label">Postes registrados</span>
                  </div>
                </div>
                <div class="campo-stat-card">
                  <div class="campo-stat-icon campo-stat-icon--equipe">
                    <q-icon name="groups" size="20px" />
                  </div>
                  <div class="campo-stat-body">
                    <span class="campo-stat-val">{{ campoStats.equipes }}</span>
                    <span class="campo-stat-label">{{ campoStats.equipes === 1 ? 'Equipe' : 'Equipes' }}</span>
                  </div>
                </div>
                <div class="campo-stat-card">
                  <div class="campo-stat-icon campo-stat-icon--foto">
                    <q-icon name="photo_camera" size="20px" />
                  </div>
                  <div class="campo-stat-body">
                    <span class="campo-stat-val">{{ campoStats.comFoto }}/{{ campoStats.total }}</span>
                    <span class="campo-stat-label">Com foto</span>
                  </div>
                </div>
                <div class="campo-stat-card">
                  <div class="campo-stat-icon campo-stat-icon--hora">
                    <q-icon name="schedule" size="20px" />
                  </div>
                  <div class="campo-stat-body">
                    <span class="campo-stat-val campo-stat-val--sm">{{ campoStats.ultimoRegistro }}</span>
                    <span class="campo-stat-label">Último registro</span>
                  </div>
                </div>
              </div>

              <div
                v-for="grupo in registrosCampoPorEquipe"
                :key="grupo.equipe"
                class="campo-equipe-grupo"
              >
                <div class="campo-equipe-header">
                  <div class="campo-equipe-title">
                    <q-icon name="engineering" size="16px" />
                    <span>{{ grupo.equipe }}</span>
                  </div>
                  <q-chip dense size="sm" color="orange-2" text-color="orange-10">
                    {{ grupo.registros.length }} PG{{ grupo.registros.length > 1 ? 's' : '' }}
                  </q-chip>
                </div>

                <div class="pg-list">
                  <div v-for="(r, idx) in grupo.registros" :key="r.id" class="pg-item">
                    <div class="pg-item-num">{{ idx + 1 }}</div>

                    <div
                      class="pg-item-foto"
                      :class="{ 'pg-item-foto--clickable': !!r.foto_url }"
                      @click="r.foto_url && verFotosPoste(r)"
                    >
                      <img v-if="r.foto_url" :src="r.foto_url" class="pg-item-img" alt="foto poste" />
                      <span v-if="r.fotos_extras?.length" class="pg-item-foto-count">+{{ r.fotos_extras.length }}</span>
                      <div v-else class="pg-item-sem-foto" title="Foto não enviada">
                        <q-icon name="hide_image" size="20px" />
                        <span>Sem foto</span>
                      </div>
                    </div>

                    <div class="pg-item-info">
                      <div class="pg-item-pg">
                        <q-icon name="electrical_services" size="14px" />
                        PG {{ r.pg_numero }}
                      </div>
                      <div class="pg-item-meta">
                        <span class="pg-item-hora">
                          <q-icon name="event" size="11px" />
                          {{ formatarDataCompleta(r.created_at) }}
                        </span>
                      </div>
                    </div>

                    <q-btn
                      v-if="r.foto_url"
                      flat dense size="sm"
                      icon="zoom_in"
                      :label="r.fotos_extras?.length ? `Ver ${r.fotos_extras.length + 1} fotos` : 'Ver foto'"
                      color="orange-9"
                      class="pg-item-ver-foto"
                      @click="verFotosPoste(r)"
                    />

                    <q-btn
                      flat round dense
                      icon="delete"
                      color="negative"
                      size="sm"
                      @click="apagarRegistro(r)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <q-separator class="q-my-md" />

          <!-- ── Seção Clientes (Etapa 2) ── -->
          <div class="etapa-section etapa-section--office">
            <div class="etapa-label">
              <q-icon name="people" size="16px" />
              Etapa 2 — Clientes Atendidos
              <q-btn
                label="Adicionar Cliente"
                icon="add"
                color="secondary"
                flat dense size="sm"
                class="q-ml-auto"
                @click="adicionarCliente"
              />
            </div>

            <div v-if="!clientes.length" class="clientes-vazio">
              <q-icon name="person_add" size="20px" />
              Nenhum cliente adicionado. Clique em "Adicionar Cliente".
            </div>

            <div
              v-for="(c, i) in clientes"
              :key="i"
              class="cliente-row"
              :class="{ 'cliente-row--nao': !c.atendido }"
            >
              <!-- Badge planilha + endereço -->
              <div v-if="c.origem === 'planilha'" class="cliente-origem-bar">
                <q-icon name="table_chart" size="11px" />
                <span>Planilha</span>
                <span v-if="c._endereco" class="cliente-end">{{ c._endereco }}{{ c._bairro ? ' — ' + c._bairro : '' }}</span>
              </div>

              <div class="row q-col-gutter-sm items-start">
                <div class="col-12 col-sm-4">
                  <q-input v-model="c.nome" label="Nome do Cliente" outlined dense />
                </div>
                <div class="col-6 col-sm-2">
                  <q-select v-model="c.padrao" :options="padraoOptions" label="Padrão" outlined dense emit-value map-options clearable />
                </div>
                <div class="col-6 col-sm-3">
                  <q-input v-model="c.conta_contrato" label="Conta / CPF" outlined dense />
                </div>
                <div class="col-auto row items-center" style="gap:4px;padding-top:4px">
                  <!-- Toggle atendido -->
                  <q-btn
                    :icon="c.atendido ? 'check_circle' : 'cancel'"
                    :color="c.atendido ? 'positive' : 'negative'"
                    flat round dense size="md"
                    @click="c.atendido = !c.atendido"
                  >
                    <q-tooltip>{{ c.atendido ? 'Atendido — clique para marcar como não atendido' : 'Não atendido' }}</q-tooltip>
                  </q-btn>
                  <q-btn icon="delete" color="grey-5" flat round dense @click="removerCliente(i)" />
                </div>
              </div>

              <!-- Medidor + Foto -->
              <div class="row q-col-gutter-sm items-center q-mt-xs">
                <div class="col-12 col-sm-4">
                  <q-input
                    v-model="c.num_medidor"
                    label="Nº do Medidor *"
                    outlined dense
                    :error="tentouSalvar && !c.num_medidor?.trim()"
                    error-message="Obrigatório"
                    hide-bottom-space
                  >
                    <template #prepend><q-icon name="speed" size="15px" /></template>
                  </q-input>
                </div>
                <div class="col-auto">
                  <q-btn
                    flat dense size="sm"
                    icon="add_a_photo"
                    :color="(tentouSalvar && !c.fotos.length) ? 'negative' : (c.fotos.length ? 'blue-7' : 'grey-6')"
                    :label="c.fotos.length ? 'Adicionar foto' : 'Foto do medidor *'"
                    @click="selecionarFoto(i)"
                  />
                  <div v-if="tentouSalvar && !c.fotos.length" class="text-negative" style="font-size:11px;margin-top:2px">
                    Foto obrigatória
                  </div>
                </div>
                <div v-for="(f, fi) in c.fotos" :key="f.preview" class="col-auto medidor-thumb-wrap">
                  <img
                    :src="f.preview"
                    class="medidor-thumb"
                    title="Ver foto ampliada"
                    @click="verFoto(f.preview)"
                  />
                  <q-btn
                    icon="close" round dense unelevated size="6px"
                    color="negative" class="medidor-thumb-remove"
                    @click="removerFoto(c, fi)"
                  >
                    <q-tooltip>Remover foto</q-tooltip>
                  </q-btn>
                </div>
              </div>

              <!-- Motivo se não atendido -->
              <div v-if="!c.atendido" class="row q-mt-xs q-pl-sm">
                <div class="col-12 col-sm-9">
                  <q-input v-model="c.motivo" label="Motivo do não atendimento *" outlined dense :rules="[v => !!v || 'Informe o motivo']" />
                </div>
              </div>
            </div>

            <!-- Resumo -->
            <div v-if="clientes.length" class="resumo-bar q-mt-md">
              <div class="resumo-item resumo-item--ok">
                <q-icon name="check_circle" /> {{ totalAtendidos }} atendidos
              </div>
              <div v-if="totalNaoAtendidos" class="resumo-item resumo-item--nao">
                <q-icon name="cancel" /> {{ totalNaoAtendidos }} não atendidos
              </div>
              <div class="resumo-item resumo-item--total">
                <q-icon name="people" /> {{ clientes.length }} total
              </div>
            </div>
          </div>

        </q-card-section>

        <q-separator />

        <q-card-actions align="right" class="q-pa-md">
          <div v-if="rascunhoEm" class="rascunho-info q-mr-auto">
            <q-icon name="edit_note" size="16px" />
            Rascunho salvo em {{ formatarDataCompleta(rascunhoEm) }}
          </div>
          <q-btn label="Cancelar" flat color="grey-7" @click="dialog = false" />
          <q-btn
            v-if="notaAtiva?.status !== 'concluido'"
            label="Salvar e continuar depois"
            icon="save"
            color="primary"
            outline
            :loading="salvando === 'rascunho'"
            :disable="!clientes.length || !!salvando"
            @click="salvar(true)"
          >
            <q-tooltip>Guarda o que já foi preenchido sem concluir a nota</q-tooltip>
          </q-btn>
          <div>
            <q-btn
              label="Salvar e Concluir"
              icon="check_circle"
              color="positive"
              unelevated
              :loading="salvando === 'concluir'"
              :disable="!clientes.length || !!salvando || !podeConcluir"
              @click="salvar(false)"
            />
            <q-tooltip v-if="!podeConcluir" class="text-body2">
              Só notas em "Aguardando Etapa 2" ou "Auditar" podem ser concluídas. Esta nota está em "{{ labelStatus(notaAtiva?.status) }}".
            </q-tooltip>
          </div>
        </q-card-actions>

      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup>
import { ref, computed, reactive, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useNotasStore } from 'stores/notas'
import { useApontamentoStore } from 'stores/apontamento'
import { supabase } from 'boot/supabase'
import MapaNotas from 'components/MapaNotas.vue'
import ProgInfo from 'components/ProgInfo.vue'

const $q         = useQuasar()
const notasStore = useNotasStore()
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
      n.nota?.toLowerCase().includes(q) ||
      n.projeto_info_sap?.toLowerCase().includes(q) ||
      n.pep?.toLowerCase().includes(q) ||
      n.base?.toLowerCase().includes(q)
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
    message: `Isto vai apagar ${alvo}: postes registrados em campo, clientes, números de medidor e fotos. ` +
             'Ela voltará para "Não Iniciado" com a marca "Apagada". Esta ação não pode ser desfeita.',
    cancel: { label: 'Cancelar', flat: true, color: 'grey-7' },
    ok: { label: 'Apagar', color: 'negative', unelevated: true },
    persistent: true
  }).onOk(async () => {
    const { error } = await notasStore.apagarNotas(lista)
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
  gap: 8px;
  flex-wrap: wrap;
}
.stab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  border: 1.5px solid var(--border-color, #e0e0e0);
  background: var(--bg-card, #fff);
  color: var(--text-secondary, #546e7a);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.stab-icon { display: flex; align-items: center; }
.stab-count {
  margin-left: 4px;
  background: rgba(0,0,0,0.08);
  border-radius: 20px;
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 700;
}
.stab--active.stab--todas          { border-color: #1976d2; background: #e3f2fd; color: #1565c0; }
.stab--active.stab--pendente       { border-color: #9e9e9e; background: #f5f5f5; color: #424242; }
.stab--active.stab--em_andamento   { border-color: #f57c00; background: #fff3e0; color: #e65100; }
.stab--active.stab--baixar_medidor { border-color: #1565c0; background: #e3f2fd; color: #0d47a1; }
.stab--active.stab--concluido      { border-color: #388e3c; background: #e8f5e9; color: #1b5e20; }

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
.fluxo-banner {
  display: flex; align-items: center; gap: 12px;
  background: #fff8e1; border: 1px solid #ffe082;
  border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;
}
.fluxo-banner-txt { flex: 1; font-size: 13px; color: #5d4037; line-height: 1.45; }
.imprevisto-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fbe9e7;
  border: 1px solid #ffab91;
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 12px;
}
.imprevisto-banner-txt { flex: 1; min-width: 0; }
.imprevisto-banner-title { font-weight: 700; color: #bf360c; font-size: 13px; }
.imprevisto-banner-obs { font-size: 12px; color: #4e342e; margin-top: 2px; }
.imprevisto-banner-meta { font-size: 11px; color: #8d6e63; margin-top: 2px; }

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
.rascunho-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #e65100;
}

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
  border: 2px solid var(--border-color, #e8ecf0);
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.15s, border-color 0.2s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.nota-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); transform: translateY(-2px); }
.nota-card--pendente       { border-left: 4px solid #bdbdbd; }
.nota-card--em_andamento   { border-left: 4px solid #f57c00; box-shadow: 0 2px 12px rgba(245,124,0,0.1); }
.nota-card--baixar_medidor { border-left: 4px solid #1976d2; box-shadow: 0 2px 12px rgba(25,118,210,0.1); }
.nota-card--concluido      { border-left: 4px solid #43a047; }

.nc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.nc-num { font-size: 20px; font-weight: 800; color: var(--text-primary, #0d1b2a); }
.nc-badges { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }

.nc-badge-base {
  font-size: 10px; font-weight: 700;
  background: #e3f2fd; color: #1565c0;
  border-radius: 6px; padding: 2px 8px;
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
.nc-status--pendente       { background: #f5f5f5;  color: #757575; }
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
.nc-msg--pendente       { background: #f5f5f5;  color: #9e9e9e; }
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
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border-color, #e8ecf0);
  border-radius: 12px;
}
.filtros-count { font-size: 12px; font-weight: 600; white-space: nowrap; }

/* ── Vista lista ── */
.lista-notas {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lista-header {
  display: grid;
  grid-template-columns: 130px 110px 220px 150px 1fr 90px 130px 110px;
  gap: 12px;
  padding: 6px 16px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #37474f;
  border-bottom: 2px solid #b0bec5;
  margin-bottom: 2px;
  text-align: center;
}
.lista-header > div { text-align: center; }
.lista-header-status { display: flex; align-items: center; justify-content: center; gap: 4px; }

.status-legenda { padding: 12px 14px; max-width: 340px; display: flex; flex-direction: column; gap: 10px; }
.status-legenda-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #78909c; }
.status-legenda-item { display: flex; align-items: flex-start; gap: 10px; }
.status-legenda-label { font-size: 13px; font-weight: 700; }
.status-legenda-desc { font-size: 12px; color: #78909c; line-height: 1.35; }
.body--dark .lista-header { color: #b0bec5; border-bottom-color: rgba(255,255,255,0.15); }
.lista-row {
  display: grid;
  grid-template-columns: 130px 110px 220px 150px 1fr 90px 130px 110px;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 10px;
  border: 1.5px solid var(--border-color, #e8ecf0);
  background: var(--bg-card, #fff);
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.lista-row:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.08); border-color: #b0bec5; }
.lista-row--pendente       { border-left: 4px solid #bdbdbd; }
.lista-row--em_andamento   { border-left: 4px solid #f57c00; }
.lista-row--baixar_medidor { border-left: 4px solid #1976d2; }
.lista-row--concluido      { border-left: 4px solid #43a047; }

.lista-num  { font-size: 15px; font-weight: 800; color: var(--text-primary, #0d1b2a); text-align: center; }
.lista-base { text-align: center; }
.lista-pep  { text-align: center; font-size: 12px; font-weight: 600; color: #7b1fa2; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
:root[data-theme="dark"] .lista-pep,
.body--dark .lista-pep  { color: #ce93d8; }
.lista-info { display: flex; gap: 10px; font-size: 12px; color: var(--text-muted, #607d8b); justify-content: center; }
.lista-info span { display: flex; align-items: center; gap: 3px; border-radius: 8px; padding: 2px 7px; }
.info-destaque { font-weight: 800; }
.info-destaque--poste  { background: #fff3e0; color: #e65100; box-shadow: 0 0 6px rgba(230,81,0,0.35); }
.info-destaque--cliente { background: #e8f5e9; color: #2e7d32; box-shadow: 0 0 6px rgba(46,125,50,0.3); }
.lista-status { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px; }
.lista-status .badge-apagada { margin-left: 0; }
.lista-equipe { display: inline-flex; align-items: center; gap: 3px; width: 100%; justify-content: center; font-size: 11px; font-weight: 700; color: #5d4037; background: #fff8e1; border-radius: 8px; padding: 2px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.body--dark .lista-equipe { background: rgba(255,202,40,0.12); color: #ffe082; }
.lista-acao { display: flex; justify-content: center; align-items: center; gap: 2px; }

@media (max-width: 700px) {
  .lista-row {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto auto;
  }
  .lista-pep { grid-column: 1 / -1; }
  .lista-info { grid-column: 1 / -1; }
}

/* ── Dialog ── */
.dialog-card { display: flex; flex-direction: column; max-height: 100dvh; }
.dialog-bar { background: #0a1628; color: #fff; min-height: 50px; flex-shrink: 0; }
.dialog-bar-title { font-size: 15px; font-weight: 700; }
.dialog-nota-header {
  display: flex; flex-wrap: wrap; gap: 6px;
  background: var(--bg-main, #f4f6f9); padding: 10px 16px; flex-shrink: 0;
}
.dialog-scroll { flex: 1; overflow-y: auto; }

/* ── Seções etapas ── */
.etapa-section { border-radius: 12px; padding: 16px; }
.etapa-section--campo  { background: #fffde7; border: 1px solid #ffe082; }
.etapa-section--office { background: var(--bg-card, #fff); border: 1px solid var(--border-color, #e0e0e0); }

.etapa-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-secondary, #546e7a); margin-bottom: 14px;
}
.etapa-section--campo .etapa-label { color: #e65100; }

/* ── Campo resumo ── */
.campo-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
@media (min-width: 640px) {
  .campo-stats-grid { grid-template-columns: repeat(4, 1fr); }
}
.campo-stat-card {
  display: flex; align-items: center; gap: 10px;
  background: #fff; border: 1px solid #ffe082;
  border-radius: 12px; padding: 10px 12px;
  min-width: 0;
}
.campo-stat-icon {
  width: 38px; height: 38px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.campo-stat-icon--total  { background: #fff3e0; color: #e65100; }
.campo-stat-icon--equipe { background: #e3f2fd; color: #1565c0; }
.campo-stat-icon--foto   { background: #e8f5e9; color: #2e7d32; }
.campo-stat-icon--hora   { background: #f3e5f5; color: #7b1fa2; }
.campo-stat-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.campo-stat-val { font-size: 18px; font-weight: 800; color: #1a1a1a; line-height: 1.1; }
.campo-stat-val--sm { font-size: 13px; font-weight: 700; }
.campo-stat-label {
  font-size: 9px; font-weight: 700; color: #888;
  text-transform: uppercase; letter-spacing: 0.06em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.campo-equipe-grupo { margin-bottom: 14px; }
.campo-equipe-grupo:last-child { margin-bottom: 0; }
.campo-equipe-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-bottom: 8px;
  padding: 6px 10px; background: rgba(255,255,255,0.65);
  border-radius: 8px; border: 1px solid #ffe082;
}
.campo-equipe-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 800; color: #bf360c;
  text-transform: uppercase; letter-spacing: 0.04em;
}

.campo-vazio, .clientes-vazio {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: #9e9e9e; padding: 8px 0;
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
  font-size: 12px; color: #7e57c2; font-weight: 600;
  text-align: center;
}
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
.grupo-item--em_andamento   { border-left: 4px solid #f57c00; }
.grupo-item--baixar_medidor { border-left: 4px solid #1976d2; }
.grupo-item--concluido      { border-left: 4px solid #43a047; }
.grupo-item--pendente       { border-left: 4px solid #bdbdbd; }
.grupo-item-left { flex: 1; min-width: 0; }
.grupo-item-nota { font-size: 16px; font-weight: 800; color: #0d1b2a; }
.grupo-item-info {
  display: flex; gap: 8px; margin-top: 2px;
  font-size: 11px; color: #78909c;
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

.pg-list { display: flex; flex-direction: column; gap: 8px; }

.pg-item {
  display: flex; align-items: center; gap: 10px;
  background: #fff; border: 1px solid #ffe082; border-radius: 12px;
  padding: 8px 10px 8px 8px;
  box-shadow: 0 1px 4px rgba(230, 81, 0, 0.06);
}
.pg-item-num {
  width: 22px; height: 22px; border-radius: 50%;
  background: #ffe082; color: #e65100;
  font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.pg-item-foto {
  width: 64px; height: 64px; border-radius: 10px;
  overflow: hidden; flex-shrink: 0; position: relative;
  background: #fff8e1; border: 1px solid #ffe082;
}
.pg-item-foto-count {
  position: absolute; right: 3px; bottom: 3px;
  background: rgba(0,0,0,0.65); color: #fff;
  font-size: 10px; font-weight: 800;
  border-radius: 8px; padding: 1px 5px;
}
.pg-item-foto--clickable { cursor: zoom-in; }
.pg-item-foto--clickable:hover .pg-item-img { opacity: 0.85; }
.pg-item-img {
  width: 100%; height: 100%; object-fit: cover;
  transition: opacity 0.2s;
}
.pg-item-img:hover { opacity: 0.85; }
.pg-item-sem-foto {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; color: #e65100; opacity: 0.65; font-size: 8px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em;
}

.pg-item-info { flex: 1; min-width: 0; }
.pg-item-pg {
  display: flex; align-items: center; gap: 5px;
  font-size: 15px; font-weight: 800; color: #e65100;
}
.pg-item-meta { margin-top: 3px; }
.pg-item-hora {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; color: #888; font-weight: 500;
}
.pg-item-ver-foto { flex-shrink: 0; font-size: 11px !important; }

/* ── Clientes ── */
.cliente-row {
  border-radius: 10px; padding: 10px 12px 8px; margin-bottom: 8px;
  border: 1.5px solid var(--border-color, #e8ecf0);
  background: var(--bg-card, #fff);
  transition: border-color 0.2s;
}
.cliente-row--nao { border-color: #ef9a9a; background: #fff8f8; }

.cliente-origem-bar {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; color: #1565c0;
  margin-bottom: 8px; letter-spacing: 0.04em;
}
.cliente-end { font-weight: 400; color: #78909c; margin-left: 4px; }

/* ── Resumo ── */
.resumo-bar { display: flex; gap: 16px; padding: 10px 14px; background: var(--bg-main, #f4f6f9); border-radius: 10px; }
.resumo-item { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 700; }
.resumo-item--ok    { color: #2e7d32; }
.resumo-item--nao   { color: #c62828; }
.resumo-item--total { color: #455a64; }

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
