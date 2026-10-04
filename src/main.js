import { W, H, makePoly, inflate, free } from './geometry.js';
import { generate, tryMove } from './obstacles.js';
import { graphPath, meshPath, pathLength } from './astar.js';
import { buildVisibility } from './visibility.js';
import { buildGrid } from './grid.js';
import { buildVoronoi } from './voronoi.js';
import { buildDelaunay } from './delaunay.js';
import { buildTrapezoids } from './trapezoid.js';

const METHODS = {
  visibility: { label: 'Grafo de visibilidad', color: '#f59e0b', build: p => buildVisibility(p),
    desc: 'Nodos en los vértices de los obstáculos; arista si hay línea de vista.' },
  grid: { label: 'Waypoints en grilla', color: '#10b981', build: (p, s) => buildGrid(p, s.cell),
    desc: 'Un nodo por celda libre, conectado a sus 8 vecinos.' },
  voronoi: { label: 'Roadmap de Voronoi', color: '#a855f7', build: p => buildVoronoi(p),
    desc: 'Aristas equidistantes a dos obstáculos: caminos con máximo margen.' },
  delaunay: { label: 'NavMesh Delaunay', color: '#3b82f6', build: p => buildDelaunay(p),
    desc: 'Triángulos del espacio libre; el grafo une los centros de triángulos vecinos.' },
  trapezoid: { label: 'NavMesh trapezoidal', color: '#ec4899', build: p => buildTrapezoids(p),
    desc: 'Franjas verticales por cada vértice, fusionadas en trapecios convexos.' },
};

const state = { count: 10, size: 45, margin: 12, cell: 30, showMargin: true, showNodes: true, showPath: true,
  methods: new Set(['delaunay']) };
let obstacles = [], polys = [], results = [];
const markers = { start: [60, 300], end: [840, 300] };

const svg = d3.select('#scene');
const gBg = svg.append('g').attr('class', 'layer-ro');
const gCells = svg.append('g').attr('class', 'layer-ro');
const gInfl = svg.append('g').attr('class', 'layer-ro');
const gObs = svg.append('g');
const gGraph = svg.append('g').attr('class', 'layer-ro');
const gPath = svg.append('g').attr('class', 'layer-ro');
const gMark = svg.append('g');

for (let x = 50; x < W; x += 50) gBg.append('line').attr('class', 'bg-grid').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', H);
for (let y = 50; y < H; y += 50) gBg.append('line').attr('class', 'bg-grid').attr('y1', y).attr('y2', y).attr('x1', 0).attr('x2', W);

const pathOf = pts => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z';

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; rebuild(); });
}

function rebuild() {
  polys = obstacles.map(o => makePoly(inflate(o.pts, state.margin)));
  results = Object.keys(METHODS).filter(id => state.methods.has(id)).map(id => {
    const t = performance.now();
    const r = METHODS[id].build(polys, state);
    r.id = id;
    r.ms = performance.now() - t;
    return r;
  });
  repath();
  drawStructures();
}

function repath() {
  for (const r of results) {
    r.path = r.kind === 'mesh' ? meshPath(r, markers.start, markers.end) : graphPath(r, polys, markers.start, markers.end, r.k);
  }
  drawPaths();
  drawStats();
}

function drawObstacles() {
  gObs.selectAll('path').data(obstacles, d => d.id).join(
    enter => enter.append('path').attr('class', 'obstacle').attr('opacity', 0)
      .call(e => e.transition().duration(400).attr('opacity', 1)),
    update => update,
    exit => exit.remove(),
  ).attr('d', d => pathOf(d.pts));
  gObs.selectAll('path').call(dragObstacles);
}

function dragObstacles(sel) {
  sel.call(d3.drag()
    .subject((e, d) => ({ x: d.cx, y: d.cy }))
    .on('drag', function (e, d) {
      if (tryMove(d, e.x, e.y, obstacles) || tryMove(d, e.x, d.cy, obstacles) || tryMove(d, d.cx, e.y, obstacles)) {
        d3.select(this).attr('d', pathOf(d.pts));
        schedule();
      }
    }));
}

