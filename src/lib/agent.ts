import {
  AGENT_SYSTEM_PROMPT,
  AGENT_TOOLS,
  TOOL_CATEGORIES,
  COMPACTION_PROMPT,
  SPEC_PHASE_PROMPT,
  VERIFY_PHASE_PROMPT,
  RALPH_PROMPT,
  resolveActiveSkills,
  getThinkingBudget,
  type ToolDefinition,
} from './agent-prompt'
import { buildPreview } from './preview-bundle'
import { supabase } from './supabase'
import { runSubagent } from './subagent'
import type { SubagentResult } from './subagent'
import {
  type LessonEntry,
  type ChangelogEntry,
  formatLessons,
  parseLessons,
  addLesson,
  lessonsToSystemReminder,
  formatChangelog,
  parseChangelog,
  changelogToSystemReminder,
  createChangelogEntry,
  generateSessionId,
} from './agent-memory'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentCodeFile {
  path: string
  language: string
  code: string
}

export interface SelectedAgentModel {
  provider_id: string
  provider_name: string
  model_name: string
  model_id: string
}

export interface AgentProgressEvent {
  type:
    | 'text'
    | 'tool_start'
    | 'tool_result'
    | 'files'
    | 'done'
    | 'status'
    | 'compaction'
    | 'subagent'
  text?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: string
  toolError?: boolean
  files?: AgentCodeFile[]
  message?: string
  subagentResult?: SubagentResult
}

export interface AgentRunInput {
  userId: string
  prompt: string
  title: string
  files: AgentCodeFile[]
  selectedModel?: SelectedAgentModel | null
  mode?: 'create' | 'refine'
  maxTurns?: number
  signal?: AbortSignal
  onProgress?: (event: AgentProgressEvent) => void
}

export interface AgentRunResult {
  files: AgentCodeFile[]
  turns: number
  providerName: string
  modelName: string
}

// ─── Internal Types ─────────────────────────────────────────────────────────

interface ProviderKeyRow {
  id: string
  provider_id: string
  provider_name: string
  api_key: string
  base_url: string | null
  models: string | null
  enabled: boolean
  is_custom: boolean | null
}

interface ModelInfo {
  name: string
  id: string
}

interface ResolvedProvider {
  key: ProviderKeyRow
  baseUrl: string
  model: ModelInfo
}

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

interface StructuredError {
  code: string
  message: string
  suggestion: string
  retryable: boolean
  similarPaths?: string[]
}

interface ToolResult {
  content: string
  isError: boolean
  files?: AgentCodeFile[]
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  mistral: 'https://api.mistral.ai/v1',
  groq: 'https://api.groq.com/openai/v1',
  together: 'https://api.together.xyz/v1',
}

const ALLOWED_PROVIDER_HOSTS = new Set([
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.deepseek.com',
  'api.mistral.ai',
  'api.groq.com',
  'api.together.xyz',
  'openrouter.ai',
  'api.openrouter.ai',
  'api.x.ai',
  'api.together.ai',
  'api.perplexity.ai',
  'api.fireworks.ai',
  'api.cerebras.ai',
  'api.github.com',
  'models.github.com',
  'integrate.api.nvidia.com',
])

const MAX_OUTPUT_TOKENS = 8192
const MAX_TOOL_TURNS = 20

// ─── Compaction Settings ────────────────────────────────────────────────────

const COMPACTION_THRESHOLD = 5
const KEEP_RECENT_TURNS = 3
const SUMMARY_INTERVAL = 6
const READ_TRUNCATE_LINES = 500
const OBSERVATION_TOOLS = new Set([
  'list_files',
  'read_file',
  'search_files',
  'compile',
])

// ─── Result Truncation Limits ──────────────────────────────────────────────

/** Max lines to show from list_files result. */
const LIST_FILES_MAX = 40
/** Max matches to show from search_files (content mode). */
const SEARCH_MAX_MATCHES = 30
/** Max errors to show from compile. */
const COMPILE_MAX_ERRORS = 8

// ─── Circuit Breaker Settings ──────────────────────────────────────────────

/** Consecutive failures before the circuit opens. */
const CB_FAILURE_THRESHOLD = 3
/** How long the circuit stays open (ms). */
const CB_COOLDOWN_MS = 30_000
/** Base delay for exponential backoff (ms). */
const BACKOFF_BASE_MS = 1000
/** Maximum backoff delay (ms). */
const BACKOFF_MAX_MS = 30_000

// ─── Anthropic Settings ─────────────────────────────────────────────────────

const ANTHROPIC_THINKING_BUDGET = 4000

// ─── Circuit Breaker ────────────────────────────────────────────────────────

class CircuitBreaker {
  private state = new Map<
    string,
    { failures: number; lastFail: number; openUntil: number }
  >()

  /** Check if the circuit is open (requests should be blocked). */
  isOpen(providerId: string): boolean {
    const entry = this.state.get(providerId)
    if (!entry) return false
    if (entry.openUntil > Date.now()) return true
    // Cooldown expired — allow a trial request (half-open state)
    if (entry.failures >= CB_FAILURE_THRESHOLD) {
      this.state.delete(providerId)
    }
    return false
  }

  /** Record a successful request — reset the circuit. */
  recordSuccess(providerId: string): void {
    this.state.delete(providerId)
  }

  /** Record a failure. Opens the circuit if threshold is reached. */
  recordFailure(providerId: string): void {
    const entry = this.state.get(providerId) || {
      failures: 0,
      lastFail: 0,
      openUntil: 0,
    }
    entry.failures++
    entry.lastFail = Date.now()

    if (entry.failures >= CB_FAILURE_THRESHOLD) {
      entry.openUntil = Date.now() + CB_COOLDOWN_MS
    }

    this.state.set(providerId, entry)
  }

  /** Get a human-readable status for debugging. */
  getStatus(providerId: string): string {
    const entry = this.state.get(providerId)
    if (!entry) return 'healthy'
    if (entry.openUntil > Date.now()) return 'open'
    return entry.failures > 0 ? 'degraded' : 'healthy'
  }
}

// Global circuit breaker instance (lives for the session)
const circuitBreaker = new CircuitBreaker()

// ─── Exponential Backoff ────────────────────────────────────────────────────

/**
 * Compute delay with exponential backoff and jitter.
 * Formula: min(max, base * 2^attempt) ± jitter
 */
function backoffDelay(attempt: number): number {
  const exponential = BACKOFF_BASE_MS * Math.pow(2, attempt)
  const capped = Math.min(exponential, BACKOFF_MAX_MS)
  // Jitter: ±20%
  const jitter = capped * 0.2 * (Math.random() * 2 - 1)
  return Math.round(capped + jitter)
}

