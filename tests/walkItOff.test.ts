import { describe, expect, it } from 'vitest';
import { checkScenario, dallaMan2007, loadPreset, loadScenarioRules, mealMetrics, presetRuns, type ParameterSet, type Scenario } from '../src/core';
import normal from '../data/parameters/dalla-man-2007-normal.json';
import exercise from '../data/parameters/romeres-2021-exercise.json';
import rulesData from '../data/rules/dalla-man-2007.json';
import walkItOff from '../data/presets/walk-it-off.json';

// Acceptance check for "Walk it off", against Engeroff, Groneberg & Wilke, Sports Med 2023
// (meta-analysis, PMC10036272): exercise after a meal lowers the glucose excursion, and the
// effect is greater soon after the meal than after a delay.
//
// Known gap, recorded in the engine assessment: on the area above the starting level, this model
// shows a slightly larger reduction for later activity. Only the peak follows the timing pattern.

const meal = normal as unknown as ParameterSet;
const withExercise: ParameterSet = { ...meal, parameters: [...meal.parameters, ...(exercise as unknown as ParameterSet).parameters] };

function scenario(activityStart?: number, durationMin = 30): Scenario {
  const events: Scenario['events'] = [{ time: 0, kind: 'meal', payload: { carbohydrateG: 78, proteinG: 0, fatG: 0, fiberG: 0 } }];
  if (activityStart !== undefined) events.push({ time: activityStart, kind: 'activity', payload: { intensity: 'moderate', durationMin } });
  return {
    id: `walk-${activityStart ?? 'rest'}`,
    profile: { age: 40, sex: 'female', heightCm: 170, weightKg: 78, insulinSensitivity: 1, activityLevel: 1.5 },
    events,
    duration: 420,
    timeStep: 0.1,
    engineId: 'dalla-man-2007',
    warmUpMinutes: 2880,
  };
}

const peakRise = (s: Scenario) => mealMetrics(dallaMan2007.run(s, withExercise).series.find((x) => x.variable === 'G')!, 0, 78).peakRise;
const rest = peakRise(scenario());

describe('Walk it off: acceptance against the meta-analysis', () => {
  it('activity soon after the meal lowers the glucose peak', () => {
    for (const start of [0, 15, 30]) expect(peakRise(scenario(start)), `start ${start}`).toBeLessThan(rest - 4);
  });

  it('activity soon after the meal lowers the peak more than activity started later', () => {
    const early = Math.max(...[0, 15, 30].map((s) => peakRise(scenario(s))));
    const late = Math.min(...[60, 90, 120].map((s) => peakRise(scenario(s))));
    expect(early).toBeLessThan(late);
  });

  it('activity raises glucose uptake by muscle and fat while it lasts', () => {
    const uid = (s: Scenario) => dallaMan2007.run(s, withExercise).series.find((x) => x.variable === 'U_id')!.values;
    const active = uid(scenario(15));
    const resting = uid(scenario());
    expect(active[30]! - resting[30]!).toBeGreaterThan(1);
    expect(Math.abs(active[200]! - resting[200]!)).toBeLessThan(0.1);
  });
});

describe('Walk it off: engine and rules', () => {
  it('reports the exercise signal and adds the exercise limitations', () => {
    const run = dallaMan2007.run(scenario(15), withExercise);
    const signal = run.series.find((x) => x.variable === 'activity')!.values;
    expect(signal[10]).toBe(0);
    expect(signal[30]).toBeCloseTo(1, 6);
    expect(signal[60]).toBeLessThan(0.01);
    expect(run.limitations.some((l) => l.includes('Romeres et al. 2021'))).toBe(true);
  });

  it('leaves runs without activity unchanged by the exercise parameters', () => {
    expect(dallaMan2007.run(scenario(), withExercise).series).toEqual(dallaMan2007.run(scenario(), meal).series);
  });

  it('refuses activity outside the sourced window', () => {
    const verified = { ...rulesData, inputs: rulesData.inputs.map((i) => ({ ...i, citation: { ...i.citation, verifiedBy: 'A Reviewer', verifiedOn: '2026-10-02' } })) };
    const rules = loadScenarioRules(verified);
    if (!rules.ok) throw new Error(rules.errors.join());
    expect(checkScenario(scenario(15), rules.rules)).toEqual([]);
    expect(checkScenario(scenario(150), rules.rules)[0]).toMatch(/Activity starting after the meal is 150 min/);
    expect(checkScenario(scenario(15, 90), rules.rules)[0]).toMatch(/Activity duration is 90 min/);
  });

  it('builds the preset as rest versus 30 min of activity starting 15 min after the meal', () => {
    const p = loadPreset(walkItOff);
    if (!p.ok) throw new Error(p.errors.join());
    const runs = presetRuns(p.preset);
    expect(runs.baseline.events.map((e) => e.kind)).toEqual(['meal']);
    expect(runs.variant.events).toContainEqual({ time: 15, kind: 'activity', payload: { intensity: 'moderate', durationMin: 30 } });
  });
});
