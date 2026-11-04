#!/usr/bin/env python3
"""Exporte les empreintes des baraques de l'îlot F (plan de 1939) vers data/ilot_f.json.

Les empreintes viennent de PLAN_BOXES dans build_rivesaltes_v4.py (relevé du plan
publié par le Mémorial). Même conversion qu'avant : 0,42 m par pixel du plan,
longueur bornée à 25–38 m, largeur à 5–8 m (dimensions indicatives).
"""
import importlib.util, json, math
from pathlib import Path
HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location("gen", HERE / "build_rivesaltes_v4.py")
gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)
out = []
for i, (x, y, w, h) in enumerate(gen.BUILDINGS, 1):
    cx = (x + w / 2 - gen.MAP_CENTRE[0]) * gen.SCALE
    cz = (gen.MAP_CENTRE[1] - (y + h / 2)) * gen.SCALE
    length = max(25, min(38, max(w, h) * gen.SCALE))
    width = max(5, min(8, min(w, h) * gen.SCALE))
    out.append({"id": i, "x": round(cx, 2), "z": round(cz, 2), "length": round(length, 2),
                "width": round(width, 2), "yaw": 0 if w >= h else round(math.pi / 2, 5)})
data = {"source": "Plan de l'îlot F, 1939 — Mémorial du camp de Rivesaltes (relevé des empreintes)",
        "unit": "mètre", "enclosure": {"xmin": -440, "xmax": 440, "zmin": -228, "zmax": 228},
        "barracks": out}
(HERE.parent / "data" / "ilot_f.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(out), "baraques exportées")
