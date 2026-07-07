"""Офлайн-проверки тендерного конвейера (без сети)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import tender_pipeline as t  # noqa: E402

PURCHASE_URL = "https://utp.sberbank-ast.ru/Rosatom/NBT/PurchaseViewResp/13/0/0/374791036"

FIXTURE_HTML = """
<html><head><title>Закупка</title>
<script>var x = "мусор";</script>
<style>.a{color:red}</style></head>
<body>
<h1>Запрос предложений № 374791036</h1>
<table><tr><td>Заказчик</td><td>АО «Пример»</td></tr>
<tr><td>НМЦ</td><td>1 234 567,89 руб.</td></tr></table>
<input type="hidden" name="xmlData"
 value="&lt;purchase&gt;&lt;deadline&gt;01.08.2026 10:00&lt;/deadline&gt;&lt;/purchase&gt;"/>
</body></html>
"""


def main() -> int:
    checks = []

    # Разбор URL УТП
    parsed = t.parse_purchase_url(PURCHASE_URL)
    checks.append(("url parsed", parsed is not None))
    checks.append(("purchase id", parsed and parsed["purchase_id"] == "374791036"))
    checks.append(("section", parsed and parsed["section"] == "Rosatom"))
    checks.append(("bad url rejected", t.parse_purchase_url("https://example.com/x") is None))

    # Ключ антидубля
    checks.append(("key utp", t.tender_key(PURCHASE_URL) == "utp:Rosatom:374791036"))
    checks.append(("key generic", t.tender_key("https://example.com/x").startswith("url:")))

    # Запасные URL: для Resp-карточки добавляется вариант без Resp
    cands = t._candidate_urls(PURCHASE_URL)
    checks.append(("fallback url", any("PurchaseView/13" in u for u in cands)))

    # Извлечение текста: скрипты/стили выброшены, скрытый XML попал в текст
    text = t.html_to_text(FIXTURE_HTML)
    checks.append(("text has title", "374791036" in text))
    checks.append(("text has customer", "АО «Пример»" in text))
    checks.append(("script removed", "мусор" not in text))
    checks.append(("hidden xml extracted", "01.08.2026" in text))

    # Отчёт
    report = t.format_report(PURCHASE_URL, {"number": "374791036", "title": "Т",
                                            "price": "100", "currency": "руб."},
                             "Анализ")
    checks.append(("report has url", PURCHASE_URL in report))
    checks.append(("report has number", "374791036" in report))
    checks.append(("report empty field", "не указано" in report))

    # Очередь по умолчанию содержит закупку владельца
    checks.append(("queue seeded", any("374791036" in u for u in t.TENDER_QUEUE)))

    ok = True
    for name, passed in checks:
        print(f"[{'OK' if passed else 'FAIL'}] {name}")
        ok = ok and bool(passed)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