/** Sleep for a given duration in ms. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('The agent run was cancelled.', 'AbortError')
  }
}

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^\/+/, '')
}

function normalizeLanguage(language: string, path: string): string {
  const lower = language.toLowerCase().trim()
  if (['tsx', 'ts', 'jsx', 'js', 'css', 'json'].includes(lower)) return lower
  if (path.endsWith('.tsx')) return 'tsx'
  if (path.endsWith('.ts')) return 'ts'
  if (path.endsWith('.jsx')) return 'jsx'
  if (path.endsWith('.js')) return 'js'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.json')) return 'json'
  return 'tsx'
}

function normalizeFiles(files: AgentCodeFile[]): AgentCodeFile[] {
  const byPath = new Map<string, AgentCodeFile>()
  for (const file of files) {
    const path = normalizePath(file.path)
    if (!path) continue
    const language = normalizeLanguage(file.language, path)
    byPath.set(path, { path, language, code: file.code.replace(/\r\n/g, '\n') })
  }
  return [...byPath.values()].sort((a, b) => {
    if (a.path === 'src/App.tsx') return -1
    if (b.path === 'src/App.tsx') return 1
    if (a.path === 'src/styles/theme.css') return 1
    if (b.path === 'src/styles/theme.css') return -1
    return a.path.localeCompare(b.path)
  })
}

function upsertFile(files: AgentCodeFile[], file: AgentCodeFile): AgentCodeFile[] {
  const normalized = normalizeFiles([file])[0]
  if (!normalized) return files
  const existing = files.findIndex((f) => f.path === normalized.path)
  if (existing >= 0) {
    const updated = [...files]
    updated[existing] = normalized
    return updated
  }
  return [...files, normalized]
}

// ─── Levenshtein Distance ──────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    const tmp = prev; prev = curr; curr = tmp
  }
  return prev[n]
}

function findSimilarFiles(targetPath: string, files: AgentCodeFile[], maxDistance = 3): string[] {
  return files
    .map((f) => ({ path: f.path, dist: levenshtein(targetPath, f.path) }))
    .filter((e) => e.dist > 0 && e.dist <= maxDistance)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((e) => e.path)
}

// ─── Glob Matching ──────────────────────────────────────────────────────────

function matchesGlob(filePath: string, globPattern: string): boolean {
  let regexStr = '^'
  let i = 0
  while (i < globPattern.length) {
    if (globPattern[i] === '*' && globPattern[i + 1] === '*') {
      regexStr += '.*'; i += 2
    } else if (globPattern[i] === '*') {
      regexStr += '[^/]*'; i += 1
    } else if (globPattern[i] === '?') {
      regexStr += '[^/]'; i += 1
    } else {
      const ch = globPattern[i]
      if ('.+^${}()|[]\\'.includes(ch)) { regexStr += '\\' + ch } else { regexStr += ch }
      i += 1
    }
  }
  regexStr += '$'
  try { return new RegExp(regexStr).test(filePath) } catch { return false }
}

// ─── Structured Error Formatting ────────────────────────────────────────────

function formatStructuredError(err: StructuredError): string {
  const parts: string[] = [`Error [${err.code}]: ${err.message}`]
  if (err.suggestion) parts.push(`Suggestion: ${err.suggestion}`)
  if (err.similarPaths && err.similarPaths.length > 0) {
    parts.push(`Similar files: ${err.similarPaths.join(', ')}`)
  }
  return parts.join('\n')
}

// ─── Context Compaction ─────────────────────────────────────────────────────

function compactMessages(
  messages: LlmMessage[],
  turnCount: number,
  _currentFiles: AgentCodeFile[],
): { messages: LlmMessage[]; compacted: boolean } {
  if (turnCount <= COMPACTION_THRESHOLD) {
    return { messages, compacted: false }
  }

  const assistantIndices: number[] = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'assistant') assistantIndices.push(i)
  }

  const totalTurns = assistantIndices.length
  if (totalTurns <= KEEP_RECENT_TURNS + 1) {
    return { messages, compacted: false }
  }

  const compactUpTo = totalTurns - KEEP_RECENT_TURNS
  let compacted = false

  for (let t = 0; t < compactUpTo; t++) {
    const asstIdx = assistantIndices[t]
    const toolResultIdx = asstIdx + 1

    if (
      toolResultIdx < messages.length &&
      messages[toolResultIdx].role === 'user' &&
      Array.isArray(messages[toolResultIdx].content)
    ) {
      const blocks = messages[toolResultIdx].content as LlmContentBlock[]
      const newBlocks = blocks.map((block) => {
        if (block.type !== 'tool_result') return block
        let toolName = ''
        if (Array.isArray(messages[asstIdx].content)) {
          const matching = (messages[asstIdx].content as LlmContentBlock[]).find(
            (b) => b.type === 'tool_use' && b.id === block.tool_use_id,
          )
          if (matching) toolName = matching.name ?? ''
        }
        if (OBSERVATION_TOOLS.has(toolName)) {
          compacted = true
          return {
            ...block,
            content: '[tool output truncated — current file state is tracked in the workspace]',
          }
        }
        return block
      })
      messages[toolResultIdx] = { role: 'user', content: newBlocks }
    }
  }

  return { messages, compacted }
}

function generateProgressSummary(
  messages: LlmMessage[],
  currentFiles: AgentCodeFile[],
  turnCount: number,
): string {
  const fileCreations: string[] = []
  const fileEdits: string[] = []

  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_use') {
          if (block.name === 'write_file' && block.input?.path) {
            fileCreations.push(String(block.input.path))
          } else if (block.name === 'edit_file' && block.input?.path) {
            fileEdits.push(String(block.input.path))
          }
        }
      }
    }
  }

  const dedupe = (arr: string[]) => [...new Set(arr)]
  const parts: string[] = [
    COMPACTION_PROMPT,
    '',
    '## Progress Summary',
    `- **Turns executed:** ${turnCount}`,
    `- **Files in project:** ${currentFiles.length}`,
  ]

  const created = dedupe(fileCreations)
  if (created.length > 0) parts.push(`- **Files created:** ${created.join(', ')}`)
  const edited = dedupe(fileEdits)
  if (edited.length > 0) parts.push(`- **Files edited:** ${edited.join(', ')}`)

  parts.push('', 'Continue from where you left off. Current file state is accurate.')
  return parts.join('\n')
}

// ─── Main Agent Loop ────────────────────────────────────────────────────────

export async function runBloomAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const sessionId = generateSessionId()

  // ── Resolve provider with fallback ────────────────────────────
  const provider = await resolveProviderWithFallback(
    input.userId,
    input.selectedModel ?? null,
  )
  const providerName =
    provider.key.provider_name ||
    input.selectedModel?.provider_name ||
    provider.key.provider_id
  const modelName =
    input.selectedModel?.model_name || provider.model.name || provider.model.id

  input.onProgress?.({
    type: 'status',
    message: `Connected to ${providerName} / ${modelName}`,
  })

  // ── Load memory (lessons + changelog) ─────────────────────────
  const memoryContext = await loadMemoryContext(input.userId, input.files)
  if (memoryContext) {
    input.onProgress?.({ type: 'status', message: 'Loaded agent memory.' })
  }

  // ── Resolve active skills from prompt ────────────────────────
  const activeSkills = resolveActiveSkills(input.prompt)
  if (activeSkills.length > 0) {
    input.onProgress?.({
      type: 'status',
      message: `Activated skills: ${activeSkills.length}`,
    })
  }

  const isNewProject =
    input.files.length === 0 || input.files[0].path === 'No files yet'
  const mode = input.mode ?? 'create'

  // ── Build initial messages ────────────────────────────────────
  const messages: LlmMessage[] = []

  // Inject skill blocks (preserves cache)
  for (const skillBody of activeSkills) {
    messages.push({ role: 'user', content: skillBody })
  }

  // Inject memory context (lessons + failed approaches)
  if (memoryContext) {
    messages.push({ role: 'user', content: memoryContext })
  }

  // SPEC PHASE: for new projects, inject spec guidance
  if (isNewProject || mode === 'create') {
    messages.push({ role: 'user', content: SPEC_PHASE_PROMPT })
  }

  // Main user prompt
  messages.push({
    role: 'user',
    content: buildUserPrompt(
      input.prompt,
      input.title,
      input.files,
      mode,
      isNewProject,
    ),
  })

  let currentFiles = normalizeFiles(input.files)
  let turnCount = 0
  let lastSummaryTurn = 0
  let ralphCheckCount = 0
  const MAX_RALPH_CHECKS = 2

  // Track session details for changelog
  const sessionFilesCreated: string[] = []
  const sessionFilesEdited: string[] = []

  // Tool execution loop
  while (turnCount < (input.maxTurns ?? MAX_TOOL_TURNS)) {
    throwIfAborted(input.signal)
    turnCount++

    // ── Compaction ──────────────────────────────────────────────
    const compactResult = compactMessages(messages, turnCount, currentFiles)
    if (compactResult.compacted) {
      if (turnCount - lastSummaryTurn >= SUMMARY_INTERVAL) {
        const summary = generateProgressSummary(messages, currentFiles, turnCount)
        messages.push({ role: 'user', content: summary })
        lastSummaryTurn = turnCount
      }
      input.onProgress?.({ type: 'compaction', message: 'Context compacted to save tokens.' })
    }

    // ── Adaptive thinking budget ────────────────────────────────
    const thinkingBudget = getThinkingBudget({ mode, turnCount })

    // ── Call the model ──────────────────────────────────────────
    const { text, toolCalls } = await callModelWithTools({
      providerId: provider.key.provider_id,
      baseUrl: provider.baseUrl,
      apiKey: provider.key.api_key,
      modelId: provider.model.id,
      system: AGENT_SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
      messages,
      signal: input.signal,
      onText: (chunk) => {
        input.onProgress?.({ type: 'text', text: chunk })
      },
      thinkingBudget,
    })

    // ── Build assistant message ─────────────────────────────────
    const assistantBlocks: LlmContentBlock[] = []
    if (text) assistantBlocks.push({ type: 'text', text })
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

    // ── Execute tools with parallelism ──────────────────────────
    const toolResults = await executeToolsParallel(
      toolCalls,
      currentFiles,
      input.signal,
      input.onProgress,
      provider,
    )

    // Track file operations for changelog
    for (const tc of toolCalls) {
      if (tc.name === 'write_file' && tc.input?.path) {
        const path = String(tc.input.path)
        if (!sessionFilesCreated.includes(path)) sessionFilesCreated.push(path)
      }
      if (tc.name === 'edit_file' && tc.input?.path) {
        const path = String(tc.input.path)
        if (!sessionFilesEdited.includes(path)) sessionFilesEdited.push(path)
      }
    }

    // ── Push tool results ───────────────────────────────────────
    let hasDone = false
    let doneResult: ToolResult | null = null
    for (let i = 0; i < toolResults.length; i++) {
      const tc = toolCalls[i]
      const result = toolResults[i]
      if (result.files) currentFiles = result.files

      // ── Ralph Loop: intercept done calls ─────────────────────
      if (tc.name === 'done') {
        if (ralphCheckCount < MAX_RALPH_CHECKS) {
          // Run self-verification subagent
          const verified = await runRalphCheck(
            tc, result, input, currentFiles, provider, messages,
          )

          if (!verified.passed) {
            // Verification failed — inject feedback and continue
            ralphCheckCount++
            input.onProgress?.({
              type: 'status',
              message: `Ralph check ${ralphCheckCount}/${MAX_RALPH_CHECKS}: ${verified.feedback.slice(0, 120)}`,
            })

            // Push the done tool result as error (so the agent knows done was rejected)
            messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: tc.id,
                  content: RALPH_PROMPT + '\n\n' + verified.feedback,
                  is_error: true,
                },
              ],
            })

            // Inject verify phase prompt if this is the second check
            if (ralphCheckCount >= MAX_RALPH_CHECKS - 1) {
              messages.push({ role: 'user', content: VERIFY_PHASE_PROMPT })
            }

            // Skip done handling — loop continues
            continue
          } else {
            // Verification passed
            hasDone = true
            doneResult = result
          }
        } else {
          // Max ralph checks reached — accept done
          hasDone = true
          doneResult = result
        }
      }

      // Push normal tool result
      if (!hasDone || tc.name !== 'done') {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: tc.id,
              content: tc.name === 'done' && hasDone ? result.content : result.content,
              is_error: result.isError,
            },
          ],
        })
      }
    }

    if (hasDone && doneResult) {
      // Push the final done result
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolCalls.find((tc) => tc.name === 'done')?.id ?? 'done',
            content: doneResult.content,
            is_error: false,
          },
        ],
      })

      // ── Write changelog entry ──────────────────────────────────
      await saveSessionChangelog(input.userId, input.files, {
        sessionId,
        prompt: input.prompt,
        filesCreated: sessionFilesCreated,
        filesEdited: sessionFilesEdited,
        approaches: [],
        lessons: [],
      })

      // Record success on the circuit breaker
      circuitBreaker.recordSuccess(provider.key.provider_id)
      input.onProgress?.({ type: 'done', files: currentFiles })
      return { files: currentFiles, turns: turnCount, providerName, modelName }
    }
  }

  // ── Max turns reached — write changelog anyway ─────────────────
  await saveSessionChangelog(input.userId, input.files, {
    sessionId,
    prompt: input.prompt,
    filesCreated: sessionFilesCreated,
    filesEdited: sessionFilesEdited,
    approaches: [],
    lessons: [],
  })

  circuitBreaker.recordSuccess(provider.key.provider_id)
  input.onProgress?.({ type: 'done', files: currentFiles })
  return { files: currentFiles, turns: turnCount, providerName, modelName }
}

// ─── Ralph Check (Self-Verification) ────────────────────────────────────────

interface RalphCheckResult {
  passed: boolean
  feedback: string
}

async function runRalphCheck(
  _toolCall: ToolCall,
  _result: ToolResult,
  input: AgentRunInput,
  currentFiles: AgentCodeFile[],
  provider: ResolvedProvider,
  _messages: LlmMessage[],
): Promise<RalphCheckResult> {
  input.onProgress?.({ type: 'status', message: 'Running self-verification...' })

  try {
    const subResult = await runSubagent({
      task: `Verify that the project satisfies ALL of the user's requirements. Be critical — catch every missing feature, bug, or oversight.`,
      context: `Original user request: "${input.prompt}"\n\nProject title: ${input.title}\n\nCheck EVERY requirement:\n1. Are all requested features implemented?\n2. Is the design responsive (390px, 768px, 1200px+)?\n3. Is HTML semantic with proper landmarks?\n4. Are there any visible focus states?\n5. Do all interactive elements work?\n6. Are all internal links valid (no dead links)?\n7. Did compile pass with zero errors?\n8. Is the color system consistent?\n9. Are there any TODOs or placeholders?`,
      files: currentFiles,
      providerId: provider.key.provider_id,
      baseUrl: provider.baseUrl,
      apiKey: provider.key.api_key,
      modelId: provider.model.id,
      signal: input.signal,
      onProgress: input.onProgress,
    })

    // If the subagent found issues, report them
    const hasIssues = subResult.recommendations.length > 0 ||
      subResult.findings.toLowerCase().includes('missing') ||
      subResult.findings.toLowerCase().includes('issue') ||
      subResult.findings.toLowerCase().includes('should') ||
      subResult.findings.toLowerCase().includes('not implemented')

    if (hasIssues) {
      const issues = subResult.recommendations.length > 0
        ? subResult.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')
        : subResult.findings

      return {
        passed: false,
        feedback: `## Verification Failed\n\nThe project does NOT fully satisfy the requirements:\n\n${issues}\n\nFix these issues and try calling done again.`,
      }
    }

    return {
      passed: true,
      feedback: 'All requirements satisfied.',
    }
  } catch {
    // If the subagent fails, let the main agent proceed
    return { passed: true, feedback: 'Verification skipped (subagent failed).' }
  }
}

// ─── Memory Management ──────────────────────────────────────────────────────

/**
 * Load lessons and changelog from the virtual project files.
 * Returns a combined <system-reminder> string or empty string.
 */
