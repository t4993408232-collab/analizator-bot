"""
Event HR Job Poster v3.0
========================

Автономный агент, который ежедневно ищет вакансии креативной/event-индустрии,
проверяет их актуальность, переформатирует под стиль канала и публикует
в Telegram-канал. Источник-ядро — публичный API hh.ru (api.hh.ru).

Главные принципы (из спецификации):
  • Никогда не выдумывать вакансии и не менять факты.
  • Публиковать только живые, открывающиеся, недавние вакансии.
  • Не дублировать.
  • Если зарплата не указана — писать «По договорённости».

ВАЖНО: агент должен работать там, где есть сетевой доступ к api.hh.ru и
api.telegram.org (production-хост). В песочнице веб-сессии эти хосты могут
быть закрыты egress-политикой — тогда вызовы вернут ошибку сети, и это
ожидаемо.
"""

import os
import json
import logging
import time
from datetime import datetime, timezone, timedelta

import requests

logger = logging.getLogger("job_poster")

# --------------------------------------------------------------------------
# Конфигурация (через переменные окружения)
# --------------------------------------------------------------------------

BOT_TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID", "@event_hr")          # куда публикуем
OWNER_CHAT_ID = os.getenv("OWNER_CHAT_ID")                 # кому шлём отчёт
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini")
OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
ENABLE_IMAGES = os.getenv("ENABLE_IMAGES", "1") == "1"

# Источник: публичные Telegram-каналы с вакансиями (через t.me/s превью).
ENABLE_TELEGRAM_SOURCE = os.getenv("ENABLE_TELEGRAM_SOURCE", "1") == "1"
# Список каналов задаёт владелец, через запятую: "channel1,channel2".
JOB_SOURCE_CHANNELS = [c.strip() for c in os.getenv("JOB_SOURCE_CHANNELS", "").split(",") if c.strip()]

TG_API = f"https://api.telegram.org/bot{BOT_TOKEN}"
HH_API = "https://api.hh.ru"
HH_USER_AGENT = os.getenv("HH_USER_AGENT", "EventHRJobPoster/3.0 (+telegram @event_hr)")

# Файл для хранения уже опубликованных вакансий (антидубль).
# ВНИМАНИЕ: на хостах с эфемерной ФС файл не переживает рестарт —
# для продакшена замени на постоянное хранилище (БД/Redis/volume).
SEEN_FILE = os.getenv("SEEN_FILE", "seen_vacancies.json")

# --------------------------------------------------------------------------
# География: страны СНГ-региона из спецификации.
# hh.ru хранит страны в дереве /areas. Имена резолвим в id динамически,
# чтобы не хардкодить и не ошибиться.
# --------------------------------------------------------------------------

ALLOWED_COUNTRIES = [
    "Россия",
    "Беларусь",
    "Казахстан",
    "Армения",
    "Киргизия",      # Кыргызстан в номенклатуре hh
    "Узбекистан",
]

# --------------------------------------------------------------------------
# Профили вакансий (ключевые слова для отбора по названию должности).
# Матчим в первую очередь по названию вакансии, чтобы не ловить мусор.
# --------------------------------------------------------------------------

PROFILE_KEYWORDS = [
    # event / production
    "event", "ивент", "продюсер", "producer", "stage manager", "режиссёр",
    "production", "продакшн", "технический директор", "technical director",
    "technical producer", "production manager", "проджект", "project manager",
    "account manager", "аккаунт", "менеджер проект",
    # creative / design
    "creative", "креатив", "art director", "арт-директор", "арт директор",
    "designer", "дизайнер", "motion", "моушн", "3d", "graphic", "график",
    "exhibition", "выставочн", "interior", "интерьер", "architect", "архитектор",
    # marketing / pr / smm
    "copywriter", "копирайтер", "smm", "pr", "пиар", "marketing", "маркетинг",
    "brand", "бренд", "btl",
    # hr / sales / bizdev
    "hr", "эйчар", "recruiter", "рекрутер", "ресечер", "researcher",
    "business development", "бизнес-девелопмент", "sales", "продаж",
    # форматы
    "festival", "фестивал", "conference", "конференц", "concert", "концерт",
    "exhibition", "выставк", "sport event", "корпоратив", "experiential",
    # подрядчики
    "свет", "звук", "видеоинженер", "led", "сцена", "декоратор", "монтаж",
    "застройщик", "кейтеринг", "регистрац", "волонтёр", "хостес", "хостесс",
]

