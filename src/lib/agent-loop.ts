/**
 * Agent Loop — master orchestrator for the Plan → Act → Reflect cycle.
 * Equivalent to Claude Code's nO master loop.
 *
 * Flow:
 *   User prompt → build system prompt → streaming API call with tools →
 *   stream text tokens → accumulate tool calls → execute tools →
 *   feed results back → repeat until done or limit reached.
 */

import type { Message } from '../components/chat/ChatPanel'
import type { ProviderConfig } from './providers'
import { getAdapter } from './adapters'
import { buildSystemPrompt } from './system-prompt'
import {
  TOOL_DEFINITIONS,
  executeTool,
  type ToolCall,
  type ToolResult,
} from './agent-tools'
import { getWorkspace } from './workspace'

/* ── Event Types ──────────────────────────────────── */

export interface AgentStreamEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'error' | 'done'
  content?: string
  toolCall?: ToolCall
  toolResult?: ToolResult
}

/* ── Configuration ────────────────────────────────── */

const MAX_ITERATIONS = 15
const MAX_FIX_CYCLES = 3

/* ── Message Types ────────────────────────────────── */

interface LoopMessage {
  role: string
  content: string | null
  tool_calls?: unknown[]
  tool_call_id?: string
  name?: string
}

/* ── The Loop ─────────────────────────────────────── */

export async function* runAgentLoop(
  userMessage: string,
  provider: ProviderConfig,
  model: string,
  existingMessages: Message[] = []
): AsyncGenerator<AgentStreamEvent> {
  const adapter = getAdapter(provider.provider_key)
  const systemPrompt = buildSystemPrompt(getWorkspace().files)

  const messages: LoopMessage[] = [
    { role: 'system', content: systemPrompt },
    ...existingMessages.slice(-6).map((m) => ({
      role: m.role as string,
      content: m.text,
    })),
    { role: 'user', content: userMessage },
  ]

  let iterations = 0
  let fixCycles = 0
  let lastBuildFailed = false

  while (iterations < MAX_ITERATIONS) {
    iterations++

    // ── Streaming API call ────────────────────────
    const baseUrl = provider.base_url ?? 'https://api.openai.com/v1'
    const url = adapter.buildUrl(baseUrl, model)
    const headers = adapter.buildHeaders(provider.api_key)

    const payload = buildStreamingPayload(
      adapter.name,
      messages,
      model,
      lastBuildFailed ? 0.1 : 0.7
    )

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000),
        redirect: 'manual',
      })
    } catch (e) {
      yield { type: 'error', content: `Network error: ${(e as Error).message}` }
      return
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      yield {
        type: 'error',
        content: adapter.parseError(res.status, errBody),
      }
      return
    }

    // ── Read the streaming response ───────────────
    const { textContent, toolCalls } = await readStream(
      res,
      adapter.name,
    )

    // Yield accumulated text from this turn
    if (textContent) {
      yield { type: 'text', content: textContent }
    }

    // ── No tool calls → agent considers itself done ──
    if (!toolCalls || toolCalls.length === 0) {
      if (!lastBuildFailed) {
        // Auto-verify: trigger build
        const verifyCall: ToolCall = {
          id: `verify_${Date.now()}`,
          name: 'execute_build',
          arguments: {},
        }
        yield { type: 'tool_call', toolCall: verifyCall }
        const verifyResult = await executeTool(verifyCall)
        yield { type: 'tool_result', toolResult: verifyResult }

        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: verifyCall.id,
              type: 'function',
              function: {
                name: 'execute_build',
                arguments: JSON.stringify({}),
              },
            },
          ],
        })
        messages.push({
          role: 'tool',
          content: verifyResult.result,
          tool_call_id: verifyCall.id,
        })

        if (!verifyResult.display.includes('passed')) {
          lastBuildFailed = true
          fixCycles++
          if (fixCycles > MAX_FIX_CYCLES) {
            yield {
              type: 'error',
              content: `Build still failing after ${MAX_FIX_CYCLES} fix cycles. The errors are shown above — you may need to step in.`,
            }
            return
          }
          continue
        }
      }

      yield { type: 'done' }
      return
    }

    // ── Execute tool calls ─────────────────────────
    lastBuildFailed = false

    const assistantMsg: LoopMessage = {
      role: 'assistant',
      content: textContent || null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      })),
    }
    messages.push(assistantMsg)

    for (const tc of toolCalls) {
      yield { type: 'tool_call', toolCall: tc }
      const result = await executeTool(tc)
      yield { type: 'tool_result', toolResult: result }

      if (tc.name === 'execute_build') {
        lastBuildFailed = !result.display.includes('passed')
        if (lastBuildFailed) fixCycles++
        else fixCycles = 0
      }

      messages.push({
        role: 'tool',
        content: result.result,
        tool_call_id: tc.id,
      })
    }

    if (fixCycles > MAX_FIX_CYCLES) {
      yield {
        type: 'error',
        content: `Build still failing after ${MAX_FIX_CYCLES} fix cycles. Try again with more specific instructions.`,
      }
      return
    }
  }

  yield {
    type: 'error',
    content: `Reached maximum of ${MAX_ITERATIONS} tool iterations. Try breaking the task into smaller steps.`,
  }
}

/* ── Streaming Response Reader ────────────────────── */