async function loadMemoryContext(
  userId: string,
  files: AgentCodeFile[],
): Promise<string> {
  const parts: string[] = []

  // Load lessons
  const lessonsFile = files.find((f) => f.path === 'src/lib/lessons.md')
  if (lessonsFile) {
    const entries = parseLessons(lessonsFile.code)
    const reminder = lessonsToSystemReminder(entries)
    if (reminder) parts.push(reminder)
  }

  // Load changelog (failed approaches only)
  const changelogFile = files.find((f) => f.path === 'src/lib/CHANGELOG.md')
  if (changelogFile) {
    const entries = parseChangelog(changelogFile.code)
    const reminder = changelogToSystemReminder(entries)
    if (reminder) parts.push(reminder)
  }

  void userId // Keep for future use (per-user memory storage)

  return parts.join('\n\n')
}

/**
 * Save a session changelog entry to the virtual project.
 */
async function saveSessionChangelog(
  _userId: string,
  files: AgentCodeFile[],
  params: {
    sessionId: string
    prompt: string
    filesCreated: string[]
    filesEdited: string[]
    approaches: ChangelogEntry['approaches']
    lessons: string[]
  },
): Promise<void> {
  // Load existing changelog
  const changelogFile = files.find((f) => f.path === 'src/lib/CHANGELOG.md')
  const existing = changelogFile
    ? parseChangelog(changelogFile.code)
    : []

  const entry = createChangelogEntry(params)
  existing.push(entry)

  // Keep only last 20 entries to prevent bloat
  const trimmed = existing.slice(-20)
  const formatted = formatChangelog(trimmed)

  // Update or create the changelog file
  if (changelogFile) {
    changelogFile.code = formatted
  } else {
    files.push({
      path: 'src/lib/CHANGELOG.md',
      language: 'md',
      code: formatted,
    })
  }
}

