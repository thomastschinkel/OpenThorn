/**
 * Bloom Subagent — read-only research/audit agent with isolated context.
 *
 * Subagents are spawned to research, audit, or analyze code without cluttering
 * the main agent's context. They have read-only tool access and return a
 * structured summary. This mirrors Claude Code's forked-context subagent pattern.
 *
 * ## Design
 *
 * - Read-only tools: think, list_files, read_file, search_files
 * - Max 8 turns (keeps costs bounded)
 * - Returns structured JSON findings
 * - Runs in the same provider/model as the parent agent
 */

import type { AgentCodeFile, AgentProgressEvent } from './agent'
import { SUBAGENT_SYSTEM_PROMPT } from './agent-prompt'
import type { ToolDefinition } from './agent-prompt'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SubagentResult {
  /** Natural-language findings with file paths and line numbers. */
  findings: string
  /** Actionable recommendations for the parent agent. */
  recommendations: string[]
  /** Files examined by the subagent. */
  filesExamined: string[]
  /** Number of turns the subagent took. */
  turns: number
  /** Raw response text (for debugging). */
  rawText: string
}

// ─── Read-only Tool Subset ─────────────────────────────────────────────────

const SUBAGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'think',
    description:
      'Think through your analysis approach. Use this to reason about findings before reporting.',
    input_schema: {
      type: 'object',
      properties: {
        thought: {
          type: 'string',
          description: 'Your reasoning about the analysis.',
        },
      },
      required: ['thought'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_files',
    description: 'List all files in the project.',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'read_file',
    description: 'Read the content of a file.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The file path to read.' },
        offset: {
          type: 'integer',
          description: 'Line number to start reading from (1-based).',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of lines to read (default: 300).',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_files',
    description:
      'Search across all project files using a regex pattern.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'The regex pattern to search for.' },
        glob: { type: 'string', description: 'Optional glob filter for files.' },
        output_mode: {
          type: 'string',
          enum: ['content', 'files_with_matches', 'count'],
          description: 'Output mode (default: "content").',
        },
        context_lines: {
          type: 'integer',
          description: 'Context lines around each match (default: 0).',
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
  },
  {
    name: 'report',
    description:
      'Submit your final analysis. Use this when you have thoroughly examined the relevant files and are ready to report.',
    input_schema: {
      type: 'object',
      properties: {
        findings: {
          type: 'string',
          description:
            'Detailed analysis. Cite specific file paths and line numbers.',
        },
        recommendations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Actionable recommendations from your analysis.',
        },
        filesExamined: {
          type: 'array',
          items: { type: 'string' },
          description: 'All files you examined.',
        },
      },
      required: ['findings'],
      additionalProperties: false,
    },
  },
]

// ─── Internal Types ─────────────────────────────────────────────────────────

interface LlmMessage {
  role: 'user' | 'assistant'
  content: string | LlmContentBlock[]
}

interface LlmContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
  is_error?: boolean
}

interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

interface SubagentRunInput {
  task: string
  context?: string
  files: AgentCodeFile[]
  providerId: string
  baseUrl: string
  apiKey: string
  modelId: string
  signal?: AbortSignal
  onProgress?: (event: AgentProgressEvent) => void
}

// ─── Subagent Entry Point ──────────────────────────────────────────────────

const MAX_SUBAGENT_TURNS = 8
const SUBAGENT_READ_LIMIT = 300

export async function runSubagent(
  input: SubagentRunInput,
): Promise<SubagentResult> {
  input.onProgress?.({
    type: 'status',
    message: `Dispatching read-only subagent to analyze: ${input.task.slice(0, 100)}`,
  })

  const userPrompt = buildSubagentPrompt(input.task, input.context, input.files)
  const messages: LlmMessage[] = [{ role: 'user', content: userPrompt }]
  let turnCount = 0

  while (turnCount < MAX_SUBAGENT_TURNS) {
    if (input.signal?.aborted) {
      throw new DOMException('Subagent cancelled.', 'AbortError')
    }
    turnCount++

    // Call model with read-only tools
    const { text, toolCalls } = await callModelForSubagent({
      providerId: input.providerId,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      modelId: input.modelId,
      messages,
      signal: input.signal,
    })

    // Build assistant message
    const assistantBlocks: LlmContentBlock[] = []
    if (text) {
      assistantBlocks.push({ type: 'text', text })
    }
    for (const tc of toolCalls) {
      assistantBlocks.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tc.input,
      })
    }

    if (assistantBlocks.length > 0) {
      messages.push({ role: 'assistant', content: assistantBlocks })
    } else if (!text && toolCalls.length === 0) {
      break
    }

    // Execute tools (read-only — no file modifications)
    for (const tc of toolCalls) {
      const result = executeSubagentTool(tc, input.files)

      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: tc.id,
            content: result.content,
            is_error: result.isError,
          },
        ],
      })

      // If report tool was called, parse and return
      if (tc.name === 'report') {
        const parsed = parseReportOutput(result.content, text, input.files)
        return { ...parsed, turns: turnCount, rawText: text }
      }
    }
  }

  // Max turns reached without report — synthesize from conversation
  return synthesizeResult(messages, input.files, turnCount)
}

