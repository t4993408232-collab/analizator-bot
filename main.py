import os
import requests
from fastapi import FastAPI, Request, HTTPException
from openai import OpenAI

BOT_TOKEN = os.getenv("BOT_TOKEN")
OWNER_CHAT_ID = os.getenv("OWNER_CHAT_ID")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

TG_API = f"https://api.telegram.org/bot{BOT_TOKEN}"

client = OpenAI(api_key=OPENAI_API_KEY)
app = FastAPI()

def tg_send(chat_id: str, text: str):
    r = requests.post(
        f"{TG_API}/sendMessage",
        json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
        timeout=20,
    )
    r.raise_for_status()

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
        model=os.getenv("OPENAI_MODEL", "gpt-5-mini"),
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

    # Пост из канала
    if "channel_post" in update:
        msg = update["channel_post"]
        text = msg.get("text") or msg.get("caption") or ""
        if not text.strip():
            return {"ok": True, "skipped": "empty"}

        analysis = analyze_post(text)
        out = "🧠 Разбор нового поста\n\n" + analysis

        # Телеграм лимит ~4096, режем на куски
        for chunk in [out[i:i+3900] for i in range(0, len(out), 3900)]:
            tg_send(OWNER_CHAT_ID, chunk)

        return {"ok": True}

    # Тест в личке: присылаешь текст — получаешь разбор
    if "message" in update:
        msg = update["message"]
        chat_id = str(msg["chat"]["id"])
        text = msg.get("text") or ""

        if text.strip().lower() in ("/start", "start"):
            tg_send(chat_id, "Привет! Пришли текст — сделаю разбор. Посты из канала тоже ловлю через webhook.")
            return {"ok": True}

        if text.strip():
            analysis = analyze_post(text)
            out = "🧠 Разбор текста\n\n" + analysis
            for chunk in [out[i:i+3900] for i in range(0, len(out), 3900)]:
                tg_send(chat_id, chunk)

        return {"ok": True}

    return {"ok": True}
