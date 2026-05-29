/**
 * AI Chat Service — calls the configured provider API with BYOK keys.
 *
 * Flow: User message → build system prompt → call provider API → parse response →
 *       extract code blocks → update project state → return display text
 */

import type { ProviderConfig } from './providers'
import { parseCodeBlocks, setProjectFile, type ProjectFile } from './project'
import type { Message } from '../components/chat/ChatPanel'

const SYSTEM_PROMPT = `You are Bloom, an expert web developer AI that builds complete, production-ready websites. You create beautiful, modern web interfaces using HTML, CSS, and JavaScript.

## How you work:
1. When the user describes what they want, you generate the complete code
2. You output code in markdown code blocks with the appropriate language tag
3. You always provide the full file content, not just diffs
4. You explain what you built after the code blocks

## Code output format:
- HTML goes in \`\`\`html ... \`\`\` blocks — always include the full HTML document structure
- CSS goes in \`\`\`css ... \`\`\` blocks — include all styles, be thorough
- JavaScript goes in \`\`\`javascript ... \`\`\` blocks — include all functionality

## Design guidelines:
- Use modern design patterns with clean typography and spacing
- Build responsive layouts that work on mobile, tablet, and desktop
- Use CSS variables for theming when appropriate
- Include subtle animations and transitions for polish
- Follow current web design trends (glass morphism, dark mode, bold typography)
- Always use proper semantic HTML

## Rules:
- Always output COMPLETE, WORKING code — never use placeholders or "..." shortcuts
- When updating, provide the FULL file contents, not partial updates
- Keep JavaScript vanilla — no framework dependencies unless the user asks
- Import fonts from Google Fonts when needed for better design
- Test your code mentally before outputting — make sure it actually works`

export interface ChatResult {
  message: string
  files: ProjectFile[]
}

/**
 * Send a chat message to the configured AI provider and return the response.
 */
export async function sendChatMessage(
  messages: Message[],
  providerId: string,
  model: string
): Promise<ChatResult> {
  const provider = await fetchProvider(providerId)
  if (!provider) throw new Error('Provider not found')

  const apiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.text,
    })),
  ]

  const response = await callProvider(provider, model, apiMessages)
  if (!response.ok) throw new Error(response.message)

  // Parse code blocks from the AI response
  const files = parseCodeBlocks(response.text)

  // Update project state with extracted files
  for (const file of files) {
    setProjectFile(file.name, file.content)
  }

  return { message: response.text, files }
}

async function callProvider(
  provider: ProviderConfig,
  model: string,
  messages: { role: string; content: string }[]
): Promise<{ ok: boolean; text: string; message: string }> {
  const baseUrl = provider.base_url ?? 'https://api.openai.com/v1'
  const url = `${baseUrl}/chat/completions`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 8192,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(60000),
      redirect: 'manual',
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const errMsg =
        (err as { error?: { message?: string } })?.error?.message ??
        `HTTP ${res.status}`
      return { ok: false, text: '', message: errMsg }
    }

    const data = (await res.json()) as {
      choices?: [{ message?: { content?: string } }]
    }
    const text = data.choices?.[0]?.message?.content ?? ''
    if (!text.trim())
      return { ok: false, text: '', message: 'Empty response from provider' }

    return { ok: true, text, message: 'OK' }
  } catch (e) {
    return {
      ok: false,
      text: '',
      message:
        e instanceof Error ? e.message : 'Unknown error calling provider',
    }
  }
}

/**
 * Fetch a single provider by ID from Supabase.
 */
async function fetchProvider(id: string): Promise<ProviderConfig | null> {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data
}
