import { verifyUser, rateLimit, runNetlifyDeploy } from './_shared'

interface VercelReq {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}
interface VercelRes {
  status: (code: number) => VercelRes
  json: (body: unknown) => void
}

function header(req: VercelReq, name: string): string | undefined {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

function parseBody(body: unknown): { projectId?: string; html?: string; existingSiteId?: string | null } {
  if (!body) return {}
  if (typeof body === 'string') {
    try { return JSON.parse(body) } catch { return {} }
  }
  return body as Record<string, never>
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await verifyUser(header(req, 'authorization'))
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Best-effort guard against abuse: cap deploys per user per minute.
  if (!rateLimit(`deploy:${user.id}`, 10, 60_000)) {
    res.status(429).json({ error: 'Too many deploys. Please wait a minute and try again.' })
    return
  }

  const { projectId, html, existingSiteId } = parseBody(req.body)
  if (!projectId || !html) {
    res.status(400).json({ error: 'Missing projectId or html' })
    return
  }

  try {
    const result = await runNetlifyDeploy({ projectId, html, existingSiteId })
    res.status(200).json(result)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Deploy failed' })
  }
}
