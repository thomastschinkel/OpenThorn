import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

vi.stubGlobal('fetch', fetchMock)

describe('deployToNetlify', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
  })

  it('posts deploy requests to the same-origin deploy endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        siteId: 'site-123',
        url: 'https://bloom-project.netlify.app',
      }),
    })

    const { deployToNetlify } = await import('../deploy')
    const result = await deployToNetlify('project-12345678', '<!doctype html><html>Bloom</html>')

    expect(result).toEqual({
      siteId: 'site-123',
      url: 'https://bloom-project.netlify.app',
    })
    expect(fetchMock).toHaveBeenCalledWith('/.netlify/functions/deploy-netlify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'project-12345678',
        html: '<!doctype html><html>Bloom</html>',
      }),
    })
  })

  it('reuses an existing Netlify site when one is saved', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        siteId: 'site-existing',
        url: 'https://existing.netlify.app',
      }),
    })

    const { deployToNetlify } = await import('../deploy')
    const result = await deployToNetlify('project-1', '<html></html>', 'site-existing')

    expect(result).toEqual({
      siteId: 'site-existing',
      url: 'https://existing.netlify.app',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/.netlify/functions/deploy-netlify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'project-1',
        html: '<html></html>',
        existingSiteId: 'site-existing',
      }),
    })
  })
})
