import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  verifyUser,
  rateLimit,
  runNetlifyDeploy,
  getProjectForDeploy,
  persistProjectSiteId,
  encryptForUser,
  decryptForUser,
  hasEncryptionSecret,
} from './api/_shared'

async function readJsonBody<T>(req: IncomingMessage): Promise<T | Record<string, never>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
  } catch {
    return {}
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export default defineConfig(({ mode }) => {
  // Mirror the Vercel function environment for the local dev shims so that
  // /api/* behaves the same in `vite dev` as it does in production.
  const env = loadEnv(mode, process.cwd(), '')
  process.env.SUPABASE_URL ||= env.SUPABASE_URL || env.VITE_SUPABASE_URL
  process.env.SUPABASE_ANON_KEY ||= env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  process.env.NETLIFY_TOKEN ||= env.NETLIFY_TOKEN || env.VITE_NETLIFY_TOKEN
  if (env.KEY_ENCRYPTION_SECRET) process.env.KEY_ENCRYPTION_SECRET ||= env.KEY_ENCRYPTION_SECRET

  return {
    plugins: [
      react(),
      {
        name: 'bloom-api-dev-endpoints',
        configureServer(server) {
          server.middlewares.use('/api/deploy-netlify', async (req, res) => {
            if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
            try {
              const user = await verifyUser(req.headers.authorization)
              if (!user) return sendJson(res, 401, { error: 'Unauthorized' })
              if (!(await rateLimit(`deploy:${user.id}`, 10, 60_000))) {
                return sendJson(res, 429, { error: 'Too many deploys. Please wait a minute and try again.' })
              }
              const body = await readJsonBody<{ projectId?: string; html?: string }>(req)
              if (!body.projectId || !body.html) return sendJson(res, 400, { error: 'Missing projectId or html' })
              const access = await getProjectForDeploy(req.headers.authorization, body.projectId)
              if (!access.ok) return sendJson(res, 403, { error: 'You do not have access to this project.' })
              const result = await runNetlifyDeploy({ projectId: body.projectId, html: body.html, existingSiteId: access.siteId })
              if (result.siteId !== access.siteId) {
                await persistProjectSiteId(req.headers.authorization, body.projectId, result.siteId)
              }
              sendJson(res, 200, result)
            } catch (err) {
              sendJson(res, 500, { error: err instanceof Error ? err.message : 'Deploy failed' })
            }
          })

          server.middlewares.use('/api/proxy', async (req, res) => {
            const CORS_PROXIED_HOSTS = new Set(['integrate.api.nvidia.com'])
            if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
            try {
              const user = await verifyUser(req.headers.authorization)
              if (!user) return sendJson(res, 401, { error: 'Unauthorized' })
              if (!(await rateLimit(`proxy:${user.id}`, 120, 60_000))) {
                return sendJson(res, 429, { error: 'Too many proxy requests. Please wait a minute.' })
              }
              const targetUrl = req.headers['x-proxy-url'] as string | undefined
              if (!targetUrl) return sendJson(res, 400, { error: 'Missing x-proxy-url header' })
              let targetHost: string
              try { targetHost = new URL(targetUrl).hostname } catch { return sendJson(res, 400, { error: 'Invalid x-proxy-url' }) }
              if (!CORS_PROXIED_HOSTS.has(targetHost)) return sendJson(res, 403, { error: `Host "${targetHost}" is not in the CORS proxy allowlist` })
              const chunks: Buffer[] = []
              for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
              const body = Buffer.concat(chunks)
              const providerKey = req.headers['x-provider-key'] as string | undefined
              const forwardHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
              if (providerKey) forwardHeaders['Authorization'] = `Bearer ${providerKey}`
              const upstream = await fetch(targetUrl, { method: 'POST', headers: forwardHeaders, body })
              res.statusCode = upstream.status
              const ct = upstream.headers.get('content-type')
              if (ct) res.setHeader('Content-Type', ct)
              if (!upstream.body) { res.end(); return }
              const reader = upstream.body.getReader()
              try {
                for (;;) {
                  const { done, value } = await reader.read()
                  if (done) break
                  res.write(value)
                }
              } finally {
                reader.releaseLock()
                res.end()
              }
            } catch (err) {
              sendJson(res, 502, { error: err instanceof Error ? err.message : 'Proxy error' })
            }
          })

          server.middlewares.use('/api/provider-keys', async (req, res) => {
            if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
            if (!hasEncryptionSecret()) return sendJson(res, 503, { error: 'Key encryption not configured' })
            try {
              const user = await verifyUser(req.headers.authorization)
              if (!user) return sendJson(res, 401, { error: 'Unauthorized' })
              if (!(await rateLimit(`keys:${user.id}`, 60, 60_000))) return sendJson(res, 429, { error: 'Too many requests' })
              const body = await readJsonBody<{ action?: string; value?: string }>(req)
              if ((body.action !== 'encrypt' && body.action !== 'decrypt') || typeof body.value !== 'string') {
                return sendJson(res, 400, { error: 'Invalid request' })
              }
              const result = body.action === 'encrypt'
                ? encryptForUser(body.value, user.id)
                : decryptForUser(body.value, user.id)
              sendJson(res, 200, { result })
            } catch {
              sendJson(res, 500, { error: 'Key operation failed' })
            }
          })
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['framer-motion'],
            'vendor-esbuild': ['esbuild-wasm'],
            'vendor-export': ['jszip', 'html2canvas'],
          },
        },
      },
      sourcemap: false,
      minify: 'esbuild',
      cssMinify: 'esbuild',
    },
  }
})
