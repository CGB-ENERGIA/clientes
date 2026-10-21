<template>
  <q-dialog
    :model-value="modelValue"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
    @update:model-value="v => emit('update:modelValue', v)"
    @show="montarMapa"
    @hide="desmontarMapa"
  >
    <q-card class="mapa-card" :class="{ 'mapa-card--compacto': compacto }">
      <header class="mapa-bar">
        <q-icon name="map" size="18px" />
        <span class="mapa-bar-titulo">{{ compacto ? 'Mapa' : 'Mapa das notas' }}</span>
        <span class="mapa-bar-sub">
          {{ notasNoMapa.length }} {{ notasNoMapa.length === 1 ? 'nota' : 'notas' }}
          <template v-if="semCoordenada.length && !compacto"> · {{ semCoordenada.length }} sem coordenada</template>
        </span>
        <q-space />
        <q-btn icon="close" flat dense round color="white" v-close-popup />
      </header>

      <div class="mapa-toolbar">
        <q-input
          v-model="busca"
          dense outlined
          :placeholder="compacto ? 'Buscar nota, SAP, município' : 'Buscar nota, SAP ou município'"
          class="mapa-busca"
          clearable
          enterkeyhint="search"
          @keyup.enter="irParaBusca"
        >
          <template #prepend><q-icon name="search" /></template>
        </q-input>

        <q-btn
          v-if="compacto"
          :flat="!painelAberto" :unelevated="painelAberto"
          :color="painelAberto ? 'primary' : 'grey-8'"
          icon="tune"
          class="mapa-btn-filtros"
          @click="painelAberto = !painelAberto"
        >
          <q-badge v-if="filtrosAtivos" floating rounded color="red">{{ filtrosAtivos }}</q-badge>
        </q-btn>

        <div v-show="!compacto || painelAberto" class="mapa-controles">
          <div class="mapa-filtros">
            <q-select
              v-model="filtroBase"
              :options="basesOpcoes"
              dense outlined clearable
              multiple
              :display-value="filtroBase.length > 1 ? `${filtroBase.length} bases` : (filtroBase[0] ?? undefined)"
              label="Base"
              class="mapa-filtro"
              options-dense
              behavior="menu"
              :hide-dropdown-icon="compacto && !!filtroBase.length"
            >
              <template #prepend>
                <q-icon name="business" size="18px" />
              </template>
              <template #option="{ itemProps, opt }">
                <q-item v-bind="itemProps" dense>
                  <q-item-section side><q-checkbox :model-value="filtroBase.includes(opt)" dense color="primary" /></q-item-section>
                  <q-item-section><q-item-label>{{ opt }}</q-item-label></q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-select
              v-model="filtroMunicipio"
              :options="municipiosOpcoesFiltradas"
              dense outlined clearable
              use-input input-debounce="0"
              label="Município"
              class="mapa-filtro mapa-filtro--mun"
              options-dense
              behavior="menu"
              :hide-dropdown-icon="compacto && !!filtroMunicipio"
              @filter="filtrarMunicipios"
            >
              <template #prepend><q-icon name="location_city" size="18px" /></template>
              <template #no-option>
                <q-item><q-item-section class="text-grey">Nenhum município</q-item-section></q-item>
              </template>
            </q-select>
          </div>

          <q-select
            v-if="esquema === 'programacao'"
            v-model="filtroDatas"
            :options="datasOpcoes"
            multiple
            dense outlined clearable
            :display-value="filtroDatas.length > 1 ? `${filtroDatas.length} datas` : (filtroDatas[0] ? dataBr(filtroDatas[0]) : undefined)"
            label="Data programada"
            class="mapa-filtro-data"
            options-dense
            behavior="menu"
          >
            <template #prepend><q-icon name="event" size="18px" /></template>
            <template #option="{ itemProps, opt }">
              <q-item v-bind="itemProps" dense>
                <q-item-section side><q-checkbox :model-value="filtroDatas.includes(opt)" dense color="primary" /></q-item-section>
                <q-item-section><q-item-label>{{ dataBr(opt) }}</q-item-label></q-item-section>
              </q-item>
            </template>
          </q-select>
          <q-select
            v-if="esquema === 'programacao'"
            v-model="filtroEquipe"
            :options="equipesOpcoes"
            dense outlined clearable
            label="Equipe"
            class="mapa-filtro mapa-filtro--equipe"
            options-dense
            behavior="menu"
          >
            <template #prepend><q-icon name="groups" size="18px" /></template>
          </q-select>

          <div class="mapa-legenda">
            <button
              v-for="s in statusVisiveis"
              :key="s.val"
              class="mapa-leg-item"
              :class="{ 'mapa-leg-item--off': ocultos.has(s.val) }"
              :style="{ '--clr': s.cor }"
              @click="alternarStatus(s.val)"
            >
              <span class="mapa-leg-dot" :style="{ background: s.cor }" />
              {{ s.label }}
              <b>{{ contagem[s.val] || 0 }}</b>
            </button>
          </div>

          <q-btn-toggle
            v-model="camada"
            dense unelevated no-caps
            toggle-color="primary"
            color="grey-3" text-color="grey-8"
            class="mapa-camada"
            :options="[{ value: 'ruas', label: 'Ruas' }, { value: 'satelite', label: 'Satélite' }]"
          />
        </div>
      </div>

      <div v-if="!online" class="mapa-aviso">
        <q-icon name="cloud_off" size="16px" />
        <span>Sem internet: o fundo do mapa pode não carregar, mas os pontos e a rota funcionam.</span>
      </div>
      <div v-if="erroGps" class="mapa-aviso">
        <q-icon name="location_disabled" size="16px" /> <span>{{ erroGps }}</span>
      </div>
      <div v-if="avisoArea" class="mapa-aviso">
        <q-icon name="info" size="16px" /> <span>{{ avisoArea }}</span>
      </div>
      <div v-if="areaAtual" class="mapa-area">
        <q-icon :name="filtroMunicipio ? 'location_city' : 'business'" size="18px" />
        <b>{{ areaAtual.titulo }}</b>
        <span>{{ areaAtual.sub }}</span>
      </div>

      <div class="mapa-wrap">
        <div ref="mapaEl" class="mapa-el" />

        <transition name="mapa-fabs">
          <div v-if="modo === 'campo' && !selecionado" class="mapa-fabs">
            <q-btn
              round
              :color="seguindo ? 'blue-7' : 'white'"
              :text-color="seguindo ? 'white' : 'blue-8'"
              :icon="seguindo ? 'gps_fixed' : 'my_location'"
              class="mapa-fab-gps"
              :class="{ 'mapa-fab-gps--ativo': seguindo }"
              @click="centralizarEmMim"
            >
              <q-tooltip v-if="!compacto">{{ seguindo ? 'Seguindo você' : 'Onde estou' }}</q-tooltip>
            </q-btn>
            <q-btn round color="teal-7" icon="near_me" :disable="!minhaPos" @click="irParaMaisProxima">
              <q-tooltip v-if="!compacto">Nota mais próxima</q-tooltip>
            </q-btn>
          </div>
        </transition>

        <transition name="mapa-sheet">
          <div
            v-if="selecionado"
            ref="sheetEl"
            class="mapa-sheet"
            :class="{ 'mapa-sheet--arrastando': arrasteY > 0 }"
            :style="arrasteY > 0 ? { transform: `translateY(${arrasteY}px)` } : null"
            @touchstart.passive="iniciarArraste"
            @touchmove="moverArraste"
            @touchend="soltarArraste"
            @touchcancel="soltarArraste"
          >
            <div v-if="compacto" class="mapa-sheet-alca" />
            <button class="mapa-sheet-fechar" aria-label="Fechar" @click="fecharSelecao">
              <q-icon name="close" size="20px" />
            </button>

            <div v-if="selecionado.length > 1" class="mapa-sheet-titulo">
              {{ selecionado.length }} notas neste ponto
            </div>

            <div class="mapa-sheet-lista">
              <div v-for="n in selecionado" :key="n.nota" class="mapa-sheet-nota">
                <div class="mapa-sheet-top">
                  <b>Nota {{ n.nota }}</b>
                  <span class="mapa-sheet-status" :style="{ background: corDe(n.status) }">{{ labelDe(n.status) }}</span>
                </div>
                <div v-if="n.projeto_info_sap" class="mapa-sheet-linha">SAP {{ n.projeto_info_sap }}</div>
                <div class="mapa-sheet-linha">{{ n.base }}<template v-if="n.municipio"> · {{ n.municipio }}</template></div>
                <div v-if="n.equipe" class="mapa-sheet-linha">Equipe {{ n.equipe }}</div>
                <div class="mapa-sheet-linha">{{ Number(n.postes) || 0 }} postes · {{ Number(n.qtd_clientes) || 0 }} clientes</div>
                <q-btn
                  v-if="permitirAbrir"
                  :label="rotuloAbrir"
                  color="primary" unelevated no-caps dense
                  class="mapa-sheet-abrir"
                  @click="emit('abrir', n)"
                />
              </div>
            </div>

            <div v-if="rota.estado === 'ok'" class="mapa-sheet-rota">
              <q-icon name="directions_car" size="22px" />
              <div class="mapa-sheet-rota-info">
                <b>{{ formatarDuracao(rota.minutos) }}</b>
                <span>{{ formatarDistancia(rota.km) }} de carro</span>
              </div>
              <q-btn flat dense no-caps color="primary" icon="route" label="Ver trajeto" @click="enquadrarRota" />
            </div>
            <div v-else-if="rota.estado === 'carregando'" class="mapa-sheet-rota mapa-sheet-rota--carregando">
              <q-spinner-dots size="22px" color="primary" />
              <span>Calculando rota{{ distanciaSelecionado ? ` · ${distanciaSelecionado} em linha reta` : '' }}</span>
            </div>
            <div v-else-if="distanciaSelecionado" class="mapa-sheet-dist">
              <q-icon name="straighten" size="16px" /> A {{ distanciaSelecionado }} de você (em linha reta)
            </div>

            <div class="mapa-sheet-acoes">
              <template v-if="modo === 'campo'">
                <a class="mapa-rota mapa-rota--google" :href="urlGoogleMaps(selecionado[0].latitude, selecionado[0].longitude)" target="_blank" rel="noopener">
                  <q-icon name="navigation" size="20px" /> Iniciar deslocamento
                </a>
                <a class="mapa-rota mapa-rota--waze" :href="urlWaze(selecionado[0].latitude, selecionado[0].longitude)" target="_blank" rel="noopener">Waze</a>
              </template>
              <a
                v-else
                class="mapa-rota mapa-rota--link"
                :href="`https://www.google.com/maps/search/?api=1&query=${selecionado[0].latitude},${selecionado[0].longitude}`"
                target="_blank" rel="noopener"
              >
                <q-icon name="open_in_new" size="16px" /> Abrir no Google Maps
              </a>
            </div>
          </div>
        </transition>

        <transition name="rot">
          <div v-if="roteiro" ref="rotEl" class="rot-painel">
            <div v-if="compacto" class="rot-alca" />
            <header class="rot-head">
              <div class="rot-head-linha">
                <span class="rot-selo"><q-icon name="alt_route" size="15px" /> Roteiro inteligente</span>
                <button class="rot-x" aria-label="Fechar roteiro" @click="fecharRoteiro">
                  <q-icon name="close" size="20px" />
                </button>
              </div>

              <template v-if="!roteiro.grande">
                <div class="rot-titulo">
                  {{ rotSequencia.length }} {{ rotSequencia.length === 1 ? 'parada' : 'paradas' }}
                  <small>{{ rotSubtitulo }}</small>
                </div>
                <div class="rot-stats">
                  <div><b>{{ rotPostes }}</b><span>postes</span></div>
                  <div><b>{{ rotTotais.km }}</b><span>{{ rotTotais.real ? 'por estrada' : 'em linha reta' }}</span></div>
                  <div>
                    <b><q-spinner-dots v-if="rotReal.estado === 'carregando'" size="20px" /><template v-else>{{ rotTotais.tempo }}</template></b>
                    <span>de carro</span>
                  </div>
                </div>
                <div v-if="rotMix.length" class="rot-mix">
                  <i v-for="s in rotMix" :key="s.val" :style="{ flex: s.qtd, background: s.cor }" :title="`${s.qtd} ${s.label}`" />
                </div>
              </template>
              <div v-else class="rot-titulo">{{ roteiro.paradas.length }} pontos neste grupo</div>
            </header>

            <div v-if="roteiro.grande" class="rot-grande">
              <q-icon name="zoom_in" size="36px" />
              <p>
                Para gerar a sequência e os links, aproxime o mapa até o grupo ter no máximo
                <b>{{ LIMITE_ROTEIRO }}</b> pontos.
              </p>
              <button class="rot-btn rot-btn--prim" @click="ampliarRoteiro">
                <q-icon name="zoom_in" size="18px" /> Ampliar este grupo
              </button>
            </div>

            <template v-else>
              <div class="rot-trecho">
                <q-select
                  v-model="rotDe"
                  :options="opcoesDe"
                  option-label="rotulo"
                  option-value="id"
                  use-input input-debounce="0"
                  stack-label
                  dense outlined clearable
                  behavior="menu"
                  options-dense
                  label="De"
                  placeholder="Minha posição"
                  class="rot-trecho-campo"
                  @filter="(val, update) => filtrarPontos('de', val, update)"
                >
                  <template #prepend><q-icon name="trip_origin" size="16px" /></template>
                </q-select>
                <q-select
                  v-model="rotPara"
                  :options="opcoesPara"
                  option-label="rotulo"
                  option-value="id"
                  use-input input-debounce="0"
                  stack-label
                  dense outlined clearable
                  behavior="menu"
                  options-dense
                  label="Para"
                  placeholder="Ordem mais curta"
                  class="rot-trecho-campo"
                  @filter="(val, update) => filtrarPontos('para', val, update)"
                >
                  <template #prepend><q-icon name="flag" size="16px" /></template>
                </q-select>
                <div v-if="rotDe && rotPara" class="rot-dist">
                  <q-icon name="straighten" size="16px" />
                  <span>Distância: <b>{{ formatarDistancia(distanciaReta) }}</b> em linha reta</span>
                  <template v-if="distanciaPorEstrada?.estado === 'ok'">
                    <span>· <b>{{ formatarDistancia(distanciaPorEstrada.km) }}</b> por estrada ({{ formatarDuracao(distanciaPorEstrada.minutos) }})</span>
                  </template>
                  <q-spinner-dots v-else-if="distanciaPorEstrada?.estado === 'carregando'" size="14px" />
                </div>
              </div>

              <div v-if="rotMarcados.length" class="rot-par">
                <template v-if="rotMarcados.length === 2">
                  <q-icon name="straighten" size="16px" />
                  <span><b>{{ rotuloPonto(rotMarcados[0]) }}</b> até <b>{{ rotuloPonto(rotMarcados[1]) }}</b>: <b>{{ formatarDistancia(distanciaMarcadosReta) }}</b> em linha reta</span>
                  <span v-if="distanciaMarcados?.estado === 'ok'">· <b>{{ formatarDistancia(distanciaMarcados.km) }}</b> por estrada ({{ formatarDuracao(distanciaMarcados.minutos) }})</span>
                  <q-spinner-dots v-else-if="distanciaMarcados?.estado === 'carregando'" size="14px" />
                </template>
                <span v-else>{{ rotMarcados.length }} marcado · marque mais um ponto para ver a distância</span>
                <button class="rot-par-limpar" @click="limparMarcados">Limpar</button>
              </div>

              <div class="rot-ctrl">
                <div v-if="rotAtivas.length > 1" class="rot-seg">
                  <button :class="{ 'rot-seg--on': rotOrdem === 'otima' }" @click="rotOrdem = 'otima'">
                    <q-icon name="flash_on" size="15px" /> Melhor sequência
                  </button>
                  <button :class="{ 'rot-seg--on': rotOrdem === 'nota' }" @click="rotOrdem = 'nota'">Por nota</button>
                </div>
                <q-space v-else />
                <button v-if="rotAtivas.length > 1 && !rotDe && !rotPara" class="rot-ico" title="Inverter sequência" aria-label="Inverter sequência" @click="rotInvertido = !rotInvertido">
                  <q-icon name="swap_vert" size="20px" />
                </button>
                <button class="rot-ico" title="Ampliar o grupo no mapa" aria-label="Ampliar o grupo no mapa" @click="ampliarRoteiro">
                  <q-icon name="zoom_in" size="20px" />
                </button>
              </div>

              <div class="rot-scroll">
                <div class="rot-lista">
                  <div v-if="rotPartidaSolta" class="rot-item" :class="{ 'rot-item--ativo': marcado(rotPartidaSolta.id) }" @click="rotMarcar(rotPartidaSolta)">
                    <span class="rot-num rot-num--eu"><q-icon name="my_location" size="17px" /></span>
                    <div class="rot-info">
                      <div class="rot-top"><span class="rot-nota">{{ rotPartidaSolta.nome ?? 'Sua posição' }}</span></div>
                      <div class="rot-sub">Ponto de partida</div>
                    </div>
                  </div>

                  <template v-for="(p, i) in rotSequencia" :key="p.id">
                    <div v-if="rotPerna(i)" class="rot-perna">
                      <q-icon name="arrow_downward" size="12px" /> {{ rotPerna(i) }}
                    </div>
                    <div
                      class="rot-item"
                      :class="{ 'rot-item--ativo': marcado(p.id) }"
                      :data-id="p.id"
                      @click="rotMarcar(p)"
                      @mouseenter="realcar(p.id)"
                      @mouseleave="realcar(null)"
                    >
                      <button class="rot-num" :style="{ '--cor': corDe(p.notas[0]?.status) }" :aria-label="`Ir para a parada ${i + 1}`" @click.stop="rotFocarNoMapa(p)">{{ i + 1 }}</button>
                      <div class="rot-info">
                        <div class="rot-top">
                          <div class="rot-notas">
                            <button
                              v-for="n in p.notas.slice(0, 3)"
                              :key="n.nota"
                              class="rot-nota"
                              :class="{ 'rot-nota--link': permitirAbrir }"
                              :title="`${labelDe(n.status)}${permitirAbrir ? ' · abrir nota' : ''}`"
                              @click="permitirAbrir && emit('abrir', n)"
                            >
                              Nota {{ n.nota }}<i :style="{ background: corDe(n.status) }" /><q-icon v-if="permitirAbrir" name="open_in_new" size="14px" />
                            </button>
                            <span v-if="p.notas.length > 3" class="rot-mais">+{{ p.notas.length - 3 }}</span>
                          </div>
                          <div class="rot-acoes" @click.stop>
                            <a :href="urlPontoGoogle(p.lat, p.lng)" target="_blank" rel="noopener" title="Abrir no Google Maps" aria-label="Abrir no Google Maps"><q-icon name="map" size="18px" /></a>
                            <a :href="urlWaze(p.lat, p.lng)" target="_blank" rel="noopener" title="Navegar com Waze" aria-label="Navegar com Waze"><q-icon name="navigation" size="18px" /></a>
                            <button title="Tirar do roteiro" aria-label="Tirar do roteiro" @click="rotAlternar(p.id)"><q-icon name="remove_circle_outline" size="18px" /></button>
                          </div>
                        </div>
                        <div class="rot-sub">{{ rotLocal(p) }}</div>
                        <button class="rot-link" :class="{ 'rot-link--ok': copiado === p.id }" title="Copiar link" @click.stop="copiar(urlPontoGoogle(p.lat, p.lng), p.id)">
                          <span>{{ linkCurto(p.lat, p.lng) }}</span>
                          <q-icon :name="copiado === p.id ? 'check' : 'content_copy'" size="14px" />
                        </button>
                      </div>
                    </div>
                  </template>
                </div>

                <div v-if="rotForaDoRoteiro.length" class="rot-fora">
                  <div class="rot-fora-titulo">Fora do roteiro · {{ rotForaDoRoteiro.length }}</div>
                  <div v-for="p in rotForaDoRoteiro" :key="p.id" class="rot-fora-item">
                    <span>{{ p.notas.map(n => `Nota ${n.nota}`).join(', ') }}</span>
                    <button title="Incluir de volta" @click="rotAlternar(p.id)"><q-icon name="add_circle_outline" size="18px" /> Incluir</button>
                  </div>
                </div>
              </div>

              <div class="rot-rodape">
                <button
                  v-if="modo === 'campo' && rotSequencia.length"
                  class="rot-btn rot-btn--dia"
                  :class="{ 'rot-btn--dia-ok': rotJaNoDia }"
                  :disabled="rotJaNoDia"
                  @click="emit('planejar', rotCodigosNotas)"
                >
                  <q-icon :name="rotJaNoDia ? 'event_available' : 'event_note'" size="18px" />
                  {{ rotJaNoDia ? 'No seu dia' : `Atender ${rotCodigosNotas.length === 1 ? 'esta nota' : rotCodigosNotas.length + ' notas'} hoje` }}
                </button>
                <button class="rot-btn rot-btn--prim" :class="{ 'rot-btn--ok': copiado === 'todos' }" :disabled="!rotSequencia.length" @click="copiarTodos">
                  <q-icon :name="copiado === 'todos' ? 'check' : 'content_copy'" size="18px" />
                  {{ copiado === 'todos' ? 'Links copiados!' : `Copiar ${rotSequencia.length} ${rotSequencia.length === 1 ? 'link' : 'links'}` }}
                </button>
                <div class="rot-rodape-2">
                  <a v-if="rotSequencia.length" class="rot-btn rot-btn--zap" :href="urlWhatsApp(rotTexto)" target="_blank" rel="noopener">
                    <q-icon name="chat" size="18px" /> WhatsApp
                  </a>
                  <a v-if="rotTrechos.length === 1" class="rot-btn rot-btn--maps" :href="rotTrechos[0].url" target="_blank" rel="noopener">
                    <q-icon name="directions" size="18px" /> Rota no Maps
                  </a>
                  <button v-else-if="rotTrechos.length > 1" class="rot-btn rot-btn--maps">
                    <q-icon name="directions" size="18px" /> Rota no Maps
                    <q-menu anchor="top right" self="bottom right">
                      <q-list dense style="min-width: 230px">
                        <q-item-label header>Rota em {{ rotTrechos.length }} trechos</q-item-label>
                        <q-item v-for="(t, k) in rotTrechos" :key="k" clickable v-close-popup tag="a" :href="t.url" target="_blank" rel="noopener">
                          <q-item-section avatar><q-icon name="directions" /></q-item-section>
                          <q-item-section>Trecho {{ k + 1 }} · paradas {{ t.de }}–{{ t.ate }}</q-item-section>
                        </q-item>
                      </q-list>
                    </q-menu>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </transition>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useQuasar, copyToClipboard } from 'quasar'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { urlGoogleMaps, urlWaze, distanciaKm, formatarDistancia, formatarDuracao, buscarRota, buscarRotaMulti } from 'src/utils/rota'
