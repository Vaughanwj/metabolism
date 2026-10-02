import { describe, expect, it } from 'vitest';
import {
  applyProfile,
  checkScenario,
  compareRuns,
  dallaMan2007,
  explainComparison,
  loadEnergyFactors,
  loadPreset,
  loadScenarioRules,
  mealEnergyKcal,
  mealMetrics,
  presetRuns,
  type ParameterSet,
  type Preset,
  type Scenario,
  type ScenarioRules,
} from '../src/core';
import normal from '../data/parameters/dalla-man-2007-normal.json';
import rulesData from '../data/rules/dalla-man-2007.json';
import energyData from '../data/reference/energy-factors.json';
import bindingData from '../data/bindings/dalla-man-2007.json';
import sameCalories from '../data/presets/same-calories-different-fuel.json';
import resistant from '../data/presets/the-resistant-machine.json';

const params = normal as unknown as ParameterSet;
const verify = <T extends { citation: object }>(x: T) => ({ ...x, citation: { ...x.citation, verifiedBy: 'A Reviewer', verifiedOn: '2026-10-02' } });
const verifiedRules = { ...rulesData, inputs: rulesData.inputs.map(verify) };
const rulesResult = loadScenarioRules(verifiedRules);
if (!rulesResult.ok) throw new Error(rulesResult.errors.join('\n'));
const rules: ScenarioRules = rulesResult.rules;

function preset(raw: unknown): Preset {
  const r = loadPreset(raw);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.preset;
}

const run = (s: Scenario) => dallaMan2007.run(s, applyProfile(params, s.profile, rules));
const glucose = (r: ReturnType<typeof run>) => r.series.find((s) => s.variable === 'G')!;

describe('scenario rules', () => {
  it('refuses the bundled rules until their citations are checked', () => {
    const result = loadScenarioRules(rulesData);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      'carbohydrateG: citation not verified by a named person',
      'insulinSensitivity: citation not verified by a named person',
    ]);
  });

  it('refuses meals and sensitivities outside the sourced ranges', () => {
    const { baseline } = presetRuns(preset(sameCalories));
    expect(checkScenario(baseline, rules)).toEqual([]);
    const big: Scenario = { ...baseline, events: [{ time: 0, kind: 'meal', payload: { carbohydrateG: 120, proteinG: 0, fatG: 0, fiberG: 0 } }] };
    expect(checkScenario(big, rules)[0]).toMatch(/carbohydrate that is 120 g, outside the 45–78 g range/);
    const veryResistant: Scenario = { ...baseline, profile: { ...baseline.profile, insulinSensitivity: 0.1 } };
    expect(checkScenario(veryResistant, rules)[0]).toMatch(/Insulin sensitivity is 0.1/);
  });

  it('scales V_m0, V_mX and k_p3 by insulin sensitivity and nothing else', () => {
    const scaled = applyProfile(params, { ...presetRuns(preset(resistant)).variant.profile }, rules);
    const before = new Map(params.parameters.map((p) => [p.id, p.value]));
    for (const p of scaled.parameters) {
      const expected = ['V_m0', 'V_mX', 'k_p3'].includes(p.id) ? before.get(p.id)! * 0.3 : before.get(p.id)!;
      expect(p.value, p.id).toBeCloseTo(expected, 12);
    }
    expect(applyProfile(params, { ...presetRuns(preset(resistant)).baseline.profile }, rules)).toBe(params);
  });
});

describe('steady-state warm-up', () => {
  it('starts a resistant profile from its own higher fasting state, flat before the meal', () => {
    const p = preset(resistant);
    const fasting: Scenario = { ...presetRuns(p).variant, events: [], duration: 120 };
    const G = glucose(run(fasting)).values;
    expect(G[0]).toBeCloseTo(114.4, 0);
    expect(Math.abs(G.at(-1)! - G[0]!)).toBeLessThan(0.05);
  });
});

