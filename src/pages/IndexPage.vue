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

        <q-btn
          v-if="filtro || filtroBase || filtroPostes || filtroClientes"
          flat dense icon="filter_alt_off"
          color="grey-6" size="sm"
          @click="limparFiltros"
        >
          <q-tooltip>Limpar filtros</q-tooltip>
        </q-btn>

        <div class="filtros-count text-grey-6 text-caption self-center q-ml-auto">
          {{ notasFiltradas.length }} de {{ notasStore.notas.length }}
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
          <div>BASE</div>
          <div>PEP</div>
          <div>CLIENTE</div>
          <div>P / C</div>
          <div>STATUS</div>
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
          <div class="lista-base"><span class="nc-badge-base">{{ n.base }}</span></div>
          <div class="lista-pep">{{ n.pep || '—' }}</div>
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
                v-else-if="n.status === 'ligar_campo'"
                label="Abrir"
                icon="cable"
                color="teal-6"
                outline dense size="xs"
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
              <q-icon name="construction" size="13px" /> Campo em andamento — postes sendo registrados
            </template>
            <template v-else-if="n.status === 'ligar_campo'">
              <q-icon name="cable" size="13px" /> Pendente de ligação em campo
            </template>
            <template v-else-if="n.status === 'baixar_medidor'">
              <q-icon name="speed" size="13px" /> Registre o Nº do medidor e a foto
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
              v-else-if="n.status === 'ligar_campo'"
              label="Abrir"
              icon="cable"
              color="teal-6"
              outline dense size="sm"
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

    <!-- Dialog preview foto medidor -->
    <q-dialog v-model="fotoDialog">
      <q-card style="max-width:95vw">
        <q-bar style="background:#0a1628;color:#fff;min-height:42px">
          <q-icon name="photo_camera" size="16px" />
          <span class="q-ml-sm text-weight-bold" style="font-size:13px">Foto do Medidor</span>
          <q-space />
          <q-btn icon="close" flat dense round color="white" v-close-popup />
        </q-bar>
        <q-card-section class="q-pa-sm">
          <img :src="fotoDialogUrl" style="max-width:100%;max-height:75vh;display:block;margin:0 auto;border-radius:8px" />
        </q-card-section>
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
          <q-chip v-if="notaAtiva?.status === 'ligar_campo'" dense color="teal-1" text-color="teal-9" icon="cable">
            Aguardando ligação em campo
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
        <input ref="fotoInput" type="file" accept="image/*" hidden @change="onFotoSelecionada" />

        <!-- Conteúdo scrollável -->
        <q-card-section class="dialog-scroll">

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
              <div class="campo-resumo">
                <div class="campo-resumo-item">
                  <span class="campo-resumo-label">Equipes</span>
                  <span class="campo-resumo-val">{{ equipesUnicas }}</span>
                </div>
                <div class="campo-resumo-item">
                  <span class="campo-resumo-label">PGs registrados</span>
                  <span class="campo-resumo-val">{{ registrosCampo.length }}</span>
                </div>
                <div class="campo-resumo-item">
                  <span class="campo-resumo-label">Último registro</span>
                  <span class="campo-resumo-val">{{ formatarData(registrosCampo.at(-1)?.created_at) }}</span>
                </div>
              </div>

              <div class="pg-list">
                <div v-for="r in registrosCampo" :key="r.id" class="pg-item">
                  <!-- Foto do poste -->
                  <div class="pg-item-foto" @click="r.foto_url && verFoto(r.foto_url)">
                    <img v-if="r.foto_url" :src="r.foto_url" class="pg-item-img" alt="foto poste" />
                    <div v-else class="pg-item-sem-foto">
                      <q-icon name="photo_camera" size="18px" />
                    </div>
                  </div>
                  <!-- Dados -->
                  <div class="pg-item-info">
                    <div class="pg-item-pg">
                      <q-icon name="electrical_services" size="12px" />
                      {{ r.pg_numero }}
                    </div>
                    <div class="pg-item-meta">
                      <span class="pg-item-equipe">{{ r.equipe }}</span>
                      <span class="pg-item-hora">{{ formatarData(r.created_at) }}</span>
                    </div>
                  </div>
                  <!-- Deletar individual -->
                  <q-btn
                    flat round dense
                    icon="delete"
                    color="negative"
                    size="xs"
                    @click="apagarRegistro(r)"
                  />
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
                    :icon="c.foto_preview ? 'photo_camera' : 'add_a_photo'"
                    :color="(tentouSalvar && !c.foto_medidor && !c.foto_url) ? 'negative' : (c.foto_preview ? 'blue-7' : 'grey-6')"
                    :label="c.foto_preview ? 'Trocar foto' : 'Foto do medidor *'"
                    @click="selecionarFoto(i)"
                  />
                  <div v-if="tentouSalvar && !c.foto_medidor && !c.foto_url" class="text-negative" style="font-size:11px;margin-top:2px">
                    Foto obrigatória
                  </div>
                </div>
                <div v-if="c.foto_preview" class="col-auto">
                  <img
                    :src="c.foto_preview"
                    class="medidor-thumb"
                    title="Ver foto ampliada"
                    @click="verFoto(c.foto_preview)"
                  />
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
          <q-btn label="Cancelar" flat color="grey-7" @click="dialog = false" />
          <q-btn
            label="Salvar e Concluir"
            icon="check_circle"
            color="positive"
            unelevated
            :loading="salvando"
            :disable="!clientes.length"
            @click="salvar"
          />
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

