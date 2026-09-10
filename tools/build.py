# -*- coding: utf-8 -*-
"""Полная пересборка данных: кинематика → динамика → гидростатика → ядро → версия."""
import subprocess, sys, os
os.chdir(os.path.join(os.path.dirname(__file__), ".."))
for step in ("kin1", "dyn1", "gidro", "mat7"):
    print("──", step)
    subprocess.run([sys.executable, "tools/%s.py" % step], check=True)
sys.path.insert(0, "tools")
import yadro, why, dano
for n in (1, 2, 4):
    yadro.apply(n)
why.apply()          # своё «почему» для каждой задачи
dano.apply()         # первый шаг: что дано и что ищут
import yadro_mat
yadro_mat.apply(7)
subprocess.run([sys.executable, "tools/ver.py"], check=True)
