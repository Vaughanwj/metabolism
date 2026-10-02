import { describe, expect, it } from 'vitest';
import {
  billOfMaterials,
  dallaMan2007,
  frameBuilder,
  loadBinding,
  loadReferenceModel,
  runDuration,
  sample,
  type ParameterSet,
  type ReferenceModel,
  type Scenario,
} from '../src/core';
import { layoutMachine } from '../src/ui/layout';
import metabolism from '../data/reference-model/metabolism.json';
import binding from '../data/bindings/dalla-man-2007.json';
import normal from '../data/parameters/dalla-man-2007-normal.json';

const loaded = loadReferenceModel(metabolism);
if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
const model: ReferenceModel = loaded.model;

const scenario: Scenario = {
  id: 'breakfast',
  profile: { age: 40, sex: 'female', heightCm: 170, weightKg: 78, insulinSensitivity: 1, activityLevel: 1.5 },
  events: [{ time: 0, kind: 'meal', payload: { carbohydrateG: 78, proteinG: 0, fatG: 0, fiberG: 0 } }],
  duration: 420,
  timeStep: 0.1,
  engineId: 'dalla-man-2007',
};
const run = dallaMan2007.run(scenario, normal as unknown as ParameterSet);

describe('loadBinding', () => {
  it('loads the bundled Dalla Man binding against the reference model', () => {
    const result = loadBinding(binding, model);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('reports unknown and duplicate ids', () => {
    const bad = {
      ...binding,
      flows: [...binding.flows, { flowId: 'no-such-flow', series: 'Ra', note: 'x' }, binding.flows[0]],
    };
    const result = loadBinding(bad, model);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain(`flows[${binding.flows.length}]: unknown flow "no-such-flow"`);
    expect(result.errors).toContain('flows: "carb-absorption" is bound twice');
  });
});

describe('sample', () => {
  const series = { variable: 'v', unit: 'u', times: [0, 1, 2], values: [0, 10, 30] };

  it('interpolates linearly between samples', () => {
    expect(sample(series, 0.5)).toBe(5);
    expect(sample(series, 1.5)).toBe(20);
  });

  it('clamps outside the run', () => {
    expect(sample(series, -1)).toBe(0);
    expect(sample(series, 9)).toBe(30);
  });
});

describe('frameBuilder', () => {
  const b = loadBinding(binding, model);
  if (!b.ok) throw new Error('binding failed');
  const frameAt = frameBuilder(run, b.binding);

  it('animates only bound flows and controls', () => {
    const frame = frameAt(70);
    expect([...frame.flows.keys()].sort()).toEqual(b.binding.flows.map((f) => f.flowId).sort());
    expect([...frame.controls.keys()]).toEqual(['insulin']);
    expect(frame.flows.has('fat-absorption')).toBe(false);
  });

  it('reports readouts that match the run', () => {
    const glucose = frameAt(70).observables.get('blood-glucose')!;
    expect(glucose.value).toBeCloseTo(163.94, 1);
    expect(glucose.unit).toBe('mg/dL');
  });

  it('scales flows of the same unit against one shared maximum', () => {
    let peak = 0;
    for (let t = 0; t <= runDuration(run); t += 1) {
      for (const f of frameAt(t).flows.values()) {
        expect(f.relative).toBeGreaterThanOrEqual(0);
        expect(f.relative).toBeLessThanOrEqual(1);
        peak = Math.max(peak, f.relative);
      }
    }
    expect(peak).toBeCloseTo(1, 6);
  });

  it('puts control activity between 0 and 1, highest when insulin peaks', () => {
    const insulin = run.series.find((s) => s.variable === 'I')!;
    const tPeak = insulin.times[insulin.values.indexOf(Math.max(...insulin.values))]!;
    expect(frameAt(tPeak).controls.get('insulin')).toBeCloseTo(1, 6);
    expect(frameAt(0).controls.get('insulin')).toBeLessThan(0.1);
  });

  it('refuses a binding for a different engine', () => {
    expect(() => frameBuilder(run, { ...b.binding, engineId: 'hall-2011' })).toThrow(/Binding is for hall-2011/);
  });
});

describe('billOfMaterials', () => {
  it('lists the liver\'s flows and the controls acting on them', () => {
    const bill = billOfMaterials(model, 'liver');
    expect(bill.flowsIn.map((f) => f.id)).toEqual(expect.arrayContaining(['carb-to-liver', 'protein-to-liver', 'glucose-to-liver']));
    expect(bill.flowsOut.map((f) => f.id)).toEqual(expect.arrayContaining(['carb-to-blood', 'liver-glucose-output']));
    expect(bill.controlsActing.map((c) => c.id)).toEqual(expect.arrayContaining(['insulin', 'glucagon', 'cortisol']));
    expect(bill.observables.map((o) => o.id)).toEqual(['liver-glycogen']);
  });

  it('lists the controls the pancreas makes', () => {
    expect(billOfMaterials(model, 'pancreas').controlsProduced.map((c) => c.id)).toEqual(['insulin', 'glucagon']);
  });

  it('shows a placeholder with nothing flowing through it', () => {
    const bill = billOfMaterials(model, 'kidneys');
    expect([bill.flowsIn, bill.flowsOut, bill.controlsActing]).toEqual([[], [], []]);
  });

  it('throws for an unknown component', () => {
    expect(() => billOfMaterials(model, 'spleen')).toThrow(/Unknown component/);
  });
});

describe('layoutMachine', () => {
  const layout = layoutMachine(model, new Map([['blood', 2]]));

  it('places every component and routes every flow', () => {
    expect([...layout.nodes.keys()].sort()).toEqual(model.components.map((c) => c.id).sort());
    for (const f of model.flows) expect(layout.flows.get(f.id)!.length, f.id).toBeGreaterThanOrEqual(2);
  });

  it('does not overlap components', () => {
    const boxes = [...layout.nodes.entries()];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, A] = boxes[i]!;
        const [b, B] = boxes[j]!;
        const apart = Math.abs(A.x - B.x) >= (A.width + B.width) / 2 || Math.abs(A.y - B.y) >= (A.height + B.height) / 2;
        expect(apart, `${a} overlaps ${b}`).toBe(true);
      }
    }
  });

  it('starts each flow at its source and ends it at its target', () => {
    for (const f of model.flows) {
      const pts = layout.flows.get(f.id)!;
      const near = (p: { x: number; y: number }, id: string) => {
        const n = layout.nodes.get(id)!;
        return Math.abs(p.x - n.x) <= n.width / 2 + 12 && Math.abs(p.y - n.y) <= n.height / 2 + 12;
      };
      expect(near(pts[0]!, f.from), `${f.id} start`).toBe(true);
      expect(near(pts[pts.length - 1]!, f.to), `${f.id} end`).toBe(true);
    }
  });

  it('makes room for readouts', () => {
    expect(layout.nodes.get('blood')!.height).toBeGreaterThan(layout.nodes.get('liver')!.height);
  });

  it('is deterministic', () => {
    const again = layoutMachine(model, new Map([['blood', 2]]));
    expect([...again.nodes.entries()]).toEqual([...layout.nodes.entries()]);
  });
});
