// manifest.json партии: raw-ссылки на ветку claude/ai-math-video, длительность — из ffprobe.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { VIDEOS } from './videos.js';
const DEST = resolve(import.meta.dirname, '..');
const RAW = 'https://raw.githubusercontent.com/t4993408232-collab/analizator-bot/claude/ai-math-video/CLAUDE%20OUTPUTS/ALISA/BATCH_v1/';
const dur = f => +(+execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', resolve(DEST, f)]).toString()).toFixed(2);
const M = VIDEOS.map(v => ({ order: v.order, id: v.id, title: v.hook, video_url: RAW + v.id + '.mp4', cover_url: RAW + v.id + '_cover.png',
  instagram_caption: v.caption, duration_sec: dur(v.id + '.mp4') }));
writeFileSync(resolve(DEST, 'manifest.json'), JSON.stringify(M, null, 2) + '\n'); console.log('manifest.json:', M.length, 'items');
