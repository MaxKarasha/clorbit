// Test config: the root is the project (vite.config.ts uses root 'web', which would hide server tests).
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: '.',
  resolve: { alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  test: {
    include: ['server/**/*.test.ts', 'web/**/*.test.{ts,tsx}', 'shared/**/*.test.ts'],
    environment: 'node',
    // Some tests spawn the CLI and servers; give them headroom on a busy machine.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
