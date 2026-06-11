import type { IncomingMessage, ServerResponse } from 'node:http'
import { verifyUser, rateLimit } from './_shared.js'

// Narrowly scoped: only providers confirmed to block browser CORS.
// This is intentionally not a general-purpose proxy — each host must be
// individually vetted and added here.
const CORS_PROXIED_HOSTS = new Set([
  'integrate.api.nvidia.com',
])

// Disable Vercel's automatic JSON body parsing so we can stream the raw bytes.
export const config = { api: { bodyParser: false } }

function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

function sendError(res: ServerResponse, status: number, message: string) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: message }))
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed')
    return
  }

  // Require a valid Supabase session to prevent open-proxy abuse.
  const user = await verifyUser(header(req, 'authorization'))
  if (!user) {
    sendError(res, 401, 'Unauthorized')
    return
  }

  // 120 requests/min per user — generous for long streaming calls.
  if (!(await rateLimit(`proxy:${user.id}`, 120, 60_000))) {
    sendError(res, 429, 'Too many proxy requests. Please wait a minute.')
    return
  }

  // Validate target URL against the allowlist (prevents SSRF).
  const targetUrl = header(req, 'x-proxy-url')
  if (!targetUrl) {
    sendError(res, 400, 'Missing x-proxy-url header')
    return
  }

  let targetHost: string
  try {
    targetHost = new URL(targetUrl).hostname
  } catch {
    sendError(res, 400, 'Invalid x-proxy-url')
    return
  }

  if (!CORS_PROXIED_HOSTS.has(targetHost)) {
    sendError(res, 403, `Host "${targetHost}" is not in the CORS proxy allowlist`)
    return
  }

  // Read raw request body (bodyParser is disabled above).
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const body = Buffer.concat(chunks)

  // Build forwarded headers — provider key only, never the Supabase JWT.
  const providerKey = header(req, 'x-provider-key')
  const forwardHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (providerKey) forwardHeaders['Authorization'] = `Bearer ${providerKey}`

  // Call the actual provider server-side (no CORS restriction applies here).
  let upstream: Response
  try {
    upstream = await fetch(targetUrl, { method: 'POST', headers: forwardHeaders, body })
  } catch (err) {
    sendError(res, 502, `Upstream error: ${err instanceof Error ? err.message : String(err)}`)
    return
  }

  // Forward status and content-type.
  const outHeaders: Record<string, string> = {}
  const ct = upstream.headers.get('content-type')
  if (ct) outHeaders['Content-Type'] = ct
  res.writeHead(upstream.status, outHeaders)

  if (!upstream.body) {
    res.end()
    return
  }

  // Pipe the upstream body chunk-by-chunk (supports SSE streaming).
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
}
