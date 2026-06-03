import { beforeEach, describe, expect, it, vi } from 'vitest'

const uploadMock = vi.fn()
const getPublicUrlMock = vi.fn()
const fromMock = vi.fn(() => ({
  upload: uploadMock,
  getPublicUrl: getPublicUrlMock,
}))

vi.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: fromMock,
    },
  },
}))

describe('deployToStorage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-03T12:34:56.789Z'))
    uploadMock.mockReset()
    getPublicUrlMock.mockReset()
    fromMock.mockClear()
  })

  it('uploads each deploy to a fresh HTML object path', async () => {
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({
      data: {
        publicUrl:
          'https://example.supabase.co/storage/v1/object/public/deployments/project-1/1780490096789/index.html',
      },
    })

    const { deployToStorage } = await import('../deploy')

    const url = await deployToStorage('project-1', '<!DOCTYPE html><html></html>')

    expect(fromMock).toHaveBeenCalledWith('deployments')
    expect(uploadMock).toHaveBeenCalledWith(
      'project-1/1780490096789/index.html',
      expect.any(Blob),
      {
        contentType: 'text/html; charset=utf-8',
        upsert: false,
        cacheControl: 'no-store',
      },
    )
    expect(getPublicUrlMock).toHaveBeenCalledWith('project-1/1780490096789/index.html')
    expect(url).toBe(
      'https://example.supabase.co/storage/v1/object/public/deployments/project-1/1780490096789/index.html',
    )
  })
})
