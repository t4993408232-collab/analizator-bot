import os
import logging
import requests
from fastapi import FastAPI, Request, HTTPException
from openai import OpenAI

logging.basicConfig(level=logging.INFO)

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

# --------------------------------------------------------------------------
# Event HR Job Poster v3.0 — расписание и ручной запуск
# --------------------------------------------------------------------------
import job_poster
import tender_pipeline

JOB_POSTER_ENABLED = os.getenv("JOB_POSTER_ENABLED", "1") == "1"
JOB_POSTER_TOKEN = os.getenv("JOB_POSTER_TOKEN")  # секрет для ручного триггера
TENDER_AUTORUN = os.getenv("TENDER_AUTORUN", "1") == "1"
TENDER_TOKEN = os.getenv("TENDER_TOKEN") or JOB_POSTER_TOKEN  # секрет /tender/run
TZ = os.getenv("JOB_POSTER_TZ", "Europe/Moscow")
PUBLISH_HOURS = [int(h) for h in os.getenv(
    "JOB_POSTER_HOURS", "10,11,12,13,14,15,16,17,18,19,20").split(",") if h.strip()]


@app.on_event("startup")
def start_scheduler():
    if not JOB_POSTER_ENABLED:
        logging.info("Job Poster выключен (JOB_POSTER_ENABLED=0)")
        return
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        import pytz
        sched = BackgroundScheduler(timezone=pytz.timezone(TZ))
        # Публикации в указанные часы (по одной лучшей вакансии за слот)
        sched.add_job(job_poster.publish_next,
                      CronTrigger(hour=",".join(map(str, PUBLISH_HOURS)), minute=0),
                      id="job_poster_publish", max_instances=1, coalesce=True)
        # Отчёт в конце дня
        sched.add_job(lambda: job_poster.send_report(job_poster.DAILY),
                      CronTrigger(hour=max(PUBLISH_HOURS), minute=45),
                      id="job_poster_report")
        sched.start()
        logging.info("Job Poster запущен: часы=%s, TZ=%s", PUBLISH_HOURS, TZ)
    except Exception as e:  # noqa: BLE001 — планировщик не должен ронять веб-процесс
        logging.error("Не удалось запустить планировщик Job Poster: %s", e)


@app.on_event("startup")
def start_tender_queue():
    """Прогоняет очередь тендерного конвейера один раз при старте (в фоне)."""
    if not (TENDER_AUTORUN and tender_pipeline.TENDER_QUEUE):
        logging.info("Тендерный конвейер: автозапуск выключен или очередь пуста")
        return
    import threading

    def _run():
        results = tender_pipeline.run_queue()
        logging.info("Тендерный конвейер: очередь обработана: %s", results)

    threading.Thread(target=_run, name="tender-queue", daemon=True).start()
    logging.info("Тендерный конвейер: очередь из %d закупок запущена",
                 len(tender_pipeline.TENDER_QUEUE))


@app.get("/")
def health():
    return {"ok": True}


@app.post("/tender/run")
async def tender_run(request: Request):
    """
    Ручной запуск конвейера. Требует TENDER_TOKEN (заголовок X-Token).
    Тело (необязательно): {"url": "...", "force": true} — конкретная закупка;
    без тела прогоняется вся очередь TENDER_QUEUE.
    """
    if TENDER_TOKEN:
        if request.headers.get("X-Token") != TENDER_TOKEN:
            raise HTTPException(status_code=403, detail="forbidden")
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001 — тело необязательно
        body = {}
    url = (body.get("url") or "").strip()
    force = bool(body.get("force"))
    if url:
        return {"ok": True, "result": tender_pipeline.run_pipeline(url, force=force)}
    return {"ok": True, "result": tender_pipeline.run_queue(force=force)}


@app.get("/tender/queue")
def tender_queue():
    """Текущая очередь и уже разобранные закупки (для отладки)."""
    return {"queue": tender_pipeline.TENDER_QUEUE,
            "seen": sorted(tender_pipeline.load_seen())}


@app.post("/job-poster/run")
async def job_poster_run(request: Request):
    """Ручной запуск одного цикла публикации. Требует JOB_POSTER_TOKEN."""
    if JOB_POSTER_TOKEN:
        if request.headers.get("X-Token") != JOB_POSTER_TOKEN:
            raise HTTPException(status_code=403, detail="forbidden")
    result = job_poster.publish_next()
    return {"ok": True, "result": result}

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