/**
 * Read an SSE stream, accumulating text and tool calls.
 * Text is yielded as a single block since async generators can't yield from callbacks.
 * The caller yields the text as a single event, which gives progressive display
 * across multiple agent turns (each turn adds text between tool calls).
 */
async function readStream(
  res: Response,
  adapterName: string,
): Promise<{ textContent: string; toolCalls: ToolCall[] | null }> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let textContent = ''

  // Accumulate tool call chunks
  const toolCallAccum: Map<
    number,
    { id: string; name: string; arguments: string }
  > = new Map()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (adapterName === 'gemini') {
        if (!trimmed.startsWith('data: ')) continue
        try {
          const json = JSON.parse(trimmed.slice(6))
          // Gemini streaming — text in candidates[0].content.parts[0].text
          const candidates = json.candidates as
            | Array<{
                content?: { parts?: Array<{ text?: string }> }
              }>
            | undefined
          const token = candidates?.[0]?.content?.parts?.[0]?.text
          if (token) textContent += token
        } catch {
          /* skip malformed JSON */
        }
      } else if (adapterName === 'anthropic') {
        // Anthropic uses a different SSE format
        if (!trimmed.startsWith('data: ')) continue
        try {
          const json = JSON.parse(trimmed.slice(6))
          if (json.type === 'content_block_delta') {
            const text = (json.delta as { text?: string })?.text
            if (text) textContent += text
          }
          if (
            json.type === 'content_block_start' &&
            json.content_block?.type === 'tool_use'
          ) {
            const block = json.content_block as {
              id: string
              name: string
            }
            toolCallAccum.set(0, {
              id: block.id,
              name: block.name,
              arguments: '',
            })
          }
          if (json.type === 'content_block_delta' && json.delta?.type === 'input_json_delta') {
            const existing = toolCallAccum.get(0)
            if (existing) {
              existing.arguments +=
                (json.delta as { partial_json?: string }).partial_json ?? ''
            }
          }
        } catch {
          /* skip */
        }
      } else {
        // OpenAI-compatible streaming
        if (!trimmed.startsWith('data: ')) continue
        if (trimmed === 'data: [DONE]') continue
        try {
          const json = JSON.parse(trimmed.slice(6))
          const choices = json.choices as
            | Array<{ delta?: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> } }>
            | undefined
          if (!choices) continue

          const delta = choices[0]?.delta
          if (!delta) continue

          // Text token
          if (delta.content) {
            textContent += delta.content
          }

          // Tool call chunks
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const existing = toolCallAccum.get(tc.index) ?? {
                id: '',
                name: '',
                arguments: '',
              }
              if (tc.id) existing.id = tc.id
              if (tc.function?.name) existing.name = tc.function.name
              if (tc.function?.arguments)
                existing.arguments += tc.function.arguments
              toolCallAccum.set(tc.index, existing)
            }
          }
        } catch {
          /* skip malformed JSON */
        }
      }
    }
  }

  // Parse accumulated tool calls
  const toolCalls: ToolCall[] = []
  for (const [, acc] of toolCallAccum) {
    if (acc.name) {
      let args: Record<string, string> = {}
      try {
        args = JSON.parse(acc.arguments)
      } catch {
        args = {}
      }
      toolCalls.push({ id: acc.id, name: acc.name, arguments: args })
    }
  }

  return {
    textContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : null,
  }
}

/* ── Provider Payload Building ────────────────────── */

function buildStreamingPayload(
  adapterName: string,
  messages: LoopMessage[],
  model: string,
  temperature: number
): Record<string, unknown> {
  // Build clean messages
  const cleanMessages = messages.map((m) => {
    const msg: Record<string, unknown> = { role: m.role }
    if (m.content !== null && m.content !== undefined) msg.content = m.content
    if (m.tool_calls) msg.tool_calls = m.tool_calls
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
    if (m.name) msg.name = m.name
    return msg
  })

  if (adapterName === 'anthropic') {
    const systemMsg = cleanMessages.find((m) => m.role === 'system')
    const other = cleanMessages.filter((m) => m.role !== 'system')
    return {
      model,
      system: systemMsg?.content,
      messages: other.map((m) => ({
        role: m.role,
        content: m.content ? [{ type: 'text', text: m.content }] : m.content,
      })),
      max_tokens: 8192,
      stream: true,
      tools: TOOL_DEFINITIONS.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      })),
      tool_choice: { type: 'auto' },
    }
  }

  if (adapterName === 'gemini') {
    const systemMsg = cleanMessages.find((m) => m.role === 'system')
    const contents = cleanMessages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        let role: string
        if (m.role === 'assistant') role = 'model'
        else if (m.role === 'tool') role = 'tool'
        else role = 'user'
        return { role, parts: [{ text: m.content || '' }] }
      })
    return {
      contents,
      systemInstruction: systemMsg
        ? { parts: [{ text: systemMsg.content }] }
        : undefined,
      tools: TOOL_DEFINITIONS.map((t) => ({
        functionDeclarations: [
          {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        ],
      })),
      generationConfig: { maxOutputTokens: 8192, temperature },
    }
  }

  // Default: OpenAI-compatible with streaming
  return {
    model,
    messages: cleanMessages,
    max_tokens: 8192,
    temperature,
    stream: true,
    tools: TOOL_DEFINITIONS,
    tool_choice: 'auto',
  }
}
