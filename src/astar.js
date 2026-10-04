import { segBlocked, free, containsConvex } from './geometry.js';

export function makeAdj(nodes, edges) {
  const adj = nodes.map(() => []);
  for (const [i, j] of edges) {
    const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]);
    adj[i].push([j, d]);
    adj[j].push([i, d]);
  }
  return adj;
}

// A* con búsqueda lineal del mínimo en la lista abierta (suficiente para unos cientos de nodos).
export function astar(adj, pos, s, t) {
  const n = adj.length;
  const g = new Array(n).fill(Infinity), f = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  const h = i => Math.hypot(pos[i][0] - pos[t][0], pos[i][1] - pos[t][1]);
  g[s] = 0;
  f[s] = h(s);
  const open = [s];
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
    const u = open.splice(bi, 1)[0];
    if (done[u]) continue;
    done[u] = true;
    if (u === t) {
      const path = [];
      for (let v = t; v !== -1; v = prev[v]) path.push(v);
      return path.reverse();
    }
    for (const [v, c] of adj[u]) {
      const ng = g[u] + c;
      if (ng < g[v]) {
        g[v] = ng;
        f[v] = ng + h(v);
        prev[v] = u;
        open.push(v);
      }
    }
  }
  return null;
}

// Conecta inicio y fin a los k nodos visibles más cercanos y corre A*.
export function graphPath(g, polys, s, e, k) {
  if (!free(polys, s[0], s[1]) || !free(polys, e[0], e[1])) return null;
  if (!segBlocked(polys, s, e)) return [s, e];
  const n = g.nodes.length;
  const adj = g.adj.map(a => a.slice());
  adj.push([], []);
  const link = (p, pi) => {
    const sorted = g.nodes.map((q, i) => [i, Math.hypot(q[0] - p[0], q[1] - p[1])]).sort((a, b) => a[1] - b[1]);
    let cnt = 0;
    for (const [i, d] of sorted) {
      if (segBlocked(polys, p, g.nodes[i])) continue;
      adj[pi].push([i, d]);
      adj[i].push([pi, d]);
      if (++cnt >= k) break;
    }
  };
  link(s, n);
  link(e, n + 1);
  const pos = [...g.nodes, s, e];
  const ids = astar(adj, pos, n, n + 1);
  return ids && ids.map(i => pos[i]);
}

function locate(m, p) {
  return m.cells.findIndex(c => containsConvex(c.pts, p[0], p[1]));
}

// A* sobre las celdas; el camino pasa por el punto medio de cada portal.
export function meshPath(m, s, e) {
  const si = locate(m, s), ei = locate(m, e);
  if (si < 0 || ei < 0) return null;
  if (si === ei) return [s, e];
  const ids = astar(m.adj, m.nodes, si, ei);
  if (!ids) return null;
  const pts = [s];
  for (let k = 0; k < ids.length - 1; k++) pts.push(m.portals.get(ids[k] * m.cells.length + ids[k + 1]));
  pts.push(e);
  return pts;
}

export function pathLength(path) {
  let L = 0;
  for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return L;
}
