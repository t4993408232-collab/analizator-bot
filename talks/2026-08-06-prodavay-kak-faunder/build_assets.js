// Генератор графики для презентации: фоны-градиенты и иконки.
// node build_assets.js  ->  assets/*.png
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const Fi = require("react-icons/fi");

const OUT = path.join(__dirname, "assets");
fs.mkdirSync(OUT, { recursive: true });

const BG = "#12141A";
const W = 1600, H = 900;

// ---------- фоны ----------
// Тёмная база + мягкое цветное свечение. Градиенты pptxgenjs не умеет,
// поэтому кладём их картинкой на фон слайда.
function bgSVG(glows) {
  const defs = glows.map((g, i) => `
    <radialGradient id="g${i}" cx="${g.cx}%" cy="${g.cy}%" r="${g.r}%">
      <stop offset="0%" stop-color="${g.color}" stop-opacity="${g.a}"/>
      <stop offset="55%" stop-color="${g.color}" stop-opacity="${(g.a * 0.28).toFixed(3)}"/>
      <stop offset="100%" stop-color="${g.color}" stop-opacity="0"/>
    </radialGradient>`).join("");
  const rects = glows.map((_, i) => `<rect width="${W}" height="${H}" fill="url(#g${i})"/>`).join("");
  // микрошум поверх градиента — убирает полосы (banding) на тёмном фоне
  const noise = `
    <filter id="noise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>${defs}${noise}</defs>
    <rect width="${W}" height="${H}" fill="${BG}"/>
    ${rects}
    <rect width="${W}" height="${H}" filter="url(#noise)" opacity="0.035"/>
  </svg>`;
}

const BACKGROUNDS = {
  // титул и финал — самые «дорогие», свечение крупное
  "bg-title": [
    { cx: 16, cy: 88, r: 78, color: "#F0862E", a: 0.20 },
    { cx: 88, cy: 12, r: 62, color: "#4A90D9", a: 0.13 },
  ],
  "bg-hero": [ // слайды с крупной цифрой
    { cx: 22, cy: 46, r: 62, color: "#F0862E", a: 0.15 },
  ],
  "bg-gos": [
    { cx: 92, cy: 8, r: 58, color: "#4A90D9", a: 0.11 },
    { cx: 4, cy: 96, r: 46, color: "#4A90D9", a: 0.06 },
  ],
  "bg-corp": [
    { cx: 92, cy: 8, r: 58, color: "#9B6BD9", a: 0.11 },
    { cx: 4, cy: 96, r: 46, color: "#9B6BD9", a: 0.06 },
  ],
  "bg-com": [
    { cx: 92, cy: 8, r: 58, color: "#F0862E", a: 0.11 },
    { cx: 4, cy: 96, r: 46, color: "#F0862E", a: 0.06 },
  ],
  "bg-money": [
    { cx: 90, cy: 10, r: 60, color: "#E5484D", a: 0.13 },
    { cx: 8, cy: 92, r: 48, color: "#E5484D", a: 0.07 },
  ],
  "bg-neutral": [
    { cx: 90, cy: 10, r: 55, color: "#8AA0C8", a: 0.07 },
  ],
  "bg-good": [
    { cx: 88, cy: 12, r: 58, color: "#3DAE72", a: 0.11 },
    { cx: 6, cy: 94, r: 46, color: "#3DAE72", a: 0.06 },
  ],
};

// ---------- иконки ----------
const ICONS = {
  "ic-gos":      ["FiFileText",  "#4A90D9"],
  "ic-corp":     ["FiLayers",    "#9B6BD9"],
  "ic-com":      ["FiUsers",     "#F0862E"],
  "ic-history":  ["FiClock",     "#F0862E"],
  "ic-contract": ["FiFileText",  "#F0862E"],
  "ic-folder":   ["FiFolder",    "#F0862E"],
  "ic-award":    ["FiAward",     "#F0862E"],
  "ic-team":     ["FiUsers",     "#F0862E"],
  "ic-turnover": ["FiTrendingUp","#F0862E"],
  "ic-shield":   ["FiShield",    "#3DAE72"],
  "ic-search":   ["FiSearch",    "#3DAE72"],
  "ic-calc":     ["FiPieChart",  "#3DAE72"],
  "ic-truck":    ["FiTruck",     "#E5484D"],
  "ic-alert":    ["FiAlertTriangle", "#E5484D"],
};

function iconSVG(name, color, size = 256) {
  const Cmp = Fi[name];
  if (!Cmp) throw new Error("нет иконки " + name);
  let svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Cmp, { size, strokeWidth: 1.8 })
  );
  // librsvg не разрешает currentColor из style — подставляем цвет явно
  svg = svg.replace(/currentColor/g, color);
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  if (!/width="/.test(svg)) svg = svg.replace("<svg", `<svg width="${size}" height="${size}"`);
  return svg;
}

(async () => {
  for (const [name, glows] of Object.entries(BACKGROUNDS)) {
    await sharp(Buffer.from(bgSVG(glows)))
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(path.join(OUT, name + ".png"));
  }
  for (const [name, [icon, color]] of Object.entries(ICONS)) {
    await sharp(Buffer.from(iconSVG(icon, color)))
      .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, name + ".png"));
  }
  const files = fs.readdirSync(OUT);
  const kb = files.reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0) / 1024;
  console.log(`Готово: ${files.length} файлов, ${kb.toFixed(0)} КБ`);
})();
