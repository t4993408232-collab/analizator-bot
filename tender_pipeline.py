"""
Тендерный конвейер v1.0
=======================

Разбор закупок с УТП Сбербанк-АСТ (секция Росатом, 223-ФЗ / ЕОСЗ) и других
страниц закупок. Конвейер: URL → загрузка страницы → извлечение текста →
структурирование фактов (OpenAI) → анализ участия (OpenAI) → отчёт владельцу
в Telegram.

Главный принцип проекта: НИЧЕГО НЕ ВЫДУМЫВАТЬ — в отчёт попадают только
факты со страницы закупки; чего нет на странице, помечается «не указано».

Очередь закупок задаётся переменной TENDER_QUEUE (URL через запятую) и
обрабатывается при старте приложения (TENDER_AUTORUN=1) и вручную через
POST /tender/run. Антидубль — файл TENDER_SEEN_FILE.

ВАЖНО: конвейеру нужен сетевой доступ к utp.sberbank-ast.ru, api.openai.com
и api.telegram.org. В песочнице веб-сессии Claude эти хосты закрыты
egress-политикой — вживую конвейер работает на Render.
"""

import os
import re
import json
import logging

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("tender_pipeline")

# --------------------------------------------------------------------------
# Конфигурация (через переменные окружения)
# --------------------------------------------------------------------------

BOT_TOKEN = os.getenv("BOT_TOKEN")
OWNER_CHAT_ID = os.getenv("OWNER_CHAT_ID")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini")

TG_API = f"https://api.telegram.org/bot{BOT_TOKEN}"

# Очередь закупок: URL через запятую. По умолчанию — закупка, поставленная
# владельцем в конвейер.
DEFAULT_QUEUE = [
    "https://utp.sberbank-ast.ru/Rosatom/NBT/PurchaseViewResp/13/0/0/374791036",
]
TENDER_QUEUE = [
    u.strip() for u in os.getenv("TENDER_QUEUE", ",".join(DEFAULT_QUEUE)).split(",")
    if u.strip()
]

# Файл антидубля (id уже разобранных закупок). На Render — на постоянном диске.
TENDER_SEEN_FILE = os.getenv("TENDER_SEEN_FILE", "seen_tenders.json")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# --------------------------------------------------------------------------
# Разбор URL закупки
# --------------------------------------------------------------------------

# https://utp.sberbank-ast.ru/Rosatom/NBT/PurchaseViewResp/13/0/0/374791036
_UTP_RE = re.compile(
    r"utp\.sberbank-ast\.ru/(?P<section>[^/]+)/NBT/"
    r"(?P<view>PurchaseView(?:Resp)?)/(?P<vid>\d+)/(?P<a>\d+)/(?P<b>\d+)/(?P<pid>\d+)",
    re.IGNORECASE,
)


def parse_purchase_url(url: str) -> dict | None:
    """Извлекает секцию и id закупки из URL УТП Сбербанк-АСТ. None — не УТП."""
    m = _UTP_RE.search(url or "")
    if not m:
        return None
    return {
        "section": m.group("section"),
        "purchase_id": m.group("pid"),
        "url": url.strip(),
    }


def tender_key(url: str) -> str:
    """Ключ антидубля: id закупки для УТП, иначе — сам URL."""
    parsed = parse_purchase_url(url)
    if parsed:
        return f"utp:{parsed['section']}:{parsed['purchase_id']}"
    return f"url:{(url or '').strip()}"


# --------------------------------------------------------------------------
# Загрузка страницы закупки
# --------------------------------------------------------------------------

def _candidate_urls(url: str) -> list:
    """Основной URL + запасные варианты представления той же закупки на УТП."""
    urls = [url]
    parsed = parse_purchase_url(url)
    if parsed and "purchaseviewresp" in url.lower():
        # Вариант карточки без «Resp» иногда доступен, когда Resp-страница пуста.
        urls.append(re.sub(r"PurchaseViewResp", "PurchaseView", url, flags=re.IGNORECASE))
    return urls


def fetch_purchase_html(url: str) -> str:
    """Скачивает HTML карточки закупки. Бросает requests.RequestException."""
    last_err = None
    for u in _candidate_urls(url):
        try:
            r = requests.get(u, headers={"User-Agent": UA}, timeout=45)
            r.raise_for_status()
            if len(r.text) > 500:        # защита от пустых заглушек
                return r.text
            last_err = requests.RequestException(f"пустой ответ от {u}")
        except requests.RequestException as e:
            logger.warning("Не удалось получить %s: %s", u, e)
            last_err = e
    raise last_err or requests.RequestException("не удалось загрузить закупку")


