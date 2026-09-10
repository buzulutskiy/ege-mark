# -*- coding: utf-8 -*-
"""Ядро темы: по одной задаче на каждый смысловой шаблон.
   Остальные не выкидываем — уводим во «второй круг»."""
import json, re, collections

def sig(v, sub):
    s = (v.get("formula", {}).get("subst") or {})
    a = str(s.get("out", "")).strip()
    inp = s.get("in", "")
    num = re.findall(r"−?\d+(?:,\d+)?", inp)
    return (sub,
            "−" if a.startswith("−") else ("0" if a.rstrip().startswith("0") else "+"),
            "дроб" if "," in a else "цел",
            inp.count("+"),
            any(x.startswith("−") for x in num),
            len(v.get("steps", [])))

def split(ids, title, qx):
    seen, core, more = collections.Counter(), [], []
    for i in ids:
        k = sig(qx.get(i, {}), title)
        seen[k] += 1
        (core if seen[k] == 1 else more).append(i)
    return core, more

def apply(num):
    plan = json.load(open("lessons/plan-fiz.json", encoding="utf-8"))
    form = json.load(open("lessons/form-fiz.json", encoding="utf-8"))
    qx = json.load(open("lessons/q-fiz.json", encoding="utf-8"))
    n = str(num)

    def cut(node, title):
        core, more = split(node["tasks"], title, qx)
        node["tasks"], node["more"] = core, more
        node["count"], node["extra"] = len(core), len(more)

    for g in plan[n]["groups"]:
        if g.get("subs"):
            for sb in g["subs"]: cut(sb, sb["title"])
            g["tasks"] = [i for sb in g["subs"] for i in sb["tasks"]]
            g["more"] = [i for sb in g["subs"] for i in sb["more"]]
        else:
            cut(g, g["title"])
        g["count"], g["extra"] = len(g["tasks"]), len(g["more"])
    plan[n]["total"] = sum(g["count"] for g in plan[n]["groups"])
    plan[n]["extra"] = sum(g["extra"] for g in plan[n]["groups"])

    core_ids = {i for g in plan[n]["groups"] for i in g["tasks"]}
    for L in form[n]["levels"]:
        for r in L["rows"]:
            all_ids = r["tasks"] + r.get("more", [])
            r["tasks"] = [i for i in all_ids if i in core_ids]
            r["more"] = [i for i in all_ids if i not in core_ids]
            r["count"], r["extra"] = len(r["tasks"]), len(r["more"])
        L["rows"] = [r for r in L["rows"] if r["count"] or r["extra"]]
        L["count"] = sum(r["count"] for r in L["rows"])
    form[n]["total"] = plan[n]["total"]

    json.dump(plan, open("lessons/plan-fiz.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(form, open("lessons/form-fiz.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("задание %s: ядро %d, второй круг %d" % (n, plan[n]["total"], plan[n]["extra"]))

if __name__ == "__main__":
    apply(1)
