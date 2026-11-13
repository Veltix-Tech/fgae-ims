import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // The build mode selects one adapter at compile time. Live bundles cannot import fixtures.
  resolve: { alias: { '@correction-adapter': fileURLToPath(new URL(
    mode === 'mock' || mode === 'test' ? './src/mocks/corrections.ts' : './src/services/adapters/live-corrections.ts', import.meta.url,
  )), '@application-adapter': fileURLToPath(new URL(
    mode === 'mock' || mode === 'test' ? './src/mocks/application.ts' : './src/services/adapters/live-application.ts', import.meta.url,
  )), '@auth-adapter': fileURLToPath(new URL(
    mode === 'mock' || mode === 'test' ? './src/mocks/auth.ts' : './src/services/adapters/live-auth.ts', import.meta.url,
  )), '@recovery-adapter': fileURLToPath(new URL(
    mode === 'mock' || mode === 'test' ? './src/mocks/recovery.ts' : './src/services/adapters/live-recovery.ts', import.meta.url,
  )), '@reset-adapter': fileURLToPath(new URL(
    mode === 'mock' || mode === 'test' ? './src/mocks/reset-password.ts' : './src/services/adapters/live-reset-password.ts', import.meta.url,
  )), '@first-login-adapter': fileURLToPath(new URL(
    mode === 'mock' || mode === 'test' ? './src/mocks/first-login.ts' : './src/services/adapters/live-first-login.ts', import.meta.url,
  )), '@registration-adapter': fileURLToPath(new URL(
    mode === 'mock' || mode === 'test' ? './src/mocks/registration.ts' : './src/services/adapters/live-registration.ts', import.meta.url,
  )) } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true },
}))
