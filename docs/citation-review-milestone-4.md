# Citation review: milestone 4 (scenario controls and presets)

These three facts need a person's check before the comparison page will run. Until then, the app refuses to start the simulator. The meal-energy row in the results table says "awaiting citation check".

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
