import type { Lesson, Scenario } from './simulation/types';

// Driven ports: what the core needs from the outside world. Adapters implement these.
// Sources return untrusted data; the core validates it before use.

export interface ReferenceModelSource {
  load(): Promise<unknown>;
}

export interface ParameterSetSource {
  list(engineId: string): Promise<unknown[]>;
}

export interface PresetSource {
  list(): Promise<{ id: string; baseline: Scenario; variant: Scenario; question: string }[]>;
}

export interface LessonSource {
  list(): Promise<Lesson[]>;
}
