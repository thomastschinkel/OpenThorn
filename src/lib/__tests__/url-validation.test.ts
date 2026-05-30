import { describe, it, expect } from 'vitest'

/**
 * Tests for the validateUrl function in agent-tools.ts.
 * We test via the web_fetch tool execution which calls validateUrl.
 * These tests verify SSRF protection.
 */
import { executeTool } from '../agent-tools'

describe('web_fetch URL validation (SSRF protection)', () => {
  it('rejects http:// URLs', async () => {
    const result = await executeTool({
      id: '1',
      name: 'web_fetch',
      arguments: { url: 'http://example.com' },
    })
    expect(result.result).toContain('Only HTTPS')
  })

  it('rejects localhost', async () => {
    const result = await executeTool({
      id: '1',
      name: 'web_fetch',
      arguments: { url: 'https://localhost:3000/api' },
    })
    expect(result.result).toContain('URL blocked')
  })

  it('rejects 127.0.0.1', async () => {
    const result = await executeTool({
      id: '1',
      name: 'web_fetch',
      arguments: { url: 'https://127.0.0.1/admin' },
    })
    expect(result.result).toContain('URL blocked')
  })

  it('rejects 10.x.x.x private range', async () => {
    const result = await executeTool({
      id: '1',
      name: 'web_fetch',
      arguments: { url: 'https://10.0.0.1/secret' },
    })
    expect(result.result).toContain('URL blocked')
  })

  it('rejects 192.168.x.x private range', async () => {
    const result = await executeTool({
      id: '1',
      name: 'web_fetch',
      arguments: { url: 'https://192.168.1.1/admin' },
    })
    expect(result.result).toContain('URL blocked')
  })

  it('rejects 172.16-31.x.x private range', async () => {
    const result = await executeTool({
      id: '1',
      name: 'web_fetch',
      arguments: { url: 'https://172.16.0.1/api' },
    })
    expect(result.result).toContain('URL blocked')
  })

  it('rejects 169.254.x.x link-local', async () => {
    const result = await executeTool({
      id: '1',
      name: 'web_fetch',
      arguments: { url: 'https://169.254.169.254/latest/meta-data/' },
    })
    expect(result.result).toContain('URL blocked')
  })

  it('rejects metadata.google.internal', async () => {
    const result = await executeTool({
      id: '1',
      name: 'web_fetch',
      arguments: { url: 'https://metadata.google.internal/' },
    })
    expect(result.result).toContain('URL blocked')
  })

  it('rejects malformed URLs', async () => {
    const result = await executeTool({
      id: '1',
      name: 'web_fetch',
      arguments: { url: 'not-a-url' },
    })
    expect(result.result).toContain('URL blocked')
  })

  it('rejects empty URL', async () => {
    const result = await executeTool({
      id: '1',
      name: 'web_fetch',
      arguments: { url: '' },
    })
    expect(result.result).toContain('url parameter is required')
  })

  it('rejects [::1] IPv6 loopback', async () => {
    const result = await executeTool({
      id: '1',
      name: 'web_fetch',
      arguments: { url: 'https://[::1]:8080/' },
    })
    expect(result.result).toContain('URL blocked')
  })
})
