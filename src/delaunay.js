import { W, H, free, inside, segBlocked, sampleEdges, borderPoints, orient } from './geometry.js';
import { makeAdj } from './astar.js';

// Triangulación de Delaunay conforme: los lados de los obstáculos se subdividen en tramos cortos
// para que aparezcan como aristas; se descartan los triángulos que los cruzan o los cubren.
export function buildDelaunay(polys) {
  const pts = [];
  polys.forEach(poly => pts.push(...sampleEdges(poly.pts, 45)));
  pts.push(...borderPoints(120));
  const sites = pts.filter(p => free(polys, p[0], p[1]));

  const { triangles, halfedges } = d3.Delaunay.from(sites);
  const cellOf = new Array(triangles.length / 3).fill(-1);
  const cells = [];
  for (let t = 0; t < triangles.length / 3; t++) {
    const tri = [0, 1, 2].map(k => sites[triangles[3 * t + k]]);
    const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    const ar = Math.abs((tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[2][0] - tri[0][0]) * (tri[1][1] - tri[0][1]));
    if (ar < 1e-3) continue;
    if (polys.some(p => inside(p, cx, cy))) continue;
    if ([0, 1, 2].some(k => segBlocked(polys, tri[k], tri[(k + 1) % 3]))) continue;
    cellOf[t] = cells.length;
    cells.push({ pts: orient(tri.map(p => [p[0], p[1]])), cx, cy });
  }

  const nodes = cells.map(c => [c.cx, c.cy]);
  const edges = [], portals = new Map(), N = cells.length;
  for (let i = 0; i < halfedges.length; i++) {
    const j = halfedges[i];
    if (j < i) continue;
    const a = cellOf[Math.floor(i / 3)], b = cellOf[Math.floor(j / 3)];
    if (a < 0 || b < 0) continue;
    const p = sites[triangles[i]], q = sites[triangles[i % 3 === 2 ? i - 2 : i + 1]];
    const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    edges.push([a, b]);
    portals.set(a * N + b, mid);
    portals.set(b * N + a, mid);
  }
  return { kind: 'mesh', nodes, edges, cells, portals, adj: makeAdj(nodes, edges) };
}
