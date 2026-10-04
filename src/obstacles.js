import { W, H, orient } from './geometry.js';

export const MAX_MARGIN = 30;
// Separación entre círculos envolventes: el margen máximo nunca solapa dos obstáculos.
const GAP = 2 * MAX_MARGIN + 4;
const PAD = MAX_MARGIN + 2;
let nextId = 0;

// Puntos sobre una elipse rotada: el polígono resultante siempre es convexo.
function randomPolygon(cx, cy, r) {
  const n = 3 + Math.floor(Math.random() * 6);
  const rot = Math.random() * Math.PI * 2;
  const ry = r * (0.5 + Math.random() * 0.5);
  const step = 2 * Math.PI / n, base = Math.random() * 2 * Math.PI;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = base + i * step + (Math.random() - 0.5) * step * 0.7;
    const ex = r * Math.cos(a), ey = ry * Math.sin(a);
    pts.push([cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot)]);
  }
  return orient(pts);
}

export function generate(count, size) {
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 80; tries++) {
    const r = size * (0.55 + 0.45 * Math.random());
    const x = PAD + r + Math.random() * (W - 2 * (PAD + r));
    const y = PAD + r + Math.random() * (H - 2 * (PAD + r));
    if (out.some(q => Math.hypot(q.cx - x, q.cy - y) < q.r + r + GAP)) continue;
    out.push({ id: nextId++, cx: x, cy: y, r, pts: randomPolygon(x, y, r) });
  }
  return out;
}

export function tryMove(o, x, y, all) {
  if (x - o.r < PAD || x + o.r > W - PAD || y - o.r < PAD || y + o.r > H - PAD) return false;
  if (all.some(q => q !== o && Math.hypot(q.cx - x, q.cy - y) < q.r + o.r + GAP)) return false;
  const dx = x - o.cx, dy = y - o.cy;
  o.pts = o.pts.map(p => [p[0] + dx, p[1] + dy]);
  o.cx = x;
  o.cy = y;
  return true;
}
