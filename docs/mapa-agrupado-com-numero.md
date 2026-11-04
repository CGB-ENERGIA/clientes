# Mapa com pontos agrupados em bolhas numeradas (Leaflet + markercluster)

Guia para outro Claude reproduzir, em qualquer projeto, o modelo de mapa usado em
`src/components/MapaNotas.vue` deste repositório: pontos individuais que, ao se aproximarem,
viram uma **bolha com o total de itens** (por exemplo, o "2" azul da imagem de referência),
com um **anel colorido na proporção de cada status** e um centro translúcido com o número.

## O que o usuário vê

- Pontos soltos: círculos pequenos coloridos pelo status do item, com borda branca.
- Pontos muito próximos: uma bolha redonda com o **número de itens dentro dela**.
  - O anel da bolha é um gráfico de pizza (`conic-gradient`): cada fatia tem a cor de um status e o tamanho
    proporcional à quantidade de itens naquele status.
  - O centro é um círculo branco translúcido com o número em negrito.
  - O tamanho da bolha cresce com o total: 38 px (até 9 itens), 46 px (até 49), 54 px (até 199), 62 px (acima).
  - Ao passar o mouse, a bolha cresce um pouco, o centro fica transparente e o número vira branco com sombra.
- Itens com **exatamente a mesma coordenada** viram um único ponto (borda mais grossa, raio maior), e o número da
  bolha conta os itens, não os pontos.
- Ao chegar no zoom 15, o agrupamento termina e todos os pontos aparecem.

## Dependências

```json
"leaflet": "^1.9.4",
"leaflet.markercluster": "^1.5.3"
```

Imports (o plugin procura o Leaflet na variável global, então `window.L` precisa existir antes dele):

```js
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Carregar o plugin uma única vez, depois de expor o L
let clusterPronto = null
function carregarCluster () {
  if (!clusterPronto) {
    window.L = L
    clusterPronto = Promise.all([
      import('leaflet.markercluster'),
      // Só o CSS de base. Não usar MarkerCluster.Default.css: o ícone da bolha é customizado.
      import('leaflet.markercluster/dist/MarkerCluster.css')
    ])
  }
  return clusterPronto
}
```

## Passo 1: dados e paleta de status

Cada item precisa de `latitude`, `longitude` e `status`. A paleta define a cor de cada status e a **ordem**
das fatias do anel:

```js
const STATUS = [
  { val: 'pendente',     label: 'Não iniciado', cor: '#9e9e9e' },
  { val: 'em_andamento', label: 'Andamento',    cor: '#fb8c00' },
  { val: 'concluido',    label: 'Concluído',    cor: '#43a047' }
]
const corDe = s => STATUS.find(x => x.val === s)?.cor ?? '#607d8b'
const ordem = s => STATUS.findIndex(x => x.val === s)
```

No projeto original há duas paletas (`ESQUEMAS.sistema` e `ESQUEMAS.programacao`), escolhidas pela prop `esquema`.

## Passo 2: criar os pontos (um por coordenada)

Agrupe os itens pela coordenada e crie **um `L.circleMarker` por coordenada**. O detalhe essencial é guardar
a lista de status dos itens em uma opção própria do marcador (`statusNotas`), porque a bolha lê essa opção
para contar itens, e não marcadores:

```js
const chavePonto = (lat, lng) => `${lat.toFixed(6)},${lng.toFixed(6)}`

function criarMarcadores (itens) {
  const porPonto = new Map()
  for (const it of itens) {
    const k = chavePonto(it.latitude, it.longitude)
    if (!porPonto.has(k)) porPonto.set(k, [])
    porPonto.get(k).push(it)
  }

  const raio = 7
  const marcadores = []
  for (const grupo of porPonto.values()) {
    const ordenados = [...grupo].sort((a, b) => ordem(a.status) - ordem(b.status))
    const principal = ordenados[0]                 // o status mais "importante" define a cor do ponto
    const m = L.circleMarker([principal.latitude, principal.longitude], {
      radius: grupo.length > 1 ? raio + 2 : raio,
      color: '#fff',
      weight: grupo.length > 1 ? 3 : 2,
      fillColor: corDe(principal.status),
      fillOpacity: 0.95,
      statusNotas: grupo.map(i => i.status),       // lido pela bolha (m.options.statusNotas)
      notasPonto: ordenados                        // itens deste ponto, para clique/detalhe
    })
    m.on('click', () => aoClicarNoPonto(ordenados))
    marcadores.push(m)
  }
  return marcadores
}
```

