"""Офлайн-проверки Job Poster (без сети)."""
import sys

import job_poster as j


def main() -> int:
    checks = []

    checks.append(("salary none", j.format_salary(None) == "По договорённости"))
    checks.append(("salary from", j.format_salary({"from": 80000, "currency": "RUR"}) == "от 80 000 ₽"))
    checks.append(("profile match", j.matches_profile("Event Producer") is True))
    checks.append(("profile reject", j.matches_profile("Бухгалтер") is False))
    checks.append(("strip html", j._strip_html("<p>Hi <b>there</b></p>") == "Hi there"))
    checks.append(("hashtags", "#design" in j._hashtags("Senior Motion Designer")))

    post = j.render_template("T", "C", "Москва", "По договорённости",
                             ["d1"], ["r1"], [], "https://example.com")
    checks.append(("template has title", post.startswith("🔥 T")))
    checks.append(("template has apply", "https://example.com" in post))
    checks.append(("channels configured", len(j.JOB_SOURCE_CHANNELS) >= 1))

    ok = True
    for name, passed in checks:
        print(f"[{'OK' if passed else 'FAIL'}] {name}")
        ok = ok and passed
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
