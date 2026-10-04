import { segBlocked } from './geometry.js';
import { makeAdj } from './astar.js';

export function buildVisibility(polys) {
  const nodes = polys.flatMap(p => p.pts);
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (!segBlocked(polys, nodes[i], nodes[j])) edges.push([i, j]);
    }
  }
  return { kind: 'graph', nodes, edges, adj: makeAdj(nodes, edges), k: Infinity };
}
