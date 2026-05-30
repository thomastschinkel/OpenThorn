import { describe, it, expect, beforeEach } from 'vitest'
import {
  TOOL_DEFINITIONS,
  executeTool,
  parseToolCallsFromDelta,
  type ToolCall,
} from '../agent-tools'
import { resetWorkspace, writeFile } from '../workspace'

describe('TOOL_DEFINITIONS', () => {
  it('has all required tools', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.function.name)
    expect(names).toContain('list_files')
    expect(names).toContain('search_files')
    expect(names).toContain('read_file')
    expect(names).toContain('write_file')
    expect(names).toContain('edit_file')
    expect(names).toContain('delete_file')
    expect(names).toContain('execute_build')
    expect(names).toContain('get_errors')
    expect(names).toContain('run_command')
    expect(names).toContain('web_search')
    expect(names).toContain('web_fetch')
    expect(names).toContain('ask_user')
  })

  it('all tools have valid function definitions', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.type).toBe('function')
      expect(tool.function.name).toBeTruthy()
      expect(tool.function.description).toBeTruthy()
      expect(tool.function.description.length).toBeGreaterThan(20)
      expect(tool.function.parameters).toBeDefined()
      expect(tool.function.parameters.type).toBe('object')
    }
  })

  it('all tool descriptions include WHEN TO USE guidance', () => {
    for (const tool of TOOL_DEFINITIONS) {
      const desc = tool.function.description
      expect(desc).toMatch(/WHEN TO USE/i)
    }
  })

  it('required tools have proper required params', () => {
    const readFile = TOOL_DEFINITIONS.find((t) => t.function.name === 'read_file')!
    expect(readFile.function.parameters.required).toContain('path')

    const writeFile = TOOL_DEFINITIONS.find((t) => t.function.name === 'write_file')!
    expect(writeFile.function.parameters.required).toContain('path')
    expect(writeFile.function.parameters.required).toContain('content')

    const runCmd = TOOL_DEFINITIONS.find((t) => t.function.name === 'run_command')!
    expect(runCmd.function.parameters.required).toContain('command')

    const webSearch = TOOL_DEFINITIONS.find((t) => t.function.name === 'web_search')!
    expect(webSearch.function.parameters.required).toContain('query')
  })

  it('optional tools have no required params', () => {
    const listFiles = TOOL_DEFINITIONS.find((t) => t.function.name === 'list_files')!
    expect(listFiles.function.parameters.required).toEqual([])

    const build = TOOL_DEFINITIONS.find((t) => t.function.name === 'execute_build')!
    expect(build.function.parameters.required).toEqual([])
  })

  it('has exactly 12 tools', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(12)
  })
})

describe('executeTool', () => {
  beforeEach(() => {
    resetWorkspace()
  })

  it('list_files returns all workspace files', async () => {
    const result = await executeTool({
      id: '1',
      name: 'list_files',
      arguments: {},
    })
    expect(result.result).toContain('package.json')
    expect(result.result).toContain('src/App.tsx')
    expect(result.display).toContain('workspace files')
  })

  it('read_file returns file content', async () => {
    const result = await executeTool({
      id: '1',
      name: 'read_file',
      arguments: { path: 'package.json' },
    })
    expect(result.result).toContain('bloom-project')
    expect(result.display).toContain('Read')
  })

  it('read_file returns error for missing file', async () => {
    const result = await executeTool({
      id: '1',
      name: 'read_file',
      arguments: { path: 'nonexistent.ts' },
    })
    expect(result.result).toContain('Error')
    expect(result.display).toContain('❌')
  })

  it('write_file creates a new file', async () => {
    const result = await executeTool({
      id: '1',
      name: 'write_file',
      arguments: { path: 'src/New.tsx', content: 'export const x = 1' },
    })
    expect(result.result).toContain('successfully')
    expect(result.display).toContain('Created')
  })

  it('write_file modifies an existing file', async () => {
    const result = await executeTool({
      id: '1',
      name: 'write_file',
      arguments: { path: 'src/App.tsx', content: 'modified' },
    })
    expect(result.display).toContain('Modified')
  })

  it('edit_file succeeds with matching content', async () => {
    writeFile('src/test.ts', 'original line')
    const result = await executeTool({
      id: '1',
      name: 'edit_file',
      arguments: { path: 'src/test.ts', old_string: 'original', new_string: 'changed' },
    })
    expect(result.display).toContain('Edited')
  })

  it('edit_file fails with non-matching content', async () => {
    writeFile('src/test.ts', 'hello')
    const result = await executeTool({
      id: '1',
      name: 'edit_file',
      arguments: { path: 'src/test.ts', old_string: 'NOPE', new_string: 'x' },
    })
    expect(result.display).toContain('❌')
  })

  it('delete_file removes a file', async () => {
    writeFile('src/temp.ts', 'temp')
    const result = await executeTool({
      id: '1',
      name: 'delete_file',
      arguments: { path: 'src/temp.ts' },
    })
    expect(result.display).toContain('Deleted')
  })

  it('execute_build passes on scaffold', async () => {
    const result = await executeTool({
      id: '1',
      name: 'execute_build',
      arguments: {},
    })
    expect(result.display).toContain('✅')
  })

  it('get_errors returns no build data before build', async () => {
    const result = await executeTool({
      id: '1',
      name: 'get_errors',
      arguments: {},
    })
    expect(result.display).toContain('⚠️')
  })

  it('search_files finds matches', async () => {
    const result = await executeTool({
      id: '1',
      name: 'search_files',
      arguments: { pattern: 'export' },
    })
    expect(result.result).toContain('match')
  })

  it('search_files handles no matches', async () => {
    const result = await executeTool({
      id: '1',
      name: 'search_files',
      arguments: { pattern: 'ZZZZNONEXISTENTPATTERNZZZZ' },
    })
    expect(result.result).toContain('No matches found')
  })

  it('returns error for unknown tool', async () => {
    const result = await executeTool({
      id: '1',
      name: 'unknown_tool',
      arguments: {},
    })
    expect(result.result).toContain('Unknown tool')
    expect(result.display).toContain('❌')
  })
})

describe('parseToolCallsFromDelta', () => {
  it('parses tool calls from OpenAI delta', () => {
    const delta = {
      tool_calls: [
        {
          index: 0,
          id: 'call_123',
          function: {
            name: 'read_file',
            arguments: '{"path":"src/App.tsx"}',
          },
        },
      ],
    }
    const result = parseToolCallsFromDelta(delta as any)
    expect(result).toHaveLength(1)
    expect(result[0].index).toBe(0)
    expect(result[0].id).toBe('call_123')
    expect(result[0].name).toBe('read_file')
    expect(result[0].arguments).toBe('{"path":"src/App.tsx"}')
  })

  it('returns empty array when no tool_calls', () => {
    const result = parseToolCallsFromDelta({})
    expect(result).toEqual([])
  })

  it('returns empty array for undefined tool_calls', () => {
    const result = parseToolCallsFromDelta({ tool_calls: undefined } as any)
    expect(result).toEqual([])
  })

  it('handles multiple tool calls', () => {
    const delta = {
      tool_calls: [
        { index: 0, function: { name: 'read_file', arguments: '{}' } },
        { index: 1, function: { name: 'write_file', arguments: '{}' } },
      ],
    }
    const result = parseToolCallsFromDelta(delta as any)
    expect(result).toHaveLength(2)
  })
})