import { ordenarRoteiro, trechosGoogle, urlPontoGoogle, linkCurto, urlWhatsApp } from 'src/utils/roteiro'
import { carregarMalha, chaveMunicipio, limitesDe } from 'src/utils/limites'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'

const props = defineProps({
  modelValue: Boolean,
  grupos: { type: Array, default: () => [] },
  // 'sistema': escritório | 'campo': PWA, com localização da equipe e botões de rota
  modo: { type: String, default: 'sistema' },
  // Nota a destacar ao abrir (centraliza e mostra os detalhes)
  foco: { type: String, default: null },
  rotuloAbrir: { type: String, default: 'Abrir nota' },
  permitirAbrir: { type: Boolean, default: true },
  baseInicial: { type: String, default: null },
  // 'sistema': cores dos status do sistema | 'programacao': status da planilha da supervisão
  esquema: { type: String, default: 'sistema' },
  // Notas que já estão no "Meu dia" da equipe (modo campo)
  planoNotas: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'abrir', 'planejar'])

const $q = useQuasar()
const compacto = computed(() => $q.screen.lt.sm)
const temHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches

const ESQUEMAS = {
  sistema: [
    { val: 'pendente',       label: 'Não Iniciado',   cor: '#9e9e9e' },
    { val: 'em_andamento',   label: 'Andamento',      cor: '#fb8c00' },
    { val: 'aguardando_etapa2', label: 'Aguardando Etapa 2', cor: '#8e24aa' },
    { val: 'baixar_medidor', label: 'Auditar', cor: '#1976d2' },
    { val: 'concluido',      label: 'Concluído',      cor: '#43a047' },
    { val: 'expurgo',        label: 'Expurgo',        cor: '#e53935' },
    { val: 'sem_acesso',     label: 'Sem Acesso',     cor: '#6d4c41' }
  ],
  programacao: [
    { val: 'PROGRAMADA',  label: 'Programada',  cor: '#1e88e5' },
    { val: 'ANDAMENTO',   label: 'Andamento',   cor: '#fb8c00' },
    { val: 'CONCLUIDA',   label: 'Concluída',   cor: '#43a047' },
    { val: 'REPROGRAMAR', label: 'Reprogramar', cor: '#8e24aa' },
    { val: 'CANCELAR',    label: 'Cancelar',    cor: '#90a4ae' }
  ]
}
const statusLista = () => ESQUEMAS[props.esquema] ?? ESQUEMAS.sistema
const corDe   = s => statusLista().find(x => x.val === s)?.cor ?? '#607d8b'
const labelDe = s => statusLista().find(x => x.val === s)?.label ?? s

const mapaEl  = ref(null)
const sheetEl = ref(null)
const busca   = ref('')
const camada  = ref('ruas')
const ocultos = ref(new Set())
const online  = ref(navigator.onLine)
const minhaPos = ref(null)
const erroGps  = ref('')
const painelAberto = ref(false)
const selecionado  = ref(null)
const seguindo     = ref(false)
const rota         = ref({ estado: null })
const arrasteY     = ref(0)
let mapa = null
let camadaMarcadores = null
let camadaDestaque = null
let camadaRota = null
let camadasBase = {}
let ajustouVisao = false
let marcadorEu = null
let circuloEu = null
let gpsWatch = null
let rumo = null
let ouvindoBussola = false
let seguirPrimeiraPosicao = false

// O plugin de agrupamento procura o Leaflet na variável global
let clusterPronto = null
function carregarCluster () {
  if (!clusterPronto) {
    window.L = L
    clusterPronto = Promise.all([
      import('leaflet.markercluster'),
      import('leaflet.markercluster/dist/MarkerCluster.css')
    ])
  }
  return clusterPronto
}

