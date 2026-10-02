# Engine assessment

Oct 1, 2026. Prepared for milestone 2 of the build spec ([spec-v2.md](spec-v2.md)).

**Status:** read by Claude, not yet checked by a human. Under the sourcing rule, nothing here is a verified citation until a person checks it against the source. Each item says what was read and what still needs reading.

## Summary

| Candidate | Verdict | Why |
| --- | --- | --- |
| Dalla Man, Rizza, Cobelli 2007 meal model | **Adopt as the meal-scale engine** | Simulates glucose and insulin after a meal in normal subjects; insulin sensitivity is adjustable; a curated machine-readable version exists for cross-checking |
| Bergman minimal model 1979 | **Do not use as an engine** | Built for the IV glucose tolerance test and takes measured insulin as an input, so it cannot simulate a meal on its own. Keep it as the teaching concept behind "insulin sensitivity" |
| Dalla Man, Breton, Cobelli 2009 exercise extension | **Do not use** | Built and tested only for type 1 diabetes |
| Exercise models for healthy subjects (Romeres 2021, Frank 2021, Roy and Parker 2007) | **Decision needed** | Each was built on non-diabetic subjects, but none is a published extension of the Dalla Man meal model. See "Exercise: models built on healthy subjects" |
| Hall et al. 2011 body weight model | **Adopt as the energy-scale engine** | Equations confirmed; models glycogen with its water and extracellular fluid, so the scale-jump lesson is possible |

## Which presets the engines can support

| Preset | Supported? | Notes |
| --- | --- | --- |
| Same calories, different fuel | **No, as written** | The meal model's input is grams of carbohydrate only. Protein and fat do not enter the model. Showing them would mean inventing effects |
| The resistant machine | **Yes** | Dalla Man model; insulin sensitivity is a parameter. A type 2 diabetes parameter set is in the 2007 paper (not yet read) |
| Walk it off | **Partly** | Healthy-subject exercise effects exist, but combining them with the meal model is our own step, not a published one. See the exercise section |
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

**Where the curated SBML may differ from the paper.** These points come from memory of the paper and are unconfirmed without the full text. The engine follows the SBML and lists each one in every run's `limitations`.
- **Renal excretion** is fixed at zero. The paper has a threshold form, k_e1 · (G_p − k_e2) above k_e2 = 339 mg/kg, which corresponds to plasma glucose of about 180 mg/dL. The normal 78 g meal peaks at about 164 mg/dL, so this makes no difference for normal-subject presets. It would matter for the type 2 diabetes set.
- **Insulin secretion** has no piecewise conditions. In the paper, the rate-of-change term applies only while glucose is rising, and Y has a floor below basal. This affects the late phase after a meal, when glucose dips below basal.
- **Insulin-dependent uptake** is scaled by (1 − part), with part = 0.2. That factor doesn't match anything I remember from the paper. One side effect is that tissue glucose isn't exactly at steady state at t = 0, so a no-meal run drifts by about 1 mg/dL over 7 hours.
- **The emptying equation divides by meal size**, so it is undefined before the first meal. The engine uses k_max there; the stomach is empty, so the choice has no effect.

**Implementation (milestone 2).**
- `src/core/simulation/engines/dallaMan2007.ts` implements the model with fixed-step RK4. The default step is 0.1 min.
- The tests reproduce an independent libroadrunner run of the same SBML for 78 g and 45 g meals, matching to within 1e-5 relative. The fixture generator is `scripts/make_dm2007_fixtures.py`.
- A convergence test checks that halving the step changes glucose by less than 1e-6 mg/dL.

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

## Exercise: models built on healthy subjects

Found after the search requested on Oct 1, 2026.