// ─── Public Memory API (called from UI after user corrections) ──────────────

/**
 * Record a lesson learned. Call this after the user corrects the agent.
 */
export function recordLesson(
  files: AgentCodeFile[],
  type: LessonEntry['type'],
  content: string,
): AgentCodeFile[] {
  const lessonsFile = files.find((f) => f.path === 'src/lib/lessons.md')
  const existing = lessonsFile ? parseLessons(lessonsFile.code) : []
  const updated = addLesson(existing, type, content)
  const formatted = formatLessons(updated)

  if (lessonsFile) {
    return files.map((f) =>
      f.path === 'src/lib/lessons.md' ? { ...f, code: formatted } : f,
    )
  }

  return [
    ...files,
    { path: 'src/lib/lessons.md', language: 'md', code: formatted },
  ]
}

// ─── Parallel Tool Execution ────────────────────────────────────────────────

async function executeToolsParallel(
  toolCalls: ToolCall[],
  currentFiles: AgentCodeFile[],
  signal: AbortSignal | undefined,
  onProgress: ((event: AgentProgressEvent) => void) | undefined,
  provider: ResolvedProvider,
): Promise<ToolResult[]> {
  if (toolCalls.length === 0) return []

  const reads: { index: number; call: ToolCall }[] = []
  const writes: { index: number; call: ToolCall }[] = []
  const subagents: { index: number; call: ToolCall }[] = []
  let compileCall: { index: number; call: ToolCall } | null = null
  let doneCall: { index: number; call: ToolCall } | null = null

  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i]
    const category = TOOL_CATEGORIES[tc.name] ?? 'read'
    switch (category) {
      case 'read': reads.push({ index: i, call: tc }); break
      case 'write': writes.push({ index: i, call: tc }); break
      case 'subagent': subagents.push({ index: i, call: tc }); break
      case 'compile': compileCall = { index: i, call: tc }; break
      case 'done': doneCall = { index: i, call: tc }; break
    }
  }

  const results: (ToolResult | null)[] = new Array(toolCalls.length).fill(null)

  // Phase 1: Execute reads + subagents in parallel
  const parallelTasks = [...reads, ...subagents]
  if (parallelTasks.length > 0) {
    const parallelResults = await Promise.all(
      parallelTasks.map(({ index, call }) => {
        onProgress?.({ type: 'tool_start', toolName: call.name, toolInput: call.input })
        return executeTool(call, currentFiles, signal, provider, onProgress).then((result) => {
          onProgress?.({ type: 'tool_result', toolName: call.name, toolResult: result.content, toolError: result.isError, files: result.files })
          return { index, result }
        })
      }),
    )
    for (const { index, result } of parallelResults) {
      results[index] = result
      if (result.files) currentFiles = result.files
    }
  }

  // Phase 2: Writes sequentially
  for (const { index, call } of writes) {
    onProgress?.({ type: 'tool_start', toolName: call.name, toolInput: call.input })
    const result = await executeTool(call, currentFiles, signal, provider, onProgress)
    onProgress?.({ type: 'tool_result', toolName: call.name, toolResult: result.content, toolError: result.isError, files: result.files })
    results[index] = result
    if (result.files) currentFiles = result.files
  }

  // Phase 3: Compile
  if (compileCall) {
    const { index, call } = compileCall
    onProgress?.({ type: 'tool_start', toolName: call.name, toolInput: call.input })
    const result = await executeTool(call, currentFiles, signal, provider, onProgress)
    onProgress?.({ type: 'tool_result', toolName: call.name, toolResult: result.content, toolError: result.isError, files: result.files })
    results[index] = result
    if (result.files) currentFiles = result.files
  }

  // Phase 4: Done
  if (doneCall) {
    const { index, call } = doneCall
    onProgress?.({ type: 'tool_start', toolName: call.name, toolInput: call.input })
    const result = await executeTool(call, currentFiles, signal, provider, onProgress)
    onProgress?.({ type: 'tool_result', toolName: call.name, toolResult: result.content, toolError: result.isError, files: result.files })
    results[index] = result
    if (result.files) currentFiles = result.files
  }

  return results.filter((r): r is ToolResult => r !== null)
}

// ─── Tool Execution ─────────────────────────────────────────────────────────