function drawStructures() {
  gInfl.selectAll('path').data(state.showMargin ? polys : []).join('path')
    .attr('class', 'inflated').attr('d', p => pathOf(p.pts));

  const cg = gCells.selectAll('g').data(results, d => d.id).join('g').style('--c', d => METHODS[d.id].color);
  cg.selectAll('path').data(d => d.cells || []).join('path')
    .attr('class', c => c.blocked ? 'cell blocked' : 'cell').attr('d', c => pathOf(c.pts));

  const gg = gGraph.selectAll('g').data(results, d => d.id).join('g').style('--c', d => METHODS[d.id].color);
  gg.selectAll('path.edges').data(d => [d]).join('path').attr('class', 'edges')
    .attr('d', r => r.edges.map(([i, j]) =>
      `M${r.nodes[i][0].toFixed(1)},${r.nodes[i][1].toFixed(1)}L${r.nodes[j][0].toFixed(1)},${r.nodes[j][1].toFixed(1)}`).join(''));
  gg.selectAll('circle').data(d => state.showNodes ? d.nodes : []).join('circle')
    .attr('cx', n => n[0]).attr('cy', n => n[1]).attr('r', 2.2);
}

function drawPaths() {
  const items = [];
  if (state.showPath) {
    for (const r of results) {
      if (!r.path) continue;
      const d = 'M' + r.path.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
      items.push({ d, color: '#fff', w: 5.5 }, { d, color: METHODS[r.id].color, w: 3 });
    }
  }
  gPath.selectAll('path').data(items).join('path').attr('class', 'path')
    .attr('d', d => d.d).attr('stroke', d => d.color).attr('stroke-width', d => d.w);
}

function drawStats() {
  const rows = results.map(r => {
    const m = METHODS[r.id];
    const parts = [`${r.nodes.length} nodos`, `${r.edges.length} aristas`];
    if (r.kind === 'mesh') parts.push(`${r.cells.length} celdas`);
    const path = r.path ? `camino ${pathLength(r.path).toFixed(0)} px` : 'sin camino';
    return `<li><span class="swatch" style="background:${m.color}"></span><b>${m.label}</b><br>${parts.join(', ')} · ${r.ms.toFixed(1)} ms<br>${path}</li>`;
  });
  d3.select('#stats').html(`<li>${obstacles.length} obstáculos</li>` + rows.join(''));
}

function randomFree(xmin, xmax) {
  for (let i = 0; i < 300; i++) {
    const p = [xmin + Math.random() * (xmax - xmin), 30 + Math.random() * (H - 60)];
    if (free(polys, p[0], p[1])) return p;
  }
  return [(xmin + xmax) / 2, H - 15];
}

function regenerate() {
  obstacles = generate(state.count, state.size);
  polys = obstacles.map(o => makePoly(inflate(o.pts, state.margin)));
  markers.start = randomFree(20, W * 0.2);
  markers.end = randomFree(W * 0.8, W - 20);
  drawObstacles();
  drawMarkers();
  rebuild();
}

function drawMarkers() {
  const data = [{ k: 'start', label: 'A', color: '#22c55e' }, { k: 'end', label: 'B', color: '#ef4444' }];
  const g = gMark.selectAll('g').data(data, d => d.k).join(enter => {
    const e = enter.append('g');
    e.append('circle').attr('class', 'marker').attr('r', 11).attr('fill', d => d.color);
    e.append('text').attr('class', 'marker-label').text(d => d.label);
    e.call(d3.drag().on('drag', (ev, d) => {
      markers[d.k] = [Math.max(0, Math.min(W, ev.x)), Math.max(0, Math.min(H, ev.y))];
      drawMarkers();
      repath();
    }));
    return e;
  });
  g.attr('transform', d => `translate(${markers[d.k][0]},${markers[d.k][1]})`);
}

function setupControls() {
  d3.select('#generate').on('click', regenerate);

  d3.selectAll('input[data-key]').each(function () {
    const key = this.dataset.key;
    const out = d3.select(`output[data-for=${key}]`);
    const sync = () => { state[key] = +this.value; out.text(this.value); };
    sync();
    d3.select(this).on('input', () => {
      sync();
      if (key === 'margin' || key === 'cell') rebuild();
    });
  });

  d3.selectAll('input[data-layer]').on('input', function () {
    state[this.dataset.layer] = this.checked;
    drawStructures();
    drawPaths();
  });

  d3.select('#methods').selectAll('label').data(Object.entries(METHODS)).join('label')
    .attr('class', 'check method')
    .html(([id, m]) => `<input type="checkbox" value="${id}" ${state.methods.has(id) ? 'checked' : ''}>
      <span><span class="swatch" style="background:${m.color}"></span>${m.label}<small>${m.desc}</small></span>`)
    .select('input').on('input', function () {
      this.checked ? state.methods.add(this.value) : state.methods.delete(this.value);
      rebuild();
    });
}

setupControls();
regenerate();