// ─── Subagent Prompt Builder ────────────────────────────────────────────────

function buildSubagentPrompt(
  task: string,
  context: string | undefined,
  files: AgentCodeFile[],
): string {
  const fileList = files
    .map((f) => `  ${f.path} (${f.language}, ${f.code.split('\n').length} lines)`)
    .join('\n')

  let prompt = `Task: ${task}\n\n`
  prompt += `Project files (${files.length} total):\n${fileList}\n\n`

  if (context) {
    prompt += `Additional context: ${context}\n\n`
  }

  prompt +=
    'Examine the relevant files, search for patterns, and analyze thoroughly. ' +
    'Use search_files to find patterns across files. ' +
    'Use read_file to examine specific files in detail. ' +
    'When you are done, call the report tool with your findings.'
  return prompt
}

// ─── Subagent Tool Execution ────────────────────────────────────────────────

interface ToolResult {
  content: string
  isError: boolean
}

function executeSubagentTool(
  tc: ToolCall,
  currentFiles: AgentCodeFile[],
): ToolResult {
  switch (tc.name) {
    case 'think': {
      return { content: String(tc.input.thought ?? ''), isError: false }
    }

    case 'list_files': {
      if (currentFiles.length === 0) {
        return { content: 'No files in the project.', isError: false }
      }
      const listing = currentFiles
        .map(
          (f) =>
            `  ${f.path}  (${f.language}, ${f.code.split('\n').length} lines)`,
        )
        .join('\n')
      return {
        content: `${currentFiles.length} files:\n${listing}`,
        isError: false,
      }
    }

    case 'read_file': {
      const path = normalizePath(String(tc.input.path ?? ''))
      const offset = Math.max(1, Number(tc.input.offset) || 1)
      const limit = Math.min(
        SUBAGENT_READ_LIMIT,
        Number(tc.input.limit) || SUBAGENT_READ_LIMIT,
      )

      const file = currentFiles.find((f) => f.path === path)
      if (!file) {
        return {
          content: `File not found: ${path}. Use list_files to see available files.`,
          isError: true,
        }
      }

      const allLines = file.code.split('\n')
      const startIdx = offset - 1
      const endIdx = Math.min(startIdx + limit, allLines.length)
      const selected = allLines.slice(startIdx, endIdx)

      const numbered = selected
        .map(
          (line, i) =>
            `${String(startIdx + i + 1).padStart(4, ' ')}  ${line}`,
        )
        .join('\n')

      let result = `File: ${path} (${allLines.length} lines total)`
      if (startIdx > 0 || endIdx < allLines.length) {
        result += `, showing lines ${startIdx + 1}-${endIdx}`
      }
      if (startIdx > 0) {
        result += `\n[... ${startIdx} lines before ...]`
      }
      result += `\n${numbered}`
      if (endIdx < allLines.length) {
        result += `\n[... ${allLines.length - endIdx} lines after ...]`
      }
      return { content: result, isError: false }
    }

    case 'search_files': {
      const pattern = String(tc.input.pattern ?? '')
      const glob = tc.input.glob ? String(tc.input.glob) : undefined
      const outputMode = (tc.input.output_mode as string) || 'content'
      const contextLines = Math.max(0, Number(tc.input.context_lines) || 0)

      if (!pattern.trim()) {
        return {
          content: 'Search pattern must not be empty.',
          isError: true,
        }
      }

      let regex: RegExp
      try {
        regex = new RegExp(pattern, 'gi')
      } catch {
        return {
          content: `Invalid regex pattern: ${pattern}`,
          isError: true,
        }
      }

      const filesToSearch = glob
        ? currentFiles.filter((f) => matchesGlob(f.path, glob))
        : currentFiles

      if (filesToSearch.length === 0) {
        return {
          content: glob
            ? `No files matched the glob pattern "${glob}".`
            : 'No files in the project.',
          isError: false,
        }
      }

      const MAX_MATCHES = 30
      const results: string[] = []
      let totalMatches = 0

      for (const file of filesToSearch) {
        const fileLines = file.code.split('\n')
        const fileMatches: { lineNum: number; line: string }[] = []

        for (let i = 0; i < fileLines.length; i++) {
          if (regex.test(fileLines[i])) {
            fileMatches.push({ lineNum: i + 1, line: fileLines[i] })
            regex.lastIndex = 0
            totalMatches++
            if (totalMatches >= MAX_MATCHES) break
          }
        }

        if (fileMatches.length > 0 && outputMode !== 'count') {
          results.push(
            `── ${file.path} (${fileMatches.length} match(es)) ──`,
          )
          for (const match of fileMatches) {
            let lineStr = `  ${String(match.lineNum).padStart(4, ' ')}  ${match.line}`
            // Show context if requested
            if (contextLines > 0) {
              const ctxStart = Math.max(1, match.lineNum - contextLines)
              const ctxEnd = Math.min(
                fileLines.length,
                match.lineNum + contextLines,
              )
              if (ctxStart < match.lineNum) {
                lineStr = `  ${String(ctxStart).padStart(4, ' ')}  ${fileLines[ctxStart - 1]}\n${lineStr}`
              }
              if (ctxEnd > match.lineNum) {
                lineStr = `${lineStr}\n  ${String(ctxEnd).padStart(4, ' ')}  ${fileLines[ctxEnd - 1]}`
              }
            }
            results.push(lineStr)
          }
        }

        if (totalMatches >= MAX_MATCHES) break
      }

      if (outputMode === 'count') {
        const counts: string[] = []
        let total = 0
        for (const file of filesToSearch) {
          let c = 0
          for (const line of file.code.split('\n')) {
            const m = line.match(regex)
            if (m) c += m.length
          }
          if (c > 0) {
            counts.push(`  ${file.path}: ${c} match(es)`)
            total += c
          }
        }
        return {
          content:
            counts.length > 0
              ? `${total} total match(es) across ${counts.length} file(s):\n${counts.join('\n')}`
              : `No matches for "${pattern}".`,
          isError: false,
        }
      }

      if (outputMode === 'files_with_matches') {
        const matched: string[] = []
        for (const file of filesToSearch) {
          if (regex.test(file.code)) {
            matched.push(`  ${file.path}`)
            regex.lastIndex = 0
          }
        }
        return {
          content:
            matched.length > 0
              ? `${matched.length} file(s) matched:\n${matched.join('\n')}`
              : `No files matched "${pattern}".`,
          isError: false,
        }
      }

      if (results.length === 0) {
        return {
          content: `No matches for "${pattern}" in ${filesToSearch.length} file(s).`,
          isError: false,
        }
      }

      let header = `Found ${totalMatches} match(es) for "${pattern}"`
      if (totalMatches >= MAX_MATCHES)
        header += ` (truncated at ${MAX_MATCHES})`
      return { content: `${header}:\n\n${results.join('\n')}`, isError: false }
    }

    case 'report': {
      return {
        content: JSON.stringify({
          findings: tc.input.findings ?? '',
          recommendations: tc.input.recommendations ?? [],
          filesExamined: tc.input.filesExamined ?? [],
        }),
        isError: false,
      }
    }

    default:
      return {
        content: `Unknown tool: ${tc.name}. Available tools: think, list_files, read_file, search_files, report.`,
        isError: true,
      }
  }
}