## Passo 3: o ícone da bolha (`iconCreateFunction`)

Esta é a peça que gera o visual da imagem. Ela soma os status de todos os marcadores filhos, monta o
`conic-gradient` e devolve um `L.divIcon`:

```js
function iconeCluster (cluster) {
  const cont = {}
  let total = 0
  for (const m of cluster.getAllChildMarkers()) {
    for (const s of m.options.statusNotas ?? []) { cont[s] = (cont[s] || 0) + 1; total++ }
  }

  // Uma fatia por status, na ordem da paleta, com ângulo proporcional à quantidade
  let acc = 0
  const fatias = Object.keys(cont)
    .sort((a, b) => ordem(a) - ordem(b))
    .map(s => {
      const ini = acc
      acc += cont[s] / total * 360
      return `${corDe(s)} ${ini}deg ${acc}deg`
    })

  const tam = total < 10 ? 38 : total < 50 ? 46 : total < 200 ? 54 : 62
  return L.divIcon({
    className: 'mapa-cluster',
    html: `<div class="mapa-cluster-anel" style="background:conic-gradient(${fatias.join(',')})"><span>${total}</span></div>`,
    iconSize: [tam, tam]
  })
}
```

## Passo 4: o grupo de agrupamento

```js
await carregarCluster()

const camadaMarcadores = L.markerClusterGroup({
  iconCreateFunction: iconeCluster,
  showCoverageOnHover: false,     // sem o polígono de cobertura ao passar o mouse
  spiderfyOnMaxZoom: false,       // sem "leque" de pontos sobrepostos
  zoomToBoundsOnClick: false,     // o clique NÃO aproxima o mapa (ver observação abaixo)
  disableClusteringAtZoom: 15,    // a partir do zoom 15 mostra todos os pontos
  maxClusterRadius: z => (z < 10 ? 60 : 45),  // raio de agrupamento menor quando o mapa está aproximado
  chunkedLoading: true            // não trava a tela com muitos pontos
}).addTo(mapa)

camadaMarcadores.on('clusterclick', e => {
  const itensDaBolha = e.layer.getAllChildMarkers().flatMap(m => m.options.notasPonto ?? [])
  aoClicarNaBolha(itensDaBolha, e.layer.getBounds())
})

// Ao (re)desenhar: limpar e adicionar em lote
camadaMarcadores.clearLayers()
camadaMarcadores.addLayers(criarMarcadores(itens))
```

**Observação sobre o clique:** no projeto original `zoomToBoundsOnClick: false` porque clicar na bolha abre um
painel de roteiro com os itens dela. Se você quiser o comportamento comum (aproximar ao clicar), use
`zoomToBoundsOnClick: true` e remova o `clusterclick`.

## Passo 5: CSS da bolha

O `L.divIcon` vem com fundo e borda padrão do Leaflet; precisam ser zerados. Se o componente Vue usar
`<style scoped>`, as regras abaixo precisam de `:deep(...)`, porque o HTML da bolha é criado pelo Leaflet,
fora do template do componente.

```css
.mapa-cluster { background: none; border: none; }

.mapa-cluster-anel {
  width: 100%; height: 100%; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  animation: mapa-pop 0.4s cubic-bezier(0.2, 1.5, 0.4, 1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}
.mapa-cluster-anel:hover {
  transform: scale(1.12);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  opacity: 0.42;
}
.mapa-cluster-anel span {
  width: calc(100% - 10px); height: calc(100% - 10px); border-radius: 50%;
  background: rgba(255, 255, 255, 0.82);
  color: #1a2535; font-weight: 800; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(2px);
  transition: background 0.2s ease, color 0.2s ease, text-shadow 0.2s ease;
}
.mapa-cluster-anel:hover span {
  background: transparent;
  color: #fff;
  text-shadow: 0 0 3px #000, 0 1px 6px rgba(0, 0, 0, 0.95), 0 0 14px rgba(0, 0, 0, 0.7);
}
@keyframes mapa-pop { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
```

