import { defineConfig } from 'vitest/config'

// Poki serves a game from a sub-path, so every asset URL must be relative.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/sim/**'],
      exclude: ['src/sim/**/*.test.ts', 'src/sim/types.ts', 'src/sim/testUtil.ts'],
    },
  },
})
