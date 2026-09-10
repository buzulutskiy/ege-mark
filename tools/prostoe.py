# -*- coding: utf-8 -*-
"""Переписывает названия циклов и формулировки задач на человеческий язык.

Оригинал задания не трогаем — он остаётся, потому что на экзамене будет именно он.
Рядом появляется поле simple: то же самое, но понятно с первого прочтения.

Запуск:  python3 tools/prostoe.py fiz 1        — задание 1 по физике
         python3 tools/prostoe.py fiz 1 5      — по 5 первых задач в каждом цикле
"""
import json, os, re, sys, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
URL = "https://api.aitunnel.ru/v1/chat/completions"
MODEL = "glm-5.3-flash"
_lock = threading.Lock()

SYS = "Ты объясняешь школьнику, который начал с нуля. Отвечаешь только валидным JSON."

P_TITLE = """Вот названия групп задач ЕГЭ по физике, номер {n} — «{name}».
Они написаны языком учебника, а ученик начал с нуля и таких слов не понимает.

{items}

Перепиши каждое название так, как сказал бы понятный репетитор: коротко, глаголом,
без слов «модуль», «проекция», «зависимость», «величина». Должно быть сразу ясно,
что предстоит научиться делать.

Плохо: «Путь как площадь под графиком модуля скорости»
Хорошо: «Найти путь по графику скорости»

Плохо: «Ускорение как наклон графика vx(t)»
Хорошо: «Найти ускорение по наклону графика»

Ответ: {{"titles":["новое название 1","новое название 2"]}} — ровно столько же и в том же порядке."""

P_TASK = """Вот настоящие задания ЕГЭ по физике. Ученик начал с нуля, и формулировки его пугают.

{items}

Перепиши каждое так, чтобы стало понятно, что от тебя хотят. Правила жёсткие:
— Все числа, единицы и сам вопрос сохрани в точности. Ответ не должен измениться.
— Убери канцелярит: «определите» → «найди», «представленного на рисунке» → «на графике»,
  «модуль скорости» → «скорость», «зависимость координаты от времени» → «как менялась координата».
— Пиши на ты, короткими фразами. Одно-два предложения.
— Если в задании есть рисунок, обязательно упомяни, что смотреть надо на него.
— Не добавляй подсказок и не объясняй, как решать. Только понятно перескажи условие.

Пример.
Было: «По графику зависимости модуля скорости тела от времени, представленного на рисунке,
определите путь, пройденный телом от момента времени 0 с до момента времени 2 с. (Ответ дайте в метрах.)»
Стало: «На графике показано, как менялась скорость тела. Найди, сколько метров оно прошло за первые 2 секунды.»

Ответ: {{"tasks":["текст 1","текст 2"]}} — ровно столько же и в том же порядке."""


def key():
    f = os.path.join(ROOT, ".aikey")
    return open(f).read().strip() if os.path.exists(f) else os.environ.get("AITUNNEL_KEY", "")


def ask(prompt, maxtok=6000):
    body = json.dumps({"model": MODEL, "max_tokens": maxtok, "reasoning": {"effort": "low"},
                       "messages": [{"role": "system", "content": SYS},
                                    {"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Authorization": "Bearer " + key(), "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=300))
    txt = (d.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    m = re.search(r"\{[\s\S]*\}", txt)
    if not m:
        raise ValueError("не по формату")
    return json.loads(m.group(0)), (d.get("usage") or {}).get("cost_rub", 0)


def main():
    sid = sys.argv[1] if len(sys.argv) > 1 else "fiz"
    num = sys.argv[2] if len(sys.argv) > 2 else None
    per = int(sys.argv[3]) if len(sys.argv) > 3 else 5

    ppath = os.path.join(ROOT, "lessons", "plan-%s.json" % sid)
    bpath = os.path.join(ROOT, "bank", "bank-%s.json" % sid)
    plan = json.load(open(ppath, encoding="utf-8"))
    bank = json.load(open(bpath, encoding="utf-8"))
    byid = {q["id"]: q for q in bank["tasks"]}
    spent = [0.0]
    nums = [num] if num else sorted(plan, key=lambda k: int(k))

    for k in nums:
        d = plan.get(k)
        if not d:
            continue
        # названия циклов
        items = "\n".join("%d. %s" % (i + 1, g["title"]) for i, g in enumerate(d["groups"]))
        try:
            j, c = ask(P_TITLE.format(n=k, name=d["name"], items=items), 3000)
            spent[0] += c or 0
            for g, nt in zip(d["groups"], j.get("titles", [])):
                if nt.strip():
                    g["hard"] = g.get("hard") or g["title"]
                    g["title"] = nt.strip()
        except Exception as e:
            print("названия %s — %s" % (k, str(e)[:50]))

        # формулировки первых задач каждого цикла
        def one(g):
            ids = (g.get("tasks") or [])[:per]
            qs = [byid[i] for i in ids if i in byid and not byid[i].get("simple")]
            if not qs:
                return
            items = "\n".join("%d. %s" % (i + 1, q["plain"][:340]) for i, q in enumerate(qs))
            try:
                j, c = ask(P_TASK.format(items=items), 5000)
            except Exception as e:
                with _lock:
                    print("  задачи «%s» — %s" % (g["title"][:30], str(e)[:40]))
                return
            with _lock:
                spent[0] += c or 0
                for q, s in zip(qs, j.get("tasks", [])):
                    if s.strip():
                        q["simple"] = s.strip()

        with ThreadPoolExecutor(max_workers=4) as ex:
            list(ex.map(one, d["groups"]))

        done = sum(1 for g in d["groups"] for i in (g.get("tasks") or [])[:per]
                   if i in byid and byid[i].get("simple"))
        print("задание %-3s %-34s циклов %d · переписано задач %d" % (k, d["name"][:34], len(d["groups"]), done))
        for g in d["groups"]:
            print("      %s" % g["title"])

    json.dump(plan, open(ppath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(bank, open(bpath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\nсохранено · потрачено %.2f ₽" % spent[0])


if __name__ == "__main__":
    main()
