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
          // Les handlers vivent sous /api/_h/<groupe>/<action>.js ; en production
          // une fonction /api/<groupe>/[action].js les route. On refait ce routage
          // ici pour que `npm run dev` serve les mêmes fichiers.
          // (Auparavant ce middleware pointait vers /api/company.js et /api/site.js,
          // supprimés depuis : l'analyse ne répondait plus du tout en local.)
          const m = /^\/api\/(analyze|ai|meta|linkedin|google|media|spaces|schedule|tiktok|email)\/([a-z0-9_-]+)/i.exec(u)
          if (m) {
            const mod = await server.ssrLoadModule(`/api/_h/${m[1]}/${m[2]}.js`)
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