function atualizarOnline () { online.value = navigator.onLine }

const todasNotas = computed(() => props.grupos.flatMap(g => g._notas?.length ? g._notas : [g]))
const comCoordenada = computed(() => todasNotas.value.filter(n => Number.isFinite(n.latitude) && Number.isFinite(n.longitude)))
const semCoordenada = computed(() => todasNotas.value.filter(n => !Number.isFinite(n.latitude) || !Number.isFinite(n.longitude)))

// ── Filtro por área (base / município) ───────────────────────────
const filtroBase      = ref([])
const filtroMunicipio = ref(null)
const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Mapa da programação começa mostrando só o dia de hoje; limpar o campo mostra todas as datas
const filtroDatas = ref(props.esquema === 'programacao' ? [hojeISO()] : [])
const datasOpcoes = computed(() =>
  [...new Set(todasNotas.value.map(n => n.data_programada).filter(Boolean))].sort()
)
const dataBr = iso => iso.split('-').reverse().join('/')
const filtroEquipe = ref(null)
const equipesOpcoes = computed(() =>
  [...new Set(todasNotas.value.map(n => n.equipe).filter(Boolean))].sort()
)
const avisoArea       = ref('')
const areaAtual       = ref(null)
const buscaMunicipio  = ref('')
let camadaArea = null
let geracaoArea = 0
let municipiosDaArea = []

const filtrosAtivos = computed(() =>
  filtroBase.value.length + (filtroMunicipio.value ? 1 : 0) + (filtroEquipe.value ? 1 : 0) + ocultos.value.size
)

const basesOpcoes = computed(() =>
  [...new Set(todasNotas.value.map(n => n.base).filter(Boolean))].sort()
)
const municipiosOpcoes = computed(() =>
  [...new Set(todasNotas.value
    .filter(n => !filtroBase.value.length || filtroBase.value.includes(n.base))
    .map(n => n.municipio).filter(Boolean))].sort()
)
const municipiosOpcoesFiltradas = computed(() => {
  const q = chaveMunicipio(buscaMunicipio.value)
  return q ? municipiosOpcoes.value.filter(m => chaveMunicipio(m).includes(q)) : municipiosOpcoes.value
})
function filtrarMunicipios (val, update) {
  update(() => { buscaMunicipio.value = val })
}

const notasDaArea = computed(() => comCoordenada.value.filter(n =>
  (!filtroDatas.value.length || filtroDatas.value.includes(n.data_programada)) &&
  (!filtroEquipe.value || n.equipe === filtroEquipe.value) &&
  (!filtroBase.value.length || filtroBase.value.includes(n.base)) &&
  (!filtroMunicipio.value || chaveMunicipio(n.municipio) === chaveMunicipio(filtroMunicipio.value))
))

const contagem = computed(() => {
  const c = {}
  for (const n of notasDaArea.value) c[n.status] = (c[n.status] || 0) + 1
  return c
})

const statusVisiveis = computed(() => statusLista().filter(s => contagem.value[s.val] || ocultos.value.has(s.val)))

const notasNoMapa = computed(() => notasDaArea.value.filter(n => !ocultos.value.has(n.status)))

const distanciaSelecionado = computed(() => {
  if (!selecionado.value || !minhaPos.value) return ''
  const n = selecionado.value[0]
  return formatarDistancia(distanciaKm(minhaPos.value, { lat: n.latitude, lng: n.longitude }))
})

function resumoArea (notas) {
  const abertas = notas.filter(n => ['pendente', 'em_andamento', 'aguardando_etapa2', 'baixar_medidor'].includes(n.status)).length
  return `${notas.length} ${notas.length === 1 ? 'nota' : 'notas'} · ${abertas} em aberto`
}

function limparArea () {
  camadaArea?.remove()
  camadaArea = null
  areaAtual.value = null
  avisoArea.value = ''
  municipiosDaArea = []
}

async function desenharArea () {
  const geracao = ++geracaoArea
  limparArea()
  if (!mapa || (!filtroBase.value.length && !filtroMunicipio.value)) return

  const municipios = filtroMunicipio.value
    ? [filtroMunicipio.value]
    : todasNotas.value.filter(n => filtroBase.value.includes(n.base)).map(n => n.municipio)

  let res
  try {
    res = await limitesDe(municipios)
  } catch {
    if (geracao === geracaoArea) avisoArea.value = 'Não foi possível carregar os limites dos municípios.'
    return
  }
  if (geracao !== geracaoArea || !mapa) return

  const tituloBase = filtroBase.value.length === 1
    ? `Base ${filtroBase.value[0]}`
    : `${filtroBase.value.length} bases selecionadas`
  areaAtual.value = filtroMunicipio.value
    ? { titulo: filtroMunicipio.value, sub: resumoArea(notasDaArea.value) }
    : { titulo: tituloBase, sub: `${res.features.length} municípios · ${resumoArea(notasDaArea.value)}` }

  if (res.naoEncontrados.length) {
    avisoArea.value = `Sem limite oficial para: ${res.naoEncontrados.join(', ')}.`
  }
  if (!res.features.length) return

  camadaArea = L.layerGroup().addTo(mapa)

  // Escurece tudo fora da área: retângulo do mundo com "furos" nos polígonos da área
  const contorno = res.contorno ?? res.features[0]
  const poligonos = contorno.geometry.type === 'MultiPolygon'
    ? contorno.geometry.coordinates
    : [contorno.geometry.coordinates]
  const furos = poligonos.map(p => p[0].map(([lng, lat]) => [lat, lng]))
  L.polygon([[[-89, -179], [-89, 179], [89, 179], [89, -179]], ...furos], {
    pane: 'mascara', stroke: false, fillColor: '#0a1628', fillOpacity: 0.35, interactive: false
  }).addTo(camadaArea)

  // Divisas internas dos municípios da base; o clique é tratado em aoClicarMapa
  if (!filtroMunicipio.value && res.features.length > 1) {
    municipiosDaArea = res.features
    L.geoJSON({ type: 'FeatureCollection', features: res.features }, {
      pane: 'contorno',
      interactive: false,
      style: { color: '#1565c0', weight: 1, opacity: 0.7, dashArray: '4 4', fillColor: '#1565c0', fillOpacity: 0.03 }
    }).addTo(camadaArea)
    for (const f of res.features) {
      const centro = L.geoJSON(f).getBounds().getCenter()
      L.tooltip({ permanent: true, direction: 'center', className: 'mapa-mun-label', pane: 'rotulos' })
        .setLatLng(centro).setContent(f.properties.nome).addTo(camadaArea)
    }
  }

  const linha = L.geoJSON(contorno, {
    pane: 'contorno',
    interactive: false,
    style: { color: '#0d47a1', weight: 3.5, opacity: 0.95, fill: false }
  }).addTo(camadaArea)

  // A faixa com o nome da área muda a altura do mapa: recalcula antes de enquadrar
  await nextTick()
  if (!mapa) return
  mapa.invalidateSize()
  mapa.fitBounds(linha.getBounds(), { padding: compacto.value ? [12, 12] : [24, 24] })
  atualizarRotulos()
}

function atualizarRotulos () {
  const pane = mapa?.getPane('rotulos')
  if (pane) pane.style.display = mapa.getZoom() >= 9 ? '' : 'none'
}

function aoClicarMapa (e) {
  if (roteiro.value) return
  if (selecionado.value) { fecharSelecao(); return }
  if (!municipiosDaArea.length) return
  const ponto = [e.latlng.lng, e.latlng.lat]
  const f = municipiosDaArea.find(m => booleanPointInPolygon(ponto, m))
  if (!f) return
  const alvo = municipiosOpcoes.value.find(m => chaveMunicipio(m) === chaveMunicipio(f.properties.nome))
  if (alvo) filtroMunicipio.value = alvo
}

watch(filtroBase, () => {
  if (filtroMunicipio.value && !municipiosOpcoes.value.includes(filtroMunicipio.value)) filtroMunicipio.value = null
  else desenharArea()
}, { deep: true })
watch(filtroMunicipio, () => {
  if (compacto.value && filtroMunicipio.value) painelAberto.value = false
  desenharArea()
})

function alternarStatus (s) {
  const novo = new Set(ocultos.value)
  novo.has(s) ? novo.delete(s) : novo.add(s)
  ocultos.value = novo
}

// ── Detalhes da nota (gaveta inferior no celular, cartão no computador) ─
const chavePonto = (lat, lng) => `${lat.toFixed(6)},${lng.toFixed(6)}`

function notasNoPonto (lat, lng) {
  const k = chavePonto(lat, lng)
  const ordem = s => statusLista().findIndex(x => x.val === s)
  return notasNoMapa.value
    .filter(n => chavePonto(n.latitude, n.longitude) === k)
    .sort((a, b) => ordem(a.status) - ordem(b.status))
}

async function selecionar (notas) {
  if (!notas?.length || !mapa) return
  if (roteiro.value) fecharRoteiro()
  const mesmoPonto = selecionado.value?.[0]?.nota === notas[0].nota
  selecionado.value = notas
  seguindo.value = false
  const { latitude: lat, longitude: lng } = notas[0]
  camadaDestaque.clearLayers()
  L.marker([lat, lng], {
    icon: L.divIcon({
      className: 'mapa-pulso',
      html: `<span class="mapa-pulso-onda"></span><span class="mapa-pulso-onda mapa-pulso-onda--2"></span><span class="mapa-pulso-anel" style="--cor:${corDe(notas[0].status)}"></span>`,
      iconSize: [44, 44]
    }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 1000
  }).addTo(camadaDestaque)
  if (!mesmoPonto) calcularRota()

  // Garante que o ponto fique visível acima da gaveta
  await nextTick()
  if (!mapa) return
  const altura = mapa.getSize().y
  const sheet = sheetEl.value?.offsetHeight ?? 0
  const visivel = compacto.value ? altura - sheet : altura
  const pt = mapa.latLngToContainerPoint([lat, lng])
  const alvoY = compacto.value ? visivel / 2 : Math.min(Math.max(pt.y, 60), altura - 60)
  const alvoX = Math.min(Math.max(pt.x, 50), mapa.getSize().x - 50)
  if (Math.abs(pt.y - alvoY) > 8 || Math.abs(pt.x - alvoX) > 8) {
    mapa.panBy([pt.x - alvoX, pt.y - alvoY], { animate: true })
  }
}

function fecharSelecao () {
  selecionado.value = null
  arrasteY.value = 0
  camadaDestaque?.clearLayers()
  limparRota()
}

// ── Rota de carro até a nota selecionada (modo campo) ───────────
let rotaAbort = null
let rotaOrigem = null
let rotaLinha = null
const cacheRotas = new Map()

function limparRota () {
  rotaAbort?.abort()
  rotaAbort = null
  rotaOrigem = null
  rotaLinha = null
  camadaRota?.clearLayers()
  rota.value = { estado: null }
}

async function calcularRota () {
  limparRota()
  if (props.modo !== 'campo' || !minhaPos.value || !selecionado.value || !navigator.onLine) return
  const n = selecionado.value[0]
  const origem = { lat: minhaPos.value.lat, lng: minhaPos.value.lng }
  // O servidor público não atende trajetos muito longos com rapidez
  if (distanciaKm(origem, { lat: n.latitude, lng: n.longitude }) > 400) return

  const chave = `${n.nota}|${origem.lat.toFixed(3)},${origem.lng.toFixed(3)}`
  rotaOrigem = origem
  rota.value = { estado: 'carregando' }
  let res = cacheRotas.get(chave)
  if (!res) {
    rotaAbort = new AbortController()
    try {
      res = await buscarRota(origem, { lat: n.latitude, lng: n.longitude }, rotaAbort.signal)
      cacheRotas.set(chave, res)
    } catch (e) {
      if (e.name !== 'AbortError') rota.value = { estado: 'erro' }
      return
    }
  }
  if (!mapa || selecionado.value?.[0]?.nota !== n.nota) return
  rota.value = { estado: 'ok', km: res.km, minutos: res.minutos }
  desenharRota(res.pontos)
}

function desenharRota (pontos) {
  camadaRota.clearLayers()
  const renderer = L.svg({ pane: 'rota' })
  L.polyline(pontos, { renderer, pane: 'rota', color: '#fff', weight: 9, opacity: 0.9, interactive: false, className: 'mapa-rota-linha mapa-rota-linha--borda' }).addTo(camadaRota)
  rotaLinha = L.polyline(pontos, { renderer, pane: 'rota', color: '#1e88e5', weight: 5, opacity: 1, interactive: false, className: 'mapa-rota-linha' }).addTo(camadaRota)
  // pathLength = 1 permite animar o "desenho" da linha com CSS, qualquer que seja o tamanho
  camadaRota.eachLayer(l => l.getElement()?.setAttribute('pathLength', '1'))
}

function enquadrarRota () {
  if (!mapa || !rotaLinha) return
  const sheet = compacto.value ? (sheetEl.value?.offsetHeight ?? 0) : 0
  const lateral = !compacto.value && sheetEl.value ? sheetEl.value.offsetWidth + 24 : 30
  mapa.flyToBounds(rotaLinha.getBounds(), {
    paddingTopLeft: [lateral, 30],
    paddingBottomRight: [30, sheet + 30],
    maxZoom: 17,
    duration: 0.9
  })
}

// ── Arrastar a gaveta para baixo fecha os detalhes ─────────────
let arrasteInicio = null
function iniciarArraste (e) {
  if (!compacto.value || sheetEl.value?.scrollTop > 0) { arrasteInicio = null; return }
  arrasteInicio = e.touches[0].clientY
}
function moverArraste (e) {
  if (arrasteInicio == null) return
  const dy = e.touches[0].clientY - arrasteInicio
  if (dy > 0) {
    arrasteY.value = dy
    if (e.cancelable) e.preventDefault()
  } else {
    arrasteY.value = 0
  }
}
function soltarArraste () {
  if (arrasteInicio == null) return
  arrasteInicio = null
  if (arrasteY.value > 90) {
    const el = sheetEl.value
    if (el) { el.style.transition = 'transform 0.2s ease-in'; el.style.transform = 'translateY(100%)' }
    fecharSelecao()
  } else {
    arrasteY.value = 0
  }
}

function selecionarNoPonto (lat, lng) {
  selecionar(notasNoPonto(lat, lng))
}

// ── Roteiro: clicar numa bolha separa os pontos, ordena e gera os links ──
const LIMITE_ROTEIRO = 200
const roteiro = ref(null)
const rotOrdem = ref('otima')
const rotInvertido = ref(false)
// Partida e chegada escolhidas pelo usuário (null = posição atual e ordem mais curta)
const rotDe = ref(null)
const rotPara = ref(null)
const buscaDe = ref('')
const buscaPara = ref('')

// Cada ponto do mapa com notas, para escolher como partida ou chegada
const pontosDoMapa = computed(() => {
  const m = new Map()
  for (const n of comCoordenada.value) {
    const id = chavePonto(n.latitude, n.longitude)
    if (!m.has(id)) m.set(id, { id, lat: n.latitude, lng: n.longitude, notas: [] })
    m.get(id).notas.push(n)
  }
  return [...m.values()]
    .map(p => {
      const rotulo = `Nota ${p.notas.map(n => n.nota).join(', ')}${p.notas[0].municipio ? ' · ' + p.notas[0].municipio : ''}`
      const busca = [rotulo, ...p.notas.map(n => n.projeto_info_sap)].join(' ').toLowerCase()
      return { ...p, rotulo, busca }
    })
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, undefined, { numeric: true }))
})
function pontosFiltrados (q, excluir) {
  return pontosDoMapa.value.filter(p => p.id !== excluir?.id && (!q || p.busca.includes(q))).slice(0, 200)
}
// Municípios do Maranhão como ponto de partida livre (ponto médio do contorno)
const municipiosMapa = ref([])
function centroDe (geom) {
  let soma = { lat: 0, lng: 0 }, n = 0
  const varre = c => {
    if (typeof c[0] === 'number') { soma.lng += c[0]; soma.lat += c[1]; n++ } else c.forEach(varre)
  }
  varre(geom.coordinates)
  return { lat: soma.lat / n, lng: soma.lng / n }
}
async function carregarMunicipios () {
  if (municipiosMapa.value.length) return
  const malha = await carregarMalha()
  municipiosMapa.value = [...malha.values()].map(f => {
    const c = centroDe(f.geometry)
    const nome = f.properties.nome
    const rotulo = `Município · ${nome}`
    return { id: `mun:${chaveMunicipio(nome)}`, lat: c.lat, lng: c.lng, notas: [], nome, rotulo, busca: rotulo.toLowerCase() }
  })
}
function municipiosFiltrados (q, excluir) {
  return municipiosMapa.value.filter(p => p.id !== excluir?.id && p.busca.includes(q)).slice(0, 60)
}