const $q         = useQuasar()
const notasStore = useNotasStore()
const apStore    = useApontamentoStore()

// ── Filtros, tabs e vista ─────────────────────────────────────────
const filtro         = ref('')
const filtroBase     = ref(null)
const filtroPostes   = ref(null)
const filtroClientes = ref(null)
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

function limparFiltros () {
  filtro.value         = ''
  filtroBase.value     = null
  filtroPostes.value   = null
  filtroClientes.value = null
}

// ── Prioridade de status (menor índice = mais urgente) ───────────
const STATUS_PRIO = ['em_andamento', 'baixar_medidor', 'ligar_campo', 'pendente', 'concluido']

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
  return [...grupos.values()]
})

const contadores = computed(() => {
  const gs = todasAgrupadas.value
  return {
    todas:          gs.length,
    pendente:       gs.filter(g => g.status === 'pendente').length,
    em_andamento:   gs.filter(g => g.status === 'em_andamento').length,
    ligar_campo:    gs.filter(g => g.status === 'ligar_campo').length,
    baixar_medidor: gs.filter(g => g.status === 'baixar_medidor').length,
    concluido:      gs.filter(g => g.status === 'concluido').length
  }
})

const tabs = computed(() => [
  { val: 'todas',          label: 'Geral',           icon: 'apps',          count: contadores.value.todas },
  { val: 'pendente',       label: 'Não Iniciado',    icon: 'schedule',      count: contadores.value.pendente },
  { val: 'em_andamento',   label: 'Andamento',       icon: 'construction',  count: contadores.value.em_andamento },
  { val: 'ligar_campo',    label: 'Ligar - Campo',   icon: 'cable',         count: contadores.value.ligar_campo },
  { val: 'baixar_medidor', label: 'Baixar Medidor',  icon: 'speed',         count: contadores.value.baixar_medidor },
  { val: 'concluido',      label: 'Concluídos',      icon: 'check_circle',  count: contadores.value.concluido }
])

const notasFiltradas = computed(() => {
  let lista = tabAtual.value === 'todas'
    ? todasAgrupadas.value
    : todasAgrupadas.value.filter(g => g.status === tabAtual.value)

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

  return lista
})

