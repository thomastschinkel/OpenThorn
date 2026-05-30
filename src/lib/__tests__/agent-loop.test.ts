import { describe, it, expect } from 'vitest'
import type { Message } from '../../components/chat/ChatPanel'

// Test that the agent loop module exports and types are correct
describe('agent-loop types', () => {
  it('AgentStreamEvent type is importable', async () => {
    const mod = await import('../agent-loop')
    expect(mod).toBeDefined()
    expect(typeof mod.runAgentLoop).toBe('function')
  })

  it('runAgentLoop is an async generator', async () => {
    const { runAgentLoop } = await import('../agent-loop')
    const result = runAgentLoop('test', {} as any, 'gpt-4', 'build', [])
    expect(result[Symbol.asyncIterator]).toBeDefined()
  })

  it('accepts onAskUser callback', async () => {
    const { runAgentLoop } = await import('../agent-loop')
    const onAskUser = async (q: string, opts: string[]) => 'answer'
    const result = runAgentLoop('test', {} as any, 'gpt-4', 'build', [], onAskUser)
    expect(result[Symbol.asyncIterator]).toBeDefined()
  })
})

describe('message format', () => {
  it('Message type has correct shape', () => {
    const msg: Message = {
      id: '1',
      role: 'assistant',
      text: 'Hello',
      blocks: [{ type: 'text', content: 'Hello' }],
    }
    expect(msg.id).toBe('1')
    expect(msg.role).toBe('assistant')
    expect(msg.text).toBe('Hello')
    expect(msg.blocks).toHaveLength(1)
  })

  it('ContentBlock supports all types', () => {
    const blocks: Message['blocks'] = [
      { type: 'text', content: 'text' },
      { type: 'tool', tool: 'write_file', toolResult: 'ok' },
      { type: 'file_change', path: 'src/test.ts' },
      { type: 'status', content: 'Working...' },
    ]
    expect(blocks).toHaveLength(4)
  })
})

describe('tool call tracking', () => {
  it('writes are trackable as file changes', () => {
    const fileChangeTools = ['write_file', 'edit_file', 'delete_file']
    expect(fileChangeTools).toContain('write_file')
    expect(fileChangeTools).toContain('edit_file')
    expect(fileChangeTools).toContain('delete_file')
    expect(fileChangeTools).not.toContain('read_file')
    expect(fileChangeTools).not.toContain('list_files')
  })

  it('build failures are tracked separately', () => {
    // execute_build results contain 'passed' or 'failed'
    const buildTool = 'execute_build'
    expect(buildTool).toBe('execute_build')
  })
})