// Local digitado livremente (rua, posto, bairro): busca no OpenStreetMap, restrita ao Maranhão
const locaisBusca = ref([])
let buscaLocalTimer = null
let buscaLocalAbort = null
watch(buscaDe, texto => {
  clearTimeout(buscaLocalTimer)
  buscaLocalAbort?.abort()
  locaisBusca.value = []
  if (texto.length < 3 || !navigator.onLine) return
  buscaLocalTimer = setTimeout(async () => {
    buscaLocalAbort = new AbortController()
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&q=${encodeURIComponent(`${texto}, Maranhão`)}`
      const r = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' }, signal: buscaLocalAbort.signal })
      const lista = await r.json()
      locaisBusca.value = lista
        .filter(x => /Maranh/i.test(x.display_name))
        .map(x => {
          const nome = x.display_name.split(',').slice(0, 2).join(',').trim()
          const rotulo = `Local · ${nome}`
          return { id: `local:${Number(x.lat).toFixed(5)},${Number(x.lon).toFixed(5)}`, lat: Number(x.lat), lng: Number(x.lon), notas: [], nome, rotulo, busca: rotulo.toLowerCase() }
        })
    } catch (e) {
      if (e.name !== 'AbortError') locaisBusca.value = []
    }
  }, 500)
})

// Opções da partida: notas do mapa, municípios e locais encontrados pela busca digitada
const opcoesDe = computed(() => {
  const q = buscaDe.value
  return [
    ...pontosFiltrados(q, rotPara.value),
    ...(q ? municipiosFiltrados(q, rotPara.value) : []),
    ...locaisBusca.value
  ]
})
const opcoesPara = computed(() => pontosFiltrados(buscaPara.value, rotDe.value))

// Distância por estrada entre dois pontos; espera a seleção parar de mudar antes de consultar a rota
function criarMedidor () {
  const resultado = ref(null)
  let timer = null
  let abort = null
  const parar = () => { clearTimeout(timer); abort?.abort(); resultado.value = null }
  const medir = (a, b) => {
    parar()
    if (!a || !b) return
    resultado.value = { estado: 'carregando' }
    timer = setTimeout(async () => {
      if (!navigator.onLine) { resultado.value = { estado: 'reta' }; return }
      abort = new AbortController()
      try {
        const r = await buscarRota(a, b, abort.signal)
        resultado.value = { estado: 'ok', km: r.km, minutos: r.minutos, pontos: r.pontos }
      } catch (e) {
        if (e.name !== 'AbortError') resultado.value = { estado: 'reta' }
      }
    }, 350)
  }
  return { resultado, medir, parar }
}

// Distância entre a partida e a chegada escolhidas: em linha reta na hora e por estrada quando a rota chega
const distanciaReta = computed(() => rotDe.value && rotPara.value ? distanciaKm(rotDe.value, rotPara.value) : null)
const medidorDeAPara = criarMedidor()
const distanciaPorEstrada = medidorDeAPara.resultado
watch([rotDe, rotPara], ([de, para]) => medidorDeAPara.medir(de, para))

// Pontos marcados na lista do roteiro (vários, na ordem em que foram marcados)
const rotMarcados = ref([])
const medidorMarcados = criarMedidor()
const distanciaMarcados = medidorMarcados.resultado
const distanciaMarcadosReta = computed(() =>
  rotMarcados.value.length === 2 ? distanciaKm(rotMarcados.value[0], rotMarcados.value[1]) : null)
const pontoGps = computed(() => roteiro.value?.origem
  ? { id: 'gps', lat: roteiro.value.origem.lat, lng: roteiro.value.origem.lng, notas: [] }
  : null)
const marcado = id => rotMarcados.value.some(m => m.id === id)
const rotuloPonto = p => p.notas?.length ? `Nota ${p.notas[0].nota}` : (p.nome ?? 'Sua posição')
// Ponto de partida que não é parada da lista: a posição atual ou um local livre escolhido em De
const rotPartidaSolta = computed(() => rotDe.value
  ? (rotDe.value.notas.length ? null : rotDe.value)
  : pontoGps.value)
function rotMarcar (p) {
  if (!p) return
  rotMarcados.value = marcado(p.id) ? rotMarcados.value.filter(m => m.id !== p.id) : [...rotMarcados.value, p]
  if (marcado(p.id)) {
    nextTick(() => {
      const el = [...(rotEl.value?.querySelectorAll('[data-id]') ?? [])].find(e => e.dataset.id === p.id)
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }
}
function limparMarcados () { rotMarcados.value = [] }
watch(rotMarcados, m => {
  desenharRoteiro()
  if (m.length === 2) medidorMarcados.medir(m[0], m[1])
  else medidorMarcados.parar()
})
// A rota por estrada entre os dois pontos marcados aparece no mapa quando chega
watch(() => medidorMarcados.resultado.value, () => desenharRoteiro())
function filtrarPontos (campo, val, update) {
  update(() => { (campo === 'de' ? buscaDe : buscaPara).value = val.trim().toLowerCase() })
}
const rotExcluidas = ref(new Set())
const rotReal = ref({ estado: null })
const copiado = ref('')
const rotEl = ref(null)
let camadaRoteiro = null
let rendererRoteiro = null
let rotRealPontos = null
let rotTimer = null
let rotAbort = null
let copiadoTimer = null
let rotRealcado = null
let rotAnimar = false
let rotGeracao = 0
const rotLocalizando = ref(false)
const rotSemGps = ref('')
const rotMarcadores = new Map()
const cacheRotasMulti = new Map()

const porNotaParada = (a, b) =>
  String(a.notas[0]?.nota).localeCompare(String(b.notas[0]?.nota), undefined, { numeric: true })

const rotAtivas = computed(() =>
  roteiro.value ? roteiro.value.paradas.filter(p => !rotExcluidas.value.has(p.id)) : [])
const rotForaDoRoteiro = computed(() =>
  roteiro.value ? roteiro.value.paradas.filter(p => rotExcluidas.value.has(p.id)) : [])

const rotSequencia = computed(() => {
  if (!roteiro.value || roteiro.value.grande) return []
  // Partida e chegada escolhidas ficam fixas; as demais paradas são ordenadas entre elas
  const fixos = new Set([rotDe.value?.id, rotPara.value?.id])
  const livres = rotAtivas.value.filter(p => !fixos.has(p.id))
  const meio = rotOrdem.value === 'otima'
    ? ordenarRoteiro(livres, rotDe.value ?? roteiro.value.origem, rotPara.value)
    : [...livres].sort(porNotaParada)
  // Partida só entra na lista quando é uma nota; posição atual e locais livres são só o ponto de saída
  const seq = [...(rotDe.value?.notas.length ? [rotDe.value] : []), ...meio, ...(rotPara.value ? [rotPara.value] : [])]
  return rotInvertido.value && !rotDe.value && !rotPara.value ? seq.reverse() : seq
})

// Origem (posição atual, se não houver partida escolhida) + paradas, na ordem em que serão percorridas
const rotPontos = computed(() => [...(rotPartidaSolta.value ? [rotPartidaSolta.value] : []), ...rotSequencia.value])
const rotOffset = computed(() => rotPontos.value.length - rotSequencia.value.length)
const rotNotas = computed(() => rotSequencia.value.flatMap(p => p.notas))
const rotPostes = computed(() => rotNotas.value.reduce((s, n) => s + (Number(n.postes) || 0), 0))
const rotMix = computed(() => {
  const c = {}
  for (const n of rotNotas.value) c[n.status] = (c[n.status] || 0) + 1
  return statusLista().filter(s => c[s.val]).map(s => ({ ...s, qtd: c[s.val] }))
})
const rotKmReta = computed(() => {
  const pts = rotPontos.value
  let t = 0
  for (let k = 1; k < pts.length; k++) t += distanciaKm(pts[k - 1], pts[k])
  return t
})
const rotTotais = computed(() => {
  const r = rotReal.value
  if (r.estado === 'ok') return { real: true, km: formatarDistancia(r.km), tempo: formatarDuracao(r.minutos) }
  return { real: false, km: rotSequencia.value.length > 1 || roteiro.value?.origem ? `≈ ${formatarDistancia(rotKmReta.value)}` : '—', tempo: '—' }
})
const rotSubtitulo = computed(() => {
  const base = rotOrdem.value === 'otima' ? 'sequência mais curta' : 'ordem por número da nota'
  const partida = rotDe.value
    ? (rotDe.value.notas.length ? `de nota ${rotDe.value.notas[0].nota}` : `de ${rotDe.value.nome}`)
    : (roteiro.value?.origem ? 'saindo de você' : '')
  const chegada = rotPara.value ? `até nota ${rotPara.value.notas[0].nota}` : ''
  if (partida || chegada) return [base, partida, chegada].filter(Boolean).join(' · ')
  if (roteiro.value?.origem) return `${base} · saindo de você`
  if (rotLocalizando.value) return `${base} · obtendo sua localização…`
  return rotSemGps.value ? `${base} · sem sua localização` : base
})
const rotCodigosNotas = computed(() => rotNotas.value.map(n => n.nota))
const rotJaNoDia = computed(() => {
  const no = new Set(props.planoNotas)
  return rotCodigosNotas.value.length > 0 && rotCodigosNotas.value.every(c => no.has(c))
})
const rotTrechos = computed(() =>
  rotDe.value && !rotDe.value.notas.length
    ? trechosGoogle([rotDe.value, ...rotSequencia.value])
    : trechosGoogle(rotSequencia.value, { daPosicaoAtual: !!roteiro.value?.origem && !rotDe.value }))

// Equipes distintas das notas de um ponto, para mostrar junto do número da nota
function equipesDe (notas) {
  return [...new Set(notas.map(n => n.equipe).filter(Boolean))].join(', ')
}

function rotLocal (p) {
  const mun = p.notas[0]?.municipio
  const postes = p.notas.reduce((s, n) => s + (Number(n.postes) || 0), 0)
  const equipes = [...new Set(p.notas.map(n => n.equipe).filter(Boolean))].join(', ')
  return `${mun ? mun + ' · ' : ''}${equipes ? equipes + ' · ' : ''}${postes} ${postes === 1 ? 'poste' : 'postes'}`
}

function rotPerna (i) {
  const k = i + rotOffset.value - 1
  if (k < 0) return ''
  const r = rotReal.value
  if (r.estado === 'ok' && r.pernas?.[k]) return `${formatarDistancia(r.pernas[k].km)} · ${formatarDuracao(r.pernas[k].minutos)}`
  const pts = rotPontos.value
  return `≈ ${formatarDistancia(distanciaKm(pts[k], pts[k + 1]))} em linha reta`
}

const rotTexto = computed(() => {
  const seq = rotSequencia.value
  const linhas = [`Roteiro CGB · ${seq.length} ${seq.length === 1 ? 'parada' : 'paradas'}`]
  if (rotTotais.value.real) linhas.push(`${rotTotais.value.km} · ${rotTotais.value.tempo} de carro`)
  linhas.push('')
  seq.forEach((p, i) => {
    const mun = p.notas[0]?.municipio
    linhas.push(`${i + 1}) Nota ${p.notas.map(n => n.nota).join(', ')}${mun ? ` · ${mun}` : ''}`)
    linhas.push(urlPontoGoogle(p.lat, p.lng), '')
  })
  return linhas.join('\n').trim()
})

// A API de área de transferência exige contexto seguro e permissão; o textarea temporário cobre o resto
function copiarComTextarea (texto) {
  const ta = document.createElement('textarea')
  ta.value = texto
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
  document.body.appendChild(ta)
  ta.select()
  ta.setSelectionRange(0, texto.length)
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  ta.remove()
  return ok
}

async function copiar (texto, chave) {
  try { await copyToClipboard(texto) } catch {
    if (!copiarComTextarea(texto)) {
      $q.notify({ type: 'negative', message: 'Não foi possível copiar. Selecione e copie manualmente.', position: 'top', timeout: 2500 })
      return
    }
  }
  copiado.value = chave
  clearTimeout(copiadoTimer)
  copiadoTimer = setTimeout(() => { copiado.value = '' }, 1800)
}
const copiarTodos = () => copiar(rotTexto.value, 'todos')

function rotAlternar (id) {
  rotMarcados.value = rotMarcados.value.filter(m => m.id !== id)
  const novo = new Set(rotExcluidas.value)
  novo.has(id) ? novo.delete(id) : novo.add(id)
  rotExcluidas.value = novo
}

function realcar (id) {
  rotRealcado?.getElement()?.firstElementChild?.classList.remove('rot-pin--realce')
  rotRealcado = id != null ? rotMarcadores.get(id) : null
  rotRealcado?.getElement()?.firstElementChild?.classList.add('rot-pin--realce')
}

function marcarAtivo () {
  for (const [id, m] of rotMarcadores) {
    m.getElement()?.firstElementChild?.classList.toggle('rot-pin--ativo', marcado(id))
  }
}

function rotFocarNoMapa (p) {
  const lateral = !compacto.value && rotEl.value ? rotEl.value.offsetWidth + 24 : 0
  const base = compacto.value ? (rotEl.value?.offsetHeight ?? 0) : 0
  const alvo = L.latLng(p.lat, p.lng)
  const zoom = Math.max(mapa.getZoom(), 15)
  // Desloca o centro para o ponto cair na área livre, fora do painel
  const pt = mapa.project(alvo, zoom).add([-lateral / 2, base / 2])
  mapa.flyTo(mapa.unproject(pt, zoom), zoom, { duration: 0.7 })
}


function desenharRoteiro () {
  camadaRoteiro?.clearLayers()
  rotMarcadores.clear()
  rotRealcado = null
  if (!mapa || !roteiro.value || roteiro.value.grande) return

  const seq = rotSequencia.value
  // Com dois pontos marcados, o roteiro inteiro sai do mapa e fica só o trecho entre eles
  const soPar = rotMarcados.value.length === 2
  const pts = soPar ? [] : rotPontos.value.map(p => [p.lat, p.lng])
  if (!soPar && rotReal.value.estado === 'ok' && rotRealPontos) {
    const base = { renderer: rendererRoteiro, pane: 'roteiroLinha', interactive: false }
    L.polyline(rotRealPontos, { ...base, color: '#fff', weight: 9, opacity: 0.9, className: 'mapa-rota-linha mapa-rota-linha--borda' }).addTo(camadaRoteiro)
    L.polyline(rotRealPontos, { ...base, color: '#1e88e5', weight: 5, opacity: 1, className: 'mapa-rota-linha' }).addTo(camadaRoteiro)
    // pathLength = 1 permite animar o "desenho" da linha com CSS
    camadaRoteiro.eachLayer(l => l.getElement()?.setAttribute('pathLength', '1'))
  } else if (pts.length > 1) {
    L.polyline(pts, {
      renderer: rendererRoteiro, pane: 'roteiroLinha', interactive: false,
      color: '#1e88e5', weight: 4, opacity: 0.9, dashArray: '1 10', lineCap: 'round', className: 'rot-linha-reta'
    }).addTo(camadaRoteiro)
  }

  // No modo campo a bolinha azul da equipe já está no mapa
  const origem = rotPartidaSolta.value
  if (origem && !marcadorEu && rotMarcados.value.length !== 2) {
    L.marker([origem.lat, origem.lng], {
      icon: L.divIcon({
        className: 'mapa-eu',
        html: '<span class="mapa-eu-pulso"></span><span class="mapa-eu-ponto"></span>',
        iconSize: [64, 64]
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 900
    }).addTo(camadaRoteiro)
  }

  // Entre dois pontos marcados: rota por estrada, ou linha reta tracejada enquanto ela não chega
  const par = medidorMarcados.resultado.value
  if (soPar) {
    const [a, b] = rotMarcados.value
    const porEstrada = par?.estado === 'ok' && par.pontos
    L.polyline(porEstrada ? par.pontos : [[a.lat, a.lng], [b.lat, b.lng]], {
      renderer: rendererRoteiro, pane: 'roteiroLinha', interactive: false,
      color: '#f57c00', weight: 5, opacity: 0.95, lineCap: 'round',
      dashArray: porEstrada ? null : '2 8'
    }).addTo(camadaRoteiro)
  }

  const ultimo = seq.length - 1
  const animar = rotAnimar
  rotAnimar = false
  seq.forEach((p, i) => {
    const cls = `rot-pin${animar ? ' rot-pin--anim' : ''}${i === 0 ? ' rot-pin--ini' : ''}${i === ultimo && ultimo > 0 ? ' rot-pin--fim' : ''}`
    const m = L.marker([p.lat, p.lng], {
      pane: 'roteiroPontos',
      keyboard: false,
      icon: L.divIcon({
        className: 'rot-pin-wrap',
        html: `<span class="${cls}" style="--cor:${corDe(p.notas[0]?.status)};animation-delay:${Math.min(i * 35, 700)}ms">${i + 1}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    })
    const equipe = equipesDe(p.notas)
    const titulo = p.notas.map(n => `Nota ${n.nota}`).join(', ')
    if (temHover) m.bindTooltip(equipe ? `${titulo}<br>Equipe ${equipe}` : titulo, { direction: 'top', offset: [0, -14] })
    m.on('click', () => rotMarcar(p))
    m.addTo(camadaRoteiro)
    rotMarcadores.set(p.id, m)
  })
  marcarAtivo()
}