const semNotasMsg = computed(() => {
  if (!notasStore.notas.length) return 'Nenhuma nota importada ainda.'
  const labels = {
    pendente:       'Não Iniciadas',
    em_andamento:   'em Andamento',
    ligar_campo:    'para Ligar - Campo',
    baixar_medidor: 'para Baixar Medidor',
    concluido:      'Concluídas'
  }
  return `Nenhuma nota ${labels[tabAtual.value] ?? ''} no momento.`
})

const statusOpcoes = [
  { val: 'pendente',       label: 'Não Iniciado',   icon: 'schedule',     color: 'grey-6'  },
  { val: 'em_andamento',   label: 'Andamento',      icon: 'construction', color: 'orange'  },
  { val: 'ligar_campo',    label: 'Ligar - Campo',  icon: 'cable',        color: 'teal'    },
  { val: 'baixar_medidor', label: 'Baixar Medidor', icon: 'speed',        color: 'blue'    },
  { val: 'concluido',      label: 'Concluído',      icon: 'check_circle', color: 'positive'},
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
  $q.dialog({
    title: 'Apagar todos os registros de campo?',
    message: `Remove todos os ${registrosCampo.value.length} registros de campo desta nota. Esta ação não pode ser desfeita.`,
    cancel: true, ok: { label: 'Apagar tudo', color: 'negative' }
  }).onOk(async () => {
    const { error } = await supabase.from('campo_registros').delete().eq('nota', notaAtiva.value.nota)
    if (!error) {
      registrosCampo.value = []
      $q.notify({ type: 'positive', message: 'Registros de campo removidos.', position: 'top', timeout: 2000 })
    }
  })
}

