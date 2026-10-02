"""Regenerate tests/fixtures/dm2007-roadrunner-*.csv from the curated BioModels SBML.

These fixtures are the reproduction target for the Dalla Man 2007 engine: an independent
solver (libroadrunner, CVODE) running the same curated model.

    pip install libroadrunner==2.8.0
    python scripts/make_dm2007_fixtures.py
"""
from pathlib import Path

import numpy as np
import roadrunner

ROOT = Path(__file__).resolve().parent.parent
SBML = ROOT / "data" / "sources" / "BIOMD0000000379.xml"
OUT = ROOT / "tests" / "fixtures"
SELECTIONS = ["time", "G", "I", "Ra", "EGP", "U", "S", "Q_sto", "Q_gut",
              "G_p", "G_t", "I_p", "I_l", "X", "Y", "I_po", "I_1", "I_d"]

for dose_mg in (78000, 45000):
    r = roadrunner.RoadRunner(str(SBML))
    r.integrator.relative_tolerance = 1e-10
    r.integrator.absolute_tolerance = 1e-10
    r["D"] = dose_mg
    r["Q_sto1"] = dose_mg
    rows = np.array(r.simulate(0, 420, 421, selections=SELECTIONS))
    path = OUT / f"dm2007-roadrunner-{dose_mg // 1000}g.csv"
    with path.open("w", newline="\n") as f:
        f.write(",".join(SELECTIONS) + "\n")
        for row in rows:
            f.write(",".join(f"{v:.10g}" for v in row) + "\n")
    print(f"wrote {path.name}")
