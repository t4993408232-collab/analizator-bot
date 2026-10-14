# Видео из кода: разбор Silver Air + библиотека решений

## 1. Как сделан «Silver Air» (rocketmandrey/silver-air-stained-glass)

Клип на 3:33 под трек из Suno. В нём нет ни одного кадра видеогенерации: всё считается в шейдере и рендерится покадрово.

### Конвейер

```
assets/timing.json (биты, сильные доли) ─┐
assets/lyrics.json (строки + тайминги) ──┤
glass.js  → витражи режутся на стёкла ───┤→ chapel.js: window.frame(t)  →  render.mjs  →  ffmpeg  →  MP4
three.js + один большой фрагментный шейдер ┘   (кадр = чистая функция t)     (headless Chrome)
```

| Слой | Что там | Приём |
|---|---|---|
| **Стёкла** (`glass.js`, 467 строк) | Фигура рисуется Canvas2D-путями (bezier) с метками цвета, затем режется на стёкла: взвешенная CVT (Lloyd) с учётом границ меток. Свинец считается через distance transform, пайка — капли. Всё детерминировано (seeded RNG) | Процедурная «картина → мозаика». Результат упакован в DataTexture: цвет/толщина, id стекла, силуэт |
| **Капелла** (`chapel.js`, 646 строк) | Весь мир рейтрейсится в одном fragment shader: круглая башня, ниши с откосами (`sdArch`), купол с розой, кладка из fbm | SDF + аналитические пересечения, без мешей |
| **Стекло в кадре** | Толщина из fbm, полосатый рубин, «корды» (sin+fbm), пузыри, рассвет внутри выпуклого стекла (нормаль по bbox стекла) | Каждая деталь = 1–3 строки шума |
| **Свет** | Солнце проходит через окно и даёт цветное пятно на полу и лучи в пыльном воздухе | Volumetric-марш по лучу, проекция окна на пол |
| **Осколки** | Таблица кусков во float-текстуре (2048×8): позиция, базис, uv. Один интегратор: гравитация, сопротивление, вращение, один мягкий отскок. Лёгшие куски «запекаются» в карту пола (DEC 1024²) | GPU-таблица частиц + decal-карта, чтобы куча не «перекладывалась» |
| **Тайминг** | `keyed(t, [[t,v],…])` — ключи со smoothstep; `pulseAt(t, beats, k)` — экспоненциальный удар на долях; `ramp(t,a,b)`; фаза такта → «дыхание» света | Все параметры = функции t, привязанные к битам и строкам текста |
| **Камера** | Почти один дубль: сплайн-путь с касательными, плавная скорость, одна склейка через темноту | `pathAt`, `camAt(t)` |
| **Пост** | Два джиттер-прохода, которые усредняются (AA), UnrealBloom, ACES tone mapping | three.js EffectComposer |
| **Рендер** (`render.mjs`) | puppeteer-core → `await frame(t)` → квадрат 1080 вписывается в вертикальный кадр 1080×1920 с размытым фоном, титром и строкой текста → JPEG в pipe ffmpeg → libx264 + AAC | 24 fps, детерминированно, любой кадр можно отрендерить отдельно |

### Главные принципы, которые стоит забрать

1. **Кадр — чистая функция времени.** `window.frame(t)` не хранит состояние между кадрами. Поэтому можно перерендерить любой кусок, отлаживать по секундам (`frame(186)` в консоли) и рендерить параллельно.
2. **Музыка — это данные.** Биты и сильные доли лежат в `timing.json`, строки — в `lyrics.json`. Визуальные события ставятся на конкретную долю: «последний бит перед бриджем», «души встречаются на сильной доле».
3. **Один шейдер вместо сцены.** SDF, шум и аналитический свет дают «дорогую» картинку без ассетов.
4. **Процедурные ассеты на старте.** Сложная геометрия считается один раз при загрузке (раскрой стёкол ~15 с) и уходит в текстуры.
5. **Headless Chrome + ffmpeg pipe.** Без экранной записи и без дропа кадров.

---

## 2. Библиотека: что есть на GitHub для видео из кода

Звёзды на 10.10.2026, проверено через GitHub Search API.