async function executeTool(
  toolCall: ToolCall,
  currentFiles: AgentCodeFile[],
  signal: AbortSignal | undefined,
  provider: ResolvedProvider,
  onProgress?: (event: AgentProgressEvent) => void,
): Promise<ToolResult> {
  throwIfAborted(signal)

  switch (toolCall.name) {
    // ── think ──────────────────────────────────────────────────
    case 'think': {
      return { content: String(toolCall.input.thought ?? ''), isError: false }
    }

    // ── list_files ──────────────────────────────────────────────
    case 'list_files': {
      if (currentFiles.length === 0) {
        return { content: 'No files in the project yet.', isError: false }
      }
      const sorted = [...currentFiles].sort((a, b) => a.path.localeCompare(b.path))
      const truncated = sorted.length > LIST_FILES_MAX
      const shown = truncated ? sorted.slice(0, LIST_FILES_MAX) : sorted
      const listing = shown
        .map((f) => `  ${f.path}  (${f.language}, ${f.code.split('\n').length} lines)`)
        .join('\n')
      return {
        content: `${currentFiles.length} files${truncated ? ` (showing first ${LIST_FILES_MAX})` : ''}:\n${listing}${truncated ? `\n... and ${currentFiles.length - LIST_FILES_MAX} more. Use search_files or read specific paths.` : ''}`,
        isError: false,
      }
    }

    // ── read_file ───────────────────────────────────────────────
    case 'read_file': {
      const path = normalizePath(String(toolCall.input.path ?? ''))
      const offset = Math.max(1, Number(toolCall.input.offset) || 1)
      const limit = Number(toolCall.input.limit) || READ_TRUNCATE_LINES
      const file = currentFiles.find((f) => f.path === path)
      if (!file) {
        const similar = findSimilarFiles(path, currentFiles)
        return {
          content: formatStructuredError({
            code: 'FILE_NOT_FOUND',
            message: `File not found: ${path}`,
            suggestion: 'Use list_files to see all project files. Check the path spelling.',
            retryable: true,
            similarPaths: similar.length > 0 ? similar : undefined,
          }),
          isError: true,
        }
      }
      const allLines = file.code.split('\n')
      const startIdx = offset - 1
      const endIdx = Math.min(startIdx + limit, allLines.length)
      const selected = allLines.slice(startIdx, endIdx)
      const numbered = selected
        .map((line, i) => `${String(startIdx + i + 1).padStart(4, ' ')}  ${line}`)
        .join('\n')

      let result = `File: ${path} (${allLines.length} lines total)`
      if (startIdx > 0 || endIdx < allLines.length) {
        result += `, showing lines ${startIdx + 1}-${endIdx}`
      }
      if (startIdx > 0) result += `\n[... ${startIdx} lines before ...]`
      result += `\n${numbered}`
      if (endIdx < allLines.length) {
        result += `\n[... ${allLines.length - endIdx} lines after ...]`
        result += `\n[Tip: Use offset=${endIdx + 1} to read the next ${limit} lines]`
      }
      return { content: result, isError: false }
    }

    // ── search_files ────────────────────────────────────────────
    case 'search_files': {
      const pattern = String(toolCall.input.pattern ?? '')
      const glob = toolCall.input.glob ? String(toolCall.input.glob) : undefined
      const outputMode = (toolCall.input.output_mode as string) || 'content'
      const contextLines = Math.max(0, Number(toolCall.input.context_lines) || 0)

      if (!pattern.trim()) {
        return {
          content: formatStructuredError({
            code: 'INVALID_PATTERN',
            message: 'Search pattern must not be empty.',
            suggestion: 'Provide a regex pattern to search for, e.g. "import.*from"',
            retryable: true,
          }),
          isError: true,
        }
      }

      let regex: RegExp
      try { regex = new RegExp(pattern, 'gi') } catch {
        return {
          content: formatStructuredError({
            code: 'INVALID_REGEX',
            message: `Invalid regex pattern: ${pattern}`,
            suggestion: 'Check your regex syntax. Escape special characters like ( [ { . * + ? ^ $ | \\\\.',
            retryable: true,
          }),
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

      // Count mode
      if (outputMode === 'count') {
        const counts: string[] = []
        let totalMatches = 0
        for (const file of filesToSearch) {
          let matchCount = 0
          for (const line of file.code.split('\n')) {
            const matches = line.match(regex)
            if (matches) matchCount += matches.length
          }
          if (matchCount > 0) {
            counts.push(`  ${file.path}: ${matchCount} match(es)`)
            totalMatches += matchCount
          }
        }
        return {
          content: counts.length > 0
            ? `${totalMatches} total match(es) across ${counts.length} file(s):\n${counts.join('\n')}`
            : `No matches for "${pattern}" in ${filesToSearch.length} file(s).`,
          isError: false,
        }
      }

      // Files-with-matches mode
      if (outputMode === 'files_with_matches') {
        const matched: string[] = []
        for (const file of filesToSearch) {
          if (regex.test(file.code)) {
            matched.push(`  ${file.path}`)
            regex.lastIndex = 0
          }
        }
        return {
          content: matched.length > 0
            ? `${matched.length} file(s) matched:\n${matched.join('\n')}`
            : `No files matched "${pattern}" in ${filesToSearch.length} file(s).`,
          isError: false,
        }
      }

      // Content mode with truncation
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
            if (totalMatches >= SEARCH_MAX_MATCHES) break
          }
        }

        if (fileMatches.length > 0) {
          results.push(`── ${file.path} (${fileMatches.length} match(es)) ──`)
          const shownContext = new Set<number>()

          for (const match of fileMatches) {
            const ctxStart = Math.max(1, match.lineNum - contextLines)
            const ctxEnd = Math.min(fileLines.length, match.lineNum + contextLines)

            if (contextLines > 0 && ctxStart < match.lineNum) {
              for (let cl = ctxStart; cl < match.lineNum; cl++) {
                if (!shownContext.has(cl)) {
                  results.push(`  ${String(cl).padStart(4, ' ')}  ${fileLines[cl - 1]}`)
                  shownContext.add(cl)
                }
              }
            }

            results.push(` ▶${String(match.lineNum).padStart(4, ' ')}  ${match.line}`)
            shownContext.add(match.lineNum)

            if (contextLines > 0 && ctxEnd > match.lineNum) {
              for (let cl = match.lineNum + 1; cl <= ctxEnd; cl++) {
                if (!shownContext.has(cl)) {
                  results.push(`  ${String(cl).padStart(4, ' ')}  ${fileLines[cl - 1]}`)
                  shownContext.add(cl)
                }
              }
            }
          }
        }

        if (totalMatches >= SEARCH_MAX_MATCHES) break
      }

      if (results.length === 0) {
        return {
          content: `No matches for "${pattern}" in ${filesToSearch.length} file(s).`,
          isError: false,
        }
      }

      let header = `Found ${totalMatches} match(es) for "${pattern}"`
      if (totalMatches >= SEARCH_MAX_MATCHES)
        header += ` (truncated at ${SEARCH_MAX_MATCHES} — narrow your pattern or use glob to filter)`
      return { content: `${header}:\n\n${results.join('\n')}`, isError: false }
    }

    // ── write_file ──────────────────────────────────────────────
    case 'write_file': {
      const path = normalizePath(String(toolCall.input.path ?? ''))
      const language = String(toolCall.input.language ?? 'tsx')
      const code = String(toolCall.input.code ?? '')

      if (!code.trim()) {
        return {
          content: formatStructuredError({
            code: 'EMPTY_FILE', message: 'File code must not be empty.',
            suggestion: 'Provide complete, valid code for the file. Use edit_file for small changes.',
            retryable: true,
          }), isError: true,
        }
      }
      if (!path.startsWith('src/')) {
        return {
          content: formatStructuredError({
            code: 'INVALID_PATH', message: `File path must be under src/. Got: ${path}`,
            suggestion: 'All project files must be under the src/ directory.',
            retryable: true,
          }), isError: true,
        }
      }
      if (path.includes('..')) {
        return {
          content: formatStructuredError({
            code: 'PATH_TRAVERSAL', message: `Path traversal not allowed: ${path}`,
            suggestion: 'Use a path under src/ without .. segments.',
            retryable: false,
          }), isError: true,
        }
      }

      const isNew = !currentFiles.some((f) => f.path === path)
      const newFiles = upsertFile(currentFiles, { path, language, code })
      return {
        content: `${isNew ? 'Created' : 'Overwrote'} ${path} (${code.split('\n').length} lines, ${code.length} chars).`,
        isError: false,
        files: newFiles,
      }
    }

    // ── edit_file ───────────────────────────────────────────────
    case 'edit_file': {
      const path = normalizePath(String(toolCall.input.path ?? ''))
      const oldStr = String(toolCall.input.old_string ?? '')
      const newStr = String(toolCall.input.new_string ?? '')
      const file = currentFiles.find((f) => f.path === path)

      if (!file) {
        const similar = findSimilarFiles(path, currentFiles)
        return {
          content: formatStructuredError({
            code: 'FILE_NOT_FOUND', message: `File not found: ${path}`,
            suggestion: 'Use list_files to see what exists. Check the path spelling.',
            retryable: true,
            similarPaths: similar.length > 0 ? similar : undefined,
          }), isError: true,
        }
      }
      if (!oldStr) {
        return {
          content: formatStructuredError({
            code: 'EMPTY_OLD_STRING', message: 'old_string must not be empty.',
            suggestion: 'Provide the exact text to replace, including indentation. Copy it directly from the file.',
            retryable: true,
          }), isError: true,
        }
      }
      if (oldStr === newStr) {
        return {
          content: formatStructuredError({
            code: 'IDENTICAL_STRINGS', message: 'old_string and new_string are identical.',
            suggestion: 'The replacement text must differ from the original.',
            retryable: true,
          }), isError: true,
        }
      }

      const count = file.code.split(oldStr).length - 1
      if (count === 0) {
        const firstLines = file.code.split('\n').slice(0, 5).join('\n')
        return {
          content: formatStructuredError({
            code: 'STRING_NOT_FOUND',
            message: `old_string not found in ${path}. Must match exactly including indentation.`,
            suggestion: `Read the file first. It starts with:\n${firstLines}\n\nCopy the exact indentation (tabs/spaces).`,
            retryable: true,
          }), isError: true,
        }
      }
      if (count > 1) {
        return {
          content: formatStructuredError({
            code: 'MULTIPLE_MATCHES',
            message: `old_string appears ${count} times in ${path}. It must be unique.`,
            suggestion: 'Include more surrounding context lines to make it unique.',
            retryable: true,
          }), isError: true,
        }
      }

      const newCode = file.code.replace(oldStr, newStr)
      const newFiles = currentFiles.map((f) =>
        f.path === path ? { ...f, code: newCode } : f,
      )
      return {
        content: `Edited ${path}: replaced ${oldStr.length} chars with ${newStr.length} chars.\nPreview: ${newStr.slice(0, 200)}${newStr.length > 200 ? '...' : ''}`,
        isError: false,
        files: newFiles,
      }
    }

    // ── compile ─────────────────────────────────────────────────
    case 'compile': {
      if (currentFiles.length === 0) {
        return { content: 'No files to compile. Create some files first.', isError: false }
      }

      try {
        const preview = await buildPreview(
          currentFiles.map((f) => ({ path: f.path, content: f.code })),
        )
        if (preview.errors.length === 0) {
          return { content: 'Compilation successful. No errors.', isError: false }
        }

        const uniqueErrors = [...new Set(preview.errors)]
        const shown = uniqueErrors.slice(0, COMPILE_MAX_ERRORS)
        const truncated =
          uniqueErrors.length > COMPILE_MAX_ERRORS
            ? `\n  ... and ${uniqueErrors.length - COMPILE_MAX_ERRORS} more error(s). Fix the first ones first.`
            : ''

        return {
          content: `Compilation failed: ${uniqueErrors.length} error(s).\n${shown.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}${truncated}\n\nRead the affected files and fix each error with edit_file. Recompile after fixing.`,
          isError: true,
        }
      } catch (err) {
        return {
          content: formatStructuredError({
            code: 'COMPILE_CRASH',
            message: err instanceof Error ? err.message : String(err),
            suggestion: 'This might be a config issue or syntax error. Check recent changes.',
            retryable: true,
          }), isError: true,
        }
      }
    }

    // ── spawn_subagent ──────────────────────────────────────────
    case 'spawn_subagent': {
      const task = String(toolCall.input.task ?? '')
      const context = toolCall.input.context
        ? String(toolCall.input.context)
        : undefined

      if (!task.trim()) {
        return {
          content: formatStructuredError({
            code: 'EMPTY_TASK',
            message: 'Subagent task must not be empty.',
            suggestion: 'Provide a specific task like "Audit all components for accessibility issues" or "Find unused CSS variables".',
            retryable: true,
          }), isError: true,
        }
      }

      onProgress?.({ type: 'status', message: `Subagent analyzing: ${task.slice(0, 100)}` })

      try {
        const result = await runSubagent({
          task,
          context,
          files: currentFiles,
          providerId: provider.key.provider_id,
          baseUrl: provider.baseUrl,
          apiKey: provider.key.api_key,
          modelId: provider.model.id,
          signal,
          onProgress,
        })

        onProgress?.({ type: 'subagent', subagentResult: result })

        // Format subagent results for the main agent
        // Note: first ~120 chars appear as the tool detail in the UI timeline,
        // so front-load the key takeaway.
        const filesList = result.filesExamined.join(', ') || 'none'
        const summary = result.findings.split('\n')[0]?.slice(0, 100) || 'Analysis complete.'

        const output = [
          `### Subagent: ${task.slice(0, 80)}${task.length > 80 ? '…' : ''}`,
          ``,
          `> ${summary}`,
          ``,
          `**Files examined:** ${filesList}  •  **Turns:** ${result.turns}`,
          ``,
          `#### Full Analysis`,
          result.findings,
        ]

        if (result.recommendations.length > 0) {
          output.push(
            ``,
            `#### Actionable Recommendations`,
            ...result.recommendations.map((r, i) => `  ${i + 1}. ${r}`),
          )
        }

        return { content: output.join('\n'), isError: false }
      } catch (err) {
        return {
          content: formatStructuredError({
            code: 'SUBAGENT_FAILED',
            message: err instanceof Error ? err.message : String(err),
            suggestion: 'Try a more focused task description, or handle the research yourself.',
            retryable: true,
          }), isError: true,
        }
      }
    }

    // ── done ────────────────────────────────────────────────────
    case 'done': {
      const summary = String(toolCall.input.summary ?? 'Project complete.')
      const nextSuggestions = Array.isArray(toolCall.input.nextSuggestions)
        ? toolCall.input.nextSuggestions.filter((s: unknown) => typeof s === 'string')
        : []
      return {
        content: JSON.stringify({ summary, nextSuggestions }),
        isError: false,
        files: currentFiles,
      }
    }

    default:
      return {
        content: formatStructuredError({
          code: 'UNKNOWN_TOOL',
          message: `Unknown tool: ${toolCall.name}`,
          suggestion: `Available tools: ${AGENT_TOOLS.map((t) => t.name).join(', ')}`,
          retryable: false,
        }), isError: true,
      }
  }
}

