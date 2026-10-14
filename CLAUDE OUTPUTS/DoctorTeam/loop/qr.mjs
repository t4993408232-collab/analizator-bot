// Builds the QR matrices from config.json (error correction H, so the codes survive glare and a dirty screen).
//   node qr.mjs  -> assets/qr.json
import QRCode from 'qrcode';
import { readFileSync, writeFileSync } from 'node:fs';
const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url)));
const out = cfg.qr.map(({ url }) => { const q = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const n = q.modules.size, rows = []; for (let y = 0; y < n; y++) { let r = ''; for (let x = 0; x < n; x++) r += q.modules.get(x, y) ? '1' : '0'; rows.push(r); }
  console.log(`${url}\n  version ${q.version}, ${n}x${n} modules, EC level H`); return { url, n, rows }; });
writeFileSync(new URL('./assets/qr.json', import.meta.url), JSON.stringify(out));
