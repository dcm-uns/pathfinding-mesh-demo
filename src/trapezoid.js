import { W, H, orient } from './geometry.js';
import { makeAdj } from './astar.js';

const yAt = (l, x) => l.y1 + (l.y2 - l.y1) * (x - l.x1) / (l.x2 - l.x1);

// Descomposición trapezoidal: se corta en franjas verticales en cada vértice y luego se
// fusionan franjas contiguas que comparten techo y suelo. Supone obstáculos que no se solapan.
export function buildTrapezoids(polys) {
  const xs = [0, W];
  const edgesOf = polys.map((poly, pi) => {
    const es = [];
    poly.pts.forEach((a, i) => {
      const b = poly.pts[(i + 1) % poly.pts.length];
      xs.push(a[0]);
      if (a[0] === b[0]) return;
      const [l, r] = a[0] < b[0] ? [a, b] : [b, a];
      es.push({ id: `${pi}:${i}`, x1: l[0], y1: l[1], x2: r[0], y2: r[1] });
    });
    return es;
  });
  const X = [];
  for (const x of xs.sort((a, b) => a - b)) if (!X.length || x - X[X.length - 1] > 1e-3) X.push(x);

  const TOP = { id: 'T', x1: 0, y1: 0, x2: W, y2: 0 };
  const BOT = { id: 'B', x1: 0, y1: H, x2: W, y2: H };
  const traps = [];
  let active = new Map();

  for (let k = 0; k < X.length - 1; k++) {
    const x0 = X[k], x1 = X[k + 1], xm = (x0 + x1) / 2;
    const spans = [];
    for (const es of edgesOf) {
      const cross = es.filter(l => l.x1 < xm && xm < l.x2).map(l => ({ l, y: yAt(l, xm) }));
      if (cross.length < 2) continue;
      cross.sort((a, b) => a.y - b.y);
      spans.push({ lo: cross[0], hi: cross[cross.length - 1] });
    }
    spans.sort((a, b) => a.lo.y - b.lo.y);
    const merged = [];
    for (const s of spans) {
      const last = merged[merged.length - 1];
      if (last && s.lo.y < last.hi.y) { if (s.hi.y > last.hi.y) last.hi = s.hi; } else merged.push({ ...s });
    }

    const next = new Map();
    let top = TOP;
    const emit = bot => {
      if (yAt(bot, xm) - yAt(top, xm) <= 0.5) return;
      const key = `${top.id}|${bot.id}`;
      const prev = active.get(key);
      let t;
      if (prev && Math.abs(prev.x1 - x0) < 1e-3) { t = prev; t.x1 = x1; } else { t = { top, bot, x0, x1 }; traps.push(t); }
      next.set(key, t);
    };
    for (const m of merged) { emit(m.lo.l); top = m.hi.l; }
    emit(BOT);
    active = next;
  }

  const cells = traps.map(t => {
    const raw = [[t.x0, yAt(t.top, t.x0)], [t.x1, yAt(t.top, t.x1)], [t.x1, yAt(t.bot, t.x1)], [t.x0, yAt(t.bot, t.x0)]];
    const pts = orient(raw.filter((p, i) => {
      const q = raw[(i + 1) % 4];
      return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-3;
    }));
    return { pts, cx: pts.reduce((s, p) => s + p[0], 0) / pts.length, cy: pts.reduce((s, p) => s + p[1], 0) / pts.length };
  });

  const nodes = cells.map(c => [c.cx, c.cy]);
  const edges = [], portals = new Map(), N = cells.length;
  for (let a = 0; a < N; a++) {
    for (let b = 0; b < N; b++) {
      const A = traps[a], B = traps[b];
      if (Math.abs(A.x1 - B.x0) > 1e-3) continue;
      const x = A.x1;
      const lo = Math.max(yAt(A.top, x), yAt(B.top, x)), hi = Math.min(yAt(A.bot, x), yAt(B.bot, x));
      if (hi - lo <= 1) continue;
      const mid = [x, (lo + hi) / 2];
      edges.push([a, b]);
      portals.set(a * N + b, mid);
      portals.set(b * N + a, mid);
    }
  }
  return { kind: 'mesh', nodes, edges, cells, portals, adj: makeAdj(nodes, edges) };
}