// ─── Report Parsing ─────────────────────────────────────────────────────────

function parseReportOutput(
  reportContent: string,
  fallbackText: string,
  files: AgentCodeFile[],
): Omit<SubagentResult, 'turns' | 'rawText'> {
  // Try JSON parse first
  try {
    const parsed = JSON.parse(reportContent)
    return {
      findings: String(parsed.findings ?? ''),
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.filter((r: unknown) => typeof r === 'string')
        : [],
      filesExamined: Array.isArray(parsed.filesExamined)
        ? parsed.filesExamined.filter((f: unknown) => typeof f === 'string')
        : [],
    }
  } catch {
    // Fallback: extract from text
  }

  // Try extracting JSON from markdown code blocks
  const jsonMatch = reportContent.match(/```json\s*([\s\S]*?)```/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      return {
        findings: String(parsed.findings ?? ''),
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.filter(
              (r: unknown) => typeof r === 'string',
            )
          : [],
        filesExamined: Array.isArray(parsed.filesExamined)
          ? parsed.filesExamined.filter(
              (f: unknown) => typeof f === 'string',
            )
          : [],
      }
    } catch {
      // Continue to text fallback
    }
  }

  // Text fallback: use the raw report content as findings
  return {
    findings: reportContent || fallbackText,
    recommendations: [],
    filesExamined: files.map((f) => f.path),
  }
}

