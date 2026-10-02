"""Смоук-проверка запуска приложения (Layer 3, без внешней сети).

Поднимает uvicorn с выключенными планировщиком и автозапуском тендеров,
дёргает эндпоинты, которые не ходят наружу, и гасит сервер.
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.getenv("SMOKE_PORT", "8765"))
BASE = f"http://127.0.0.1:{PORT}"


def call(method: str, path: str, body: bytes | None = None, headers: dict | None = None):
    req = urllib.request.Request(BASE + path, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, None


def main() -> int:
    tmp = tempfile.mkdtemp(prefix="smoke-")
    env = dict(os.environ,
               JOB_POSTER_ENABLED="0", TENDER_AUTORUN="0",
               OPENAI_API_KEY="smoke-dummy", BOT_TOKEN="0:smoke",
               JOB_POSTER_TOKEN="smoke-token",
               SEEN_FILE=os.path.join(tmp, "seen_vacancies.json"),
               TENDER_SEEN_FILE=os.path.join(tmp, "seen_tenders.json"),
               NO_PROXY="127.0.0.1,localhost", no_proxy="127.0.0.1,localhost")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(PORT)],
        cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
    try:
        for _ in range(50):
            try:
                if call("GET", "/")[0] == 200:
                    break
            except OSError:
                pass
            if proc.poll() is not None:
                break
            time.sleep(0.2)

        checks = [
            ("app ready: GET /", call("GET", "/") if proc.poll() is None else (None, None),
             lambda s, b: s == 200 and b == {"ok": True}),
        ]
        if proc.poll() is None:
            checks += [
                ("GET /tender/queue", call("GET", "/tender/queue"),
                 lambda s, b: s == 200 and isinstance(b.get("queue"), list)),
                ("webhook: пустой апдейт", call("POST", "/webhook", b"{}"),
                 lambda s, b: s == 200 and b == {"ok": True}),
                ("webhook: битый JSON → 400", call("POST", "/webhook", b"not json"),
                 lambda s, b: s == 400),
                ("webhook: пустой пост пропущен",
                 call("POST", "/webhook", json.dumps({"channel_post": {"text": " "}}).encode()),
                 lambda s, b: s == 200 and b.get("skipped") == "empty"),
                ("/job-poster/run без токена → 403", call("POST", "/job-poster/run"),
                 lambda s, b: s == 403),
                ("/tender/run без токена → 403", call("POST", "/tender/run"),
                 lambda s, b: s == 403),
            ]
        ok = True
        for name, (status, body), pred in checks:
            passed = status is not None and pred(status, body)
            print(f"[{'OK' if passed else 'FAIL'}] {name} (HTTP {status})")
            ok = ok and passed
    finally:
        proc.terminate()
        try:
            out, _ = proc.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            out, _ = proc.communicate()
    if not ok:
        print("--- лог uvicorn ---")
        print(out.decode(errors="replace")[-3000:])
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
