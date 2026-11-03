"""Офлайн-проверки Job Poster (без сети)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import job_poster as j  # noqa: E402


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
    checks.append(("signature at end", post.rstrip().endswith(j.JOB_POST_SIGNATURE) if j.JOB_POST_SIGNATURE else True))
    checks.append(("signature has channel", "@event_hr" in j.JOB_POST_SIGNATURE or not j.CHANNEL_ID.startswith("@")))

    checks.append(("creative match", j.matches_creative("Креативный директор") is True))
    checks.append(("creative reject", j.matches_creative("Event Producer") is False))
    checks.append(("signature main", j.channel_signature(j.CHANNEL_ID) == j.JOB_POST_SIGNATURE))
    checks.append(("signature swap", j._with_channel_signature(post, "@creative_x").endswith("@creative_x")
                   and "@event_hr" not in j._with_channel_signature(post, "@creative_x")))
    checks.append(("employer pages list", isinstance(j.EMPLOYER_PAGES, list)))

    ok = True
    for name, passed in checks:
        print(f"[{'OK' if passed else 'FAIL'}] {name}")
        ok = ok and passed
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
