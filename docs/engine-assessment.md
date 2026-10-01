# Engine assessment

Oct 1, 2026. Prepared for milestone 2 of the build spec ([spec-v2.md](spec-v2.md)).

**Status:** read by Claude, not yet checked by a human. Under the sourcing rule, nothing here is a verified citation until a person checks it against the source. Each item says what was read and what still needs reading.

## Summary

| Candidate | Verdict | Why |
| --- | --- | --- |
| Dalla Man, Rizza, Cobelli 2007 meal model | **Adopt as the meal-scale engine** | Simulates glucose and insulin after a meal in normal subjects; insulin sensitivity is adjustable; a curated machine-readable version exists for cross-checking |
| Bergman minimal model 1979 | **Do not use as an engine** | Built for the IV glucose tolerance test and takes measured insulin as an input, so it cannot simulate a meal on its own. Keep it as the teaching concept behind "insulin sensitivity" |
| Dalla Man, Breton, Cobelli 2009 exercise extension | **Decision needed** | Adds physical activity but was built and tested for type 1 diabetes |
| Hall et al. 2011 body weight model | **Adopt as the energy-scale engine** | Equations confirmed; models glycogen with its water and extracellular fluid, so the scale-jump lesson is possible |

## Which presets the engines can support

| Preset | Supported? | Notes |
| --- | --- | --- |
| Same calories, different fuel | **No, as written** | The meal model's input is grams of carbohydrate only. Protein and fat do not enter the model. Showing them would mean inventing effects |
| The resistant machine | **Yes** | Dalla Man model; insulin sensitivity is a parameter. A type 2 diabetes parameter set is in the 2007 paper (not yet read) |
| Walk it off | **Only by extrapolation** | The only candidate exercise model is a type 1 diabetes model, driven by heart rate |
| Deficit size | **Yes** | Hall model; validation included a 30-day fast in obese subjects, which supports the "honest about extremes" requirement |
| The scale jump | **Yes** | Hall model includes glycogen (with about 2.7 g water per g) and sodium-driven extracellular fluid |

## Meal scale: Dalla Man, Rizza, Cobelli 2007

**Source:** Dalla Man C, Rizza RA, Cobelli C. Meal simulation model of the glucose-insulin system. *IEEE Trans Biomed Eng.* 2007;54(10):1740-9. PMID 17926672.

