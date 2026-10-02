import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dallaMan2007, loadParameterSet, type ParameterSet, type RunResult, type Scenario } from '../src/core';
import normal from '../data/parameters/dalla-man-2007-normal.json';

const params = normal as unknown as ParameterSet;

function mealScenario(carbohydrateG: number, timeStep = 0.1, duration = 420): Scenario {
  return {
    id: `meal-${carbohydrateG}g`,
    profile: { age: 40, sex: 'female', heightCm: 170, weightKg: 78, insulinSensitivity: 1, activityLevel: 1.5 },
    events: [{ time: 0, kind: 'meal', payload: { carbohydrateG, proteinG: 0, fatG: 0, fiberG: 0 } }],
    duration,
    timeStep,
    engineId: 'dalla-man-2007',
  };
}

function seriesOf(result: RunResult, variable: string): number[] {
  const s = result.series.find((x) => x.variable === variable);
  if (!s) throw new Error(`no series ${variable}`);
  return s.values;
}

function readFixture(name: string): Record<string, number[]> {
  const [header, ...rows] = readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8').trim().split('\n');
  const cols = header!.split(',');
  const table: Record<string, number[]> = Object.fromEntries(cols.map((c) => [c, []]));
  for (const row of rows) row.split(',').forEach((v, i) => table[cols[i]!]!.push(Number(v)));
  return table;
}

function maxRelativeError(actual: number[], expected: number[]): number {
  const scale = Math.max(...expected.map(Math.abs));
  return Math.max(...expected.map((e, i) => Math.abs(actual[i]! - e) / scale));
}

describe('Dalla Man 2007 engine: reproduction of the curated SBML', () => {
  // Fixtures: the BioModels SBML run in libroadrunner 2.8 (CVODE, rtol 1e-10), one row per minute.
  for (const [grams, file] of [[78, 'dm2007-roadrunner-78g.csv'], [45, 'dm2007-roadrunner-45g.csv']] as const) {
    it(`matches the reference run for a ${grams} g carbohydrate meal`, () => {
      const result = dallaMan2007.run(mealScenario(grams), params);
      const reference = readFixture(file);
      for (const variable of ['G', 'I', 'Ra', 'EGP', 'U', 'S', 'Q_sto', 'Q_gut']) {
        expect(maxRelativeError(seriesOf(result, variable), reference[variable]!), variable).toBeLessThan(1e-5);
      }
    });
  }

  it('shows the expected shape for the 78 g meal: peak about 164 mg/dL near 70 min', () => {
    const G = seriesOf(dallaMan2007.run(mealScenario(78), params), 'G');
    const peak = Math.max(...G);
    expect(peak).toBeCloseTo(163.94, 1);
    expect(G.indexOf(peak)).toBe(70);
    expect(G[0]).toBeCloseTo(94.68, 1);
  });
});

describe('Dalla Man 2007 engine: numerics', () => {
  it('converges: halving the step changes glucose by less than 1e-6 mg/dL', () => {
    const coarse = seriesOf(dallaMan2007.run(mealScenario(78, 0.1), params), 'G');
    const fine = seriesOf(dallaMan2007.run(mealScenario(78, 0.05), params), 'G');
    expect(Math.max(...coarse.map((g, i) => Math.abs(g - fine[i]!)))).toBeLessThan(1e-6);
  });

  it('is deterministic', () => {
    expect(dallaMan2007.run(mealScenario(78), params)).toEqual(dallaMan2007.run(mealScenario(78), params));
  });

  it('conserves the meal: absorbed plus remaining glucose equals the dose', () => {
    const result = dallaMan2007.run(mealScenario(78), params);
    const absorbedMg = (result.flowTotals['Ra']! / 0.9) * 78; // Ra counts fraction f = 0.9, per kg of 78 kg
    const remainingMg = seriesOf(result, 'Q_sto').at(-1)! + seriesOf(result, 'Q_gut').at(-1)!;
    expect((absorbedMg + remainingMg) / 78000).toBeCloseTo(1, 4);
  });
});

describe('Dalla Man 2007 engine: behaviour', () => {
  it('a larger carbohydrate load gives a higher glucose peak', () => {
    const peak = (g: number) => Math.max(...seriesOf(dallaMan2007.run(mealScenario(g), params), 'G'));
    expect(peak(90)).toBeGreaterThan(peak(78));
    expect(peak(78)).toBeGreaterThan(peak(30));
  });

  it('protein and fat do not change the glucose curve (stated limitation)', () => {
    const carbsOnly = mealScenario(50);
    const mixed: Scenario = {
      ...carbsOnly,
      events: [{ time: 0, kind: 'meal', payload: { carbohydrateG: 50, proteinG: 30, fatG: 25, fiberG: 5 } }],
    };
    const result = dallaMan2007.run(mixed, params);
    expect(seriesOf(result, 'G')).toEqual(seriesOf(dallaMan2007.run(carbsOnly, params), 'G'));
    expect(result.limitations[0]).toMatch(/protein and fat do not enter/);
  });

  it('handles a second meal later in the run', () => {
    const scenario = mealScenario(45, 0.1, 600);
    scenario.events.push({ time: 300, kind: 'meal', payload: { carbohydrateG: 45, proteinG: 0, fatG: 0, fiberG: 0 } });
    const G = seriesOf(dallaMan2007.run(scenario, params), 'G');
    expect(Math.max(...G.slice(300))).toBeGreaterThan(G[300]! + 20);
  });

  it('refuses events it does not model', () => {
    const scenario = mealScenario(45);
    scenario.events.push({ time: 30, kind: 'activity', payload: { intensity: 'walk', durationMin: 15 } });
    expect(() => dallaMan2007.run(scenario, params)).toThrow(/does not model "activity"/);
  });

  it('refuses a parameter set with a missing parameter', () => {
    const partial: ParameterSet = { ...params, parameters: params.parameters.filter((p) => p.id !== 'k_abs') };
    expect(() => dallaMan2007.run(mealScenario(45), partial)).toThrow(/missing: k_abs/);
  });

  it('records the model, version and parameter set used', () => {
    const result = dallaMan2007.run(mealScenario(45), params);
    expect([result.engineId, result.engineVersion, result.parameterSetId]).toEqual(['dalla-man-2007', '0.2.0', 'dalla-man-2007-normal']);
  });
});

describe('loadParameterSet', () => {
  it('accepts the bundled set, which has been human-verified', () => {
    const result = loadParameterSet(normal);
    expect(result.ok ? [] : result.errors).toEqual([]);
    if (!result.ok) return;
    expect(result.set.parameters).toHaveLength(44);
    expect(result.set.parameters.every((p) => p.citation.verifiedBy === 'Vaughan Wynne-Jones')).toBe(true);
  });

  it('refuses the whole set if any value is unverified', () => {
    const unverified = {
      ...normal,
      parameters: normal.parameters.map((p) => (p.id === 'k_abs' ? { ...p, citation: { ...p.citation, verifiedBy: '' } } : p)),
    };
    expect(loadParameterSet(unverified)).toEqual({ ok: false, errors: ['k_abs: citation not verified by a named person'] });
  });
});