// ─── Model Calling ──────────────────────────────────────────────────────────

interface ModelCallResult {
  text: string
  toolCalls: ToolCall[]
}

async function callModelWithTools({
  providerId, baseUrl, apiKey, modelId, system, tools, messages, signal, onText, thinkingBudget,
}: {
  providerId: string; baseUrl: string; apiKey: string; modelId: string
  system: string; tools: ToolDefinition[]; messages: LlmMessage[]
  signal?: AbortSignal; onText: (chunk: string) => void
  thinkingBudget?: number
}): Promise<ModelCallResult> {
  if (providerId === 'anthropic') {
    return callAnthropicWithTools({ baseUrl, apiKey, modelId, system, tools, messages, signal, onText, thinkingBudget })
  }
  if (providerId === 'google') {
    return callGeminiWithTools({ baseUrl, apiKey, modelId, system, tools, messages, signal, onText })
  }
  return callOpenAIWithTools({ baseUrl, apiKey, modelId, system, tools, messages, signal, onText })
}

// ─── OpenAI-compatible ──────────────────────────────────────────────────────

function toolsToOpenAIFormat(tools: ToolDefinition[]) {
  return tools.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.input_schema } }))
}

function toolsToAnthropicFormat(tools: ToolDefinition[]) {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }))
}

