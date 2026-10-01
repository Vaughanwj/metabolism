import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the built site works under any path, e.g. /metabolism/ on the landing page.
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
