import type { Comparison, Intervention, RunResult } from '../simulation/types';
import type { MealMetrics } from './mealMetrics';

// Baseline versus variant: which flow totals moved, and a short plain-language note.

export interface TotalLabel {
  key: string;
  label: string;
  unit: string;
}

/** Totals that changed by less than this fraction of their larger value are treated as unchanged. */
const NEGLIGIBLE = 0.01;

export function compareRuns(baseline: RunResult, variant: RunResult, intervention: Intervention): Comparison {
  const keys = [...new Set([...Object.keys(baseline.flowTotals), ...Object.keys(variant.flowTotals)])];
  const flowDeltas: Record<string, number> = {};
  const relative: [string, number][] = [];
  for (const key of keys) {
    const b = baseline.flowTotals[key] ?? 0;
    const v = variant.flowTotals[key] ?? 0;
    flowDeltas[key] = v - b;
    const scale = Math.max(Math.abs(b), Math.abs(v));
    if (scale > 0 && Math.abs(v - b) / scale >= NEGLIGIBLE) relative.push([key, Math.abs(v - b) / scale]);
  }
  relative.sort((a, b) => b[1] - a[1]);
  return { intervention, baseline, variant, flowDeltas, explainingFlows: relative.map(([key]) => key) };
}

function signed(n: number, digits = 0): string {
  const s = n.toFixed(digits);
  return n > 0 ? `+${s}` : s;
}

/** A few sentences describing the difference, for the "what changed and why" note. */
export function explainComparison(
  comparison: Comparison,
  labels: TotalLabel[],
  metrics: { baseline: MealMetrics; variant: MealMetrics },
  maxFlows = 3,
): string[] {
  const { baseline: mb, variant: mv } = metrics;
  // Differences use the rounded figures so the sentence agrees with the numbers it quotes.
  const riseB = Math.round(mb.peakRise);
  const riseV = Math.round(mv.peakRise);
  const lines = [`Glucose rose ${riseV} mg/dL above its pre-meal level in the variant, against ${riseB} in the baseline (${signed(riseV - riseB)}).`];
  if (Math.abs(mv.preMeal - mb.preMeal) >= 1) {
    lines.push(`The variant started from ${mv.preMeal.toFixed(0)} mg/dL before the meal, against ${mb.preMeal.toFixed(0)} in the baseline.`);
  }
  const byKey = new Map(labels.map((l) => [l.key, l]));
  const flows = comparison.explainingFlows.filter((k) => byKey.has(k)).slice(0, maxFlows);
  if (flows.length === 0) {
    lines.push('No modeled flow changed by more than 1% over the run.');
    return lines;
  }
  lines.push('Over the whole run, the flows that changed most were:');
  for (const key of flows) {
    const l = byKey.get(key)!;
    const b = comparison.baseline.flowTotals[key] ?? 0;
    const v = comparison.variant.flowTotals[key] ?? 0;
    const pct = b !== 0 ? ` (${signed(((v - b) / Math.abs(b)) * 100)}%)` : '';
    lines.push(`${l.label}: ${b.toFixed(0)} → ${v.toFixed(0)} ${l.unit}${pct}.`);
  }
  return lines;
}
