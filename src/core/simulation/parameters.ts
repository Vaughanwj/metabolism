import { citationProblem } from '../model/loader';
import type { Citation } from '../model/types';
import type { Parameter, ParameterSet } from './types';

// Loads a parameter set from untrusted data. An engine needs every parameter, so a set with
// any unverified citation is refused as a whole (sourcing rule), with each problem listed.

export type ParameterSetResult =
  | { ok: true; set: ParameterSet }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadParameterSet(raw: unknown): ParameterSetResult {
  if (!isRecord(raw)) return { ok: false, errors: ['parameter set must be an object'] };
  const errors: string[] = [];
  const { id, engineId, name, parameters } = raw;
  if (typeof id !== 'string' || id === '') errors.push('id must be a non-empty string');
  if (typeof engineId !== 'string' || engineId === '') errors.push('engineId must be a non-empty string');
  if (typeof name !== 'string' || name === '') errors.push('name must be a non-empty string');
  if (!Array.isArray(parameters)) return { ok: false, errors: [...errors, 'parameters must be an array'] };

  const seen = new Set<string>();
  const loaded: Parameter[] = [];
  parameters.forEach((entry, i) => {
    if (!isRecord(entry)) {
      errors.push(`parameters[${i}] must be an object`);
      return;
    }
    const label = typeof entry['id'] === 'string' ? entry['id'] : `parameters[${i}]`;
    if (typeof entry['id'] !== 'string' || entry['id'] === '') errors.push(`parameters[${i}].id must be a non-empty string`);
    else if (seen.has(entry['id'])) errors.push(`duplicate parameter "${entry['id']}"`);
    else seen.add(entry['id']);
    if (typeof entry['value'] !== 'number' || !Number.isFinite(entry['value'])) errors.push(`${label}: value must be a finite number`);
    if (typeof entry['unit'] !== 'string' || entry['unit'] === '') errors.push(`${label}: unit must be a non-empty string`);
    if (typeof entry['description'] !== 'string') errors.push(`${label}: description must be a string`);
    const problem = citationProblem(entry['citation']);
    if (problem) errors.push(`${label}: ${problem}`);
    if (errors.length === 0) {
      loaded.push({
        id: entry['id'] as string,
        value: entry['value'] as number,
        unit: entry['unit'] as string,
        description: entry['description'] as string,
        citation: entry['citation'] as Citation,
      });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, set: { id: id as string, engineId: engineId as string, name: name as string, parameters: loaded } };
}
