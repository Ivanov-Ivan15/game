import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['shared/**/*.js', 'server/room.js', 'src/prediction.ts'],
      exclude: ['**/*.test.ts', 'node_modules/**'],
      reporter: ['text', 'html']
    }
  }
});