// A rota por estrada chega depois; enquanto isso vale a linha reta entre as paradas
function agendarRotaReal () {
  clearTimeout(rotTimer)
  rotAbort?.abort()
  rotAbort = null
  rotRealPontos = null
  const pts = rotPontos.value
  if (!roteiro.value || roteiro.value.grande || pts.length < 2) {
    rotReal.value = { estado: null }
    desenharRoteiro()
    return
  }
  if (!navigator.onLine || pts.length > 90) {
    rotReal.value = { estado: 'reta' }
    desenharRoteiro()
    return
  }
  const chave = pts.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')
  const cache = cacheRotasMulti.get(chave)
  if (cache) { aplicarRotaReal(cache); return }
  rotReal.value = { estado: 'carregando' }
  desenharRoteiro()
  rotTimer = setTimeout(async () => {
    rotAbort = new AbortController()
    try {
      const res = await buscarRotaMulti(pts, rotAbort.signal)
      cacheRotasMulti.set(chave, res)
      aplicarRotaReal(res)
    } catch (e) {
      if (e.name !== 'AbortError') { rotReal.value = { estado: 'reta' }; desenharRoteiro() }
    }
  }, 350)
}

function aplicarRotaReal (res) {
  rotRealPontos = res.pontos
  rotReal.value = { estado: 'ok', km: res.km, minutos: res.minutos, pernas: res.pernas }
  desenharRoteiro()
}

function enquadrarRoteiro (duracao = 0.9) {
  if (!mapa || !roteiro.value) return
  const pts = (roteiro.value.grande ? roteiro.value.paradas : rotPontos.value).map(p => [p.lat, p.lng])
  if (!pts.length) return
  const el = rotEl.value
  const lateral = !compacto.value && el ? el.offsetWidth + 24 : 30
  const base = compacto.value ? (el?.offsetHeight ?? 0) : 0
  mapa.flyToBounds(L.latLngBounds(pts), {
    paddingTopLeft: [lateral, 40],
    paddingBottomRight: [40, base + 30],
    maxZoom: 17,
    duration: duracao
  })
}

function abrirRoteiroDoPonto (lat, lng) {
  const notas = notasNoPonto(lat, lng)
  if (!notas.length) return
  abrirRoteiroDe([{ id: chavePonto(lat, lng), lat, lng, notas }], L.latLngBounds([[lat, lng]]))
}

function abrirRoteiro (cluster) {
  const paradas = cluster.getAllChildMarkers().map(m => {
    const { lat, lng } = m.getLatLng()
    return { id: chavePonto(lat, lng), lat, lng, notas: m.options.notasPonto ?? [] }
  })
  abrirRoteiroDe(paradas, cluster.getBounds())
}

async function abrirRoteiroDe (paradas, bounds) {
  if (!mapa) return
  fecharSelecao()
  rotOrdem.value = 'otima'
  rotInvertido.value = false
  rotDe.value = null
  rotPara.value = null
  carregarMunicipios()
  buscaDe.value = ''
  buscaPara.value = ''
  rotExcluidas.value = new Set()
  rotMarcados.value = []
  copiado.value = ''
  rotAnimar = true
  const geracao = ++rotGeracao
  rotSemGps.value = ''
  roteiro.value = {
    paradas,
    grande: paradas.length > LIMITE_ROTEIRO,
    bounds,
    // Fixa a posição de partida na abertura: o GPS atualiza sempre e embaralharia a sequência
    origem: minhaPos.value ? { lat: minhaPos.value.lat, lng: minhaPos.value.lng } : null
  }
  if (!roteiro.value.origem && !roteiro.value.grande) obterOrigem(geracao)
  await nextTick()
  enquadrarRoteiro()
}

