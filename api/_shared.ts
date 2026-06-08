// Shared server-side helpers for Vercel Functions and the Vite dev shims.
// Files prefixed with "_" are not treated as routes by Vercel.
import { createHash, createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto'

// ---------------------------------------------------------------------------
// Supabase JWT verification
// ---------------------------------------------------------------------------

export interface AuthedUser {
  id: string
  email?: string
}

function supabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return { url, anonKey }
}

/**
 * Verify a Supabase access token by calling the Auth API. Returns the user on
 * success, or null if the token is missing/invalid or the server is not
 * configured with Supabase credentials.
 */
export async function verifyUser(authorization: string | undefined): Promise<AuthedUser | null> {
  const token = (authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const env = supabaseEnv()
  if (!env) return null

  try {
    const res = await fetch(`${env.url}/auth/v1/user`, {
      headers: { apikey: env.anonKey, Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id?: string; email?: string }
    if (!data?.id) return null
    return { id: data.id, email: data.email }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Best-effort in-memory rate limiting (per warm instance)
// ---------------------------------------------------------------------------

const buckets = new Map<string, number[]>()

/** Returns true if the action is allowed, false if the caller is over the limit. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs)
  if (hits.length >= max) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  return true
}

// ---------------------------------------------------------------------------
// Server-side provider-key encryption (AES-256-GCM)
//
// The encryption key is derived from a server-held secret (KEY_ENCRYPTION_SECRET)
// combined with the user id. A database dump alone therefore cannot be decrypted
// without also holding the server secret.
// ---------------------------------------------------------------------------

const SERVER_PREFIX = 'senc:'

export function hasEncryptionSecret(): boolean {
  return Boolean(process.env.KEY_ENCRYPTION_SECRET)
}

function deriveServerKey(userId: string): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET
  if (!secret) throw new Error('KEY_ENCRYPTION_SECRET is not configured')
  return Buffer.from(hkdfSync('sha256', secret, userId, 'provider-key-v1', 32))
}

export function encryptForUser(plaintext: string, userId: string): string {
  const key = deriveServerKey(userId)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${SERVER_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('base64')}`
}

export function decryptForUser(stored: string, userId: string): string {
  if (!stored.startsWith(SERVER_PREFIX)) return stored
  const body = stored.slice(SERVER_PREFIX.length)
  const [ivHex, tagHex, ctB64] = body.split(':')
  if (!ivHex || !tagHex || !ctB64) throw new Error('Malformed encrypted value')
  const key = deriveServerKey(userId)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()])
  return pt.toString('utf8')
}

// ---------------------------------------------------------------------------
// Netlify deploy (for user-generated sites)
// ---------------------------------------------------------------------------

const NETLIFY_API = 'https://api.netlify.com/api/v1'

interface NetlifySiteResponse { id?: string }
interface NetlifyDeployResponse {
  id?: string
  required?: string[]
  state?: string
  ssl_url?: string
  url?: string
  deploy_ssl_url?: string
  deploy_url?: string
}

async function netlifyFetch(token: string, path: string, options: RequestInit): Promise<Response> {
  const res = await fetch(`${NETLIFY_API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
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
  if (!data.id) throw new Error('Netlify did not return a site id')
  return data.id
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
    if (data.state === 'ready') return data
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('Netlify deploy did not become ready in time')
}

async function deployToNetlifySite(token: string, siteId: string, html: string): Promise<string> {
  const files = new Map<string, string>([
    ['/index.html', html],
    ['/_headers', ['/index.html', '  Content-Type: text/html; charset=utf-8', '/*', '  X-Content-Type-Options: nosniff', ''].join('\n')],
    ['/_redirects', '/* /index.html 200\n'],
  ])

  const manifest = Object.fromEntries(Array.from(files, ([path, content]) => [path, sha1(content)]))

  const res = await netlifyFetch(token, `/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: manifest }),
  })
  const data = (await res.json()) as NetlifyDeployResponse
  if (!data.id) throw new Error('Netlify did not return a deploy id')

  const required = new Set(data.required ?? [])
  for (const [path, content] of files) {
    if (required.size === 0 || required.has(manifest[path])) {
      await uploadDeployFile(token, data.id, path, content)
    }
  }

  const readyDeploy = await waitForDeployReady(token, data.id)
  const url = deployUrl(readyDeploy) || deployUrl(data)
  if (!url) throw new Error('Netlify did not return a deploy URL')
  return url
}

export interface DeployInput {
  projectId: string
  html: string
  existingSiteId?: string | null
}

export async function runNetlifyDeploy(input: DeployInput): Promise<{ url: string; siteId: string }> {
  const token = process.env.NETLIFY_TOKEN || process.env.VITE_NETLIFY_TOKEN
  if (!token) throw new Error('Missing NETLIFY_TOKEN')
  const siteId = input.existingSiteId || (await createNetlifySite(token, input.projectId))
  const url = await deployToNetlifySite(token, siteId, input.html)
  return { url, siteId }
}