# Сопоставление профессия → объект для иллюстрации (из спецификации).
ILLUSTRATION_HINTS = [
    (("event", "продюсер", "producer", "stage", "режисс"), "сцена, свет, режиссёрский пульт"),
    (("designer", "дизайн", "graphic", "график"), "3D-композиция, макеты, графика"),
    (("motion", "моушн", "3d"), "абстрактная 3D-анимация, динамичные формы"),
    (("marketing", "маркет", "smm", "brand", "бренд"), "аналитика, диаграммы, digital-объекты"),
    (("pr", "пиар"), "микрофоны, камеры, пресс-зона"),
    (("architect", "архитектор", "exhibition", "выставоч", "interior", "интерьер"), "выставочный павильон, стенд"),
    (("hr", "эйчар", "recruiter", "рекрутер"), "минималистичные человеческие силуэты, связи"),
    (("свет", "звук", "led", "сцена", "монтаж", "застройщик"), "профессиональное сценическое оборудование"),
]
DEFAULT_ILLUSTRATION = "абстрактный современный объект креативной индустрии"


# --------------------------------------------------------------------------
# Антидубль: простое файловое хранилище опубликованных id
# --------------------------------------------------------------------------

def load_seen() -> set:
    try:
        with open(SEEN_FILE, "r", encoding="utf-8") as f:
            return set(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def save_seen(seen: set) -> None:
    try:
        with open(SEEN_FILE, "w", encoding="utf-8") as f:
            json.dump(sorted(seen), f, ensure_ascii=False)
    except OSError as e:
        logger.warning("Не удалось сохранить %s: %s", SEEN_FILE, e)


# --------------------------------------------------------------------------
# HH.ru API
# --------------------------------------------------------------------------

def _hh_get(path: str, params: dict = None) -> dict:
    r = requests.get(
        f"{HH_API}{path}",
        params=params or {},
        headers={"User-Agent": HH_USER_AGENT},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


_country_ids_cache = None


def resolve_country_ids() -> list:
    """Возвращает hh-id разрешённых стран (с кэшем на процесс)."""
    global _country_ids_cache
    if _country_ids_cache is not None:
        return _country_ids_cache
    ids = []
    try:
        areas = _hh_get("/areas")  # список стран верхнего уровня
        wanted = {c.lower() for c in ALLOWED_COUNTRIES}
        for country in areas:
            if country.get("name", "").lower() in wanted:
                ids.append(country["id"])
    except requests.RequestException as e:
        logger.error("Не удалось получить /areas: %s", e)
    _country_ids_cache = ids
    return ids


def search_vacancies(per_page: int = 50, max_pages: int = 2, days: int = 7) -> list:
    """
    Ищет свежие вакансии по профилям в разрешённых странах.
    Возвращает список «коротких» объектов вакансий hh.
    """
    found = {}
    query = " OR ".join(
        f'"{kw}"' for kw in
        ["event", "продюсер", "creative", "art director", "designer",
         "motion", "smm", "pr", "маркетинг", "brand", "hr", "recruiter",
         "продакшн", "project manager"]
    )
    for area in resolve_country_ids():
        for page in range(max_pages):
            try:
                data = _hh_get("/vacancies", {
                    "text": query,
                    "area": area,
                    "period": days,                 # за последние N дней
                    "order_by": "publication_time",
                    "per_page": per_page,
                    "page": page,
                })
            except requests.RequestException as e:
                logger.error("Ошибка поиска (area=%s, page=%s): %s", area, page, e)
                break
            items = data.get("items", [])
            for it in items:
                found[it["id"]] = it
            if page >= data.get("pages", 1) - 1:
                break
            time.sleep(0.2)  # бережём rate-limit hh
    return list(found.values())


def fetch_vacancy(vacancy_id: str) -> dict | None:
    """Полная карточка вакансии. None — если закрыта/удалена/недоступна."""
    try:
        v = _hh_get(f"/vacancies/{vacancy_id}")
    except requests.RequestException as e:
        logger.info("Вакансия %s недоступна: %s", vacancy_id, e)
        return None
    if v.get("archived"):       # закрыта
        return None
    return v


# --------------------------------------------------------------------------
# Фильтрация и приоритизация
# --------------------------------------------------------------------------

def matches_profile(name: str) -> bool:
    n = (name or "").lower()
    return any(kw in n for kw in PROFILE_KEYWORDS)


CITY_RANK = {"москва": 6, "moscow": 6, "санкт-петербург": 5, "saint": 5, "спб": 5}


def priority_score(v: dict) -> float:
    """Чем больше — тем выше в очереди (по приоритетам из спецификации)."""
    score = 0.0
    schedule = (v.get("schedule") or {}).get("id", "")
    if schedule == "remote" or v.get("work_format"):
        score += 30
    salary = v.get("salary")
    if salary:
        score += 20
        top = salary.get("to") or salary.get("from") or 0
        score += min(top / 10000.0, 50)     # вклад от величины зарплаты, с потолком
    city = ((v.get("area") or {}).get("name") or "").lower()
    for key, rank in CITY_RANK.items():
        if key in city:
            score += rank
            break
    return score


def format_salary(salary: dict | None) -> str:
    if not salary:
        return "По договорённости"
    cur = salary.get("currency", "RUR")
    cur = {"RUR": "₽", "BYR": "Br", "BYN": "Br", "KZT": "₸", "USD": "$", "EUR": "€"}.get(cur, cur)
    frm, to = salary.get("from"), salary.get("to")
    if frm and to:
        return f"{frm:,}–{to:,} {cur}".replace(",", " ")
    if frm:
        return f"от {frm:,} {cur}".replace(",", " ")
    if to:
        return f"до {to:,} {cur}".replace(",", " ")
    return "По договорённости"


# --------------------------------------------------------------------------
# Форматирование поста (по шаблону v3.0)
# --------------------------------------------------------------------------

def build_post(v: dict) -> str:
    """
    Собирает текст поста СТРОГО из данных вакансии.
    Если задан OpenAI — переупаковывает обязанности/требования в короткие
    буллеты, не меняя фактов. Контакт = настоящая ссылка hh (alternate_url).
    """
    title = v.get("name", "").strip()
    employer = ((v.get("employer") or {}).get("name") or "—").strip()
    city = ((v.get("area") or {}).get("name") or "—").strip()
    schedule = (v.get("schedule") or {}).get("id", "")
    if schedule == "remote":
        city = f"{city} / Remote"
    salary = format_salary(v.get("salary"))
    url = v.get("alternate_url", "")

    duties, reqs, plus = _extract_sections(v)
    return render_template(title, employer, city, salary, duties, reqs, plus, url)


def render_template(title, employer, city, salary, duties, reqs, plus, apply_link) -> str:
    """Единый шаблон поста v3.0 для любого источника."""
    lines = [
        f"🔥 {title}",
        "",
        f"🏢 {employer}",
        "",
        f"📍 {city}",
        "",
        f"💰 {salary}",
        "",
        "📝 Что предстоит делать",
    ]
    lines += [f"• {d}" for d in duties] or ["• см. описание по ссылке"]
    lines += ["", "✅ Требования"]
    lines += [f"• {r}" for r in reqs] or ["• см. описание по ссылке"]
    if plus:
        lines += ["", "⭐ Будет плюсом"]
        lines += [f"• {p}" for p in plus]
    lines += ["", "🔗 Откликнуться", apply_link, "", _hashtags(title)]
    return "\n".join(lines)


def _extract_sections(v: dict) -> tuple:
    """Достаёт буллеты обязанностей/требований. Через OpenAI, иначе — из key_skills/snippet."""
    if OPENAI_API_KEY:
        try:
            return _extract_sections_llm(v)
        except Exception as e:                       # noqa: BLE001 — не валим публикацию из-за LLM
            logger.warning("LLM-форматирование не удалось: %s", e)
    # Фолбэк без LLM: требования = ключевые навыки, обязанности = из сниппета
    skills = [s["name"] for s in (v.get("key_skills") or [])][:6]
    snippet = (v.get("snippet") or {})
    duty = _strip_html(snippet.get("responsibility") or "")
    req = _strip_html(snippet.get("requirement") or "")
    duties = [duty] if duty else []
    reqs = ([req] if req else []) + skills
    return duties[:5], reqs[:5], []


def _extract_sections_llm(v: dict) -> tuple:
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    desc = _strip_html(v.get("description") or "")[:6000]
    prompt = (
        "Ты — редактор канала вакансий креативной индустрии. По тексту вакансии "
        "верни СТРОГО JSON вида "
        '{"duties": [..], "requirements": [..], "plus": [..]}. '
        "Каждый пункт — короткий, без воды, без рекламы, без смайлов. "
        "НИЧЕГО НЕ ВЫДУМЫВАЙ: бери только то, что есть в тексте. "
        "duties и requirements — по 3–5 пунктов, plus — 0–2.\n\n"
        f"Вакансия: {v.get('name')}\n\n{desc}"
    )
    resp = client.responses.create(model=OPENAI_MODEL, input=prompt)
    raw = (resp.output_text or "").strip()
    raw = raw[raw.find("{"): raw.rfind("}") + 1]
    data = json.loads(raw)
    return (
        [d.strip() for d in data.get("duties", []) if d.strip()][:5],
        [r.strip() for r in data.get("requirements", []) if r.strip()][:5],
        [p.strip() for p in data.get("plus", []) if p.strip()][:2],
    )


def _hashtags(title: str) -> str:
    t = title.lower()
    tags = []
    mapping = [
        ("event", "#event"), ("продюсер", "#producer"), ("producer", "#producer"),
        ("design", "#design"), ("дизайн", "#design"), ("motion", "#motion"),
        ("market", "#marketing"), ("маркет", "#marketing"), ("smm", "#smm"),
        ("pr", "#pr"), ("пиар", "#pr"), ("hr", "#hr"), ("recruit", "#hr"),
        ("creative", "#creative"), ("креатив", "#creative"),
    ]
    for key, tag in mapping:
        if key in t and tag not in tags:
            tags.append(tag)
    if not tags:
        tags = ["#event", "#creative"]
    return " ".join(tags)


def _strip_html(s: str) -> str:
    import re
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


# --------------------------------------------------------------------------
# Иллюстрация (OpenAI Images)
# --------------------------------------------------------------------------

def generate_image(title: str) -> bytes | None:
    if not (ENABLE_IMAGES and OPENAI_API_KEY):
        return None
    obj = DEFAULT_ILLUSTRATION
    t = title.lower()
    for keys, hint in ILLUSTRATION_HINTS:
        if any(k in t for k in keys):
            obj = hint
            break
    prompt = (
        f"Premium minimalist 3D illustration. Subject: {obj}. "
        "Dark background, single bright hero object, modern render, soft studio light, "
        "no text, no logos, no people faces, square composition, cohesive brand style."
    )
    try:
        from openai import OpenAI
        import base64
        client = OpenAI(api_key=OPENAI_API_KEY)
        res = client.images.generate(
            model=OPENAI_IMAGE_MODEL, prompt=prompt, size="1024x1024", n=1,
        )
        return base64.b64decode(res.data[0].b64_json)
    except Exception as e:                            # noqa: BLE001
        logger.warning("Не удалось сгенерировать иллюстрацию: %s", e)
        return None


# --------------------------------------------------------------------------
# Публикация в Telegram
# --------------------------------------------------------------------------

def publish(text: str, image: bytes | None) -> bool:
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN не задан — публикация невозможна")
        return False
    try:
        if image:
            # caption у Telegram ограничен 1024 символами
            if len(text) <= 1024:
                r = requests.post(
                    f"{TG_API}/sendPhoto",
                    files={"photo": ("job.png", image, "image/png")},
                    data={"chat_id": CHANNEL_ID, "caption": text},
                    timeout=60,
                )
            else:
                requests.post(
                    f"{TG_API}/sendPhoto",
                    files={"photo": ("job.png", image, "image/png")},
                    data={"chat_id": CHANNEL_ID},
                    timeout=60,
                ).raise_for_status()
                r = requests.post(
                    f"{TG_API}/sendMessage",
                    json={"chat_id": CHANNEL_ID, "text": text, "disable_web_page_preview": False},
                    timeout=30,
                )
        else:
            r = requests.post(
                f"{TG_API}/sendMessage",
                json={"chat_id": CHANNEL_ID, "text": text, "disable_web_page_preview": False},
                timeout=30,
            )
        r.raise_for_status()
        return True
    except requests.RequestException as e:
        logger.error("Ошибка публикации в Telegram: %s", e)
        return False


def send_report(report: dict) -> None:
    if not (BOT_TOKEN and OWNER_CHAT_ID):
        return
    reasons = report.get("reasons", {})
    text = (
        "📊 Отчёт Job Poster за день\n\n"
        f"Найдено вакансий: {report.get('found', 0)}\n"
        f"Опубликовано: {report.get('published', 0)}\n"
        f"Отклонено: {report.get('rejected', 0)}\n\n"
        "Причины отклонения:\n"
        f"• закрыта/недоступна: {reasons.get('closed', 0)}\n"
        f"• дубль: {reasons.get('dup', 0)}\n"
        f"• не по тематике: {reasons.get('offtopic', 0)}"
    )
    try:
        requests.post(f"{TG_API}/sendMessage",
                      json={"chat_id": OWNER_CHAT_ID, "text": text}, timeout=30).raise_for_status()
    except requests.RequestException as e:
        logger.error("Не удалось отправить отчёт: %s", e)


# --------------------------------------------------------------------------
# Дневная статистика (для отчёта)
# --------------------------------------------------------------------------

DAILY = {"found": 0, "published": 0, "rejected": 0,
         "reasons": {"closed": 0, "dup": 0, "offtopic": 0}, "date": None}


def _reset_daily(today: str) -> None:
    DAILY.update(found=0, published=0, rejected=0,
                 reasons={"closed": 0, "dup": 0, "offtopic": 0}, date=today)


# --------------------------------------------------------------------------
# Источник: Telegram-каналы с вакансиями
# --------------------------------------------------------------------------

def _parse_tg_vacancy(msg: dict) -> dict | None:
    """
    Превращает пост Telegram в готовый текст вакансии через OpenAI.
    Берёт ТОЛЬКО факты из текста. Контакт = из поста, иначе ссылка на пост.
    Возвращает {"text", "title"} или None, если это не вакансия/не по теме.
    """
    if not OPENAI_API_KEY:
        return None
    text = msg.get("text", "")
    if not matches_profile(text):            # дешёвый предфильтр по ключевым словам
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        links = ", ".join(msg.get("links") or []) or "нет"
        prompt = (
            "Перед тобой пост из Telegram-канала вакансий. Верни СТРОГО JSON:\n"
            '{"is_vacancy": bool, "on_topic": bool, "title": str, "company": str, '
            '"city": str, "salary": str, "duties": [str], "requirements": [str], '
            '"plus": [str], "contact": str}\n'
            "Правила: НИЧЕГО НЕ ВЫДУМЫВАЙ — только то, что есть в тексте. "
            "on_topic=true только для event/creative/marketing/PR/SMM/HR/design/"
            "production/подрядчиков. Если зарплаты нет — salary='По договорённости'. "
            "company/city пустые, если их нет. contact — @username, email или ссылка "
            "ИЗ ТЕКСТА; если нет — оставь пусто. duties/requirements — короткие буллеты, "
            "plus — 0-2.\n\n"
            f"Ссылки из поста: {links}\n\nТекст поста:\n{text[:5000]}"
        )
        resp = client.responses.create(model=OPENAI_MODEL, input=prompt)
        raw = (resp.output_text or "").strip()
        raw = raw[raw.find("{"): raw.rfind("}") + 1]
        d = json.loads(raw)
    except Exception as e:                   # noqa: BLE001
        logger.warning("Не удалось разобрать TG-пост %s: %s", msg.get("permalink"), e)
        return None

    if not (d.get("is_vacancy") and d.get("on_topic")):
        return None
    title = (d.get("title") or "").strip()
    if not title:
        return None
    apply_link = (d.get("contact") or "").strip() or msg.get("permalink", "")
    post = render_template(
        title,
        (d.get("company") or "—").strip(),
        (d.get("city") or "—").strip(),
        (d.get("salary") or "По договорённости").strip(),
        [x.strip() for x in d.get("duties", []) if x.strip()][:5],
        [x.strip() for x in d.get("requirements", []) if x.strip()][:5],
        [x.strip() for x in d.get("plus", []) if x.strip()][:2],
        apply_link,
    )
    return {"text": post, "title": title}


def telegram_candidates(seen: set) -> list:
    """Собирает готовые посты из всех настроенных каналов. Дедуп по permalink."""
    if not (ENABLE_TELEGRAM_SOURCE and JOB_SOURCE_CHANNELS):
        return []
    import telegram_source
    out = []
    for channel in JOB_SOURCE_CHANNELS:
        for msg in telegram_source.fetch_channel_messages(channel):
            key = f"tg:{msg['channel']}/{msg['post_id']}"
            DAILY["found"] += 1
            if key in seen:
                DAILY["reasons"]["dup"] += 1
                DAILY["rejected"] += 1
                continue
            if not telegram_source.is_recent(msg.get("date")):
                continue
            parsed = _parse_tg_vacancy(msg)
            if not parsed:
                DAILY["reasons"]["offtopic"] += 1
                DAILY["rejected"] += 1
                continue
            out.append({"key": key, "score": 10.0,
                        "text": parsed["text"], "title": parsed["title"]})
    return out


# --------------------------------------------------------------------------
# Главная операция: опубликовать следующую лучшую вакансию (1 за слот)
# --------------------------------------------------------------------------

def publish_next() -> dict:
    """Один цикл: найти (hh + Telegram) → отфильтровать → выбрать лучшую → опубликовать."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if DAILY["date"] != today:
        _reset_daily(today)

    seen = load_seen()

    # --- источник 1: hh.ru ---
    raw = search_vacancies()
    DAILY["found"] += len(raw)
    hh_candidates = []
    for v in raw:
        key = f"hh:{v['id']}"
        if key in seen:
            DAILY["reasons"]["dup"] += 1
            DAILY["rejected"] += 1
            continue
        if not matches_profile(v.get("name", "")):
            DAILY["reasons"]["offtopic"] += 1
            DAILY["rejected"] += 1
            continue
        hh_candidates.append({"key": key, "score": priority_score(v), "hh": v})

    # --- источник 2: Telegram-каналы ---
    tg_candidates = telegram_candidates(seen)

    # Общая очередь по приоритету
    queue = sorted(hh_candidates + tg_candidates, key=lambda c: c["score"], reverse=True)

    for c in queue:
        if "hh" in c:                         # hh: проверяем, что вакансия жива
            full = fetch_vacancy(c["hh"]["id"])
            if full is None:
                DAILY["reasons"]["closed"] += 1
                DAILY["rejected"] += 1
                seen.add(c["key"])
                continue
            text = build_post(full)
            title = full.get("name", "")
        else:                                 # telegram: пост уже готов
            text, title = c["text"], c["title"]

        image = generate_image(title)
        if publish(text, image):
            seen.add(c["key"])
            save_seen(seen)
            DAILY["published"] += 1
            logger.info("Опубликовано (%s): %s", c["key"], title)
            return {"published": True, "key": c["key"], "title": title}
        return {"published": False, "error": "telegram"}

    save_seen(seen)
    return {"published": False, "reason": "нет новых подходящих вакансий"}
