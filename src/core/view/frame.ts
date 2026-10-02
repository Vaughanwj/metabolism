import type { RunResult, TimeSeries } from '../simulation/types';
import type { EngineBinding } from './binding';

// What the machine view shows at one moment of a run. Pure: the UI only draws it.

export interface FlowState {
  value: number;
  unit: string;
  /** 0 to 1: this flow's value relative to the largest bound flow with the same unit in the run. */
  relative: number;
  note: string;
}

export interface ReadoutState {
  value: number;
  unit: string;
}

export interface Frame {
  time: number;
  /** Bound flows only; an absent flow is not modeled by this engine. */
  flows: Map<string, FlowState>;
  /** Bound controls only: 0 at the run's lowest level of the signal, 1 at its highest. */
  controls: Map<string, number>;
  observables: Map<string, ReadoutState>;
}

/** Linear interpolation of a sampled series at time t, clamped to its ends. */
export function sample(series: TimeSeries, t: number): number {
  const { times, values } = series;
  if (times.length === 0) return NaN;
  if (t <= times[0]!) return values[0]!;
  const last = times.length - 1;
  if (t >= times[last]!) return values[last]!;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! <= t) lo = mid;
    else hi = mid;
  }
  const t0 = times[lo]!;
  const t1 = times[hi]!;
  const w = (t - t0) / (t1 - t0);
  return values[lo]! * (1 - w) + values[hi]! * w;
}

function findSeries(run: RunResult, variable: string): TimeSeries {
  const s = run.series.find((x) => x.variable === variable);
  if (!s) throw new Error(`Run from ${run.engineId} has no series "${variable}"`);
  return s;
}

/**
 * Precomputes what is constant over a run, then returns a function that builds each frame.
 * Pass every run being compared as scaleRuns so all are drawn on the same scale.
 */
export function frameBuilder(run: RunResult, binding: EngineBinding, scaleRuns: RunResult[] = [run]): (t: number) => Frame {
  for (const r of [run, ...scaleRuns]) {
    if (binding.engineId !== r.engineId) throw new Error(`Binding is for ${binding.engineId} but the run is from ${r.engineId}`);
  }
  const flows = binding.flows.map((b) => ({ ...b, s: findSeries(run, b.series) }));
  const controls = binding.controls.map((b) => {
    const all = scaleRuns.flatMap((r) => findSeries(r, b.series).values);
    return { ...b, s: findSeries(run, b.series), min: Math.min(...all), max: Math.max(...all) };
  });
  const observables = binding.observables.map((b) => ({ ...b, s: findSeries(run, b.series) }));

  // One scale per unit so arrows carrying the same kind of quantity are comparable.
  const maxByUnit = new Map<string, number>();
  for (const b of binding.flows) {
    for (const r of scaleRuns) {
      const s = findSeries(r, b.series);
      const peak = Math.max(...s.values.map(Math.abs));
      maxByUnit.set(s.unit, Math.max(maxByUnit.get(s.unit) ?? 0, peak));
    }
  }

  return (t: number): Frame => {
    const frame: Frame = { time: t, flows: new Map(), controls: new Map(), observables: new Map() };
    for (const f of flows) {
      const value = sample(f.s, t);
      const max = maxByUnit.get(f.s.unit) ?? 0;
      frame.flows.set(f.flowId, { value, unit: f.s.unit, relative: max > 0 ? Math.abs(value) / max : 0, note: f.note });
    }
    for (const c of controls) {
      frame.controls.set(c.controlId, c.max > c.min ? (sample(c.s, t) - c.min) / (c.max - c.min) : 0);
    }
    for (const o of observables) {
      frame.observables.set(o.observableId, { value: sample(o.s, t), unit: o.s.unit });
    }
    return frame;
  };
}

/** The time span a run covers. */
export function runDuration(run: RunResult): number {
  const times = run.series[0]?.times ?? [];
  return times.length > 0 ? times[times.length - 1]! : 0;
}
