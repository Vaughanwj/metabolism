import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Hexagonal rule: the core imports nothing from adapters, UI, storage, packages or Node.
const coreDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/core');

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? tsFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

const IMPORT = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

describe('core boundary', () => {
  for (const file of tsFiles(coreDir)) {
    it(`${relative(coreDir, file)} imports only from inside the core`, () => {
      const outside: string[] = [];
      for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
        const spec = match[1] ?? match[2] ?? '';
        const target = resolve(dirname(file), spec);
        if (!spec.startsWith('.') || !(target === coreDir || target.startsWith(coreDir + sep))) outside.push(spec);
      }
      expect(outside).toEqual([]);
    });
  }
});
