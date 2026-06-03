import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

const NETLIFY_API = 'https://api.netlify.com/api/v1'

interface DeployRequestBody {
  projectId?: string
  html?: string
  existingSiteId?: string | null
}

interface NetlifySiteResponse {
  id?: string
}

interface NetlifyDeployResponse {
  id?: string
  required?: string[]
  state?: string
  ssl_url?: string
  url?: string
  deploy_ssl_url?: string
  deploy_url?: string
}

async function readJsonBody(req: IncomingMessage): Promise<DeployRequestBody> {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as DeployRequestBody
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function netlifyFetch(token: string, path: string, options: RequestInit): Promise<Response> {
  const res = await fetch(`${NETLIFY_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Netlify API error ${res.status}: ${body}`)
  }

  return res
}

async function createNetlifySite(token: string, projectId: string): Promise<string> {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  const res = await netlifyFetch(token, '/sites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `bloom-${projectId.slice(0, 8)}-${suffix}` }),
  })
  const data = (await res.json()) as NetlifySiteResponse

  if (!data.id) {
    throw new Error('Netlify did not return a site id')
  }

  return data.id as string
}

function sha1(content: string): string {
  return createHash('sha1').update(content).digest('hex')
}

function deployUrl(data: NetlifyDeployResponse): string | undefined {
  return data.ssl_url || data.url || data.deploy_ssl_url || data.deploy_url
}

async function uploadDeployFile(token: string, deployId: string, path: string, content: string): Promise<void> {
  await netlifyFetch(token, `/deploys/${deployId}/files/${encodeURIComponent(path.slice(1))}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: content,
  })
}

async function waitForDeployReady(token: string, deployId: string): Promise<NetlifyDeployResponse> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await netlifyFetch(token, `/deploys/${deployId}`, { method: 'GET' })
    const data = (await res.json()) as NetlifyDeployResponse

    if (data.state === 'ready') {
      return data
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error('Netlify deploy did not become ready in time')
}

async function deployToNetlifySite(token: string, siteId: string, html: string): Promise<string> {
  const files = new Map<string, string>([
    ['/index.html', html],
    ['/_headers', [
    '/index.html',
    '  Content-Type: text/html; charset=utf-8',
    '/*',
    '  X-Content-Type-Options: nosniff',
    '',
  ].join('\n')],
    ['/_redirects', '/* /index.html 200\n'],
  ])

  const manifest = Object.fromEntries(
    Array.from(files, ([path, content]) => [path, sha1(content)]),
  )

  const res = await netlifyFetch(token, `/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: manifest }),
  })
  const data = (await res.json()) as NetlifyDeployResponse
  if (!data.id) {
    throw new Error('Netlify did not return a deploy id')
  }

  const required = new Set(data.required ?? [])
  for (const [path, content] of files) {
    if (required.size === 0 || required.has(manifest[path])) {
      await uploadDeployFile(token, data.id, path, content)
    }
  }

  const readyDeploy = await waitForDeployReady(token, data.id)
  const url = deployUrl(readyDeploy) || deployUrl(data)

  if (!url) {
    throw new Error('Netlify did not return a deploy URL')
  }

  return url as string
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'bloom-netlify-deploy-dev-endpoint',
      configureServer(server) {
        const env = loadEnv(server.config.mode, process.cwd(), '')

        server.middlewares.use('/.netlify/functions/deploy-netlify', async (req, res) => {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'Method not allowed' })
            return
          }

          try {
            const token = env.NETLIFY_TOKEN || env.VITE_NETLIFY_TOKEN || process.env.NETLIFY_TOKEN || process.env.VITE_NETLIFY_TOKEN
            if (!token) {
              sendJson(res, 500, { error: 'Missing NETLIFY_TOKEN' })
              return
            }

            const body = await readJsonBody(req)
            if (!body.projectId || !body.html) {
              sendJson(res, 400, { error: 'Missing projectId or html' })
              return
            }

            const siteId = body.existingSiteId || (await createNetlifySite(token, body.projectId))
            const url = await deployToNetlifySite(token, siteId, body.html)
            sendJson(res, 200, { url, siteId })
          } catch (err) {
            sendJson(res, 500, { error: err instanceof Error ? err.message : 'Deploy failed' })
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
        },
      },
    },
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: 'esbuild',
  },
})
