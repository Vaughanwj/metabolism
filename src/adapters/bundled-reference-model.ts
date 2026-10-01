import type { ReferenceModelSource } from '../core/ports';
import metabolism from '../../data/reference-model/metabolism.json';

/** Serves the reference model bundled with the app at build time. */
export const bundledReferenceModel: ReferenceModelSource = {
  load: async () => metabolism,
};
