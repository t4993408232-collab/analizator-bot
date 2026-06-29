"""
Чтение публичных Telegram-каналов с вакансиями через веб-превью t.me/s/<канал>.

Превью публичных каналов доступно без авторизации и аккаунта: страница
https://t.me/s/<channel> отдаёт HTML с последними постами, датами и ссылками.
Мы парсим её и возвращаем нормализованные сообщения. Контакты/ссылки берём
строго из текста поста — ничего не выдумываем.

Требует сетевого доступа к t.me (на песочнице веб-сессии может быть закрыт).
"""

import re
import logging
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("telegram_source")

TME_PREVIEW = "https://t.me/s/{channel}"
UA = "Mozilla/5.0 (compatible; EventHRJobPoster/3.0)"


def _clean_channel(name: str) -> str:
    return name.strip().lstrip("@").split("/")[-1]


def fetch_channel_messages(channel: str, limit: int = 20) -> list:
    """
    Возвращает последние сообщения публичного канала.
    Каждый элемент: {channel, post_id, permalink, date(datetime|None), text, links[]}.
    """
    channel = _clean_channel(channel)
    if not channel:
        return []
    try:
        r = requests.get(TME_PREVIEW.format(channel=channel),
                         headers={"User-Agent": UA}, timeout=30)
        r.raise_for_status()
    except requests.RequestException as e:
        logger.warning("Не удалось получить канал @%s: %s", channel, e)
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    messages = []
    for wrap in soup.select(".tgme_widget_message"):
        post = wrap.get("data-post", "")          # "channel/123"
        post_id = post.split("/")[-1] if post else ""
        permalink = f"https://t.me/{post}" if post else ""

        text_el = wrap.select_one(".tgme_widget_message_text")
        if not text_el:
            continue
        # сохраняем переносы строк
        for br in text_el.find_all("br"):
            br.replace_with("\n")
        text = text_el.get_text("\n").strip()
        text = re.sub(r"\n{3,}", "\n\n", text)

        links = [a.get("href") for a in text_el.find_all("a", href=True)]

        date = None
        time_el = wrap.select_one("time[datetime]")
        if time_el:
            try:
                date = datetime.fromisoformat(time_el["datetime"].replace("Z", "+00:00"))
            except ValueError:
                pass

        if text:
            messages.append({
                "channel": channel,
                "post_id": post_id,
                "permalink": permalink,
                "date": date,
                "text": text,
                "links": links,
            })
    return messages[-limit:]


def is_recent(date, max_days: int = 30) -> bool:
    if date is None:
        return True  # дату не смогли определить — не отбраковываем по ней
    return (datetime.now(timezone.utc) - date).days <= max_days