async function callOpenAIWithTools({
  baseUrl, apiKey, modelId, system, tools, messages, signal, onText,
}: {
  baseUrl: string; apiKey: string; modelId: string; system: string
  tools: ToolDefinition[]; messages: LlmMessage[]
  signal?: AbortSignal; onText: (chunk: string) => void
}): Promise<ModelCallResult> {
  const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`

  const openaiMessages = [
    { role: 'system', content: system },
    ...messages.flatMap(convertToOpenAIMessages),
  ]
  const openaiTools = toolsToOpenAIFormat(tools)

  const attempts: Array<Record<string, unknown>> = [
    { tools: openaiTools, stream: true },
    { tools: openaiTools, stream: true, tool_choice: 'auto' },
    { tools: openaiTools, stream: false },
    { stream: true },
  ]

  let lastError = ''

  for (let attemptIdx = 0; attemptIdx < attempts.length; attemptIdx++) {
    const attempt = attempts[attemptIdx]
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60_000)
      const combinedSignal = signal ? anyAbort(signal, controller.signal) : controller.signal

      const response = await fetch(url, {
        method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelId, messages: openaiMessages,
          temperature: 0.22, max_tokens: MAX_OUTPUT_TOKENS, ...attempt,
        }),
        signal: combinedSignal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        let errorPayload: unknown = ''
        try { errorPayload = JSON.parse(errorText) } catch { errorPayload = errorText }
        lastError = `${response.status}: ${typeof errorPayload === 'string' ? errorPayload.slice(0, 300) : JSON.stringify(errorPayload).slice(0, 300)}`

        if (response.status === 401 || response.status === 403) break
        if (response.status === 429) {
          await sleep(backoffDelay(attemptIdx))
        }
        if (response.status !== 400 && response.status !== 422) break
        continue
      }

      const result = attempt.stream === true
        ? await parseOpenAIToolStream(response, onText)
        : await parseOpenAINonStream(response, onText)
      if (result) return result
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  throw new Error(lastError || 'Provider request failed.')
}

function anyAbort(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  a.addEventListener('abort', onAbort, { once: true })
  b.addEventListener('abort', onAbort, { once: true })
  if (a.aborted || b.aborted) controller.abort()
  return controller.signal
}

async function parseOpenAINonStream(response: Response, onText: (chunk: string) => void): Promise<ModelCallResult | null> {
  const payload = await response.json().catch(() => null)
  if (!payload) return null
  const choice = payload?.choices?.[0]
  const message = choice?.message
  if (!message) return null
  const text = typeof message.content === 'string' ? message.content : ''
  if (text) onText(text)
  const toolCalls: ToolCall[] = []
  if (Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      if (tc.type === 'function' && tc.function) {
        try {
          toolCalls.push({
            id: tc.id || `call_${toolCalls.length}`,
            name: tc.function.name,
            input: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : (tc.function.arguments ?? {}),
          })
        } catch { /* skip invalid */ }
      }
    }
  }
  return { text, toolCalls }
}

async function parseOpenAIToolStream(response: Response, onText: (chunk: string) => void): Promise<ModelCallResult | null> {
  const reader = response.body?.getReader()
  if (!reader) return null
  const decoder = new TextDecoder()
  let buffer = '', fullText = ''
  const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const delta = parsed?.choices?.[0]?.delta
          if (delta?.content) { fullText += delta.content; onText(delta.content) }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!toolCalls.has(idx)) toolCalls.set(idx, { id: tc.id ?? `call_${idx}`, name: tc.function?.name ?? '', arguments: '' })
              const existing = toolCalls.get(idx)!
              if (tc.id) existing.id = tc.id
              if (tc.function?.name) existing.name = tc.function.name
              if (tc.function?.arguments) existing.arguments += tc.function.arguments
            }
          }
        } catch { /* skip */ }
      }
    }
  } finally { reader.releaseLock() }

  const parsedToolCalls: ToolCall[] = []
  for (const tc of toolCalls.values()) {
    if (tc.name) {
      try { parsedToolCalls.push({ id: tc.id, name: tc.name, input: JSON.parse(tc.arguments || '{}') }) } catch { /* skip */ }
    }
  }
  return { text: fullText, toolCalls: parsedToolCalls }
}

// ─── Anthropic (with caching + thinking) ────────────────────────────────────

async function callAnthropicWithTools({
  baseUrl, apiKey, modelId, system, tools, messages, signal, onText, thinkingBudget,
}: {
  baseUrl: string; apiKey: string; modelId: string; system: string
  tools: ToolDefinition[]; messages: LlmMessage[]
  signal?: AbortSignal; onText: (chunk: string) => void
  thinkingBudget?: number
}): Promise<ModelCallResult> {
  const anthropicMessages = messages.map(convertToAnthropicMessage)

  const body: Record<string, unknown> = {
    model: modelId, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.22,
    tools: toolsToAnthropicFormat(tools), messages: anthropicMessages, stream: true,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
  }

  const budget = thinkingBudget ?? ANTHROPIC_THINKING_BUDGET
  if (budget > 0) {
    body.thinking = { type: 'enabled', budget_tokens: budget }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120_000)
  const combinedSignal = signal ? anyAbort(signal, controller.signal) : controller.signal

  try {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST', redirect: 'manual',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body), signal: combinedSignal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      let ep: unknown = ''
      try { ep = JSON.parse(errorText) } catch { ep = errorText }
      throw new Error(`Anthropic ${response.status}: ${typeof ep === 'string' ? ep.slice(0, 400) : JSON.stringify(ep).slice(0, 400)}`)
    }

    return parseAnthropicToolStream(response, onText)
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

async function parseAnthropicToolStream(response: Response, onText: (chunk: string) => void): Promise<ModelCallResult> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body not readable')
  const decoder = new TextDecoder()
  let buffer = '', fullText = ''
  const toolCalls: Map<number, { id: string; name: string; input: string }> = new Map()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        try {
          const parsed = JSON.parse(trimmed.slice(5).trim())
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            fullText += parsed.delta.text; onText(parsed.delta.text)
          }
          if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
            toolCalls.set(parsed.index, { id: parsed.content_block.id, name: parsed.content_block.name, input: '' })
          }
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
            const existing = toolCalls.get(parsed.index)
            if (existing) existing.input += parsed.delta.partial_json
          }
        } catch { /* skip */ }
      }
    }
  } finally { reader.releaseLock() }

  const parsedToolCalls: ToolCall[] = []
  for (const tc of toolCalls.values()) {
    try { parsedToolCalls.push({ id: tc.id, name: tc.name, input: tc.input ? JSON.parse(tc.input) : {} }) } catch { /* skip */ }
  }
  return { text: fullText, toolCalls: parsedToolCalls }
}

// ─── Gemini ─────────────────────────────────────────────────────────────────

async function callGeminiWithTools({
  baseUrl, apiKey, modelId, system, tools, messages, signal, onText,
}: {
  baseUrl: string; apiKey: string; modelId: string; system: string
  tools: ToolDefinition[]; messages: LlmMessage[]
  signal?: AbortSignal; onText: (chunk: string) => void
}): Promise<ModelCallResult> {
  const cleanModel = modelId.replace(/^models\//, '')
  const url = `${baseUrl}/models/${encodeURIComponent(cleanModel)}:streamGenerateContent?alt=sse`

  const functionDeclarations = tools.map((t) => ({ name: t.name, description: t.description, parameters: t.input_schema }))
  const systemParts = system ? [{ text: system }] : []

  const contents = messages.map((msg) => {
    const role = msg.role === 'assistant' ? 'model' : 'user'
    if (typeof msg.content === 'string') return { role, parts: [{ text: msg.content }] }
    const parts: Array<Record<string, unknown>> = []
    for (const block of msg.content) {
      if (block.type === 'text' && block.text) {
        parts.push({ text: block.text })
      } else if (block.type === 'tool_use') {
        parts.push({ functionCall: { name: block.name, args: block.input ?? {} } })
      } else if (block.type === 'tool_result') {
        const toolUseBlock = findMatchingToolUse(messages, block.tool_use_id)
        parts.push({
          functionResponse: {
            name: toolUseBlock?.name ?? 'unknown',
            response: { content: block.content, is_error: block.is_error },
          },
        })
      }
    }
    return { role, parts: parts.length > 0 ? parts : [{ text: '' }] }
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60_000)
  const combinedSignal = signal ? anyAbort(signal, controller.signal) : controller.signal

  try {
    const response = await fetch(url, {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: systemParts.length > 0 ? { parts: systemParts } : undefined,
        contents,
        tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
        generationConfig: { temperature: 0.22, maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
      signal: combinedSignal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Gemini ${response.status}: ${errorText.slice(0, 400)}`)
    }

    return parseGeminiToolStream(response, onText)
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

async function parseGeminiToolStream(response: Response, onText: (chunk: string) => void): Promise<ModelCallResult> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body not readable')
  const decoder = new TextDecoder()
  let buffer = '', fullText = ''
  const toolCalls: ToolCall[] = []
  let toolIdCounter = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        try {
          const parsed = JSON.parse(trimmed.slice(5).trim())
          const parts = parsed?.candidates?.[0]?.content?.parts
          if (parts) {
            for (const part of parts) {
              if (part.text) { fullText += part.text; onText(part.text) }
              if (part.functionCall) {
                toolIdCounter++
                toolCalls.push({ id: `call_${toolIdCounter}`, name: part.functionCall.name, input: part.functionCall.args ?? {} })
              }
            }
          }
        } catch { /* skip */ }
      }
    }
  } finally { reader.releaseLock() }

  return { text: fullText, toolCalls }
}

