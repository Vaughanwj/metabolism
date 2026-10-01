import { loadReferenceModel } from './core';
import { bundledReferenceModel } from './adapters/bundled-reference-model';

// Placeholder entry point until the machine view (milestone 3).
const status = document.querySelector<HTMLElement>('#status');
const result = loadReferenceModel(await bundledReferenceModel.load());

if (status) {
  status.textContent = result.ok
    ? `Reference model loaded: ${result.model.components.length} components, ${result.model.flows.length} flows, ${result.model.controls.length} controls.`
    : `Reference model failed to load:\n${result.errors.join('\n')}`;
}