// O roteiro parte de onde o usuário está agora; sem permissão, usa o ponto mais conveniente
function obterOrigem (geracao) {
  if (!navigator.geolocation) { rotSemGps.value = 'sem localização'; return }
  rotLocalizando.value = true
  navigator.geolocation.getCurrentPosition(
    pos => {
      rotLocalizando.value = false
      if (geracao !== rotGeracao || !roteiro.value) return
      roteiro.value = { ...roteiro.value, origem: { lat: pos.coords.latitude, lng: pos.coords.longitude } }
      nextTick(() => enquadrarRoteiro())
    },
    () => {
      rotLocalizando.value = false
      if (geracao === rotGeracao) rotSemGps.value = 'sem localização'
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
  )
}

function ampliarRoteiro () {
  const bounds = roteiro.value?.bounds
  fecharRoteiro()
  if (bounds && mapa) mapa.flyToBounds(bounds, { padding: [50, 50], maxZoom: 17, duration: 0.8 })
}

function fecharRoteiro () {
  medidorDeAPara.parar()
  medidorMarcados.parar()
  clearTimeout(rotTimer)
  rotAbort?.abort()
  rotAbort = null
  rotRealPontos = null
  rotGeracao++
  rotLocalizando.value = false
  roteiro.value = null
  rotReal.value = { estado: null }
  rotMarcados.value = []
  camadaRoteiro?.clearLayers()
  rotMarcadores.clear()
  rotRealcado = null
}

watch(rotSequencia, agendarRotaReal)
watch([filtroBase, filtroMunicipio, ocultos], () => { if (roteiro.value) fecharRoteiro() }, { deep: true })

function moverESelecionar (mover, n) {
  mapa.once('moveend', () => setTimeout(() => selecionarNoPonto(n.latitude, n.longitude), 30))
  mover()
}

function irParaNota (n, zoom = 16) {
  if (!mapa || !n) return
  moverESelecionar(() => mapa.flyTo([n.latitude, n.longitude], zoom, { duration: 0.9 }), n)
}

// ── Localização da equipe (modo campo) ──────────────────────────
function iniciarGps () {
  if (props.modo !== 'campo' || gpsWatch != null) return
  if (!navigator.geolocation) { erroGps.value = 'Este aparelho não informa a localização.'; return }
  gpsWatch = navigator.geolocation.watchPosition(
    pos => {
      erroGps.value = ''
      const { latitude, longitude, accuracy, heading, speed } = pos.coords
      minhaPos.value = { lat: latitude, lng: longitude, precisao: accuracy }
      // Em movimento, o rumo do GPS é mais confiável que a bússola
      if (Number.isFinite(heading) && speed > 1.5) atualizarRumo(heading)
      desenharEu()
      if (seguirPrimeiraPosicao) { seguirPrimeiraPosicao = false; centralizarEmMim() }
      else if (seguindo.value) mapa?.panTo([latitude, longitude], { animate: true, duration: 0.6 })
      if (rotaOrigem && distanciaKm(rotaOrigem, minhaPos.value) > 0.5) calcularRota()
      else if (selecionado.value && !rotaOrigem && rota.value.estado == null) calcularRota()
    },
    err => {
      erroGps.value = err.code === 1
        ? 'Localização bloqueada. Permita o acesso à localização para ver onde você está.'
        : 'Não foi possível obter sua localização agora.'
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  )
}

function pararGps () {
  if (gpsWatch != null) navigator.geolocation.clearWatch(gpsWatch)
  gpsWatch = null
  pararBussola()
}

// ── Direção para onde a pessoa está virada (bússola do aparelho) ─
function aoGirarAparelho (e) {
  let h = null
  if (Number.isFinite(e.webkitCompassHeading)) h = e.webkitCompassHeading
  else if (e.absolute && Number.isFinite(e.alpha)) h = 360 - e.alpha
  if (h != null) atualizarRumo(h)
}

async function iniciarBussola () {
  if (ouvindoBussola || typeof window.DeviceOrientationEvent === 'undefined') return
  // iPhone exige permissão, pedida a partir de um toque do usuário
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      if (await DeviceOrientationEvent.requestPermission() !== 'granted') return
    } catch { return }
  }
  ouvindoBussola = true
  window.addEventListener('deviceorientationabsolute', aoGirarAparelho)
  window.addEventListener('deviceorientation', aoGirarAparelho)
}

function pararBussola () {
  if (!ouvindoBussola) return
  ouvindoBussola = false
  window.removeEventListener('deviceorientationabsolute', aoGirarAparelho)
  window.removeEventListener('deviceorientation', aoGirarAparelho)
}

function atualizarRumo (h) {
  rumo = ((h % 360) + 360) % 360
  const cone = marcadorEu?.getElement()?.querySelector('.mapa-eu-cone')
  if (cone) {
    cone.style.opacity = '1'
    cone.style.transform = `rotate(${rumo}deg)`
  }
}

function desenharEu () {
  if (!mapa || !minhaPos.value) return
  const { lat, lng, precisao } = minhaPos.value
  if (!marcadorEu) {
    circuloEu = L.circle([lat, lng], { radius: precisao, color: '#1e88e5', weight: 1, opacity: 0.5, fillOpacity: 0.1, interactive: false }).addTo(mapa)
    marcadorEu = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'mapa-eu',
        html: '<span class="mapa-eu-cone"></span><span class="mapa-eu-pulso"></span><span class="mapa-eu-ponto"></span>',
        iconSize: [64, 64]
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 900
    }).addTo(mapa)
    if (rumo != null) atualizarRumo(rumo)
  } else {
    marcadorEu.setLatLng([lat, lng])
    circuloEu.setLatLng([lat, lng]).setRadius(precisao)
  }
}

function centralizarEmMim () {
  iniciarBussola()
  if (!minhaPos.value) { seguirPrimeiraPosicao = true; iniciarGps(); return }
  seguindo.value = true
  mapa?.flyTo([minhaPos.value.lat, minhaPos.value.lng], Math.max(mapa.getZoom(), 16), { duration: 0.8 })
}

function irParaMaisProxima () {
  if (!minhaPos.value || !notasNoMapa.value.length) return
  let melhor = null, menor = Infinity
  for (const n of notasNoMapa.value) {
    const d = distanciaKm(minhaPos.value, { lat: n.latitude, lng: n.longitude })
    if (d < menor) { menor = d; melhor = n }
  }
  if (!melhor) return
  moverESelecionar(() => mapa.flyToBounds(
    L.latLngBounds([[minhaPos.value.lat, minhaPos.value.lng], [melhor.latitude, melhor.longitude]]),
    { padding: [60, 60], maxZoom: 16, duration: 1 }
  ), melhor)
}

function desenharMarcadores () {
  if (!mapa) return
  camadaMarcadores.clearLayers()

  // Notas no mesmo ponto viram um único marcador
  const porPonto = new Map()
  for (const n of notasNoMapa.value) {
    const k = chavePonto(n.latitude, n.longitude)
    if (!porPonto.has(k)) porPonto.set(k, [])
    porPonto.get(k).push(n)
  }

  const ordem = s => statusLista().findIndex(x => x.val === s)
  const raio = compacto.value ? 9 : 7
  const marcadores = []
  for (const notas of porPonto.values()) {
    const principal = [...notas].sort((a, b) => ordem(a.status) - ordem(b.status))[0]
    const m = L.circleMarker([principal.latitude, principal.longitude], {
      radius: notas.length > 1 ? raio + 2 : raio,
      color: '#fff',
      weight: notas.length > 1 ? 3 : 2,
      fillColor: corDe(principal.status),
      fillOpacity: 0.95,
      statusNotas: notas.map(n => n.status),
      notasPonto: [...notas].sort((a, b) => ordem(a.status) - ordem(b.status))
    })
    const equipe = equipesDe(notas)
    const titulo = notas.length > 1 ? `${notas.length} notas` : `Nota ${principal.nota}`
    if (temHover) m.bindTooltip(equipe ? `${titulo}<br>Equipe ${equipe}` : titulo, { direction: 'top', offset: [0, -6] })
    m.on('click', () => abrirRoteiroDoPonto(principal.latitude, principal.longitude))
    marcadores.push(m)
  }
  camadaMarcadores.addLayers ? camadaMarcadores.addLayers(marcadores) : marcadores.forEach(m => m.addTo(camadaMarcadores))

  if (selecionado.value) {
    const { latitude, longitude } = selecionado.value[0]
    const ainda = notasNoPonto(latitude, longitude)
    if (ainda.length) selecionado.value = ainda
    else fecharSelecao()
  }

  if (!ajustouVisao && notasNoMapa.value.length) {
    const alvo = props.foco && notasNoMapa.value.find(n => n.nota === props.foco)
    if (alvo) irParaNota(alvo, 15)
    else mapa.fitBounds(L.latLngBounds(notasNoMapa.value.map(n => [n.latitude, n.longitude])), { padding: [30, 30] })
    ajustouVisao = true
  }
}

// Bolha com o total de notas e um anel colorido na proporção de cada status
function iconeCluster (cluster) {
  const cont = {}
  let total = 0
  for (const m of cluster.getAllChildMarkers()) {
    for (const s of m.options.statusNotas ?? []) { cont[s] = (cont[s] || 0) + 1; total++ }
  }
  let acc = 0
  const fatias = Object.keys(cont)
    .sort((a, b) => statusLista().findIndex(x => x.val === a) - statusLista().findIndex(x => x.val === b))
    .map(s => {
      const ini = acc
      acc += cont[s] / total * 360
      return `${corDe(s)} ${ini}deg ${acc}deg`
    })
  const tam = total < 10 ? 38 : total < 50 ? 46 : total < 200 ? 54 : 62
  return L.divIcon({
    className: 'mapa-cluster',
    html: `<div class="mapa-cluster-anel" title="Clique para montar o roteiro" style="background:conic-gradient(${fatias.join(',')})"><span>${total}</span></div>`,
    iconSize: [tam, tam]
  })
}

async function montarMapa () {
  await nextTick()
  await carregarCluster().catch(() => null)
  if (mapa || !mapaEl.value || !props.modelValue) return
  mapa = L.map(mapaEl.value, {
    // Tolerância maior facilita acertar o ponto com o dedo
    renderer: L.canvas({ tolerance: compacto.value ? 10 : 4 }),
    zoomControl: !compacto.value,
    zoomSnap: 0.25,
    tapTolerance: 20
  }).setView([-4.5, -44.8], 7)
  camadasBase = {
    ruas: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }),
    satelite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Imagens &copy; Esri'
    })
  }
  camadasBase[camada.value].addTo(mapa)
  // Área filtrada fica abaixo dos pontos das notas (overlayPane = 400)
  mapa.createPane('mascara').style.zIndex = 350
  mapa.createPane('contorno').style.zIndex = 360
  mapa.createPane('rotulos').style.zIndex = 370
  mapa.createPane('rota').style.zIndex = 390
  mapa.createPane('roteiroLinha').style.zIndex = 420
  mapa.createPane('roteiroPontos').style.zIndex = 640
  camadaMarcadores = (L.markerClusterGroup
    ? L.markerClusterGroup({
      iconCreateFunction: iconeCluster,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: false,
      // O clique na bolha abre o roteiro em vez de aproximar o mapa
      zoomToBoundsOnClick: false,
      disableClusteringAtZoom: 15,
      maxClusterRadius: z => z < 10 ? 60 : 45,
      chunkedLoading: true
    })
    : L.layerGroup()).addTo(mapa)
  camadaMarcadores.on('clusterclick', e => abrirRoteiro(e.layer))
  camadaDestaque = L.layerGroup().addTo(mapa)
  camadaRota = L.layerGroup().addTo(mapa)
  rendererRoteiro = L.svg({ pane: 'roteiroLinha' })
  camadaRoteiro = L.layerGroup().addTo(mapa)
  mapa.on('dragstart', () => { seguindo.value = false })
  mapa.on('click', aoClicarMapa)
  mapa.on('zoomend', atualizarRotulos)

  ajustouVisao = false
  painelAberto.value = false
  desenharMarcadores()
  setTimeout(() => mapa?.invalidateSize(), 150)
  if (props.baseInicial && !filtroBase.value.includes(props.baseInicial)) filtroBase.value = [props.baseInicial]
  else desenharArea()

  window.addEventListener('online', atualizarOnline)
  window.addEventListener('offline', atualizarOnline)
  atualizarOnline()
  if (props.modo === 'campo') {
    iniciarGps()
    desenharEu()
  }
}

function desmontarMapa () {
  window.removeEventListener('online', atualizarOnline)
  window.removeEventListener('offline', atualizarOnline)
  pararGps()
  marcadorEu = null
  circuloEu = null
  camadaArea = null
  municipiosDaArea = []
  limparRota()
  camadaRota = null
  fecharRoteiro()
  camadaRoteiro = null
  rendererRoteiro = null
  seguindo.value = false
  arrasteY.value = 0
  selecionado.value = null
  mapa?.remove()
  mapa = null
}

function irParaBusca () {
  const q = busca.value?.trim().toLowerCase()
  if (!q || !mapa) return
  const achadas = notasNoMapa.value.filter(n =>
    n.nota?.toLowerCase().includes(q) ||
    n.projeto_info_sap?.toLowerCase().includes(q) ||
    n.municipio?.toLowerCase().includes(q)
  )
  if (!achadas.length) {
    $q.notify({ type: 'warning', message: 'Nenhuma nota encontrada no mapa.', position: 'top', timeout: 1800 })
    return
  }
  document.activeElement?.blur?.()
  if (achadas.length === 1) {
    irParaNota(achadas[0])
  } else {
    fecharSelecao()
    mapa.flyToBounds(L.latLngBounds(achadas.map(n => [n.latitude, n.longitude])), { padding: [40, 40], maxZoom: 15, duration: 0.9 })
  }
}

watch([notasNoMapa, compacto], desenharMarcadores)
watch(camada, (nova, antiga) => {
  if (!mapa) return
  mapa.removeLayer(camadasBase[antiga])
  camadasBase[nova].addTo(mapa)
})
// Painel de filtros, avisos e rotação da tela mudam o tamanho do mapa
watch([painelAberto, () => $q.screen.width, () => $q.screen.height, areaAtual, erroGps, online], async () => {
  await nextTick()
  setTimeout(() => mapa?.invalidateSize(), 220)
})
</script>

