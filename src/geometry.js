export const W = 900;
export const H = 600;
const EPS = 1e-6;

export function area(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

// Orientación con área positiva: el interior queda a la izquierda de cada arista (cross > 0).
export function orient(pts) {
  return area(pts) < 0 ? pts.slice().reverse() : pts;
}

export function makePoly(pts) {
  pts = orient(pts);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const len = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    return Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  });
  return {
    pts, len,
    minx: Math.min(...xs), maxx: Math.max(...xs),
    miny: Math.min(...ys), maxy: Math.max(...ys),
  };
}

// Expande un polígono convexo con bisel (distancia exacta m, sin picos en ángulos agudos).
export function inflate(pts, m) {
  if (m < 0.5) return pts;
  const n = pts.length, out = [];
  const normal = (a, b) => {
    const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1;
    return [ey / l, -ex / l];
  };
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const np = normal(pts[(i + n - 1) % n], p), nn = normal(p, pts[(i + 1) % n]);
    out.push([p[0] + np[0] * m, p[1] + np[1] * m], [p[0] + nn[0] * m, p[1] + nn[1] * m]);
  }
  return out;
}

// Punto estrictamente dentro del polígono.
export function inside(poly, x, y) {
  if (x <= poly.minx || x >= poly.maxx || y <= poly.miny || y >= poly.maxy) return false;
  const { pts, len } = poly;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if ((((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / len[i]) <= EPS) return false;
  }
  return true;
}

// Punto dentro o sobre el borde de un polígono convexo (pts ya orientados).
export function containsConvex(pts, x, y) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    if ((((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / l) < -EPS) return false;
  }
  return true;
}

export function free(polys, x, y) {
  return x >= 0 && x <= W && y >= 0 && y <= H && !polys.some(p => inside(p, x, y));
}

// El segmento atraviesa el interior de algún polígono (recorte de Cyrus-Beck).
export function segBlocked(polys, a, b) {
  const minx = Math.min(a[0], b[0]), maxx = Math.max(a[0], b[0]);
  const miny = Math.min(a[1], b[1]), maxy = Math.max(a[1], b[1]);
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const poly of polys) {
    if (maxx <= poly.minx || minx >= poly.maxx || maxy <= poly.miny || miny >= poly.maxy) continue;
    let t0 = 0, t1 = 1, ok = true;
    const { pts, len } = poly;
    for (let i = 0; i < pts.length; i++) {
      const v = pts[i], w = pts[(i + 1) % pts.length];
      const ex = w[0] - v[0], ey = w[1] - v[1];
      const c0 = (ex * (a[1] - v[1]) - ey * (a[0] - v[0])) / len[i];
      const c1 = (ex * dy - ey * dx) / len[i];
      if (Math.abs(c1) < 1e-9) {
        if (c0 <= EPS) { ok = false; break; }
      } else {
        const t = (EPS - c0) / c1;
        if (c1 > 0) { if (t > t0) t0 = t; } else if (t < t1) t1 = t;
        if (t1 - t0 <= 1e-9) { ok = false; break; }
      }
    }
    if (ok) return true;
  }
  return false;
}

// Puntos a lo largo del contorno, con separación máxima `spacing`.
export function sampleEdges(pts, spacing) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing));
    for (let j = 0; j < k; j++) {
      const p = [a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k];
      const q = out[out.length - 1];
      if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.5) out.push(p);
    }
  }
  return out;
}

// Puntos del borde del escenario; el tercer valor es el lado (0..3).
export function borderPoints(spacing) {
  const kx = Math.ceil(W / spacing), ky = Math.ceil(H / spacing), out = [];
  for (let i = 0; i < kx; i++) out.push([W * i / kx, 0, 0], [W - W * i / kx, H, 2]);
  for (let j = 0; j < ky; j++) out.push([W, H * j / ky, 1], [0, H - H * j / ky, 3]);
  return out;
}
