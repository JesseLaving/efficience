import { defineConfig } from 'vitest/config'

/* Configuration séparée de vite.config.ts : celle-ci démarre le serveur d'API
   de développement, inutile — et coûteux — pour une suite de tests unitaires. */
export default defineConfig({
  test: {
    // jsdom : les modules testés lisent localStorage (jetons, calendrier,
    // planning), qui est justement l'endroit où vivent les données de l'app.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
})
