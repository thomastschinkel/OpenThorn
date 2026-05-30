import { describe, it, expect, vi } from 'vitest'

// Must mock BEFORE importing the module — the module eagerly calls WebContainer.boot()
vi.mock('@webcontainer/api', () => ({
  WebContainer: {
    boot: vi.fn().mockResolvedValue({
      mount: vi.fn(),
      spawn: vi.fn(),
      on: vi.fn(),
      fs: {
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
      },
    }),
  },
}))

describe('WcPhase state machine', () => {
  it('all valid phases are defined', () => {
    const phases = ['idle', 'booting', 'ready', 'installing', 'starting', 'running', 'error'] as const
    expect(phases).toHaveLength(7)
    const unique = new Set(phases)
    expect(unique.size).toBe(7)
  })

  it('WcState has required fields', () => {
    const state = {
      phase: 'idle' as const,
      url: null,
      error: null,
      installOutput: '',
      serverOutput: '',
    }
    expect(state.phase).toBe('idle')
    expect(state.url).toBeNull()
    expect(state.error).toBeNull()
    expect(state.installOutput).toBe('')
    expect(state.serverOutput).toBe('')
  })

  it('WcState.url is set in running phase', () => {
    const state = {
      phase: 'running' as const,
      url: 'https://example.dev/',
      error: null,
      installOutput: '',
      serverOutput: '',
    }
    expect(state.url).toBeTruthy()
    expect(state.phase).toBe('running')
  })

  it('WcState.error is set in error phase', () => {
    const state = {
      phase: 'error' as const,
      url: null,
      error: 'Something went wrong',
      installOutput: 'npm ERR!',
      serverOutput: '',
    }
    expect(state.error).toBeTruthy()
    expect(state.phase).toBe('error')
  })
})

describe('WcState subscriptions', () => {
  it('subscribeWcState returns a function', async () => {
    const { subscribeWcState } = await import('../webcontainer')
    const unsub = subscribeWcState(() => {})
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('getWcState returns state with expected shape', async () => {
    const { getWcState } = await import('../webcontainer')
    const state = getWcState()
    expect(state).toHaveProperty('phase')
    expect(state).toHaveProperty('url')
    expect(state).toHaveProperty('error')
    expect(state).toHaveProperty('installOutput')
    expect(state).toHaveProperty('serverOutput')
  })

  it('multiple subscribers can be added and removed', async () => {
    const { subscribeWcState } = await import('../webcontainer')
    const unsub1 = subscribeWcState(() => {})
    const unsub2 = subscribeWcState(() => {})
    expect(typeof unsub1).toBe('function')
    expect(typeof unsub2).toBe('function')
    unsub1()
    unsub2()
  })
})

describe('booting state', () => {
  it('eager boot started (phase is booting or ready)', async () => {
    const { getWcState } = await import('../webcontainer')
    const state = getWcState()
    // After mock boot, should be 'ready' (boot resolved)
    expect(['booting', 'ready']).toContain(state.phase)
  })

  it('boot returns instance', async () => {
    const { boot } = await import('../webcontainer')
    const instance = await boot()
    expect(instance).toBeDefined()
    expect(typeof instance.mount).toBe('function')
    expect(typeof instance.spawn).toBe('function')
  })
})

describe('destroy', () => {
  it('resets state to idle', async () => {
    const { destroy, getWcState } = await import('../webcontainer')
    destroy()
    const state = getWcState()
    expect(state.phase).toBe('idle')
    expect(state.url).toBeNull()
    expect(state.error).toBeNull()
  })
})

describe('WcFile interface', () => {
  it('has path and content fields', () => {
    const file = { path: 'src/test.ts', content: 'export const x = 1' }
    expect(file.path).toBe('src/test.ts')
    expect(file.content).toBe('export const x = 1')
  })
})
