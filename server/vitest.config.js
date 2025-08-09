import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.js'],
    exclude: ['node_modules/**', '.git/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/fixtures/**',
        'scripts/**',
        'examples/**',
        'docs/**'
      ]
    },
    testTimeout: 10000, // 10 seconds timeout for tests
    hookTimeout: 10000, // 10 seconds timeout for hooks
    setupFiles: ['./tests/setup.js']
  }
});