export interface DeployResult {
  url: string
  siteId: string
}

export async function deployToNetlify(
  projectId: string,
  html: string,
  existingSiteId?: string | null,
): Promise<DeployResult> {
  const res = await fetch('/.netlify/functions/deploy-netlify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, html, existingSiteId }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Deploy failed: ${body || res.statusText}`)
  }

  const data = await res.json()
  if (!data?.url || !data?.siteId) {
    throw new Error('Deploy failed: invalid response from deploy endpoint')
  }

  return {
    url: String(data.url),
    siteId: String(data.siteId),
  }
}
