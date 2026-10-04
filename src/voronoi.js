import { W, H, free, segBlocked, sampleEdges, borderPoints } from './geometry.js';
import { makeAdj } from './astar.js';

// Roadmap: aristas de Voronoi entre muestras de obstáculos distintos (eje medial aproximado).
export function buildVoronoi(polys) {
  const sites = [], owner = [];
  polys.forEach((poly, pi) => sampleEdges(poly.pts, 18).forEach(p => { sites.push(p); owner.push(pi); }));
  borderPoints(36).forEach(p => { sites.push(p); owner.push(-1 - p[2]); });

  const del = d3.Delaunay.from(sites);
  const cc = del.voronoi([0, 0, W, H]).circumcenters;
  const { triangles, halfedges } = del;

  const nodeOf = new Map(), nodes = [];
  const getNode = t => {
    if (nodeOf.has(t)) return nodeOf.get(t);
    const x = cc[2 * t], y = cc[2 * t + 1];
    const id = free(polys, x, y) ? nodes.push([x, y]) - 1 : -1;
    nodeOf.set(t, id);
    return id;
  };

  const raw = [];
  for (let i = 0; i < halfedges.length; i++) {
    const j = halfedges[i];
    if (j < i) continue;
    if (owner[triangles[i]] === owner[triangles[j]]) continue;
    const a = getNode(Math.floor(i / 3)), b = getNode(Math.floor(j / 3));
    if (a < 0 || b < 0 || a === b) continue;
    if (!segBlocked(polys, nodes[a], nodes[b])) raw.push([a, b]);
  }

  // Se descartan nodos sin aristas.
  const remap = new Array(nodes.length).fill(-1), kept = [];
  for (const [a, b] of raw) for (const v of [a, b]) if (remap[v] < 0) remap[v] = kept.push(nodes[v]) - 1;
  const edges = raw.map(([a, b]) => [remap[a], remap[b]]);
  return { kind: 'graph', nodes: kept, edges, adj: makeAdj(kept, edges), k: 6 };
}
