# -*- coding: utf-8 -*-
"""Ядро темы по математике: по одной задаче на каждый смысловой шаблон."""
import json, re, collections

def sig(v, sub):
    s = (v.get("formula", {}).get("subst") or {})
    a = str(s.get("out", "")).strip()
    inp = s.get("in", "")
    return (sub, a.startswith("\u2212"), "," in a, inp.count("+"), len(v.get("steps", [])))

def apply(num):
    n = str(num)
    plan = json.load(open("lessons/plan-mat.json", encoding="utf-8"))
    form = json.load(open("lessons/form-mat.json", encoding="utf-8"))
    qx = json.load(open("lessons/q-mat.json", encoding="utf-8"))
    for g in plan[n]["groups"]:
        subs = g.get("subs") or [{"title": g["title"], "tasks": g["tasks"] + g.get("more", [])}]
        for sb in subs:
            seen, core, more = collections.Counter(), [], []
            for i in sb["tasks"] + sb.get("more", []):
                k = sig(qx.get(i, {}), sb["title"])
                seen[k] += 1
                (core if seen[k] == 1 else more).append(i)
            sb["tasks"], sb["more"] = core, more
            sb["count"], sb["extra"] = len(core), len(more)
        if g.get("subs"):
            g["tasks"] = [i for sb in g["subs"] for i in sb["tasks"]]
            g["more"] = [i for sb in g["subs"] for i in sb["more"]]
        else:
            g["tasks"], g["more"] = subs[0]["tasks"], subs[0]["more"]
        g["count"], g["extra"] = len(g["tasks"]), len(g["more"])
    plan[n]["total"] = sum(g["count"] for g in plan[n]["groups"])
    plan[n]["extra"] = sum(g["extra"] for g in plan[n]["groups"])
    core = {i for g in plan[n]["groups"] for i in g["tasks"]}
    for L in form[n]["levels"]:
        for r in L["rows"]:
            allids = r["tasks"] + r.get("more", [])
            r["tasks"] = [i for i in allids if i in core]
            r["more"] = [i for i in allids if i not in core]
            r["count"], r["extra"] = len(r["tasks"]), len(r["more"])
        L["count"] = sum(r["count"] for r in L["rows"])
    form[n]["total"] = plan[n]["total"]
    json.dump(plan, open("lessons/plan-mat.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(form, open("lessons/form-mat.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("математика, задание %s: ядро %d, второй круг %d" % (n, plan[n]["total"], plan[n]["extra"]))
