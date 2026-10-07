/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// GitHub Pages serves the game at https://<user>.github.io/tiny-tide/, so production builds and their local preview need the
// repo-name base path. `npm run android:build` builds with a relative base for the phone app. Dev and tests stay at '/'.
export default defineConfig(({ command, isPreview, mode }) => ({
  base: command === 'build' || isPreview ? '/tiny-tide/' : '/',
  build: {
    rollupOptions: {
      input: {
        tide: 'index.html',
        // The browser-test fixture page exists only in development builds (the dev server serves it as well).
        ...(mode === 'development' ? { tideFixtures: 'tests-browser/fixtures.html' } : {}),
      },
    },
  },
  server: { port: 5199 },
  preview: { port: 5199 },
  test: { exclude: ['**/node_modules/**', '.claude/**', 'android/**'] },
}));
