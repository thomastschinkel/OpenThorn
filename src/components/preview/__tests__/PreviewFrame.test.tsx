import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PreviewFrame from '../PreviewFrame'

// Mock the webcontainer module
vi.mock('../../../lib/webcontainer', () => ({
  boot: vi.fn().mockResolvedValue({}),
  ensureRunning: vi.fn().mockResolvedValue('https://test.dev/'),
  subscribeWcState: vi.fn().mockReturnValue(() => {}),
  getWcState: vi.fn().mockReturnValue({
    phase: 'booting',
    url: null,
    error: null,
    installOutput: '',
    serverOutput: '',
  }),
}))

// Mock the workspace module
vi.mock('../../../lib/workspace', () => ({
  getWorkspace: vi.fn().mockReturnValue({
    files: [
      { path: 'index.html', content: '<html><title>Test</title></html>', lastModified: 1 },
    ],
    buildResult: null,
    previewUrl: null,
  }),
  subscribeToWorkspace: vi.fn().mockReturnValue(() => {}),
}))

describe('PreviewFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(<PreviewFrame device="pc" />)
    expect(container.querySelector('iframe')).toBeTruthy()
  })

  it('shows iframe with sandbox attributes', () => {
    render(<PreviewFrame device="pc" />)
    const iframe = screen.getByTitle('Website preview')
    expect(iframe).toBeTruthy()
    expect(iframe.getAttribute('sandbox')).toContain('allow-scripts')
    expect(iframe.getAttribute('sandbox')).toContain('allow-same-origin')
    expect(iframe.getAttribute('sandbox')).toContain('allow-forms')
  })

  it('renders with phone device width', () => {
    const { container } = render(<PreviewFrame device="phone" />)
    const wrapper = container.firstElementChild!
    expect(wrapper.className).toContain('framed')
  })

  it('renders with tablet device', () => {
    const { container } = render(<PreviewFrame device="tablet" />)
    const wrapper = container.firstElementChild!
    expect(wrapper.className).toContain('framed')
  })

  it('renders without frame in pc mode', () => {
    const { container } = render(<PreviewFrame device="pc" />)
    const wrapper = container.firstElementChild!
    expect(wrapper.className).not.toContain('framed')
  })

  it('shows progress placeholder while booting', () => {
    render(<PreviewFrame device="pc" />)
    const iframe = screen.getByTitle('Website preview')
    // Should have srcDoc set during booting
    expect(iframe.getAttribute('srcDoc')).toBeTruthy()
  })

  it('renders device frame chrome in phone mode', () => {
    const { container } = render(<PreviewFrame device="phone" />)
    // Should have URL bar
    expect(container.textContent).toContain('localhost')
  })
})
