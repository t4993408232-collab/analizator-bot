#!/usr/bin/env python3
"""Clap Control для MacBook.

Два хлопка -> экран гаснет (Mac блокируется), ещё два хлопка -> экран включается.

Настоящий «сон» (pmset sleepnow) не используется намеренно: в нём микрофон
выключен и разбудить Mac хлопком физически невозможно. Поэтому скрипт держит
систему бодрствующей (caffeinate -i), а «сон» = выключенный экран.

Запуск:
    python3 clap.py            # рабочий режим
    python3 clap.py --test     # только показывает уровни и хлопки, ничего не делает
"""
import argparse
import ctypes
import os
import queue
import subprocess
import sys
import time

import numpy as np
import sounddevice as sd

RATE = 44100
BLOCK = 512  # ~12 мс на блок

# --- экран ---------------------------------------------------------------

try:
    _cg = ctypes.cdll.LoadLibrary(
        "/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics")
    _cg.CGMainDisplayID.restype = ctypes.c_uint32
    _cg.CGDisplayIsAsleep.argtypes = [ctypes.c_uint32]
    _cg.CGDisplayIsAsleep.restype = ctypes.c_int
except OSError:
    _cg = None

_state = {"asleep": False}  # запасной вариант, если CoreGraphics недоступен


def display_asleep():
    if _cg is not None:
        try:
            return bool(_cg.CGDisplayIsAsleep(_cg.CGMainDisplayID()))
        except Exception:
            pass
    return _state["asleep"]


def screen_off():
    subprocess.Popen(["pmset", "displaysleepnow"])
    _state["asleep"] = True


def screen_on():
    subprocess.Popen(["caffeinate", "-u", "-t", "2"])
    _state["asleep"] = False


def toggle(beep):
    if beep:
        subprocess.Popen(["afplay", "/System/Library/Sounds/Tink.aiff"])
    if display_asleep():
        log("двойной хлопок -> включаю экран")
        screen_on()
    else:
        log("двойной хлопок -> гашу экран")
        screen_off()


# --- детектор хлопков ------------------------------------------------------

class ClapDetector:
    """Ловит короткие резкие пики и склеивает два подряд в «двойной хлопок».

    Хлопок = пик выше порога и намного громче фона, который быстро затухает.
    Речь, музыка и гул затухают медленно и отбрасываются.
    """

    def __init__(self, threshold=0.25, ratio=10.0, gap_min=0.15, gap_max=0.8,
                 decay_s=0.10, decay_ratio=0.35, cooldown=1.5):
        self.threshold = threshold
        self.ratio = ratio
        self.gap_min = gap_min
        self.gap_max = gap_max
        self.decay_s = decay_s
        self.decay_ratio = decay_ratio
        self.cooldown = cooldown
        self.bg = 0.01          # фоновый уровень (RMS)
        self.pending = None     # [t0, max_rms] — кандидат в хлопок
        self.last_clap = None
        self.blocked_until = 0.0

    def feed(self, t, rms, peak):
        """Возвращает 'clap', 'double' или None."""
        event = None

        if self.pending is not None:
            t0, max_rms = self.pending
            if t - t0 < 0.03:
                self.pending[1] = max(max_rms, rms)
            elif t - t0 >= self.decay_s:
                self.pending = None
                if rms < max_rms * self.decay_ratio:
                    event = self._confirmed(t0)
            return event

        if (t >= self.blocked_until and peak > self.threshold
                and peak > self.bg * self.ratio):
            self.pending = [t, rms]
            return None

        self.bg = 0.95 * self.bg + 0.05 * max(rms, 1e-4)
        return None

    def _confirmed(self, t0):
        prev, self.last_clap = self.last_clap, t0
        if prev is not None and self.gap_min <= t0 - prev <= self.gap_max:
            self.last_clap = None
            self.blocked_until = t0 + self.cooldown
            return "double"
        return "clap"


# --- основной цикл ---------------------------------------------------------

def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def main():
    p = argparse.ArgumentParser(description="Два хлопка: погасить/включить экран Mac")
    p.add_argument("--threshold", type=float, default=0.25,
                   help="минимальная громкость пика 0..1 (по умолчанию 0.25)")
    p.add_argument("--ratio", type=float, default=10.0,
                   help="во сколько раз хлопок громче фона (по умолчанию 10)")
    p.add_argument("--test", action="store_true",
                   help="калибровка: показывать уровни и хлопки, экран не трогать")
    p.add_argument("--beep", action="store_true",
                   help="тихий звук при срабатывании")
    args = p.parse_args()

    det = ClapDetector(threshold=args.threshold, ratio=args.ratio)
    q = queue.Queue()

    def callback(indata, frames, time_info, status):
        x = indata[:, 0]
        q.put((time.monotonic(), float(np.sqrt(np.mean(x * x))),
               float(np.abs(x).max())))

    if not args.test:
        # не даём Mac уснуть по-настоящему, пока скрипт работает
        subprocess.Popen(["caffeinate", "-i", "-w", str(os.getpid())])

    log(f"слушаю микрофон (порог {args.threshold}, фон x{args.ratio})"
        + (" — ТЕСТ, экран не трогаю" if args.test else ""))

    silent_since = time.monotonic()
    warned = False
    last_meter = 0.0

    with sd.InputStream(samplerate=RATE, blocksize=BLOCK, channels=1,
                        dtype="float32", callback=callback):
        while True:
            t, rms, peak = q.get()

            # macOS отдаёт чистые нули, если у приложения нет доступа к микрофону
            if peak > 0:
                silent_since = t
            elif not warned and t - silent_since > 3:
                log("микрофон молчит: разрешите доступ в Системных настройках -> "
                    "Конфиденциальность -> Микрофон (для Терминала)")
                warned = True

            if args.test and t - last_meter > 0.2:
                bar = "#" * min(50, int(peak * 50))
                print(f"\rпик {peak:5.2f} фон {det.bg:5.3f} |{bar:<50}|", end="",
                      flush=True)
                last_meter = t

            event = det.feed(t, rms, peak)
            if event and args.test:
                print()
                log("ХЛОП" if event == "clap" else "ДВОЙНОЙ ХЛОПОК ✔")
            elif event == "double":
                toggle(args.beep)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