// ─── Message Conversion ─────────────────────────────────────────────────────

function convertToOpenAIMessages(msg: LlmMessage): Record<string, unknown>[] {
  if (typeof msg.content === 'string') {
    return [{ role: msg.role, content: msg.content }]
  }

  const toolResults = msg.content.filter((b) => b.type === 'tool_result')
  if (toolResults.length > 0 && msg.role === 'user') {
    return toolResults.map((tr) => ({
      role: 'tool',
      tool_call_id: tr.tool_use_id,
      content: tr.content ?? '',
    }))
  }

  const openaiContent: Record<string, unknown>[] = []
  const toolCalls: Record<string, unknown>[] = []

  for (const block of msg.content) {
    if (block.type === 'text' && block.text) {
      openaiContent.push({ type: 'text', text: block.text })
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id, type: 'function',
        function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
      })
    }
  }

  if (toolCalls.length > 0 && msg.role === 'assistant') {
    return [{ role: 'assistant', content: openaiContent.length > 0 ? openaiContent : null, tool_calls: toolCalls }]
  }
  if (msg.role === 'assistant' && openaiContent.length > 0) {
    return [{ role: 'assistant', content: openaiContent }]
  }
  return [{ role: msg.role, content: msg.content.map((b) => b.content ?? b.text ?? '').join('\n') }]
}

function convertToAnthropicMessage(msg: LlmMessage): Record<string, unknown> {
  if (typeof msg.content === 'string') return { role: msg.role, content: msg.content }
  const content: Record<string, unknown>[] = []
  for (const block of msg.content) {
    if (block.type === 'text' && block.text) content.push({ type: 'text', text: block.text })
    else if (block.type === 'tool_use') content.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input ?? {} })
    else if (block.type === 'tool_result') content.push({ type: 'tool_result', tool_use_id: block.tool_use_id, content: block.content, is_error: block.is_error })
  }
  return { role: msg.role, content }
}

function findMatchingToolUse(messages: LlmMessage[], toolUseId: string | undefined): LlmContentBlock | null {
  if (!toolUseId) return null
  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_use' && block.id === toolUseId) return block
      }
    }
  }
  return null
}

// ─── User Prompt Builder ────────────────────────────────────────────────────

function buildUserPrompt(
  prompt: string, title: string, files: AgentCodeFile[],
  mode: 'create' | 'refine', isNew: boolean,
): string {
  if (isNew || mode === 'create') {
    return `Create a website for: ${prompt}\n\nProject title: ${title}\n\nThis is a new project. Start by thinking about the design, then create files one at a time. Begin with the theme.css, then App.tsx, then components. Compile after every few files to catch errors early.`
  }
  const fileList = files
    .filter((f) => f.path !== 'No files yet')
    .map((f) => `- ${f.path} (${f.language}, ${f.code.split('\n').length} lines)`)
    .join('\n')
  return `Update the existing project based on this request: ${prompt}\n\nProject title: ${title}\n\nCurrent files:\n${fileList || '(none)'}\n\nRead files before editing them. Use search_files to find patterns across files. Make minimal, focused changes. Compile after edits to verify.`
}

// ─── Provider Resolution with Fallback ──────────────────────────────────────

function parseModels(raw: string | null | undefined): ModelInfo[] {
  return (raw ?? '')
    .split(',')
    .map((item) => {
      const [name, id] = item.split('|').map((p) => p.trim())
      return { name: name || id || '', id: id || name || '' }
    })
    .filter((m) => m.id.length > 0)
}

function validateProviderUrl(raw: string): string {
  const clean = raw.replace(/\/+$/, '')
  let hostname: string
  try { hostname = new URL(clean).hostname.toLowerCase() } catch {
    throw new Error(`Invalid base URL: ${clean.slice(0, 100)}`)
  }
  if (!ALLOWED_PROVIDER_HOSTS.has(hostname)) {
    throw new Error(
      `Provider URL host "${hostname}" is not in the allowed list. ` +
      `Use one of: ${[...ALLOWED_PROVIDER_HOSTS].sort().join(', ')}`,
    )
  }
  return clean
}

function mergeModels(defaults: ModelInfo[], custom: ModelInfo[]): ModelInfo[] {
  const seen = new Set<string>()
  const merged: ModelInfo[] = []
  for (const model of [...defaults, ...custom]) {
    if (seen.has(model.id)) continue
    seen.add(model.id)
    merged.push(model)
  }
  return merged
}

function getRecordString(value: unknown, key: string): string {
  const record = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const result = record[key]
  return typeof result === 'string' ? result : ''
}

/**
 * Resolve a provider with fallback support.
 *
 * 1. Try the selected model's provider first.
 * 2. If it fails (circuit open, auth error, etc.), try other enabled providers.
 * 3. Uses circuit breaker to skip degraded providers.
 */
async function resolveProviderWithFallback(
  userId: string,
  selectedModel: SelectedAgentModel | null,
): Promise<ResolvedProvider> {
  // Load all enabled provider keys
  const { data: allKeys, error } = await supabase
    .from('provider_keys')
    .select('id, provider_id, provider_name, api_key, base_url, models, enabled, is_custom')
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Could not load providers: ${error.message}`)
  if (!allKeys || allKeys.length === 0) {
    throw new Error('No enabled provider found. Add a provider key to get started.')
  }

  const keys = allKeys as ProviderKeyRow[]

  // Sort: preferred provider first, then by creation date
  let sortedKeys = [...keys]
  if (selectedModel) {
    const prefIdx = sortedKeys.findIndex(
      (k) => k.provider_id === selectedModel.provider_id,
    )
    if (prefIdx > 0) {
      const [pref] = sortedKeys.splice(prefIdx, 1)
      sortedKeys.unshift(pref)
    }
  }

  // Filter out providers with open circuits
  const healthyKeys = sortedKeys.filter(
    (k) => !circuitBreaker.isOpen(k.provider_id),
  )

  if (healthyKeys.length === 0) {
    throw new Error(
      'All providers are temporarily unavailable (circuit breaker open). Please wait a moment and try again.',
    )
  }

  // Try each healthy provider in order
  const errors: string[] = []

  for (let i = 0; i < healthyKeys.length; i++) {
    const key = healthyKeys[i]

    try {
      const { data: defaultRow } = await supabase
        .from('default_models')
        .select('provider_id, models')
        .eq('provider_id', key.provider_id)
        .maybeSingle()

      const defaultModels = parseModels(getRecordString(defaultRow, 'models'))
      const customModels = parseModels(key.models)
      const merged = mergeModels(defaultModels, customModels)

      const selected =
        selectedModel && selectedModel.provider_id === key.provider_id
          ? { name: selectedModel.model_name, id: selectedModel.model_id }
          : merged[0]

      if (!selected?.id) {
        errors.push(`${key.provider_name || key.provider_id}: No model configured`)
        continue
      }

      const rawBaseUrl = (
        key.base_url?.trim() || DEFAULT_BASE_URLS[key.provider_id] || ''
      ).replace(/\/+$/, '')

      if (!rawBaseUrl) {
        errors.push(`${key.provider_name || key.provider_id}: No base URL configured`)
        continue
      }

      const baseUrl = validateProviderUrl(rawBaseUrl)

      return { key, baseUrl, model: selected }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${key.provider_name || key.provider_id}: ${msg}`)

      // Record failure for circuit breaker
      circuitBreaker.recordFailure(key.provider_id)

      // If this was the preferred provider and there are fallbacks, try them
      if (i < healthyKeys.length - 1) {
        continue
      }
    }
  }

  throw new Error(
    `Could not connect to any provider:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
  )
}
