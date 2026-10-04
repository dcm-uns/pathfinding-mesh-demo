import { W, H, free, segBlocked } from './geometry.js';
import { makeAdj } from './astar.js';

export function buildGrid(polys, cell) {
  const cols = Math.floor(W / cell), rows = Math.floor(H / cell);
  const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2;
  const idx = new Array(cols * rows).fill(-1);
  const nodes = [], cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = ox + c * cell, y0 = oy + r * cell;
      const cx = x0 + cell / 2, cy = y0 + cell / 2;
      const ok = free(polys, cx, cy);
      cells.push({ pts: [[x0, y0], [x0 + cell, y0], [x0 + cell, y0 + cell], [x0, y0 + cell]], blocked: !ok });
      if (ok) {
        idx[r * cols + c] = nodes.length;
        nodes.push([cx, cy]);
      }
    }
  }
  const edges = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = idx[r * cols + c];
      if (a < 0) continue;
      for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || cc >= cols || rr >= rows) continue;
        const b = idx[rr * cols + cc];
        if (b >= 0 && !segBlocked(polys, nodes[a], nodes[b])) edges.push([a, b]);
      }
    }
  }
  return { kind: 'graph', nodes, edges, cells, adj: makeAdj(nodes, edges), k: 8 };
}