**Romeres D, Schiavon M, Basu A, Cobelli C, Basu R, Dalla Man C. 2021.** Exercise effect on insulin-dependent and insulin-independent glucose utilization in healthy individuals and individuals with type 1 diabetes: a modeling study. *Am J Physiol Endocrinol Metab* 321(1):E122-E129 ([PMC8321821](https://pmc.ncbi.nlm.nih.gov/articles/PMC8321821/)).
- From the same Padova group as the meal model. It splits the exercise effect into the same two parts the meal model's glucose use is built from: insulin-independent and insulin-dependent.
- 6 healthy subjects, 65% VO₂max for 60 min, during a fasting clamp. There was no meal.
- In healthy subjects, insulin-independent use rose by about 67–97% and insulin-dependent use by about 10–40%. The insulin-independent effect was immediate; the insulin-dependent one was delayed.
- Its base is the hot glucose minimal model, not the meal model, and endogenous glucose production is treated as a known input.

**Frank S, Jbaily A, Hinshaw L, Basu R, Basu A, Szeri AJ. 2021.** Modeling the acute effects of exercise on glucose dynamics in healthy nondiabetic subjects. *J Pharmacokinet Pharmacodyn* 48(2):225-239 ([PMC8281614](https://pmc.ncbi.nlm.nih.gov/articles/PMC8281614/)).
- Healthy subjects after a **mixed meal**: 12 resting and 12 exercising, with tracer data. The exercise was walking at 50% VO₂max, in four 15-min bouts starting 120 min after the meal.
- Models three effects: higher liver glucose output, higher muscle uptake, and opening of extra capillaries in muscle. Some parts use partial differential equations; that's heavier than we need.
- The meal enters as a measured appearance rate rather than a gut model.
- Stated limits: moderate intensity only, and it underestimates how fast liver output recovers after exercise.
- **Most useful to us as a validation target:** published post-meal glucose curves for healthy walkers versus resters.

**Roy A, Parker RS. 2007.** Dynamic modeling of exercise effects on plasma glucose and insulin levels. *J Diabetes Sci Technol* 1(3):338-347 ([PMC2769581](https://pmc.ncbi.nlm.nih.gov/articles/PMC2769581)).
- Extends the Bergman minimal model with exercise effects on glucose uptake, liver glucose output, glycogen depletion and insulin clearance.
- Built from healthy-subject literature data; valid for 30–60% VO₂max and up to 210 min.
- Its base model has no meal absorption and no pancreatic secretion, so it has the same gaps as Bergman.

**Real-world check (not a model).** A systematic review and meta-analysis of 8 randomized trials with 116 participants ([PMC10036272](https://pmc.ncbi.nlm.nih.gov/articles/PMC10036272/)) found:
- Exercise after a meal lowered the glucose rise compared with exercise before it (standardized mean difference 0.47).
- The effect was greatest within 30 minutes of finishing the meal.

Whatever engine we build should reproduce that direction and timing.

**Options for "Walk it off"**
1. **Dalla Man meal model, with exercise effects taken from Romeres 2021 (recommended).** Raise insulin-independent use immediately and insulin-dependent use with a delay, by the published healthy-subject amounts. Then check the result against Frank 2021's walking curves and the meta-analysis. The combination is ours, so the UI labels it "meal model + published exercise effect sizes."
2. Implement Frank 2021 as a separate engine for this preset only. It's the closest published match (healthy subjects, mixed meal, walking), but it's heavy and needs the meal appearance rate supplied from outside.
3. Defer "Walk it off" to a later version.

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

## Without the 2007 IEEE paper

Buying the paper wasn't possible. Fallbacks:
- **Normal-subject parameters:** the curated BioModels SBML ([BIOMD0000000379](https://biomodels.org/BIOMD0000000379)). BioModels curators check that a model reproduces a result from its paper before marking it curated.
- **Reproduction test:** use the curated model's simulated output as the regression target, and say so in the test. A figure from the paper itself can replace it later.
- **Type 2 diabetes parameters:** MathWorks' SimBiology documentation of this model lists a type 2 variant (for example basal glucose 164.18 mg/dL and basal insulin 54.81 pmol/L). It's a secondary source and must be labeled as such.
- **Other routes to the paper:** ask the corresponding author for a copy (authors usually share), or get it through a public or university library's interlibrary loan.

## Decisions

Made on Oct 1, 2026:
1. **Engines:** Dalla Man 2007 for the meal scale and Hall 2011 for the energy scale. Bergman is dropped as an engine.
2. **Citation checks:** Vaughan signs off citations (`verifiedBy`).
3. **IEEE paper:** couldn't be purchased. Use the fallbacks above. The curated BioModels SBML is the primary source for the normal subject. The MathWorks type 2 variant is a labeled secondary source.
4. **Preset 1, "Same calories, different fuel":**
   - Two meals with the same calories and different macros.
   - The glucose curve comes from the carbohydrate only.
   - The diagram routes protein (portal vein) and fat (lymph) qualitatively.
   - A label states that the model doesn't include how fat and protein slow digestion.
5. **"Walk it off":** the meta-analysis ([PMC10036272](https://pmc.ncbi.nlm.nih.gov/articles/PMC10036272/)) is the acceptance check. The engine must show a smaller glucose rise with walking after a meal, strongest within 30 minutes. The exercise rates come from Romeres 2021, added to the meal model. This reading of Vaughan's "meta" answer was flagged to Vaughan for confirmation.