describe('mealMetrics', () => {
  const series = { variable: 'G', unit: 'mg/dL', times: [0, 10, 20, 30, 40], values: [100, 130, 150, 120, 105] };

  it('computes rise, timing, area and rise per gram', () => {
    const m = mealMetrics(series, 0, 50);
    expect(m).toEqual({ preMeal: 100, peakRise: 50, timeToPeak: 20, timeToBaseline: 40, iauc: 1025, risePerGram: 1 });
  });

  it('reports no return when glucose stays up', () => {
    expect(mealMetrics({ ...series, values: [100, 130, 150, 140, 130] }, 0, 50).timeToBaseline).toBeNull();
  });
});

describe('preset: same calories, different fuel', () => {
  const p = preset(sameCalories);
  const runs = presetRuns(p);

  it('changes only the meal', () => {
    expect(runs.variant.profile).toEqual(runs.baseline.profile);
    expect(runs.variant.events).not.toEqual(runs.baseline.events);
  });

  it('gives both meals about the same energy (within 1%)', () => {
    const energy = loadEnergyFactors({ ...energyData, citation: verify(energyData).citation });
    if (!energy.ok) throw new Error(energy.errors.join());
    const kcal = (s: Scenario) => mealEnergyKcal((s.events[0] as { payload: Scenario['events'][number]['payload'] & { carbohydrateG: number; proteinG: number; fatG: number; fiberG: number } }).payload, energy.factors);
    expect(Math.abs(kcal(runs.variant) - kcal(runs.baseline)) / kcal(runs.baseline)).toBeLessThan(0.01);
  });

  it('shows a smaller glucose rise for the lower-carbohydrate meal', () => {
    const b = mealMetrics(glucose(run(runs.baseline)), 0, 78);
    const v = mealMetrics(glucose(run(runs.variant)), 0, 45);
    expect(v.peakRise).toBeLessThan(b.peakRise);
    expect(v.iauc).toBeLessThan(b.iauc);
  });
});

describe('preset: the resistant machine', () => {
  const runs = presetRuns(preset(resistant));
  const b = run(runs.baseline);
  const v = run(runs.variant);
  const mb = mealMetrics(glucose(b), 0, 78);
  const mv = mealMetrics(glucose(v), 0, 78);

  it('changes only insulin sensitivity', () => {
    expect(runs.variant.events).toEqual(runs.baseline.events);
    expect(runs.intervention).toEqual({ variable: 'Insulin sensitivity', before: '100% of normal', after: '30% of normal' });
  });

  it('starts higher, rises further and takes longer to come back', () => {
    expect(mv.preMeal).toBeGreaterThan(mb.preMeal + 10);
    expect(mv.peakRise).toBeGreaterThan(mb.peakRise);
    expect(mv.timeToBaseline!).toBeGreaterThan(mb.timeToBaseline!);
  });

  it('needs much more insulin', () => {
    expect(v.flowTotals['S']!).toBeGreaterThan(1.5 * b.flowTotals['S']!);
  });

  it('explains the difference in plain language, largest change first', () => {
    const comparison = compareRuns(b, v, runs.intervention);
    expect(comparison.explainingFlows[0]).toBe('S');
    const note = explainComparison(comparison, bindingData.totals, { baseline: mb, variant: mv });
    expect(note[0]).toBe(`Glucose rose ${Math.round(mv.peakRise)} mg/dL above its pre-meal level in the variant, against ${Math.round(mb.peakRise)} in the baseline (+${Math.round(mv.peakRise) - Math.round(mb.peakRise)}).`);
    expect(note[1]).toMatch(/started from 114 mg\/dL/);
    expect(note).toContain('Over the whole run, the flows that changed most were:');
    expect(note.find((l) => l.startsWith('Insulin released by the pancreas'))).toMatch(/\(\+\d+%\)\.$/);
  });
});

describe('compareRuns', () => {
  it('ignores totals that changed by less than 1%', () => {
    const r = run(presetRuns(preset(resistant)).baseline);
    const same = compareRuns(r, r, { variable: 'nothing', before: 0, after: 0 });
    expect(same.explainingFlows).toEqual([]);
    expect(Object.values(same.flowDeltas).every((d) => d === 0)).toBe(true);
  });
});
