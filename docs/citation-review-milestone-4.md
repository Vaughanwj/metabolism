# Citation review: milestone 4 (scenario controls and presets)

These facts need a person's check:
- **Without the rules,** the app won't start the simulator.
- **Without the exercise effects,** "Walk it off" and any activity scenario are refused.
- **Without the energy factors,** the meal-energy row says "awaiting citation check".

**How to check each one:**
1. Open its source.
2. Find the quoted text.
3. Confirm the value and Claude's reading of it.
4. Tick the box.

When you're done, tell Claude. Claude will set `verifiedBy` and `verifiedOn` in the data files.

| ✓ | Fact | Value used | Source and where | Data file |
| --- | --- | --- | --- | --- |
| ☐ | Carbohydrate range for a meal | 45–78 g | [GIM paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC2769591): "45 g of glucose is ingested at 8 a.m., 70 g at noon, and 70 g at 8 p.m." The curated SBML ([BIOMD0000000379](https://biomodels.org/BIOMD0000000379)) uses a meal dose D = 78000 mg. | `data/rules/dalla-man-2007.json` |
| ☐ | Insulin sensitivity range and what it scales | 30–100% of normal; scales `V_m0`, `V_mX` and `k_p3` | [GIM paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC2769591): "peripheral and hepatic insulin sensitivity (V_max and k_p3 in model, respectively)" and "peripheral and hepatic insulin sensitivity, which are set to 30% of the normal". | `data/rules/dalla-man-2007.json` |
| ☐ | Activity start window | 0–120 min after the meal | Engeroff T, Groneberg DA, Wilke J. *Sports Med* 2023;53(4):849-869 ([PMC10036272](https://pmc.ncbi.nlm.nih.gov/articles/PMC10036272/)). The trials started post-meal exercise within 0–29 min or 30–120 min of the meal. | `data/rules/dalla-man-2007.json` |
| ☐ | Activity duration | up to 60 min | [Romeres et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8321821/): 1 hour of exercise at 65% VO₂max. | `data/rules/dalla-man-2007.json` |
| ☐ | Exercise raises insulin-independent disposal | +79% | [Romeres et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8321821/), non-diabetic subjects: 67 ± 31%, 97 ± 28% and 74 ± 16% (visits 1–3). The value used is the mean of the three. | `data/parameters/romeres-2021-exercise.json` |
| ☐ | Exercise raises insulin-dependent disposal | +24% | Same source: 40 ± 33%, 10 ± 17% and 22 ± 32%. The value used is the mean of the three. | `data/parameters/romeres-2021-exercise.json` |
| ☐ | Activity signal smoothing | 1 min | Same source, Methods: "square-wave signal ... smoothed with a first-order low-pass filter, with time constant of 1 min". | `data/parameters/romeres-2021-exercise.json` |
| ☐ | Energy per gram | carbohydrate 4, protein 4, fat 9 kcal/g | [FAO Food and Nutrition Paper 77, chapter 3, section 3.5.1](https://www.fao.org/4/y5022e/y5022e04.htm): "17 kJ/g (4.0 kcal/g) for protein, 37 kJ/g (9.0 kcal/g) for fat and 17 kJ/g (4.0 kcal/g) for carbohydrates". | `data/reference/energy-factors.json` |

## Interpretations to confirm

- **The carbohydrate range is not a formal validation range.** It covers the meal sizes the model's authors simulated: 45 and 70 g in GIM, and 78 g in the curated model. Smaller or larger meals may well be fine, but no source says so.
- **"V_max" is ambiguous.** I read GIM's "V_max" as the whole maximum uptake rate, V_m0 + V_mX, which the curated SBML names `V_mmax`. The alternative is V_mX alone, the insulin-dependent part. The two readings give different resistant machines:

  | Reading | Fasting glucose | Fasting insulin |
  | --- | --- | --- |
  | Normal | 95 mg/dL | 30 pmol/L |
  | V_m0 + V_mX + k_p3 at 30% (used) | 114 mg/dL | 83 pmol/L |
  | V_mX + k_p3 at 30% | 101 mg/dL | 45 pmol/L |

- **GIM's type 2 diabetes setup also weakens the pancreas.** The preset doesn't, so it shows insulin resistance with the pancreas compensating, not full type 2 diabetes.
- **Exercise mapping (option 2, approved).** The project chose how to apply the exercise effects:
  - +79% on all of the meal model's insulin-independent disposal, U_ii plus the V_m0 term, with the extra taken up by muscle.
  - +24% on the V_mX term.
  - Both apply immediately.

  Using the mean of the three visits is also our choice.
