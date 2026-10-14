// Logos are drawn straight from the reference SVG paths (no raster copies): same geometry, same fills.
export async function loadSVG(url) {
  const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), 'image/svg+xml');
  const svg = doc.querySelector('svg'), [, , w, h] = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
  const g = doc.querySelector('g'), m = /translate\(([-\d.]+)[,\s]+([-\d.]+)\)/.exec(g?.getAttribute('transform') ?? '') ?? [0, 0, 0];
  const paths = [...doc.querySelectorAll('path')].map(p => ({ d: p.getAttribute('d'), path: new Path2D(p.getAttribute('d')), fill: p.getAttribute('fill') }));
  return { w, h, tx: +m[1], ty: +m[2], paths };
}
// draw the logo with its top-left at (x, y) and width wpx; `alpha(i)` lets parts build up, the end state is the plain SVG
export function drawSVG(ctx, L, x, y, wpx, alpha = () => 1, offset = () => [0, 0]) {
  const s = wpx / L.w;
  L.paths.forEach((p, i) => { const a = alpha(i); if (a <= 0) return; const [ox, oy] = offset(i);
    ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.translate(x + ox, y + oy); ctx.scale(s, s); ctx.translate(L.tx, L.ty);
    ctx.fillStyle = p.fill; ctx.fill(p.path); ctx.restore(); });
}
// N points inside the chosen paths (seeded rejection sampling) in screen coordinates
export function samplePaths(L, idx, x, y, wpx, N, rnd) {
  const s = wpx / L.w, c = new OffscreenCanvas(8, 8).getContext('2d'), out = [];
  c.setTransform(s, 0, 0, s, x + L.tx * s, y + L.ty * s);
  for (let k = 0; out.length < N && k < N * 400; k++) {
    const px = x + rnd() * wpx, py = y + rnd() * L.h * s;
    if (idx.some(i => c.isPointInPath(L.paths[i].path, px, py))) out.push([px, py]);
  }
  return out;
}
