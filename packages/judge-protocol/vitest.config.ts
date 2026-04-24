import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    alias: {
      '@algoforge/types': new URL('../types/src/index.ts', import.meta.url).pathname,
    },
  },
});
