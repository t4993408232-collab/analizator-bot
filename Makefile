# Все операции с репо — одной командой. Главная: `make check` (= ./init.sh).
PY ?= python3
F ?=

.PHONY: setup dev check test e2e check-arch verify-feature vcr \
        session-start session-end clean-check audit

setup:            ## поставить зависимости
	$(PY) -m pip install -r requirements.txt

dev:              ## локальный сервер без планировщика и автозапуска тендеров
	JOB_POSTER_ENABLED=0 TENDER_AUTORUN=0 $(PY) -m uvicorn main:app --reload --port 8000

check:            ## полная проверка: компиляция, check-arch, тесты, смоук, feature_list
	./init.sh

test:             ## только офлайн-тесты
	$(PY) tests/test_sanity.py
	$(PY) tests/test_tender.py

e2e:              ## смоук запуска приложения (без внешней сети)
	$(PY) tests/smoke_app.py

check-arch:       ## правила из .harness/arch-rules.json
	bash scripts/check-arch.sh

verify-feature:   ## make verify-feature F=feat-004
	bash scripts/verify-feature.sh $(F)

vcr:              ## доля done среди начатых фич
	@jq -r '[.features[] | select(.status != "not-started")] as $$a | ([$$a[] | select(.status == "done")] | length) as $$d | "VCR = \($$d)/\($$a | length)"' feature_list.json

session-start:    ## make session-start TASK="..." F=feat-00X
	bash scripts/session-trace.sh start "$(TASK)" $(F)

session-end:      ## make session-end RESULT=pass|fail|partial
	bash scripts/session-trace.sh end $(or $(RESULT),pass)

clean-check:      ## чистое состояние перед концом сессии
	bash scripts/clean-state-check.sh

audit:            ## аудит обвязки (оба инструмента курса)
	bash tools/audit-harness.sh .
	node .claude/skills/harness-creator/scripts/validate-harness.mjs --target .