<style scoped>
.mapa-card { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

.mapa-bar {
  display: flex; align-items: center; gap: 8px;
  background: #0a1628; color: #fff;
  min-height: 46px; padding: 0 6px 0 14px;
  padding-top: env(safe-area-inset-top);
}
.mapa-bar-titulo { font-weight: 700; font-size: 15px; white-space: nowrap; }
.mapa-bar-sub { font-size: 12px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.mapa-toolbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 7px;
  padding: 9px 14px;
  background: rgba(255,255,255,0.97);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(15,23,42,0.07);
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

/* ── Search ── */
.mapa-busca { width: 270px; }
:deep(.mapa-busca .q-field__control) {
  border-radius: 22px !important; background: #eef2f9 !important; height: 36px;
}
:deep(.mapa-busca .q-field__control::before) { border: none !important; box-shadow: none !important; }
:deep(.mapa-busca .q-field__control::after)  { border: none !important; }
:deep(.mapa-busca .q-field__marginal)         { height: 36px; color: #64748b; }
:deep(.mapa-busca .q-field__native)           { color: #1e293b; font-size: 13px; }

/* ── Filters ── */
.mapa-controles { display: contents; }
.mapa-filtros   { display: contents; }
.mapa-filtro     { width: 170px; }
.mapa-filtro--mun { width: 240px; }
.mapa-filtro--equipe { width: 240px; }
.mapa-filtro-data { width: 240px; }
:deep(.mapa-filtro .q-field__control),
:deep(.mapa-filtro--mun .q-field__control) {
  border-radius: 22px !important; background: #eef2f9 !important; height: 36px;
}
:deep(.mapa-filtro .q-field__control::before),
:deep(.mapa-filtro--mun .q-field__control::before) { border-color: transparent !important; box-shadow: none !important; }
:deep(.mapa-filtro .q-field__control::after),
:deep(.mapa-filtro--mun .q-field__control::after)  { border: none !important; }
:deep(.mapa-filtro .q-field__marginal),
:deep(.mapa-filtro--mun .q-field__marginal)         { height: 36px; color: #64748b; }
:deep(.mapa-filtro .q-field__label),
:deep(.mapa-filtro--mun .q-field__label)             { font-size: 12.5px; color: #64748b; }
:deep(.mapa-filtro .q-field__native),
:deep(.mapa-filtro--mun .q-field__native)             { font-size: 13px; color: #1e293b; font-weight: 600; }

/* ── Legend pills ── */
.mapa-legenda { display: flex; flex-wrap: wrap; gap: 5px; flex: 1; align-items: center; }

.mapa-leg-item {
  display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
  padding: 4px 9px 4px 6px; border-radius: 22px;
  border: 1.5px solid transparent;
  background: #eef2f9;
  font-size: 11.5px; font-weight: 600; color: #334155;
  cursor: pointer; font-family: inherit; white-space: nowrap;
  transition: background 0.18s, border-color 0.18s, transform 0.13s, box-shadow 0.18s, opacity 0.18s;
  user-select: none;
}
.mapa-leg-item:hover {
  box-shadow: inset 0 0 0 1.5px var(--clr, #64748b), 0 3px 10px rgba(0,0,0,0.1);
  background: #fff;
  transform: translateY(-1px);
}
.mapa-leg-item:active { transform: scale(0.95); box-shadow: inset 0 0 0 1.5px var(--clr, #64748b); }

.mapa-leg-item b {
  font-size: 10.5px; font-weight: 700; color: #475569;
  background: rgba(0,0,0,0.07); padding: 1px 7px; border-radius: 10px; margin-left: 1px;
  min-width: 20px; text-align: center;
}
.mapa-leg-item--off { opacity: 0.32; filter: grayscale(0.4); }
.mapa-leg-item--off:hover { transform: none; box-shadow: none; }

.mapa-leg-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  box-shadow: 0 0 0 1.5px rgba(0,0,0,0.14);
}

/* ── Layer toggle ── */
:deep(.mapa-camada.q-btn-toggle) {
  border-radius: 22px; overflow: hidden;
  background: #eef2f9 !important;
  box-shadow: none !important; border: none !important;
  gap: 0;
}
:deep(.mapa-camada .q-btn) {
  border-radius: 0 !important;
  font-size: 11.5px !important; font-weight: 600 !important;
  min-height: 34px; padding: 0 14px !important;
  transition: background 0.18s, color 0.18s !important;
  letter-spacing: 0.01em;
}
:deep(.mapa-camada .q-btn:first-child) { border-radius: 22px 0 0 22px !important; }
:deep(.mapa-camada .q-btn:last-child)  { border-radius: 0 22px 22px 0 !important; }
:deep(.mapa-camada .q-btn--active) {
  background: #1d4ed8 !important; color: #fff !important;
  box-shadow: 0 2px 6px rgba(29,78,216,0.4) !important;
}

.mapa-aviso {
  display: flex; align-items: center; gap: 6px;
  background: #fff3e0; color: #e65100; font-size: 12px; padding: 6px 12px;
}
.mapa-area {
  display: flex; align-items: center; gap: 8px;
  background: #e3f2fd; color: #0d47a1; padding: 6px 12px; font-size: 13px;
  border-bottom: 1px solid #bbdefb;
}
.mapa-area span { color: #1565c0; opacity: 0.85; }

.mapa-wrap { position: relative; flex: 1; min-height: 0; }
.mapa-el { position: absolute; inset: 0; z-index: 0; }

.mapa-fabs {
  position: absolute; right: 14px; bottom: calc(24px + env(safe-area-inset-bottom));
  z-index: 500; display: flex; flex-direction: column; gap: 12px;
}

/* Detalhes da nota */
.mapa-sheet {
  position: absolute; z-index: 600;
  left: 12px; bottom: 12px; width: 360px; max-height: calc(100% - 24px);
  overflow-y: auto; overscroll-behavior: contain;
  background: #fff; border-radius: 14px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.25);
  padding: 14px 14px 12px;
}
.mapa-sheet-alca { width: 40px; height: 4px; border-radius: 2px; background: #cfd8dc; margin: -4px auto 10px; }
.mapa-sheet-fechar {
  position: absolute; top: 8px; right: 8px;
  width: 36px; height: 36px; border-radius: 50%; border: none;
  background: #f1f3f4; color: #546e7a; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.mapa-sheet-titulo { font-weight: 700; color: #37474f; margin-bottom: 8px; padding-right: 40px; }
.mapa-sheet-lista { display: flex; flex-direction: column; gap: 10px; }
.mapa-sheet-nota { border-left: 3px solid #e0e0e0; padding-left: 10px; }
.mapa-sheet-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-right: 40px; font-size: 15px; }
.mapa-sheet-status { color: #fff; font-size: 11px; font-weight: 700; border-radius: 10px; padding: 2px 9px; white-space: nowrap; }
.mapa-sheet-linha { font-size: 13px; color: #546e7a; margin-top: 2px; }
.mapa-sheet-abrir { margin-top: 8px; padding: 2px 12px; }
.mapa-sheet-dist { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; font-weight: 700; color: #00695c; }
.mapa-sheet-acoes { display: flex; gap: 8px; margin-top: 10px; }
.mapa-rota {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  text-decoration: none; border-radius: 12px; font-weight: 800;
}
.mapa-rota--google { flex: 1; background: #2e7d32; color: #fff; padding: 13px 10px; font-size: 15px; }
.mapa-rota--waze { flex: 0 0 auto; background: #33ccff; color: #0d2b3e; padding: 13px 18px; font-size: 15px; }
.mapa-rota--link { color: #1565c0; font-size: 13px; font-weight: 700; padding: 4px 0; }
.mapa-rota:active { transform: scale(0.98); }

.mapa-sheet { transition: transform 0.25s cubic-bezier(0.2, 1.25, 0.35, 1); }
.mapa-sheet--arrastando { transition: none; }
.mapa-sheet-enter-active { transition: transform 0.42s cubic-bezier(0.2, 1.25, 0.35, 1), opacity 0.25s ease; }
.mapa-sheet-leave-active { transition: transform 0.2s ease-in, opacity 0.2s ease-in; }
.mapa-sheet-enter-from, .mapa-sheet-leave-to { transform: translateY(24px); opacity: 0; }

.mapa-sheet-rota {
  display: flex; align-items: center; gap: 10px; margin-top: 12px;
  background: #e3f2fd; color: #1565c0; border-radius: 12px; padding: 8px 6px 8px 12px;
  animation: mapa-surgir 0.3s ease;
}
.mapa-sheet-rota-info { display: flex; flex-direction: column; line-height: 1.2; flex: 1; min-width: 0; }
.mapa-sheet-rota-info b { font-size: 17px; color: #0d47a1; }
.mapa-sheet-rota-info span { font-size: 12px; color: #1976d2; }
.mapa-sheet-rota--carregando { background: #f5f7fa; color: #607d8b; font-size: 13px; padding: 10px 12px; }

@keyframes mapa-surgir { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.mapa-fabs-enter-active { transition: transform 0.35s cubic-bezier(0.2, 1.4, 0.4, 1), opacity 0.2s; }
.mapa-fabs-leave-active { transition: transform 0.15s ease-in, opacity 0.15s; }
.mapa-fabs-enter-from, .mapa-fabs-leave-to { transform: scale(0.4); opacity: 0; }
.mapa-fab-gps--ativo { box-shadow: 0 0 0 4px rgba(30,136,229,0.3), 0 3px 8px rgba(0,0,0,0.25); }

/* Bolhas de agrupamento */
:deep(.mapa-cluster) { background: none; border: none; }
:deep(.mapa-cluster-anel) {
  width: 100%; height: 100%; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  animation: mapa-pop 0.4s cubic-bezier(0.2, 1.5, 0.4, 1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}
:deep(.mapa-cluster-anel:hover) {
  transform: scale(1.12);
  box-shadow: 0 4px 14px rgba(0,0,0,0.35);
  opacity: 0.42;
}
:deep(.mapa-cluster-anel span) {
  width: calc(100% - 10px); height: calc(100% - 10px); border-radius: 50%;
  background: rgba(255,255,255,0.82);
  color: #1a2535; font-weight: 800; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(2px);
  transition: background 0.2s ease, color 0.2s ease, text-shadow 0.2s ease;
}
:deep(.mapa-cluster-anel:hover span) {
  background: transparent;
  color: #fff;
  text-shadow: 0 0 3px #000, 0 1px 6px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.7);
}
@keyframes mapa-pop { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* ── Roteiro ── */
.rot-painel {
  position: absolute; z-index: 620;
  left: 12px; bottom: 12px; width: 384px; max-height: calc(100% - 24px);
  display: flex; flex-direction: column; overflow: hidden;
  background: #fff; border-radius: 20px;
  box-shadow: 0 18px 48px rgba(10,22,40,0.38), 0 0 0 1px rgba(10,22,40,0.06);
}
.rot-enter-active { transition: transform 0.45s cubic-bezier(0.2, 1.2, 0.35, 1), opacity 0.25s ease; }
.rot-leave-active { transition: transform 0.2s ease-in, opacity 0.2s ease-in; }
.rot-enter-from, .rot-leave-to { transform: translateY(28px) scale(0.98); opacity: 0; }

.rot-alca { position: absolute; top: 7px; left: 50%; width: 40px; height: 4px; margin-left: -20px; border-radius: 2px; background: rgba(255,255,255,0.35); z-index: 2; }
.rot-head {
  flex-shrink: 0; color: #fff; padding: 14px 16px 14px;
  background: radial-gradient(120% 160% at 0% 0%, #2563eb 0%, #12306b 48%, #0a1628 100%);
}
.rot-head-linha { display: flex; align-items: center; justify-content: space-between; }
.rot-selo {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  background: rgba(255,255,255,0.14); border-radius: 20px; padding: 4px 10px 4px 8px;
  backdrop-filter: blur(6px);
}
.rot-x {
  width: 34px; height: 34px; margin: -4px -6px -4px 0; border-radius: 50%; border: none;
  background: rgba(255,255,255,0.12); color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: background 0.15s;
}
.rot-x:hover { background: rgba(255,255,255,0.24); }
.rot-titulo { margin-top: 10px; font-size: 22px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.1; }
.rot-titulo small { display: block; margin-top: 3px; font-size: 12px; font-weight: 600; opacity: 0.72; letter-spacing: 0; }
.rot-stats { display: grid; grid-template-columns: 0.8fr 1.1fr 1.1fr; gap: 7px; margin-top: 12px; }
.rot-stats > div {
  display: flex; flex-direction: column; gap: 1px; min-width: 0;
  background: rgba(255,255,255,0.1); border-radius: 12px; padding: 7px 10px;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
}
.rot-stats b { font-size: 17px; line-height: 1.25; font-variant-numeric: tabular-nums; white-space: nowrap; min-height: 22px; display: flex; align-items: center; }
.rot-stats span { font-size: 10.5px; opacity: 0.68; font-weight: 600; }
.rot-mix { display: flex; gap: 2px; height: 6px; margin-top: 11px; border-radius: 3px; overflow: hidden; }
.rot-mix i { display: block; min-width: 4px; }

.rot-ctrl { display: flex; align-items: center; gap: 8px; padding: 10px 12px 4px; flex-shrink: 0; }
.rot-trecho { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 12px 0; flex-shrink: 0; }
.rot-trecho-campo { flex: 1 1 160px; min-width: 0; }
.rot-dist { flex: 1 1 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; color: #37474f; }
.rot-dist b { color: #0d47a1; }
.rot-par { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 8px 12px 0; padding: 8px 10px; border-radius: 12px; background: #eef2f9; font-size: 13px; color: #37474f; flex-shrink: 0; }
.rot-par b { color: #0d47a1; }
.rot-par-limpar { margin-left: auto; border: 0; background: none; color: #1565c0; font-weight: 600; cursor: pointer; }
.rot-seg { display: inline-flex; flex: 1; min-width: 0; background: #eef2f9; border-radius: 22px; padding: 3px; }
.rot-seg button {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  border: none; background: none; border-radius: 20px; padding: 7px 10px; white-space: nowrap;
  font-family: inherit; font-size: 12px; font-weight: 700; line-height: 1; color: #475569; cursor: pointer;
  transition: background 0.18s, color 0.18s, box-shadow 0.18s;
}
.rot-seg .rot-seg--on { background: #1d4ed8; color: #fff; box-shadow: 0 2px 8px rgba(29,78,216,0.4); }
.rot-ico {
  flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%; border: none;
  background: #eef2f9; color: #334155; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: background 0.15s, transform 0.12s;
}
.rot-ico:hover { background: #dde6f7; }
.rot-ico:active { transform: scale(0.92); }

.rot-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 6px 12px 10px; }
.rot-lista { position: relative; }
.rot-lista::before {
  content: ''; position: absolute; left: 21px; top: 20px; bottom: 20px; width: 2px;
  background: repeating-linear-gradient(#cbd5e1 0 4px, transparent 4px 8px);
}
.rot-item {
  position: relative; display: grid; grid-template-columns: 32px 1fr; gap: 10px;
  padding: 8px 6px; border-radius: 14px; transition: background 0.15s, box-shadow 0.15s;
}
.rot-item:hover { background: #f1f5ff; }
.rot-item--ativo { background: #fff8e1; box-shadow: inset 0 0 0 1.5px #ffca28; }
.rot-num {
  position: relative; z-index: 1; width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--cor, #1e88e5); color: #fff; font-family: inherit; font-size: 14px; font-weight: 800; line-height: 1;
  border: 3px solid #fff; box-shadow: 0 0 0 1.5px var(--cor, #1e88e5), 0 2px 6px rgba(0,0,0,0.2);
  cursor: pointer; padding: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.35);
  transition: transform 0.15s;
}
.rot-num:hover { transform: scale(1.1); }
.rot-num--eu { --cor: #1e88e5; cursor: default; }
.rot-num--eu:hover { transform: none; }
.rot-perna {
  display: inline-flex; align-items: center; gap: 4px; margin: 1px 0 1px 48px;
  font-size: 11px; font-weight: 700; color: #64748b; font-variant-numeric: tabular-nums;
  background: #f1f5f9; border-radius: 10px; padding: 2px 9px 2px 6px;
}
.rot-info { min-width: 0; }
.rot-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
.rot-notas { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; padding-top: 4px; }
.rot-nota {
  display: inline-flex; align-items: center; gap: 6px; border: none; background: none; padding: 0;
  font-family: inherit; font-size: 14px; font-weight: 800; line-height: 1.2; color: #0f172a; cursor: default; text-align: left;
}
.rot-nota i { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 0 1.5px rgba(0,0,0,0.12); }
.rot-nota--link { cursor: pointer; }
.rot-nota--link:hover { color: #1d4ed8; text-decoration: underline; }
.rot-mais { font-size: 12px; font-weight: 700; color: #64748b; }
.rot-sub { margin-top: 1px; font-size: 12.5px; color: #64748b; }
.rot-acoes { display: flex; flex-shrink: 0; gap: 2px; margin: -2px -2px 0 0; }
.rot-acoes a, .rot-acoes button {
  width: 30px; height: 30px; border-radius: 50%; border: none; background: none; color: #64748b; cursor: pointer;
  display: flex; align-items: center; justify-content: center; text-decoration: none; transition: background 0.15s, color 0.15s;
}
.rot-acoes a:hover, .rot-acoes button:hover { background: #e2e8f0; color: #1d4ed8; }
.rot-link {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; margin-top: 6px;
  padding: 5px 9px; border-radius: 9px; border: 1px dashed #cbd5e1; background: #f8fafc; color: #475569;
  font: 11px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; cursor: pointer; text-align: left;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.rot-link span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.rot-link:hover { background: #eef2ff; border-color: #818cf8; color: #3730a3; }
.rot-link--ok, .rot-link--ok:hover { background: #f0fdf4; border: 1px solid #22c55e; color: #15803d; }

.rot-fora { margin-top: 8px; padding: 8px 10px; border-radius: 14px; background: #f8fafc; }
.rot-fora-titulo { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }
.rot-fora-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; color: #94a3b8; padding: 3px 0; }
.rot-fora-item span { text-decoration: line-through; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rot-fora-item button {
  display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; border: none; background: none;
  font-family: inherit; font-size: 12px; font-weight: 700; line-height: 1; color: #1d4ed8; cursor: pointer; padding: 4px 6px; border-radius: 8px;
}
.rot-fora-item button:hover { background: #e0e7ff; }

.rot-grande { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 22px 20px 20px; text-align: center; color: #475569; }
.rot-grande p { margin: 0; font-size: 14px; line-height: 1.45; }

.rot-rodape {
  flex-shrink: 0; display: flex; flex-direction: column; gap: 8px;
  padding: 10px 12px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid #eef2f9; background: #fff;
}
.rot-rodape-2 { display: flex; gap: 8px; }
.rot-rodape-2 > .rot-btn { flex: 1; }
.rot-btn {
  display: flex; align-items: center; justify-content: center; gap: 7px;
  border: none; border-radius: 14px; padding: 12px 12px; cursor: pointer; text-decoration: none;
  font-family: inherit; font-size: 14px; font-weight: 800; line-height: 1.1; white-space: nowrap;
  transition: transform 0.12s, box-shadow 0.18s, background 0.18s, filter 0.18s;
}
.rot-btn:active { transform: scale(0.98); }
.rot-btn:disabled { opacity: 0.5; cursor: default; }
.rot-btn--prim { background: #1d4ed8; color: #fff; box-shadow: 0 6px 16px rgba(29,78,216,0.35); }
.rot-btn--prim:hover { filter: brightness(1.08); }
.rot-btn--ok { background: #16a34a; box-shadow: 0 6px 16px rgba(22,163,74,0.35); }
.rot-btn--dia { background: linear-gradient(135deg, #ffb300, #ffca28); color: #3b2a00; box-shadow: 0 6px 16px rgba(255,179,0,0.35); }
.rot-btn--dia:hover { filter: brightness(1.05); }
.rot-btn--dia-ok, .rot-btn--dia-ok:disabled { background: #fff8e1; color: #8a6100; box-shadow: inset 0 0 0 1.5px #ffca28; opacity: 1; }
.rot-btn--zap { background: #25d366; color: #05381b; }
.rot-btn--zap:hover { filter: brightness(1.05); }
.rot-btn--maps { background: #e8f0fe; color: #1a56db; }
.rot-btn--maps:hover { background: #d7e4fd; }

/* Pinos numerados no mapa */
:deep(.rot-pin-wrap) { background: none; border: none; }
:deep(.rot-pin) {
  display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--cor, #1e88e5); color: #fff; font-weight: 800; font-size: 13px;
  border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); text-shadow: 0 1px 2px rgba(0,0,0,0.45);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
:deep(.rot-pin--anim) { animation: mapa-pop 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) backwards; }
:deep(.rot-pin--ini) { box-shadow: 0 0 0 3px #22c55e, 0 2px 8px rgba(0,0,0,0.4); }
:deep(.rot-pin--fim) { box-shadow: 0 0 0 3px #0a1628, 0 2px 8px rgba(0,0,0,0.4); }
:deep(.rot-pin.rot-pin--realce),
:deep(.rot-pin.rot-pin--ativo) { transform: scale(1.3); box-shadow: 0 0 0 4px rgba(255,202,40,0.95), 0 4px 14px rgba(0,0,0,0.45); }
:deep(.rot-linha-reta) { animation: rot-fluxo 0.9s linear infinite; }
@keyframes rot-fluxo { to { stroke-dashoffset: -11; } }

@media (prefers-reduced-motion: reduce) {
  :deep(.rot-linha-reta), :deep(.rot-pin) { animation: none; }
}

/* Nota selecionada */
:deep(.mapa-pulso) { background: none; border: none; pointer-events: none; }
:deep(.mapa-pulso-anel) {
  position: absolute; inset: 8px; border-radius: 50%;
  border: 4px solid #ffca28; box-shadow: 0 0 0 2px #fff, 0 2px 10px rgba(0,0,0,0.35);
  animation: mapa-pop 0.45s cubic-bezier(0.2, 1.6, 0.4, 1);
}
:deep(.mapa-pulso-onda) {
  position: absolute; inset: 8px; border-radius: 50%;
  background: rgba(255,202,40,0.45);
  animation: mapa-onda 1.8s ease-out infinite;
}
:deep(.mapa-pulso-onda--2) { animation-delay: 0.9s; }
@keyframes mapa-onda { from { transform: scale(0.6); opacity: 0.9; } to { transform: scale(2.2); opacity: 0; } }

/* Posição da equipe */
:deep(.mapa-eu) { background: none; border: none; pointer-events: none; }
:deep(.mapa-eu-ponto) {
  position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px;
  border-radius: 50%; background: #1e88e5; border: 3px solid #fff;
  box-shadow: 0 1px 6px rgba(0,0,0,0.4);
}
:deep(.mapa-eu-pulso) {
  position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px;
  border-radius: 50%; background: rgba(30,136,229,0.5);
  animation: mapa-onda 2s ease-out infinite;
}
:deep(.mapa-eu-cone) {
  position: absolute; inset: 0; opacity: 0;
  transition: transform 0.3s ease-out, opacity 0.3s;
  background: conic-gradient(from -28deg at 50% 50%, rgba(30,136,229,0.55) 0deg, rgba(30,136,229,0) 56deg, transparent 56deg);
  -webkit-mask: radial-gradient(circle, #000 0 30px, transparent 31px);
  mask: radial-gradient(circle, #000 0 30px, transparent 31px);
  border-radius: 50%;
}

/* Rota até a nota */
:deep(.mapa-rota-linha) {
  stroke-dasharray: 1; stroke-dashoffset: 1;
  animation: mapa-desenhar 1.1s ease-out forwards;
  stroke-linecap: round; stroke-linejoin: round;
}
@keyframes mapa-desenhar { to { stroke-dashoffset: 0; } }

:deep(.mapa-mun-label) {
  background: rgba(255,255,255,0.8); border: none; box-shadow: none;
  color: #0d47a1; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px;
}
:deep(.mapa-mun-label::before) { display: none; }

/* ── Celular ─────────────────────────────────────────────────── */
.mapa-card--compacto .mapa-toolbar { gap: 7px; padding: 8px 10px; }
.mapa-card--compacto .mapa-busca { flex: 1; width: auto; min-width: 0; }
.mapa-card--compacto .mapa-btn-filtros {
  width: 36px; height: 36px; border-radius: 18px;
  background: #eef2f9 !important;
}
.mapa-card--compacto .mapa-controles {
  display: flex; flex-wrap: wrap; align-items: center; gap: 7px; flex-basis: 100%; min-width: 0;
}
.mapa-card--compacto .mapa-filtros { display: flex; flex-wrap: wrap; gap: 7px; flex-basis: 100%; min-width: 0; }
.mapa-card--compacto .mapa-filtro,
.mapa-card--compacto .mapa-filtro--mun,
.mapa-card--compacto .mapa-filtro--equipe,
.mapa-card--compacto .mapa-filtro-data { flex: 1 1 170px; width: auto; min-width: 160px; }
.mapa-card--compacto .mapa-filtros :deep(.q-field__native) { min-width: 0; white-space: nowrap; }
.mapa-card--compacto .mapa-legenda {
  flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; min-width: 0;
  margin-left: -10px; padding-left: 10px;
  -webkit-overflow-scrolling: touch;
}
.mapa-card--compacto .mapa-legenda::-webkit-scrollbar { display: none; }
.mapa-card--compacto .mapa-camada { flex-shrink: 0; }
.mapa-card--compacto .mapa-aviso span,
.mapa-card--compacto .mapa-area span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.mapa-card--compacto .mapa-area b { white-space: nowrap; flex-shrink: 0; }
.mapa-card--compacto .mapa-area { font-size: 12px; }

.mapa-card--compacto .mapa-sheet {
  left: 0; right: 0; bottom: 0; width: auto; max-height: 62%;
  border-radius: 18px 18px 0 0;
  padding: 12px 16px calc(14px + env(safe-area-inset-bottom));
  box-shadow: 0 -6px 24px rgba(0,0,0,0.2);
}
.mapa-card--compacto .mapa-sheet-enter-from,
.mapa-card--compacto .mapa-sheet-leave-to { transform: translateY(100%); opacity: 1; }
.mapa-card--compacto .mapa-sheet-abrir { width: 100%; padding: 6px 12px; font-size: 14px; }
.mapa-card--compacto .rot-painel {
  left: 0; right: 0; bottom: 0; width: auto; max-height: 72%;
  border-radius: 20px 20px 0 0; box-shadow: 0 -8px 28px rgba(10,22,40,0.3);
}
.mapa-card--compacto .rot-head { padding-top: 20px; }
.mapa-card--compacto .rot-titulo { font-size: 20px; }
.mapa-card--compacto .rot-enter-from,
.mapa-card--compacto .rot-leave-to { transform: translateY(100%); opacity: 1; }
.mapa-card--compacto .mapa-fabs :deep(.q-btn) { width: 48px; height: 48px; }

@media (max-width: 360px) {
  .mapa-rota--google { font-size: 14px; padding: 12px 8px; }
  .mapa-rota--waze { padding: 12px 12px; font-size: 14px; }
}
</style>
