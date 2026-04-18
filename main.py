import logging
import os
import requests
from fastapi import FastAPI, Request, HTTPException
from openai import OpenAI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("analizator-bot")

BOT_TOKEN = os.getenv("BOT_TOKEN")
OWNER_CHAT_ID = os.getenv("OWNER_CHAT_ID")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini")

TG_API = f"https://api.telegram.org/bot{BOT_TOKEN}"

client = OpenAI(api_key=OPENAI_API_KEY)
app = FastAPI()


def tg_send(chat_id: str, text: str) -> None:
    try:
        r = requests.post(
            f"{TG_API}/sendMessage",
            json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
            timeout=20,
        )
        if not r.ok:
            log.error("tg_send failed: status=%s body=%s", r.status_code, r.text[:500])
            r.raise_for_status()
    except Exception:
        log.exception("tg_send exception chat_id=%s", chat_id)
        raise


def tg_send_safe(chat_id: str, text: str) -> None:
    try:
        tg_send(chat_id, text)
    except Exception:
        pass


def tg_send_chunks(chat_id: str, text: str) -> None:
    for chunk in [text[i:i + 3900] for i in range(0, len(text), 3900)]:
        tg_send(chat_id, chunk)


def analyze_post(text: str) -> str:
    prompt = f"""
Ты — редактор и стратег Telegram-канала eventstory_by (Игорь Иванов, event/brand/маркетинг).
Цель: усилить личный бренд харизматичного лидера и ассоциацию у клиентов:
"к Игорю можно прийти без тендера со сложным проектом".

Сделай:
1) Оценка поста 1–10 и почему (2–3 пункта)
2) Что работает
3) Что улучшить (вовлечение + B2B лиды)
4) Перепиши: A (до 800 знаков), B (до 1800 знаков)
5) 5 хуков (первые 2 строки)
6) 5 релевантных хэштегов

Текст:
{text}
""".strip()

    resp = client.responses.create(
        model=OPENAI_MODEL,
        input=prompt,
    )
    return (resp.output_text or "").strip()


@app.get("/")
def health():
    return {"ok": True}


@app.post("/webhook")
async def webhook(request: Request):
    try:
        update = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bad JSON: {e}")

    log.info("update keys=%s", list(update.keys()))

    try:
        if "channel_post" in update:
            msg = update["channel_post"]
            text = msg.get("text") or msg.get("caption") or ""
            if not text.strip():
                return {"ok": True, "skipped": "empty"}

            analysis = analyze_post(text)
            if not analysis:
                tg_send_safe(OWNER_CHAT_ID, "⚠️ Пустой ответ модели на пост канала.")
                return {"ok": True, "skipped": "empty_analysis"}

            out = "🧠 Разбор нового поста\n\n" + analysis
            tg_send_chunks(OWNER_CHAT_ID, out)
            return {"ok": True}

        if "message" in update:
            msg = update["message"]
            chat_id = str(msg["chat"]["id"])
            text = msg.get("text") or ""

            if text.strip().lower() in ("/start", "start"):
                tg_send(chat_id, "Привет! Пришли текст — сделаю разбор. Посты из канала тоже ловлю через webhook.")
                return {"ok": True}

            if text.strip():
                analysis = analyze_post(text)
                if not analysis:
                    tg_send_safe(chat_id, "⚠️ Модель вернула пустой ответ. Попробуй ещё раз.")
                    return {"ok": True, "skipped": "empty_analysis"}
                out = "🧠 Разбор текста\n\n" + analysis
                tg_send_chunks(chat_id, out)

            return {"ok": True}

        return {"ok": True}

    except Exception as e:
        log.exception("webhook handler failed")
        if OWNER_CHAT_ID:
            tg_send_safe(
                OWNER_CHAT_ID,
                f"⚠️ Ошибка разбора: {type(e).__name__}: {e}"[:3900],
            )
        return {"ok": True, "error": f"{type(e).__name__}"}