function labelStatus (s) {
  return {
    pendente:       'Não Iniciado',
    em_andamento:   'Andamento',
    ligar_campo:    'Ligar - Campo',
    baixar_medidor: 'Baixar Medidor',
    concluido:      'Concluído'
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
const fotoDialogUrl    = ref(null)
const fotoDialog       = ref(false)
const objectUrls       = []
const tentouSalvar     = ref(false)

onUnmounted(() => objectUrls.forEach(u => URL.revokeObjectURL(u)))

const equipesUnicas = computed(() =>
  [...new Set(registrosCampo.value.map(r => r.equipe).filter(Boolean))].join(', ')
)
const totalAtendidos    = computed(() => clientes.filter(c => c.atendido).length)
const totalNaoAtendidos = computed(() => clientes.filter(c => !c.atendido).length)

// Abre diálogo correto: grupo (múltiplas notas) ou nota individual
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
  dialog.value = true

  const da_planilha = Array.isArray(nota.clientes_planilha) ? nota.clientes_planilha : []
  da_planilha.forEach(c => clientes.push({
    nome: c.nome || '',
    padrao: '',
    conta_contrato: c.conta_contrato || '',
    num_medidor: '',
    foto_medidor: null,
    foto_preview: null,
    foto_url: null,
    atendido: true,
    motivo: '',
    origem: 'planilha',
    _endereco: c.endereco || '',
    _bairro: c.bairro || ''
  }))

  carregandoCampo.value = true
  registrosCampo.value = await notasStore.buscarRegistrosCampo(nota.nota)
  carregandoCampo.value = false
}

function adicionarCliente () {
  clientes.push({ nome: '', padrao: '', conta_contrato: '', num_medidor: '', foto_medidor: null, foto_preview: null, foto_url: null, atendido: true, motivo: '' })
}

function selecionarFoto (i) {
  clienteIndexFoto.value = i
  fotoInput.value.value = ''
  fotoInput.value.click()
}

function onFotoSelecionada (e) {
  const file = e.target.files[0]
  if (!file || clienteIndexFoto.value === null) return
  const c = clientes[clienteIndexFoto.value]
  if (c.foto_preview) URL.revokeObjectURL(c.foto_preview)
  const url = URL.createObjectURL(file)
  objectUrls.push(url)
  c.foto_medidor = file
  c.foto_preview = url
  c.foto_url = null
}

function verFoto (url) {
  fotoDialogUrl.value = url
  fotoDialog.value = true
}
function removerCliente (i) { clientes.splice(i, 1) }

async function salvar () {
  const n = notaAtiva.value

  const erros = []
  if (!clientes.length) { erros.push('pelo menos um cliente') }
  else {
    if (clientes.some(c => !c.nome?.trim()))                            erros.push('nome de todos os clientes')
    if (clientes.some(c => !c.num_medidor?.trim()))                     erros.push('número do medidor de todos os clientes')
    if (clientes.some(c => !c.foto_medidor && !c.foto_url))            erros.push('foto do medidor de todos os clientes')
    if (clientes.filter(c => !c.atendido).some(c => !c.motivo?.trim())) erros.push('motivo dos não atendidos')
  }

  if (erros.length) {
    tentouSalvar.value = true
    $q.notify({ type: 'warning', message: `Preencha: ${erros.join(', ')}.`, timeout: 5000 })
    return
  }

  salvando.value = true

  // Upload de fotos dos medidores
  for (const c of clientes) {
    if (c.foto_medidor instanceof File) {
      const ext  = c.foto_medidor.name.split('.').pop() || 'jpg'
      const path = `${n.nota}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: ue } = await supabase.storage
        .from('medidores')
        .upload(path, c.foto_medidor, { upsert: false })
      if (!ue) {
        const { data: pub } = supabase.storage.from('medidores').getPublicUrl(path)
        c.foto_url = pub.publicUrl
      }
    }
  }

  const naoAtendidosList = clientes
    .filter(c => !c.atendido)
    .map(c => ({ cliente: c.nome, motivo: c.motivo }))

  const { error } = await apStore.addApontamento({
    base:              n.base,
    pep:               n.pep,
    nota:              n.nota,
    postes:            registrosCampo.value.length || Number(n.postes) || 0,
    pg_numeros:        registrosCampo.value.map(r => r.pg_numero),
    clientes:          clientes.map(c => ({ nome: c.nome.trim(), padrao: c.padrao ?? '', conta_contrato: c.conta_contrato ?? '', num_medidor: c.num_medidor ?? '', foto_url: c.foto_url ?? null })),
    todos_atendidos:   clientes.every(c => c.atendido),
    nao_atendidos:     naoAtendidosList,
    qtd_clientes_nota: Number(n.qtd_clientes) || 0
  })

  if (error) {
    $q.notify({ type: 'negative', message: 'Erro ao salvar: ' + error.message })
    salvando.value = false
    return
  }

  // Marca nota como concluída
  await notasStore.atualizarStatus(n.nota, 'concluido')

  salvando.value = false
  dialog.value = false
  $q.notify({ type: 'positive', message: `Nota ${n.nota} concluída!`, icon: 'check_circle' })
}

function formatarData (iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
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
.stab--active.stab--ligar_campo    { border-color: #00796b; background: #e0f2f1; color: #004d40; }
.stab--active.stab--baixar_medidor { border-color: #1565c0; background: #e3f2fd; color: #0d47a1; }
.stab--active.stab--concluido      { border-color: #388e3c; background: #e8f5e9; color: #1b5e20; }

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
.nota-card--ligar_campo    { border-left: 4px solid #00897b; box-shadow: 0 2px 12px rgba(0,137,123,0.1); }
.nota-card--baixar_medidor { border-left: 4px solid #1976d2; box-shadow: 0 2px 12px rgba(25,118,210,0.1); }
.nota-card--concluido      { border-left: 4px solid #43a047; }

.nc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.nc-num { font-size: 20px; font-weight: 800; color: var(--text-primary, #0d1b2a); }
.nc-badges { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }

.nc-badge-base {
  font-size: 10px; font-weight: 700;
  background: #e3f2fd; color: #1565c0;
  border-radius: 6px; padding: 2px 8px;
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
.nc-status--ligar_campo    { background: #e0f2f1;  color: #00695c; }
.nc-status--baixar_medidor { background: #e3f2fd;  color: #1565c0; }
.nc-status--concluido      { background: #e8f5e9;  color: #2e7d32; }

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
.nc-msg--ligar_campo    { background: #e0f2f1;  color: #00695c; }
.nc-msg--baixar_medidor { background: #e3f2fd;  color: #1565c0; }
.nc-msg--concluido      { background: #e8f5e9;  color: #2e7d32; }

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
  grid-template-columns: 130px 120px 130px 1fr 1fr 100px 130px 90px;
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
.body--dark .lista-header { color: #b0bec5; border-bottom-color: rgba(255,255,255,0.15); }
.lista-row {
  display: grid;
  grid-template-columns: 130px 120px 130px 1fr 1fr 100px 130px 90px;
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
.lista-row--ligar_campo    { border-left: 4px solid #00897b; }
.lista-row--baixar_medidor { border-left: 4px solid #1976d2; }
.lista-row--concluido      { border-left: 4px solid #43a047; }

.lista-num  { font-size: 15px; font-weight: 800; color: var(--text-primary, #0d1b2a); text-align: center; }
.lista-base { text-align: center; }
.lista-pep  { text-align: center; font-size: 12px; font-weight: 600; color: #7b1fa2; font-family: monospace; word-break: break-all; }
:root[data-theme="dark"] .lista-pep,
.body--dark .lista-pep  { color: #ce93d8; }
.lista-info { display: flex; gap: 10px; font-size: 12px; color: var(--text-muted, #607d8b); justify-content: center; }
.lista-info span { display: flex; align-items: center; gap: 3px; border-radius: 8px; padding: 2px 7px; }
.info-destaque { font-weight: 800; }
.info-destaque--poste  { background: #fff3e0; color: #e65100; box-shadow: 0 0 6px rgba(230,81,0,0.35); }
.info-destaque--cliente { background: #e8f5e9; color: #2e7d32; box-shadow: 0 0 6px rgba(46,125,50,0.3); }
.lista-status { display: flex; justify-content: center; }
.lista-acao { display: flex; justify-content: center; }

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
.campo-resumo { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.campo-resumo-item { display: flex; flex-direction: column; gap: 2px; }
.campo-resumo-label { font-size: 10px; font-weight: 700; color: rgba(0,0,0,0.4); text-transform: uppercase; letter-spacing: 0.07em; }
.campo-resumo-val { font-size: 15px; font-weight: 700; color: #333; }

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
.grupo-item--ligar_campo    { border-left: 4px solid #00897b; }
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

.pg-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }

.pg-item {
  display: flex; align-items: center; gap: 10px;
  background: #fff8e1; border: 1px solid #ffcc02; border-radius: 10px;
  padding: 6px 10px 6px 6px;
}

.pg-item-foto {
  width: 52px; height: 52px; border-radius: 7px;
  overflow: hidden; flex-shrink: 0;
  background: #ffe082;
  cursor: pointer;
}
.pg-item-img {
  width: 100%; height: 100%; object-fit: cover;
  transition: opacity 0.2s;
}
.pg-item-img:hover { opacity: 0.85; }
.pg-item-sem-foto {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: #e65100; opacity: 0.5;
}

.pg-item-info { flex: 1; min-width: 0; }
.pg-item-pg {
  display: flex; align-items: center; gap: 4px;
  font-size: 13px; font-weight: 800; color: #e65100;
}
.pg-item-meta {
  display: flex; align-items: center; gap: 8px;
  margin-top: 2px;
}
.pg-item-equipe { font-size: 10px; font-weight: 600; color: #888; }
.pg-item-hora   { font-size: 10px; color: #bbb; }

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
</style>
