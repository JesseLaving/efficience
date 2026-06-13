import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// In production (GitHub Pages) the app is served from /efficience/.
// In dev it stays at the root for convenience.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/efficience/' : '/',
  plugins: [react()],
}))
