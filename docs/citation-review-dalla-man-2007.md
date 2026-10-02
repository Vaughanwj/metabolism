# Citation review: Dalla Man 2007, normal subject

Each value below must be checked by a person before the app will use it. The loader refuses the whole parameter set until every entry has `verifiedBy` and `verifiedOn`.

**How to check:**
1. Open [BIOMD0000000379 on BioModels](https://biomodels.org/BIOMD0000000379) and go to the model's parameter list. The same file is also saved at `data/sources/BIOMD0000000379.xml`.
2. Confirm that each value matches.
3. Tick the box.
4. When you're done, tell Claude. Claude then sets `verifiedBy` to your name and `verifiedOn` to the date in `data/parameters/dalla-man-2007-normal.json`.

Units come from the model structure and could not be checked against the paper. Note any that look wrong.

| ✓ | Id | Value | Unit | Meaning | Where |
| --- | --- | --- | --- | --- | --- |
| ☐ | `V_G` | 1.88 | dL/kg | Glucose distribution volume | SBML parameter V_G |
| ☐ | `k_1` | 0.065 | 1/min | Glucose transfer, plasma to tissue | SBML parameter k_1 |
| ☐ | `k_2` | 0.079 | 1/min | Glucose transfer, tissue to plasma | SBML parameter k_2 |
| ☐ | `G_b` | 95 | mg/dL | Basal plasma glucose | SBML parameter G_b |
| ☐ | `V_I` | 0.05 | L/kg | Insulin distribution volume | SBML parameter V_I |
| ☐ | `m_1` | 0.19 | 1/min | Insulin transfer, liver to plasma | SBML parameter m_1 |
| ☐ | `m_2` | 0.484 | 1/min | Insulin transfer, plasma to liver | SBML parameter m_2 |
| ☐ | `m_4` | 0.194 | 1/min | Peripheral insulin degradation | SBML parameter m_4 |
| ☐ | `m_5` | 0.0304 | min·kg/pmol | Hepatic extraction dependence on secretion | SBML parameter m_5 |
| ☐ | `m_6` | 0.6471 | dimensionless | Hepatic extraction intercept | SBML parameter m_6 |
| ☐ | `I_b` | 25 | pmol/L | Basal plasma insulin | SBML parameter I_b |
| ☐ | `S_b` | 1.8 | pmol/kg/min | Basal insulin secretion | SBML parameter S_b |
| ☐ | `k_max` | 0.0558 | 1/min | Maximum gastric emptying rate | SBML parameter k_max |
| ☐ | `k_min` | 0.008 | 1/min | Minimum gastric emptying rate | SBML parameter k_min |
| ☐ | `k_abs` | 0.057 | 1/min | Intestinal absorption rate | SBML parameter k_abs |
| ☐ | `k_gri` | 0.0558 | 1/min | Grinding rate, solid to liquid stomach | SBML parameter k_gri |
| ☐ | `f` | 0.9 | dimensionless | Fraction of intestinal absorption appearing in plasma | SBML parameter f |
| ☐ | `b` | 0.82 | dimensionless | Emptying curve breakpoint b (fraction of dose) | SBML parameter b |
| ☐ | `d` | 0.01 | dimensionless | Emptying curve breakpoint d (fraction of dose) | SBML parameter d |
| ☐ | `BW` | 78 | kg | Body weight of the average subject | SBML parameter BW |
| ☐ | `k_p1` | 2.7 | mg/kg/min | Extrapolated EGP at zero glucose and insulin | SBML parameter k_p1 |
| ☐ | `k_p2` | 0.0021 | 1/min | Liver glucose effectiveness | SBML parameter k_p2 |
| ☐ | `k_p3` | 0.009 | mg/kg/min per pmol/L | Insulin action on the liver | SBML parameter k_p3 |
| ☐ | `k_p4` | 0.0618 | mg/kg/min per pmol/kg | Portal insulin action on the liver | SBML parameter k_p4 |
| ☐ | `k_i` | 0.0079 | 1/min | Delay between insulin signal and action on the liver | SBML parameter k_i |
| ☐ | `U_ii` | 1 | mg/kg/min | Insulin-independent glucose use (brain, red cells) | SBML parameter U_ii |
| ☐ | `V_m0` | 2.5 | mg/kg/min | Basal maximum insulin-dependent uptake | SBML parameter V_m0 |
| ☐ | `V_mX` | 0.047 | mg/kg/min per pmol/L | Insulin action on peripheral uptake | SBML parameter V_mX |
| ☐ | `K_m0` | 225.59 | mg/kg | Michaelis-Menten constant for uptake | SBML parameter K_m0 |
| ☐ | `p_2U` | 0.0331 | 1/min | Rate of insulin action on peripheral uptake | SBML parameter p_2U |
| ☐ | `part` | 0.2 | dimensionless | Scaling of insulin-dependent uptake by (1 - part); appears in the SBML, not known from the paper | SBML parameter part |
| ☐ | `K` | 2.3 | pmol/kg per mg/dL | Pancreatic responsivity to rate of glucose change | SBML parameter K |
| ☐ | `alpha` | 0.05 | 1/min | Delay between glucose signal and insulin secretion | SBML parameter alpha |
| ☐ | `beta` | 0.11 | pmol/kg/min per mg/dL | Pancreatic responsivity to glucose | SBML parameter beta |
| ☐ | `gamma` | 0.5 | 1/min | Transfer rate, portal vein to liver | SBML parameter gamma |
| ☐ | `G_p0` | 178 | mg/kg | Initial plasma glucose mass | SBML species G_p initial amount |
| ☐ | `G_t0` | 135 | mg/kg | Initial tissue glucose mass | SBML species G_t initial amount |
| ☐ | `I_l0` | 4.5 | pmol/kg | Initial liver insulin mass | SBML species I_l initial amount |
| ☐ | `I_p0` | 1.25 | pmol/kg | Initial plasma insulin mass | SBML species I_p initial amount |
| ☐ | `I_10` | 25 | pmol/L | Initial delayed insulin signal, first compartment | SBML species I_1 initial amount |
| ☐ | `I_d0` | 25 | pmol/L | Initial delayed insulin signal | SBML species I_d initial amount |
| ☐ | `X0` | 0 | pmol/L | Initial insulin action on peripheral uptake | SBML species X initial amount |
| ☐ | `I_po0` | 3.6 | pmol/kg | Initial portal vein insulin | SBML species I_po initial amount |
| ☐ | `Y0` | 0 | pmol/kg/min | Initial secretion above basal | SBML species Y initial amount |
