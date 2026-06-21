import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only: serve the /api serverless functions through the Vite dev server,
// so `npm run dev` behaves like production (same-origin /api). On Vercel these
// same files in /api/ are deployed as serverless functions automatically.
function apiDevServer(): PluginOption {
  return {
    name: 'api-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const u = req.url || ''
        try {
          if (u.startsWith('/api/company')) {
            const mod = await server.ssrLoadModule('/api/company.js')
            return void mod.default(req, res)
          }
          if (u.startsWith('/api/site')) {
            const mod = await server.ssrLoadModule('/api/site.js')
            return void mod.default(req, res)
          }
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          return void res.end(JSON.stringify({ error: 'dev api error', detail: String(e) }))
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // VITE_BASE lets the same code deploy to multiple roots:
  //   Vercel (served at /)      -> VITE_BASE=/
  //   GitHub Pages / 42web sub  -> default /efficience/
  base: process.env.VITE_BASE || (command === 'build' ? '/efficience/' : '/'),
  plugins: [react(), apiDevServer()],
}))