### Фреймворки программного видео
| Репо | ★ | Для чего |
|---|---|---|
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | 63k | Видео на React. Шаблоны, data-driven, персонализация. [skills](https://github.com/remotion-dev/skills) — навыки для агентов |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | 60k | HTML + GSAP → MP4, рассчитан на AI-агентов |
| [3b1b/manim](https://github.com/3b1b/manim) / [ManimCommunity/manim](https://github.com/ManimCommunity/manim) | 95k / 41k | Математические объяснялки, морфинг формул |
| [motion-canvas/motion-canvas](https://github.com/motion-canvas/motion-canvas) | 19k | Анимация на генераторах, точная синхронизация с озвучкой, анимация кода |
| [midrender/revideo](https://github.com/midrender/revideo) | 4k | Motion Canvas + headless API для серверного рендера |
| [Zulko/moviepy](https://github.com/Zulko/moviepy) | 15k | Монтаж на Python: нарезка, титры, композиты |
| [mifi/editly](https://github.com/mifi/editly) | 5.5k | JSON → видео, gl-transitions из коробки |
| [tnfe/FFCreator](https://github.com/tnfe/FFCreator) | 3k | Быстрые рекламные шорты на Node |
| [theatre-js/theatre](https://github.com/theatre-js/theatre) | 13k | Визуальные ключи для three.js и камер |

### Захват кадров
| Репо | ★ | Для чего |
|---|---|---|
| [tungs/timecut](https://github.com/tungs/timecut) / [timesnap](https://github.com/tungs/timesnap) | 650 / 240 | Подмена времени страницы → любая JS-анимация в ровные кадры |
| [spite/ccapture.js](https://github.com/spite/ccapture.js) | 3.8k | Захват canvas с фиксированным fps |
| [Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny) | 7.3k | WebCodecs: MP4 прямо в браузере, без ffmpeg |
| [patriciogonzalezvivo/glslViewer](https://github.com/patriciogonzalezvivo/glslViewer) | 5.3k | Шейдер → кадры из консоли, без браузера |

### Шейдеры и WebGL
| Репо | ★ | Стиль |
|---|---|---|
| [mrdoob/three.js](https://github.com/mrdoob/three.js) + [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) | 116k / 2.9k | 3D, bloom, глитч, DOF, кинолук |
| [patriciogonzalezvivo/lygia](https://github.com/patriciogonzalezvivo/lygia) | 3.5k | Модульные GLSL-функции: шум, SDF, цвет, блюр, свет |
| [patriciogonzalezvivo/thebookofshaders](https://github.com/patriciogonzalezvivo/thebookofshaders) | 7k | Учебник: паттерны, шум, клетки |
| [gl-transitions/gl-transitions](https://github.com/gl-transitions/gl-transitions) | 2.1k | ~100 GLSL-переходов (есть [фильтр для ffmpeg](https://github.com/transitive-bullshit/ffmpeg-gl-transition)) |
| [hydra-synth/hydra](https://github.com/hydra-synth/hydra) | 2.7k | Видеофидбек, муар, VJ-психоделия |
| [jberg/butterchurn](https://github.com/jberg/butterchurn) | 2k | Milkdrop / Winamp-визуализации, тысячи пресетов |
| [oframe/ogl](https://github.com/oframe/ogl), [regl](https://github.com/regl-project/regl), [twgl](https://github.com/greggman/twgl.js) | 4.7k / 5.6k / 3k | Лёгкие WebGL-обёртки |
| [fand/vfx-js](https://github.com/fand/vfx-js), [curtainsjs](https://github.com/martinlaxenaire/curtainsjs) | 1.2k / 1.8k | Шейдерные эффекты на DOM, тексте и картинках |
| [pixijs/pixijs](https://github.com/pixijs/pixijs) | 48k | Быстрый 2D: спрайты, displacement, glow |

### Генеративное искусство
| Репо | ★ | Стиль |
|---|---|---|
| [processing/p5.js](https://github.com/processing/p5.js) | 24k | Flow fields, частицы, генеративный постер |
| [mattdesl/canvas-sketch](https://github.com/mattdesl/canvas-sketch) | 5.3k | Зацикленные анимации с экспортом MP4, принт |
| [thi-ng/umbrella](https://github.com/thi-ng/umbrella) | 3.8k | Алгоритмическая геометрия, цветовые теории |
| [rough-stuff/rough](https://github.com/rough-stuff/rough) | 21k | Стиль «от руки», скетч |
| [metafizzy/zdog](https://github.com/metafizzy/zdog) | 10.7k | Игрушечный псевдо-3D |
| [mxgmn/WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse) | 25k | Процедурные паттерны, тайлы |
| [jasonwebb/morphogenesis-resources](https://github.com/jasonwebb/morphogenesis-resources) | 2.3k | Рост, реакция-диффузия, DLA |

### Моушн и анимация
| Репо | ★ | Стиль |
|---|---|---|
| [greensock/GSAP](https://github.com/greensock/GSAP) | 29k | Таймлайны, SplitText, MorphSVG — стандарт кинетики |
| [juliangarnier/anime](https://github.com/juliangarnier/anime) | 73k | Stagger-сетки, SVG |
| [airbnb/lottie-web](https://github.com/airbnb/lottie-web) / [dotlottie-web](https://github.com/LottieFiles/dotlottie-web) | 32k / 0.9k | Анимации из After Effects в код |
| [rive-app/rive-wasm](https://github.com/rive-app/rive-wasm) | 1k | Персонажи с state machines |
| [mojs/mojs](https://github.com/mojs/mojs) | 19k | Бёрсты, конфетти-акценты |
| [maxwellito/vivus](https://github.com/maxwellito/vivus) | 15k | Линия рисуется (логотипы, подписи) |

### Звук → картинка
| Репо | ★ | Для чего |
|---|---|---|
| [librosa/librosa](https://github.com/librosa/librosa) | 8.7k | Биты, onset, энергия, хрома — офлайн-карта для монтажа |
| [CPJKU/madmom](https://github.com/CPJKU/madmom) | 1.7k | Нейросетевые даунбиты: склейки на сильную долю |
| [aubio/aubio](https://github.com/aubio/aubio), [essentia.js](https://github.com/MTG/essentia.js), [meyda](https://github.com/meyda/meyda) | 3.8k / 0.9k / 1.7k | Темп, onset, RMS, спектр (CLI, браузер) |
| [hvianna/audioMotion-analyzer](https://github.com/hvianna/audioMotion-analyzer), [wavesurfer.js](https://github.com/katspaugh/wavesurfer.js) | 1k / 10k | Спектр-бары, волны для аудиограмм |

### Текст и субтитры
| Репо | ★ | Для чего |
|---|---|---|
| [m-bain/whisperX](https://github.com/m-bain/whisperX), [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | 24k / 26k | Пословные таймкоды: караоке и TikTok-капшены |
| [remotion-dev/template-tiktok](https://github.com/remotion-dev/template-tiktok) | 285 | Готовые прыгающие субтитры |
| [shshaw/Splitting](https://github.com/shshaw/Splitting) | 1.8k | Разбивка на буквы для stagger-анимации |
| [protectwise/troika](https://github.com/protectwise/troika) | 2k | Чёткий SDF-текст в three.js |

### Awesome-списки и витрины
- [terkelg/awesome-creative-coding](https://github.com/terkelg/awesome-creative-coding) (15k) — главный список по креативному кодингу
- [willianjusten/awesome-audio-visualization](https://github.com/willianjusten/awesome-audio-visualization) (5.1k)
- [vanrez-nez/awesome-glsl](https://github.com/vanrez-nez/awesome-glsl) (1.4k)
- [kosmos/awesome-generative-art](https://github.com/kosmos/awesome-generative-art) (1.8k)
- [psenough/teach_yourself_demoscene_in_14_days](https://github.com/psenough/teach_yourself_demoscene_in_14_days) (2.3k)
- [remotion-dev/github-unwrapped](https://github.com/remotion-dev/github-unwrapped) — эталон data-driven видео
- [farbrausch/fr_public](https://github.com/farbrausch/fr_public) — исходники демосцены
- [frankxai/awesome-motion-design-agent-skills](https://github.com/frankxai/awesome-motion-design-agent-skills) — навыки агентов для GSAP, Remotion, Lottie

---

## 3. Карта: стиль → чем делать

| Хочу | Стек |
|---|---|
| Музыкальный клип с «дорогой» картинкой | Шейдер + `timing.json` из librosa/madmom + headless-рендер (подход Silver Air, `kit/`) |
| Шаблонные ролики, персонализация, данные | Remotion или hyperframes |
| Объяснялки, формулы, схемы | Manim, Motion Canvas |
| Кинетическая типографика | GSAP SplitText / Splitting.js; в шейдерном клипе — Canvas2D поверх (`kit/timeline.js → lyric()`) |
| Субтитры TikTok-стиля | whisperX → Remotion template-tiktok |
| Переходы | gl-transitions (в kit: burn, iris, glitch, fade) |
| Кинолук: bloom, аберрация, зерно | pmndrs/postprocessing или пост-проход в kit |
| Психоделия, VJ | hydra, butterchurn |
| Генеративный постер в движении | p5.js / canvas-sketch + palettes iq |
| 3D-сцена с камерой | three.js + Theatre.js для ключей |
| Нарезка под бит из готовых видео | librosa → MoviePy / editly |

---

## 4. Что собрано и как использовать — `kit/`

Стартовый кит по методу Silver Air: без three.js, на одном WebGL2, с переносимым рендером.

```
kit/
  lib/time.js     keyed, ramp, pulseAt, beatInfo, sectionAt — тайминг как функции t
  lib/glsl.js     шум, fbm, domain warp, cosine-палитры iq, SDF (арка, сердце), Voronoi с границей, ACES
  lib/gl.js       движок: сцена → float RT → переход → пост (mip-bloom, аберрация, зерно, виньетка)
  scenes/         5 стилей: stained (витраж + волна света + разлёт стёкол), silk (domain warp),
                  tunnel (неоновый тоннель на бит), riso (ризограф: halftone + смещение красок), stars (финал: осколки-звёзды и луч)
  timeline.js     сам ролик: секции, переходы, юниформы от битов, кинетический текст
  scenes/void.js  тёмный «терминальный» фон под текст
  lib/synth.js    офлайн-синтезатор: бочка, хлопок, хэты, бас, Karplus-Strong, пэд, стекло/колокол,
                  ASMR-фоли (клавиша, треск, шелест, «зап», пресс, удар, разгон), ревербератор, сайдчейн, WAV
  clips/asmr/     сюжетный ролик «видео без графики и монтажа — только код»:
                  story.js (сценарий — общий для картинки и звука), clip.js (картинка), sound.mjs (музыка)
  beats.mjs       биты из аудио без Python (ffmpeg → spectral flux → темп → сетка → timing.json)
  render.mjs      headless Chromium → JPEG pipe → ffmpeg (Linux/macOS, SwiftShader или GPU)
```

**Новый ролик за 4 шага:**

1. Положи трек в `assets/track.m4a` и запусти `node beats.mjs assets/track.m4a`. Для точных даунбитов на сложной музыке используй librosa или madmom.
2. Впиши строки текста в `assets/lyrics.json` в формате `[start, end, "text", "serif|mono|ink"]`.
3. В `timeline.js` расставь секции `S`: стиль, переход и юниформы как функции `t` и `c`. В `c` лежат `kick` (удар на каждой доле), `down` (сильная доля), `wave` (время с начала такта) и `barPhase`.
4. Посмотри контакт-лист: `node render.mjs --sheet --scale .5 --at 2,7,12`. Финальный рендер: `node render.mjs`.

**Новый стиль** — это файл в `scenes/` с функцией `vec3 scene(vec2 uv, vec2 p)`. В нём доступны `uT, uBeat, uBar, uP, uA, uB` и вся `glsl.js`. Подключается одной строкой в `timeline.js`.

---

## 5. Сюжетный ролик «только код» — `clips/asmr/`

32 с, 1080×1920, 120 BPM. И картинка, и звук сгенерированы кодом: ни одного ассета, кроме двух шрифтов Google Fonts.

| Время | Картинка | Звук |
|---|---|---|
| 0–3,3 | Терминал: печатается «> claude, сделай видео» | Щелчок клавиши на каждую букву (время берётся из `story.js`) |
| 3,3 | Enter → «⏺ пишу код…» | Тяжёлая клавиша Enter |
| 4 / 5 / 6 | «без графики» · «без монтажа» · **«только код»** | Удар + бочка + стеклянный звон на каждое слово |
| 6,5–8 | Снизу вверх бежит настоящий GLSL-код сцен | Разгон, «вычислительные» тики, дробь |
| 8 | Дроп: код сгорает → витраж, подпись `voronoi(p)` | Крэш, бочка 4/4, катящийся бас, арпеджио; звон стекла |
| 12 | Шёлк, `fbm(p + 4.*fbm(p))` | Шелест ткани на каждый такт |
| 16 | Тоннель, `.35 / length(p)` | «Зап» на каждую долю |
| 20 | Ризограф, `halftone(p, ink)` | Стук пресса на восьмые |
| 24 | Витраж разбивается по стеклу, «и звук — тоже код» | Треск, удар, каскад из 46 осколков |
| 26–29 | Звёзды и луч: «0 кадров графики», «0 склеек», «только код» | Колокола на каждой строке, мерцание |
| 29–32 | Печатается «claude code», над ним «видео = код» | Клавиши, финальный удар |

Подписи с кодом сами печатаются в начале каждой секции, и на каждый символ звучит тихий щелчок. Сверху весь ролик идёт счётчик кадров.

**Пересобрать:**
```bash
node clips/asmr/sound.mjs                 # музыка -> clips/asmr/track.m4a + timing.json
node render.mjs --clip asmr --sheet --scale .5 --at 2,6,9,13,25,30   # быстрая проверка кадров
node render.mjs --clip asmr               # out/asmr.mp4
```
Текст и тайминги правятся в `story.js`: картинка и звук подстроятся вместе.
