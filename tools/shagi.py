# -*- coding: utf-8 -*-
"""Превращает официальный разбор задачи в пошаговый гайд.

Приложение не показывает ответ, а ведёт: спрашивает промежуточный результат на каждом шаге.
Запуск:  python3 tools/shagi.py fiz 1 [сколько задач в цикле]
"""
import json, os, re, sys, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
URL = "https://api.aitunnel.ru/v1/chat/completions"
MODEL = "glm-5.3-flash"
_lock = threading.Lock()

SYS = ("Ты репетитор. Ведёшь ученика к ответу по шагам, никогда не называя ответ раньше времени. "
       "Отвечаешь только валидным JSON.")

PROMPT = """Задача ЕГЭ по физике и её официальный разбор.

УСЛОВИЕ: {q}
ПРАВИЛЬНЫЙ ОТВЕТ: {a}
РАЗБОР: {sol}

Тип задачи: «{title}». Общий приём: {algo}

Разбей решение на шаги так, чтобы ученик прошёл его сам. На каждом шаге ты задаёшь вопрос,
он вписывает промежуточный результат, ты подтверждаешь и идёшь дальше.

Правила:
— От 2 до 4 шагов. Последний шаг даёт финальный ответ задачи.
— Ответ на каждом шаге — одно число или одно слово, которое можно проверить сравнением.
  Не «выразим формулу», а «сколько получилось».
— Вопрос ставь конкретно: «Сколько секунд длится разгон?», «Чему равна площадь прямоугольника?»
— hint — подсказка одной строкой, что именно посмотреть или на что поделить. Без ответа.
— why — короткое пояснение с числами, показывается после верного ответа.
— Первый шаг не должен требовать всего решения сразу: начни с того, что просто вычитать из условия.

ВАЖНО. Ты не видишь рисунок к задаче — только текст. Если хоть один промежуточный ответ
пришлось бы взять с графика или картинки, а в разборе этого числа нет, НЕ ВЫДУМЫВАЙ его.
В таком случае верни ровно {{"skip": true}} и ничего больше. Лучше отказаться, чем научить неверному.
Каждое число в твоих шагах должно встречаться в условии или в разборе выше.

Ответ строго так:
{{"steps":[{{"q":"вопрос","a":"ответ","hint":"подсказка","why":"пояснение с числами"}}]}}"""


def key():
    f = os.path.join(ROOT, ".aikey")
    return open(f).read().strip() if os.path.exists(f) else os.environ.get("AITUNNEL_KEY", "")


def ask(prompt):
    body = json.dumps({"model": MODEL, "max_tokens": 4000, "reasoning": {"effort": "low"},
                       "messages": [{"role": "system", "content": SYS},
                                    {"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Authorization": "Bearer " + key(), "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=240))
    txt = (d.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    m = re.search(r"\{[\s\S]*\}", txt)
    if not m:
        raise ValueError("не по формату")
    return json.loads(m.group(0)), (d.get("usage") or {}).get("cost_rub", 0)


NUM = re.compile(r"-?\d+(?:[.,]\d+)?")


def norm(x):
    x = str(x).strip().lower().replace(",", ".").replace("\u2212", "-")
    m = NUM.fullmatch(x.replace(" ", ""))
    if m:
        f = float(x.replace(" ", ""))
        return str(int(f)) if f == int(f) else str(round(f, 4))
    return re.sub(r"\s+", " ", x)


def numbers(t):
    return {norm(x) for x in NUM.findall(str(t).replace("\u2212", "-"))}


def validate(steps, q):
    """Шаги принимаем, только если они сходятся с известным ответом и не содержат выдуманных чисел."""
    if not steps or len(steps) < 2:
        return "мало шагов"
    if norm(steps[-1]["a"]) != norm(q.get("answer", "")):
        return "последний шаг не даёт ответ задачи"
    have = numbers(q.get("plain", "")) | numbers(q.get("solution", "")) | numbers(q.get("answer", ""))
    invented = [st["a"] for st in steps if NUM.fullmatch(str(st["a"]).strip().replace(" ", ""))
                and norm(st["a"]) not in have]
    if len(invented) > 1:                      # одно совпадение может быть случайным, два — уже выдумка
        return "числа не из условия и не из разбора: " + ", ".join(map(str, invented[:3]))
    return ""


def main():
    sid = sys.argv[1] if len(sys.argv) > 1 else "fiz"
    num = sys.argv[2] if len(sys.argv) > 2 else None
    per = int(sys.argv[3]) if len(sys.argv) > 3 else 3

    ppath = os.path.join(ROOT, "lessons", "plan-%s.json" % sid)
    bpath = os.path.join(ROOT, "bank", "bank-%s.json" % sid)
    plan = json.load(open(ppath, encoding="utf-8"))
    bank = json.load(open(bpath, encoding="utf-8"))
    byid = {q["id"]: q for q in bank["tasks"]}
    spent = [0.0]
    stats = {"ok": 0, "bad": 0, "skip": 0, "why": []}
    nums = [num] if num else sorted(plan, key=lambda k: int(k))

    for k in nums:
        d = plan.get(k)
        if not d:
            continue
        jobs = []
        for g in d["groups"]:
            for i in (g.get("tasks") or [])[:per]:
                q = byid.get(i)
                if q and q.get("solution") and not q.get("steps"):
                    jobs.append((g, q))

        def one(job):
            g, q = job
            try:
                j, c = ask(PROMPT.format(q=q["plain"][:420], a=q.get("answer", ""),
                                         sol=(q.get("solution") or "")[:900],
                                         title=g["title"], algo=" → ".join(g.get("algorithm", []))))
            except Exception as e:
                return
            with _lock:
                spent[0] += c or 0
            if j.get("skip"):
                with _lock:
                    stats["skip"] += 1
                return
            st = [x for x in j.get("steps", []) if x.get("q") and str(x.get("a", "")).strip()][:4]
            bad = validate(st, q)
            if bad:
                with _lock:
                    stats["bad"] += 1
                    stats["why"].append(bad)
                return
            with _lock:
                stats["ok"] += 1
                q["steps"] = st

        with ThreadPoolExecutor(max_workers=6) as ex:
            list(ex.map(one, jobs))
        ready = sum(1 for g in d["groups"] for i in (g.get("tasks") or [])[:per]
                    if byid.get(i, {}).get("steps"))
        print("задание %-3s %-28s готово %d · модель отказалась %d · проверку не прошло %d"
              % (k, d["name"][:28], ready, stats["skip"], stats["bad"]))
        for w in stats["why"][:4]:
            print("      отсеяно: %s" % w[:76])

    json.dump(bank, open(bpath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("сохранено · потрачено %.2f ₽" % spent[0])


if __name__ == "__main__":
    main()