**What was read**
- The curated SBML version, BioModels [BIOMD0000000379](https://biomodels.org/BIOMD0000000379), which contains the normal-subject parameter set.
- The companion software paper: Dalla Man C, Raimondo DM, Rizza RA, Cobelli C. GIM, simulation software of meal glucose-insulin model. *J Diabetes Sci Technol.* 2007 ([PMC2769591](https://pmc.ncbi.nlm.nih.gov/articles/PMC2769591)).

**What still needs reading:** the 2007 IEEE paper itself, which is paywalled. It holds the equations as published, the type 2 diabetes parameters and the figures to reproduce.

**Structure.** 12 ODEs in total (GIM paper). The subsystems are:
- stomach (solid and liquid phases) and gut absorption
- glucose kinetics in two compartments
- insulin kinetics (liver and plasma)
- endogenous glucose production
- glucose utilization, insulin-independent and insulin-dependent
- insulin secretion
- renal excretion

The parameters were fitted to mean data from a large group of normal subjects who had triple-tracer meal studies.

**Inputs.** The meal is entered as glucose (carbohydrate) amount only. GIM lets you set hepatic and peripheral insulin sensitivity as a percentage of normal. The model has no exercise term.

**Normal-subject parameters in the SBML** (units as in the paper, to be confirmed against it):

| Group | Parameters |
| --- | --- |
| Glucose kinetics | V_G 1.88, k_1 0.065, k_2 0.079, G_b 95 (mg/dL) |
| Insulin kinetics | V_I 0.05, m_1 0.19, m_2 0.484, m_4 0.194, m_5 0.0304, m_6 0.6471, HE_b 0.6, I_b 25 (pmol/L) |
| Gastric emptying and absorption | k_max 0.0558, k_min 0.008, k_abs 0.057, k_gri 0.0558, f 0.9, b 0.82, d 0.01 |
| Endogenous production | k_p1 2.7, k_p2 0.0021, k_p3 0.009, k_p4 0.0618, k_i 0.0079 |
| Utilization | U_ii 1, V_m0 2.5, V_mX 0.047, K_m0 225.59, p_2U 0.0331 |
| Secretion | K 2.3, alpha 0.05, beta 0.11, gamma 0.5 |
| Renal excretion | k_e1 0.0005, k_e2 339 |
| Subject and meal | BW 78 kg, D 78,000 mg |

**Licensing.**
- My understanding, which is not legal advice: equations published in a paper can be implemented. What is protected is the paper's text and figures.
- The commercial UVA/Padova simulator and its virtual patient population are licensed separately. We should not use them.
- BioModels' licence for curated models still needs to be confirmed. I believe it is CC0.
- The GIM software is available to academic institutions on request only. We don't need it.

**Reproduction test (spec requirement).** The published single-meal figure for normal subjects is the regression target. Running the SBML model in an independent solver gives a second cross-check while the paper figure is being digitized.

## Bergman minimal model 1979

**Source:** Bergman RN, Ider YZ, Bowden CR, Cobelli C. Quantitative estimation of insulin sensitivity. *Am J Physiol.* 1979;236(6):E667-77.

**What was read:** a historical review, Bergman 2021, *Front Endocrinol* ([PMC7917251](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7917251/)).

The model has two equations: glucose disappearance (glucose effectiveness S_G and remote insulin action X), and the X compartment, which is driven by **measured** plasma insulin. It was designed to estimate S_I from a 180-minute IV glucose tolerance test. Because insulin is an input rather than something it simulates, it cannot show the pancreas responding to a meal. The Dalla Man model includes insulin action terms descended from this lineage. I recommend dropping it as an engine.

## Exercise: Dalla Man, Breton, Cobelli 2009

**Source:** Physical activity into the meal glucose-insulin model of type 1 diabetes: in silico studies. *J Diabetes Sci Technol.* 2009 ([PMC2769836](https://pmc.ncbi.nlm.nih.gov/articles/PMC2769836)). It builds on Breton MD 2008, *J Diabetes Sci Technol*.

**Structure.** Exercise enters as heart rate above rest. Three states describe its effects:
- **Y:** a fast on/off rise in insulin-independent glucose clearance.
- **Z:** a fast-on, slow-off rise in insulin sensitivity.
- **W:** the cumulative effect of exercise.

The selected variant ("Model C") has α = 3×10⁻⁴, β = 0.01 bpm⁻¹, γ = 1×10⁻⁷ and T_ex = 600 min.

**Problem.** It was tested only in silico on simulated type 1 diabetes subjects, whose insulin comes from injection rather than the pancreas. Grafting it onto the normal-subject meal model would be an extrapolation, and the spec says to refuse those.

**Options**
1. Adopt it, labeled as extrapolated.
2. Search for an exercise model validated in non-diabetic subjects.
3. Defer "Walk it off."

My recommendation is option 2, falling back to 3.

## Mixed meals: protein and fat

No candidate model covers protein and fat. Relevant literature exists:
- Ritschel et al. 2023, "Mathematical meal models for simulation of human metabolism" ([arXiv 2307.16444](https://arxiv.org/abs/2307.16444)), reviews five meal glucose rate-of-appearance models.
- The Padova group has used the oral minimal model to quantify how fat and protein slow the glucose rise in type 1 diabetes ([PAGE abstract](https://www.page-meeting.org/Abstracts/use-of-the-minimally-invasive-oral-minimal-model-to-quantify-the-effect-of-fat-and-protein-on-the-postprandial-glucose-excursion-in-individuals-with-type-1-diabetes-under-free-living-conditions/)).

**Recommendation for v1:** change preset 1 to vary carbohydrate only, for example "same size meal, different carbohydrate load," which the engine supports. Keep a research ticket open for a sourced protein and fat effect.

## Energy scale: Hall et al. 2011

**Source:** Hall KD, Sacks G, Chandramohan D, Chow CC, Wang YC, Gortmaker SL, Swinburn BA. Quantification of the effect of energy imbalance on bodyweight. *Lancet.* 2011;378(9793):826-37 ([PMC3880593](https://pmc.ncbi.nlm.nih.gov/articles/PMC3880593)).

**What was read:** the paper summary and the full web appendix, "Dynamic Mathematical Model of Body Weight Change in Adults" ([NIDDK PDF](https://www.niddk.nih.gov/-/media/Files/BWP/Hall_Lancet_Web_Appendix.pdf)). The equations below were transcribed from the appendix images.

| Eq. | Equation |
| --- | --- |
| 1 | ρ_G · dG/dt = CI − k_G · G², with k_G = CI_b / G_init² |
| 2 | dECF/dt = (1/[Na]) · (ΔNa_diet − ξ_Na · (ECF − ECF_init) − ξ_CI · (1 − CI/CI_b)) |
| 3 | ρ_F · dF/dt = (1 − p) · (EI − EE − ρ_G · dG/dt);  ρ_L · dL/dt = p · (EI − EE − ρ_G · dG/dt) |
| 4 | Initial fat if unknown (Jackson et al.): men F = BW/100 · (0.14·age + 37.31·ln(BW/H²) − 103.94); women F = BW/100 · (0.14·age + 39.96·ln(BW/H²) − 102.01) |
| 5 | EE = K + γ_F·F + γ_L·L + δ·BW + TEF + AT + η_L·dL/dt + η_F·dF/dt |
| 6 | TEF = β_TEF · ΔEI |
| 7 | τ_AT · dAT/dt = β_AT · ΔEI − AT |
| 8 | δ = ((1 − β_TEF) · PAL − 1) · RMR / BW, with RMR from Mifflin–St Jeor |
| 9 | Closed form: EE = [K + γ_F·F + γ_L·L + δ·BW + TEF + AT + (EI − ρ_G·dG/dt)·(p·η_L/ρ_L + (1−p)·η_F/ρ_F)] / [1 + p·η_L/ρ_L + (1−p)·η_F/ρ_F] |

**Parameters:**
- energy densities: ρ_G = 17.6 MJ/kg, ρ_F = 39.5 MJ/kg, ρ_L = 7.6 MJ/kg
- energy partition: p = C/(C + F), with C = 10.4 kg × ρ_L/ρ_F
- resting expenditure from body composition: γ_F = 13 kJ/kg/d, γ_L = 92 kJ/kg/d
- cost of building tissue: η_F = 750 kJ/kg, η_L = 960 kJ/kg
- thermic effect of food: β_TEF = 0.1
- adaptation: β_AT = 0.14, τ_AT = 14 d
- activity: δ ≈ 30 kJ/kg/d for a sedentary person (PAL 1.5)
- glycogen: about 500 g at baseline, with about 2.7 g water per gram
- sodium: [Na] = 3.22 mg/mL, ξ_Na = 3000 mg/L/d, ξ_CI = 4000 mg/d

K is set by the initial energy balance.

**Inputs:** energy intake, carbohydrate intake, dietary sodium change and physical activity level. Starting body composition comes from age, sex, height and weight.

**Validation (from the paper):**
- the CALERIE calorie restriction trial
- inpatient liquid-diet studies
- 30-day fasting in obese subjects

**Licensing.** Hall is an NIH researcher and the appendix is hosted by NIDDK, but the paper itself is Lancet copyright. Implementing the equations should be fine. Copying their text or figures is not. An open-source R implementation exists for cross-checking (the INSP "bw" package, [adult_weight](https://rdrr.io/github/INSP-RH/Normales/man/adult_weight.html)). Its licence is not yet checked.

**What still needs reading:** the main paper's validation figures, to pick a reproduction target, and the validated input ranges, so controls can be clamped.

## Decisions needed

1. Approve Dalla Man 2007 (meal) and Hall 2011 (energy) as the v1 engines, and drop Bergman as an engine.
2. Preset 1: switch to a carbohydrate-only comparison for v1?
3. "Walk it off": search for a non-diabetic exercise model, adopt the type 1 diabetes extension labeled as extrapolated, or defer?
4. Obtain the full text of the 2007 IEEE paper, which is paywalled, for the type 2 diabetes parameters and the reproduction figure.
5. Who signs off citations (`verifiedBy`)? The loader rejects facts no named person has checked.