def html_to_text(html: str) -> str:
    """
    Достаёт видимый текст страницы + содержимое скрытых полей с XML-данными
    (ASP.NET-страницы УТП кладут данные закупки в hidden-инпуты).
    """
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    hidden_xml = []
    for inp in soup.find_all("input", {"type": "hidden"}):
        val = inp.get("value") or ""
        if "<" in val and ">" in val and len(val) > 40:
            # это встроенный XML/HTML с данными — тоже превращаем в текст
            hidden_xml.append(BeautifulSoup(val, "html.parser").get_text(" ", strip=True))

    text = soup.get_text("\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    if hidden_xml:
        text += "\n\n[Данные закупки]\n" + "\n".join(hidden_xml)
    return text.strip()


# --------------------------------------------------------------------------
# OpenAI: структурирование фактов и анализ участия
# --------------------------------------------------------------------------

STRUCTURE_FIELDS = [
    "number", "title", "customer", "organizer", "method", "price", "currency",
    "application_deadline", "results_date", "delivery_place", "security",
    "requirements", "documents", "contacts",
]


def _openai_json(prompt: str) -> dict:
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    resp = client.responses.create(model=OPENAI_MODEL, input=prompt)
    raw = (resp.output_text or "").strip()
    raw = raw[raw.find("{"): raw.rfind("}") + 1]
    return json.loads(raw)


def structure_tender(page_text: str) -> dict:
    """Извлекает факты закупки в JSON. Только то, что есть в тексте страницы."""
    prompt = (
        "Перед тобой текст страницы закупки (тендера) с электронной торговой "
        "площадки (Сбербанк-АСТ, секция Росатом, 223-ФЗ/ЕОСЗ). Верни СТРОГО JSON:\n"
        '{"number": str, "title": str, "customer": str, "organizer": str, '
        '"method": str, "price": str, "currency": str, '
        '"application_deadline": str, "results_date": str, '
        '"delivery_place": str, "security": str, '
        '"requirements": [str], "documents": [str], "contacts": str}\n'
        "Правила: НИЧЕГО НЕ ВЫДУМЫВАЙ — только факты из текста. "
        "Если поля нет на странице — пустая строка (или пустой список). "
        "number — номер закупки/процедуры; price — НМЦ (начальная цена) как в "
        "тексте; security — обеспечение заявки/договора; requirements — "
        "ключевые требования к участникам; documents — перечень документации; "
        "contacts — контакты организатора из текста.\n\n"
        f"Текст страницы:\n{page_text[:24000]}"
    )
    data = _openai_json(prompt)
    return {f: data.get(f, "" if f not in ("requirements", "documents") else [])
            for f in STRUCTURE_FIELDS}


def assess_tender(data: dict, page_text: str) -> str:
    """Анализ для решения об участии. Опирается только на извлечённые факты."""
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    prompt = (
        "Ты — тендерный специалист. По фактам закупки ниже подготовь короткий "
        "анализ для решения об участии. Структура ответа (обычный текст, без "
        "markdown-заголовков):\n"
        "1) Суть закупки (1–2 предложения)\n"
        "2) Ключевые требования к участнику (3–5 пунктов, каждый с новой строки, «• »)\n"
        "3) Риски и на что обратить внимание (2–4 пункта, «• »)\n"
        "4) Чеклист документов для заявки (пункты, «• »)\n"
        "5) Сроки: что и до какой даты сделать\n"
        "Опирайся ТОЛЬКО на переданные факты и текст страницы; чего нет — "
        "пиши «не указано, уточнить в документации».\n\n"
        f"Факты (JSON): {json.dumps(data, ensure_ascii=False)}\n\n"
        f"Фрагмент страницы:\n{page_text[:8000]}"
    )
    resp = client.responses.create(model=OPENAI_MODEL, input=prompt)
    return (resp.output_text or "").strip()


# --------------------------------------------------------------------------
# Отчёт в Telegram
# --------------------------------------------------------------------------

def _field(value: str, default: str = "не указано") -> str:
    return (value or "").strip() or default


def format_report(url: str, data: dict, assessment: str) -> str:
    lines = [
        "📦 Тендерный конвейер: разбор закупки",
        "",
        f"🔢 Номер: {_field(data.get('number'))}",
        f"📌 Предмет: {_field(data.get('title'))}",
        f"🏢 Заказчик: {_field(data.get('customer'))}",
        f"⚙️ Способ закупки: {_field(data.get('method'))}",
        f"💰 НМЦ: {_field(data.get('price'))} {(data.get('currency') or '').strip()}".rstrip(),
        f"📅 Подача заявок до: {_field(data.get('application_deadline'))}",
        f"📅 Подведение итогов: {_field(data.get('results_date'))}",
        f"🔒 Обеспечение: {_field(data.get('security'))}",
        f"📞 Контакты: {_field(data.get('contacts'))}",
    ]
    if assessment:
        lines += ["", "🧠 Анализ участия", "", assessment]
    lines += ["", "🔗 Карточка закупки:", url]
    return "\n".join(lines)


def tg_send_owner(text: str) -> bool:
    if not (BOT_TOKEN and OWNER_CHAT_ID):
        logger.error("BOT_TOKEN/OWNER_CHAT_ID не заданы — отчёт не отправлен")
        return False
    try:
        for chunk in [text[i:i + 3900] for i in range(0, len(text), 3900)]:
            requests.post(
                f"{TG_API}/sendMessage",
                json={"chat_id": OWNER_CHAT_ID, "text": chunk,
                      "disable_web_page_preview": True},
                timeout=30,
            ).raise_for_status()
        return True
    except requests.RequestException as e:
        logger.error("Не удалось отправить отчёт: %s", e)
        return False


# --------------------------------------------------------------------------
# Антидубль
# --------------------------------------------------------------------------

def load_seen() -> set:
    try:
        with open(TENDER_SEEN_FILE, "r", encoding="utf-8") as f:
            return set(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def save_seen(seen: set) -> None:
    try:
        with open(TENDER_SEEN_FILE, "w", encoding="utf-8") as f:
            json.dump(sorted(seen), f, ensure_ascii=False)
    except OSError as e:
        logger.warning("Не удалось сохранить %s: %s", TENDER_SEEN_FILE, e)


# --------------------------------------------------------------------------
# Конвейер
# --------------------------------------------------------------------------

def run_pipeline(url: str, force: bool = False, notify_errors: bool = True) -> dict:
    """
    Полный прогон одной закупки: fetch → extract → structure → assess → report.
    Возвращает dict со статусом и стадией, на которой остановились.
    """
    url = (url or "").strip()
    if not url:
        return {"ok": False, "stage": "parse", "error": "пустой URL"}

    key = tender_key(url)
    seen = load_seen()
    if key in seen and not force:
        logger.info("Закупка уже разобрана, пропуск: %s", key)
        return {"ok": True, "stage": "skip", "key": key, "skipped": "дубль"}

    # 1. Загрузка страницы
    try:
        html = fetch_purchase_html(url)
    except requests.RequestException as e:
        msg = f"⚠️ Тендерный конвейер: не удалось загрузить закупку\n{url}\nОшибка: {e}"
        logger.error(msg)
        if notify_errors:
            tg_send_owner(msg)
        return {"ok": False, "stage": "fetch", "key": key, "error": str(e)}

    # 2. Извлечение текста
    page_text = html_to_text(html)
    if len(page_text) < 100:
        err = "страница загрузилась, но текста почти нет (возможно, рендерится JS)"
        if notify_errors:
            tg_send_owner(f"⚠️ Тендерный конвейер: {err}\n{url}")
        return {"ok": False, "stage": "extract", "key": key, "error": err}

    # 3–4. Структурирование фактов и анализ (OpenAI)
    data, assessment = {}, ""
    if OPENAI_API_KEY:
        try:
            data = structure_tender(page_text)
        except Exception as e:                       # noqa: BLE001 — не валим отчёт из-за LLM
            logger.warning("Структурирование не удалось: %s", e)
        try:
            assessment = assess_tender(data, page_text)
        except Exception as e:                       # noqa: BLE001
            logger.warning("Анализ не удался: %s", e)
    if not data:
        # Фолбэк без LLM: отдаём владельцу сырой текст страницы (усечённый),
        # чтобы факты всё равно дошли.
        assessment = assessment or ("Автоматический разбор недоступен. "
                                    "Сырые данные страницы:\n\n" + page_text[:2500])

    # 5. Отчёт
    report = format_report(url, data, assessment)
    sent = tg_send_owner(report)

    seen.add(key)
    save_seen(seen)
    return {
        "ok": True, "stage": "done", "key": key, "sent": sent,
        "number": data.get("number", ""), "title": data.get("title", ""),
    }


def run_queue(force: bool = False) -> list:
    """Прогоняет все закупки из TENDER_QUEUE. Возвращает список результатов."""
    results = []
    for url in TENDER_QUEUE:
        try:
            results.append(run_pipeline(url, force=force))
        except Exception as e:                       # noqa: BLE001 — очередь не должна падать целиком
            logger.error("Сбой конвейера на %s: %s", url, e)
            results.append({"ok": False, "stage": "crash", "url": url, "error": str(e)})
    return results