O anel visível é a "borda" de 5 px entre o `conic-gradient` do `div` externo e o círculo branco do `span`
(que tem `100% - 10px`). Para um anel mais grosso ou fino, mude esse `10px`.

## Passo 6: o mapa e o contêiner

```js
const mapa = L.map(elementoDoMapa, {
  renderer: L.canvas({ tolerance: 4 }),  // canvas é bem mais rápido com muitos pontos; tolerância maior (ex.: 10) ajuda o toque no celular
  zoomSnap: 0.25,
  tapTolerance: 20
}).setView([-4.5, -44.8], 7)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap'
}).addTo(mapa)

// Depois de desenhar, enquadrar todos os pontos
mapa.fitBounds(L.latLngBounds(itens.map(i => [i.latitude, i.longitude])), { padding: [30, 30] })
```

O elemento do mapa precisa ter **altura definida**. No projeto: `.mapa-wrap { position: relative; flex: 1; min-height: 0 }`
e `.mapa-el { position: absolute; inset: 0; z-index: 0 }`.

## Cuidados (erros que já aconteceram ou são comuns)

1. **Sem `window.L = L`, o plugin falha em silêncio** e `L.markerClusterGroup` fica `undefined`. No projeto original há um
   fallback: `L.markerClusterGroup ? ... : L.layerGroup()`, que mostra os pontos sem agrupar.
2. **Contar itens, não marcadores.** Se vários itens ficam na mesma coordenada, cada marcador carrega vários itens. Por isso o
   número da bolha usa `m.options.statusNotas` e não `cluster.getChildCount()`.
3. **Mapa dentro de diálogo, aba ou painel escondido:** crie o mapa só depois que o elemento estiver visível e chame
   `mapa.invalidateSize()` depois da animação de abertura. Se não, os tiles aparecem cortados ou cinza.
4. **Recriar a camada ao mudar filtros:** chame `camadaMarcadores.clearLayers()` antes de `addLayers(...)`, senão os pontos se acumulam.
5. **Ordem das fatias** vem da ordem da paleta. Mantenha a mesma ordem na legenda para o usuário ligar cor e status.
6. **Contraste do número:** o centro branco translúcido garante a leitura sobre qualquer cor de anel. Se trocar por um centro escuro,
   inverta a cor do número.
7. **`disableClusteringAtZoom`** precisa ser menor ou igual ao `maxZoom` do mapa (no projeto, 15 contra 19).

## Onde está no projeto original

| Peça | Local em `src/components/MapaNotas.vue` |
| --- | --- |
| Carregar o plugin | função `carregarCluster` |
| Criar os pontos por coordenada | função `desenharMarcadores` |
| Ícone da bolha | função `iconeCluster` |
| Grupo de agrupamento e `clusterclick` | função `montarMapa` |
| CSS da bolha | bloco `/* Bolhas de agrupamento */` no `<style>` |
| Paletas de status | constante `ESQUEMAS` |

## Checklist rápido para aplicar

- [ ] Instalar `leaflet` e `leaflet.markercluster`.
- [ ] Importar `leaflet.css` e carregar o plugin com `window.L = L`.
- [ ] Definir a paleta de status e a função `corDe`.
- [ ] Criar um `circleMarker` por coordenada, com `statusNotas` nas opções.
- [ ] Implementar `iconeCluster` e passar em `iconCreateFunction`.
- [ ] Criar o `markerClusterGroup` com as opções acima e adicionar os marcadores com `addLayers`.
- [ ] Colar o CSS da bolha (com `:deep` se o componente for `scoped`).
- [ ] Garantir altura no contêiner e `invalidateSize()` quando o mapa estiver dentro de algo que abre.