function synthesizeResult(
  messages: LlmMessage[],
  files: AgentCodeFile[],
  turns: number,
): SubagentResult {
  // Extract the last assistant message text as findings
  let lastText = ''
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        lastText = msg.content
      } else {
        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            lastText += block.text + '\n'
          }
        }
      }
      if (lastText.trim()) break
    }
  }

  return {
    findings: lastText.trim() || 'Subagent completed without explicit findings.',
    recommendations: [],
    filesExamined: files.map((f) => f.path),
    turns,
    rawText: lastText,
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^\/+/, '')
}

function matchesGlob(filePath: string, globPattern: string): boolean {
  let regexStr = '^'
  let i = 0
  while (i < globPattern.length) {
    if (globPattern[i] === '*' && globPattern[i + 1] === '*') {
      regexStr += '.*'
      i += 2
    } else if (globPattern[i] === '*') {
      regexStr += '[^/]*'
      i += 1
    } else if (globPattern[i] === '?') {
      regexStr += '[^/]'
      i += 1
    } else {
      const ch = globPattern[i]
      if ('.+^${}()|[]\\'.includes(ch)) {
        regexStr += '\\' + ch
      } else {
        regexStr += ch
      }
      i += 1
    }
  }
  regexStr += '$'
  try {
    return new RegExp(regexStr).test(filePath)
  } catch {
    return false
  }
}

// ─── Model Calling (simplified for subagent — OpenAI-compatible only) ──────

async function callModelForSubagent({
  providerId,
  baseUrl,
  apiKey,
  modelId,
  messages,
  signal,
}: {
  providerId: string
  baseUrl: string
  apiKey: string
  modelId: string
  messages: LlmMessage[]
  signal?: AbortSignal
}): Promise<{ text: string; toolCalls: ToolCall[] }> {
  // Reuse the same pattern as the main agent but simplified for subagent use
  const url = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl}/chat/completions`

  const openaiMessages = [
    { role: 'system', content: SUBAGENT_SYSTEM_PROMPT },
    ...messages.flatMap(convertToOpenAIMessages),
  ]

  const openaiTools = SUBAGENT_TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }))

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45_000)
  const combinedSignal = signal
    ? anyAbort(signal, controller.signal)
    : controller.signal
  void providerId

  try {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: openaiMessages,
        temperature: 0.22,
        max_tokens: 4096,
        tools: openaiTools,
        stream: false, // Non-streaming for subagent (simpler, cheaper)
      }),
      signal: combinedSignal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `Subagent model error ${response.status}: ${errorText.slice(0, 200)}`,
      )
    }

    const payload = await response.json()
    const choice = payload?.choices?.[0]
    const message = choice?.message
    if (!message) {
      return { text: '', toolCalls: [] }
    }

    const text = typeof message.content === 'string' ? message.content : ''
    const toolCalls: ToolCall[] = []

    if (Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        if (tc.type === 'function' && tc.function) {
          try {
            toolCalls.push({
              id: tc.id || `call_${toolCalls.length}`,
              name: tc.function.name,
              input:
                typeof tc.function.arguments === 'string'
                  ? JSON.parse(tc.function.arguments)
                  : (tc.function.arguments ?? {}),
            })
          } catch {
            // Skip invalid
          }
        }
      }
    }

    return { text, toolCalls }
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

// ─── OpenAI Message Conversion (simplified for subagent) ────────────────────

function convertToOpenAIMessages(
  msg: LlmMessage,
): Record<string, unknown>[] {
  if (typeof msg.content === 'string') {
    return [{ role: msg.role, content: msg.content }]
  }

  // Tool results → separate role:"tool" messages
  const toolResults = msg.content.filter((b) => b.type === 'tool_result')
  if (toolResults.length > 0 && msg.role === 'user') {
    return toolResults.map((tr) => ({
      role: 'tool',
      tool_call_id: tr.tool_use_id,
      content: tr.content ?? '',
    }))
  }

  // Assistant with tool calls
  const openaiContent: Record<string, unknown>[] = []
  const toolCalls: Record<string, unknown>[] = []

  for (const block of msg.content) {
    if (block.type === 'text' && block.text) {
      openaiContent.push({ type: 'text', text: block.text })
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        },
      })
    }
  }

  if (toolCalls.length > 0 && msg.role === 'assistant') {
    return [
      {
        role: 'assistant',
        content: openaiContent.length > 0 ? openaiContent : null,
        tool_calls: toolCalls,
      },
    ]
  }

  return [
    {
      role: msg.role,
      content: msg.content
        .map((b) => b.content ?? b.text ?? '')
        .join('\n'),
    },
  ]
}

function anyAbort(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  a.addEventListener('abort', onAbort, { once: true })
  b.addEventListener('abort', onAbort, { once: true })
  if (a.aborted || b.aborted) controller.abort()
  return controller.signal
}
