import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Mirror public/_redirects behavior in dev server
function cloudflareRedirects(): Plugin {
  return {
    name: 'cloudflare-redirects',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/manifesto') {
          res.writeHead(301, { Location: 'https://jakesimonds.leaflet.pub/3mdgq56uf3c2d' })
          res.end()
          return
        }
        // Serve /claimAward without needing index.html
        if (req.url?.toLowerCase() === '/claimaward') {
          res.writeHead(302, { Location: '/claimAward/index.html' })
          res.end()
          return
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflareRedirects()],
  server: {
    // Listen on all interfaces so 127.0.0.1 works (required for ATProto OAuth loopback)
    host: true,
    // Allow ngrok tunnels for mobile testing
    allowedHosts: ['.ngrok-free.app'],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        claim: resolve(__dirname, 'claimAward/index.html'),
      },
    },
  },
})
