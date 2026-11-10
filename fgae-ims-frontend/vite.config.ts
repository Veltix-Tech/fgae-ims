import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // The build mode selects one adapter at compile time. Live bundles cannot import fixtures.
  resolve: { alias: { '@auth-adapter': fileURLToPath(new URL(
    mode === 'mock' || mode === 'test' ? './src/mocks/auth.ts' : './src/services/adapters/live-auth.ts', import.meta.url,
  )) } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true },
}))
