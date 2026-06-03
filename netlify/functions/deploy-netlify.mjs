import { createHash } from 'node:crypto'

const NETLIFY_API = 'https://api.netlify.com/api/v1'

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

async function netlifyFetch(token, path, options) {
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

async function createSite(token, projectId) {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  const res = await netlifyFetch(token, '/sites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `bloom-${projectId.slice(0, 8)}-${suffix}` }),
  })
  const data = await res.json()

  if (!data.id) {
    throw new Error('Netlify did not return a site id')
  }

  return data.id
}

function sha1(content) {
  return createHash('sha1').update(content).digest('hex')
}

function deployUrl(data) {
  return data.ssl_url || data.url || data.deploy_ssl_url || data.deploy_url
}

async function uploadDeployFile(token, deployId, path, content) {
  await netlifyFetch(token, `/deploys/${deployId}/files/${encodeURIComponent(path.slice(1))}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: content,
  })
}

async function waitForDeployReady(token, deployId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await netlifyFetch(token, `/deploys/${deployId}`, { method: 'GET' })
    const data = await res.json()

    if (data.state === 'ready') {
      return data
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error('Netlify deploy did not become ready in time')
}

async function deployZip(token, siteId, html) {
  const files = new Map([
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
  const data = await res.json()
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

  return url
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  try {
    const token = process.env.NETLIFY_TOKEN || process.env.VITE_NETLIFY_TOKEN
    if (!token) {
      return json(500, { error: 'Missing NETLIFY_TOKEN' })
    }

    const { projectId, html, existingSiteId } = JSON.parse(event.body || '{}')
    if (!projectId || !html) {
      return json(400, { error: 'Missing projectId or html' })
    }

    const siteId = existingSiteId || (await createSite(token, projectId))
    const url = await deployZip(token, siteId, html)

    return json(200, { url, siteId })
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Deploy failed' })
  }
}
