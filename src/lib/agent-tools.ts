/**
 * Agent Tools — tool definitions (OpenAI function-calling JSON Schema)
 * and execution layer for the Plan → Act → Reflect loop.
 *
 * Tool descriptions follow the "what → when → when NOT → common mistakes"
 * pattern. Each tool tells the model exactly how to use it successfully.
 */

import {
  listFiles,
  readFile,
  writeFile,
  editFile,
  deleteFile,
  executeBuild,
  getErrors,
} from './workspace'
import { spawnCommand } from './webcontainer'

/* ── Tool Definitions ─────────────────────────────── */

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: `List all files in the project workspace with their sizes and last-modified times.

WHEN TO USE: Always call this FIRST before making any changes to the project. It gives you a complete picture of what exists, what's been modified recently, and the overall project structure.

WHEN NOT TO USE: If you just called it in the current turn and haven't made any file changes since, you don't need to call it again.

COMMON MISTAKES: Skipping this step leads to creating duplicate files, editing files that don't exist, or missing important context about the project structure.`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: `Search for a text pattern across all files in the workspace. Returns matching file paths and line numbers.

WHEN TO USE: Before modifying existing code, search for all usages of a function, component, import, or pattern to understand the full impact of your change. Use this to find where something is defined or used.

WHEN NOT TO USE: If you need to read the full content of a specific file, use read_file instead. This is for finding, not for reading.

COMMON MISTAKES: Searching for overly generic terms (like "export" or "return") will return too many results. Be specific with your search pattern.`,
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description:
              'The text or regex pattern to search for. Be specific — search for function names, component names, import paths, or distinctive code patterns. Example: "useState", "export default function App", "from.*react"',
          },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: `Execute a shell command inside the WebContainer terminal and get its output. The command runs in a full Linux environment with Node.js and npm available.

WHEN TO USE: Run npm commands (npm install, npm run dev, npm test), list directory contents (ls), check file existence (cat, head), install additional system packages. Use this for ANY terminal operation.

WHEN NOT TO USE: Don't use this to read or write files — use read_file and write_file instead. Don't use for commands that run indefinitely (servers) — the tool has a 30-second timeout.

COMMON MISTAKES: Commands that start a long-running process (like a dev server) will be killed after 30 seconds. Use this tool for short-lived commands only. The output is truncated to ~10KB — use grep or head/tail to narrow down output.`,
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description:
              'The shell command to run. Examples: "ls -la src/", "npm test", "cat package.json", "npx tsc --noEmit", "head -20 src/App.tsx". The command runs inside the project root directory.',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: `Search the web for current information, documentation, solutions, and references. Returns structured results with titles, URLs, and snippets.

WHEN TO USE: When you need to look up documentation for a library or API, find solutions to errors, check current best practices, research technology choices, or verify facts. Always search BEFORE using an unfamiliar npm package or API.

WHEN NOT TO USE: For reading the full content of a specific URL — use web_fetch instead. For searching within the project codebase — use search_files.

COMMON MISTAKES: Searching for overly broad terms returns noisy results. Be specific: "React 19 useEffect cleanup async" is better than "React hooks". Search results are from the open web — verify critical information.`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'The search query. Be specific and include relevant keywords, version numbers, or dates. Example: "Vite 6 HMR not working WebContainer 2025", "React 19 useOptimistic example", "tailwindcss v4 dark mode configuration"',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: `Fetch and extract the text content from a URL. Use this to read documentation pages, API references, blog posts, or any web content you need to reference.

WHEN TO USE: After finding a relevant URL via web_search, fetch the full page to read details. Also use for checking API endpoints, reading package documentation on npmjs.com, or fetching data from public APIs.

WHEN NOT TO USE: Don't use for URLs that require authentication (they'll fail). Don't use for downloading large files or binary content. For APIs that return JSON, this tool will extract the text content.

COMMON MISTAKES: Fetching pages that are JavaScript-rendered SPA apps — you'll get an empty shell. Use for documentation sites, blogs, and server-rendered pages. Results are text-only, no images or styles.`,
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description:
              'The full URL to fetch. Must start with https://. Example: "https://react.dev/reference/react/useEffect", "https://www.npmjs.com/package/zustand"',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: `Ask the user a question when you need clarification, a decision, or confirmation before proceeding. Use this to resolve ambiguity rather than guessing.

WHEN TO USE: When the user's request is genuinely ambiguous (multiple valid interpretations), when you need to choose between two valid technical approaches, when you've found a problem and want to confirm the fix direction, or when the user needs to make a subjective design choice.

WHEN NOT TO USE: Don't overuse — for minor ambiguities, make a reasonable assumption and proceed. Don't ask about obvious implementation details. Don't ask more than 2-3 questions per task.

COMMON MISTAKES: Asking too many questions disrupts flow. Asking about things you should just decide ("Should I use const or let?"). Asking yes/no questions when a multiple-choice would be clearer.`,
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description:
              'The question to ask the user. Be clear and specific. Example: "This could be a single-page app with client-side routing or separate HTML pages. Which approach do you prefer?"',
          },
          options: {
            type: 'string',
            description:
              'Optional comma-separated list of choices to present to the user. Example: "Single-page with React Router, Separate pages with links, You decide — pick the best approach"',
          },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: `Read the complete contents of a file.

WHEN TO USE: Always read a file before modifying it so you know the exact current contents. Also use this to understand how existing components work, what exports are available, or the current state of configuration files.

WHEN NOT TO USE: If you just wrote the file in the current turn and it hasn't been modified since, you don't need to re-read it.

COMMON MISTAKES: The biggest cause of failed edit_file calls is not knowing the exact file content. Always read first, then edit. Also, never assume file contents based on memory — files may have changed since you last read them.`,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'File path relative to the project root. Examples: "src/App.tsx", "src/components/Header.tsx", "package.json"',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: `Create a new file or completely overwrite an existing file with the full content.

WHEN TO USE: For NEW files (creating a component, page, utility, or config file for the first time) OR when rewriting an ENTIRE file (the changes are too large for edit_file). Always provide the COMPLETE file content — not just the changed parts.

WHEN NOT TO USE: For small targeted changes (less than ~20 lines) to existing files, use edit_file instead. It's more precise and less error-prone for surgical edits.

COMMON MISTAKES:
- Providing incomplete content (only the changed section) — the file will be REPLACED, not merged.
- Forgetting import statements for components, hooks, or utilities used in the file.
- Not including the CSS module import when creating a component that has styles.
- Creating duplicate files — check list_files first to see what already exists.`,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'File path relative to project root. Include the appropriate extension. Examples: "src/components/Header.tsx", "src/utils/api.ts", "src/pages/Home.module.css"',
          },
          content: {
            type: 'string',
            description:
              'The COMPLETE file content including all imports, type definitions, component implementation, and exports. Must be fully implemented — no stubs, TODOs, placeholders, or incomplete functions. Include error handling, loading states, and edge case handling.',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: `Make a precise, surgical string replacement in an existing file.

WHEN TO USE: For small targeted changes (typically less than ~20 lines): renaming a variable, updating a className, adding a single prop, fixing a typo, changing a style property. The old_string must match the file content EXACTLY — character for character, including all whitespace and indentation.

WHEN NOT TO USE: For creating new files (use write_file). For large rewrites or changes spanning more than ~20 lines (use write_file with the full new content). If you haven't read the file in this turn, read it first — the old_string must be exact.

COMMON MISTAKES:
- The #1 cause of edit failures: old_string doesn't exactly match the file. Even one space difference causes failure. Always read the file first.
- Using edit_file for changes that span large sections — it's harder to match exactly. Use write_file instead.
- Trying to match text that appears multiple times in the file — the edit will fail. Include more surrounding context to make the old_string unique.`,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path relative to project root.',
          },
          old_string: {
            type: 'string',
            description:
              'The EXACT text to find and replace. Must match the file content character-for-character, including all whitespace, indentation, blank lines, and punctuation. Always read the file immediately before editing to ensure this is accurate. To avoid duplicate matches, include enough surrounding context to make it unique.',
          },
          new_string: {
            type: 'string',
            description: 'The replacement text that will replace old_string.',
          },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: `Permanently remove a file from the project workspace.

WHEN TO USE: When a file is truly no longer needed AND no other file imports or references it. Before deleting, search the workspace to confirm there are no remaining references.

WHEN NOT TO USE: If the file is still imported or referenced anywhere — fix those references first, then delete. If you're unsure whether the file is needed, don't delete it.

COMMON MISTAKES: Deleting a file that is still imported by other files causes build errors. Always use search_files to find all references before deleting.`,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'File path to delete. Examples: "src/old/DeprecatedComponent.tsx", "src/utils/unused-helper.ts"',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_build',
      description: `Run the TypeScript compiler to verify all files compile without errors.

WHEN TO USE: After finishing ALL file changes (creating, editing, or deleting files), call this to verify everything works together. The build checks for TypeScript type errors, missing imports, syntax issues, and other compilation problems.

WHEN NOT TO USE: Don't call it after every single file — batch your changes and verify once at the end. Don't skip it either — unverified changes are the #1 source of broken projects.

COMMON MISTAKES: Forgetting to run the build after making changes. If the build fails, use get_errors to see exactly what went wrong, fix the issues, and run execute_build again. Give up after 3 failed fix cycles and ask for help.`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_errors',
      description: `Get the detailed errors and warnings from the most recent build.

WHEN TO USE: Immediately after execute_build fails. The errors include file paths, line numbers, and specific error messages that tell you exactly what to fix. Also use this to check for warnings (unused imports, deprecated APIs) even when the build passes.

WHEN NOT TO USE: If no build has been run yet (you'll get a message saying so). Run execute_build first.

COMMON MISTAKES: Trying to fix errors without reading them first. The error messages tell you exactly what's wrong and where — use that information rather than guessing.`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
]

/* ── Tool Execution ────────────────────────────────── */

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, string>
}

export interface ToolResult {
  id: string
  name: string
  result: string // JSON-stringified result for the model
  display: string // Human-readable for the chat UI
}

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const base = { id: call.id, name: call.name }

  try {
    switch (call.name) {
      case 'list_files': {
        const files = listFiles()
        const listing = files
          .map(
            (f) =>
              `${f.path} (${(f.content.length / 1024).toFixed(1)} KB, modified ${new Date(f.lastModified).toLocaleTimeString()})`
          )
          .join('\n')
        return {
          ...base,
          result: `Files in workspace (${files.length} total):\n${listing}`,
          display: `Listed ${files.length} workspace files`,
        }
      }

      case 'run_command': {
        const cmd = call.arguments.command
        if (!cmd) {
          return {
            ...base,
            result: 'Error: command parameter is required for run_command',
            display: '❌ run_command: missing command',
          }
        }
        const { exitCode, output } = await spawnCommand(cmd)
        const result = [
          `$ ${cmd}`,
          output || '(no output)',
          exitCode !== 0 ? `\n[exit code: ${exitCode}]` : '',
          exitCode === -1 ? '\n[Command timed out after 30s]' : '',
        ]
          .filter(Boolean)
          .join('\n')
        const ok = exitCode === 0
        return {
          ...base,
          result,
          display: `${ok ? '✅' : '⚠️'} $ ${cmd}${exitCode !== 0 ? ` (exit ${exitCode})` : ''}`,
        }
      }

      case 'web_search': {
        const query = call.arguments.query
        if (!query) {
          return {
            ...base,
            result: 'Error: query parameter is required for web_search',
            display: '❌ web_search: missing query',
          }
        }
        try {
          const results = await searchWeb(query)
          return {
            ...base,
            result: results,
            display: `🔍 Searched web for "${query.slice(0, 50)}"`,
          }
        } catch (e) {
          return {
            ...base,
            result: `Search failed: ${(e as Error).message}. Try a different query or use web_fetch if you have a specific URL.`,
            display: `❌ Web search failed: ${(e as Error).message}`,
          }
        }
      }

      case 'web_fetch': {
        const rawUrl = call.arguments.url
        if (!rawUrl) {
          return {
            ...base,
            result: 'Error: url parameter is required for web_fetch',
            display: '❌ web_fetch: missing url',
          }
        }
        const validated = validateUrl(rawUrl)
        if (!validated.ok) {
          return {
            ...base,
            result: `URL blocked: ${validated.reason}. Only public HTTPS URLs are allowed — no private IPs, localhost, or internal hostnames.`,
            display: `❌ web_fetch: ${validated.reason}`,
          }
        }
        try {
          const content = await fetchWeb(validated.url)
          return {
            ...base,
            result: content,
            display: `🌐 Fetched ${validated.url.slice(0, 60)}`,
          }
        } catch (e) {
          return {
            ...base,
            result: `Fetch failed: ${(e as Error).message}. The site may be unreachable, require authentication, or block requests.`,
            display: `❌ Web fetch failed: ${(e as Error).message}`,
          }
        }
      }

      case 'search_files': {
        const pattern = call.arguments.pattern
        if (!pattern) {
          return {
            ...base,
            result: 'Error: pattern parameter is required for search_files',
            display: '❌ search_files: missing pattern',
          }
        }
        const files = listFiles()
        const results: string[] = []
        for (const f of files) {
          // Only search text files, skip binary/large files
          if (f.content.length > 500_000) continue
          const lines = f.content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            try {
              if (new RegExp(pattern, 'i').test(lines[i])) {
                results.push(`${f.path}:${i + 1}: ${lines[i].trim().slice(0, 120)}`)
              }
            } catch {
              // If regex is invalid, fall back to plain text search
              if (lines[i].toLowerCase().includes(pattern.toLowerCase())) {
                results.push(`${f.path}:${i + 1}: ${lines[i].trim().slice(0, 120)}`)
              }
            }
          }
        }
        const capped = results.slice(0, 50)
        const summary =
          capped.length === 0
            ? `No matches found for "${pattern}" in ${files.length} files.`
            : `Found ${results.length} match(es) for "${pattern}" in ${files.length} files:\n${capped.join('\n')}${results.length > 50 ? `\n... and ${results.length - 50} more matches` : ''}`
        return {
          ...base,
          result: summary,
          display: `🔍 Found ${results.length} match(es) for "${pattern}"`,
        }
      }

      case 'read_file': {
        const content = readFile(call.arguments.path)
        if (content === null) {
          return {
            ...base,
            result: `Error: File not found: ${call.arguments.path}. Check the path spelling and try again — use list_files to see available paths.`,
            display: `❌ File not found: ${call.arguments.path}`,
          }
        }
        return {
          ...base,
          result: content,
          display: `📖 Read ${call.arguments.path}`,
        }
      }

      case 'write_file': {
        const existed = readFile(call.arguments.path) !== null
        writeFile(call.arguments.path, call.arguments.content)
        const display = existed
          ? `✏️ Modified ${call.arguments.path}`
          : `📄 Created ${call.arguments.path}`
        return {
          ...base,
          result: `File written successfully: ${call.arguments.path}`,
          display,
        }
      }

      case 'edit_file': {
        const editResult = editFile(
          call.arguments.path,
          call.arguments.old_string,
          call.arguments.new_string
        )
        if (!editResult.success) {
          return {
            ...base,
            result: `Edit failed: ${editResult.error}\n\nTip: Read the file first to ensure old_string matches exactly, including whitespace and indentation. If the change is large, consider using write_file with the full file content instead.`,
            display: `❌ Edit failed on ${call.arguments.path}: ${editResult.error}`,
          }
        }
        return {
          ...base,
          result: `Edit applied successfully to ${call.arguments.path}`,
          display: `✏️ Edited ${call.arguments.path}`,
        }
      }

      case 'delete_file': {
        const ok = deleteFile(call.arguments.path)
        if (!ok) {
          return {
            ...base,
            result: `Error: File not found: ${call.arguments.path}. It may have already been deleted or the path is incorrect.`,
            display: `❌ Delete failed: ${call.arguments.path} not found`,
          }
        }
        return {
          ...base,
          result: `File deleted: ${call.arguments.path}`,
          display: `🗑️ Deleted ${call.arguments.path}`,
        }
      }

      case 'execute_build': {
        const buildResult = await executeBuild()
        const summary = buildResult.success
          ? 'Build passed with no errors.'
          : `Build failed with ${buildResult.errors.length} error(s):\n${buildResult.errors.join('\n')}`
        const display = buildResult.success
          ? '✅ Build passed'
          : `🔨 Build failed — ${buildResult.errors.length} error(s)`
        return { ...base, result: summary, display }
      }

      case 'get_errors': {
        const errs = getErrors()
        if (!errs) {
          return {
            ...base,
            result: 'No build has been run yet. Call execute_build first to compile the project and detect errors.',
            display: '⚠️ No build data available — run execute_build first',
          }
        }
        if (errs.errors.length === 0 && errs.warnings.length === 0) {
          return {
            ...base,
            result: 'No errors or warnings from the last build. All files compile cleanly.',
            display: '✅ No errors or warnings',
          }
        }
        const text = [
          errs.errors.length > 0
            ? `Build errors (${errs.errors.length}):\n${errs.errors.join('\n')}`
            : '',
          errs.warnings.length > 0
            ? `Warnings (${errs.warnings.length}):\n${errs.warnings.join('\n')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n')
        return {
          ...base,
          result: text,
          display: `🔍 ${errs.errors.length} error(s), ${errs.warnings.length} warning(s)`,
        }
      }

      default:
        return {
          ...base,
          result: `Unknown tool: ${call.name}. Available tools: list_files, search_files, read_file, write_file, edit_file, delete_file, execute_build, get_errors`,
          display: `❌ Unknown tool: ${call.name}`,
        }
    }
  } catch (e) {
    return {
      ...base,
      result: `Tool execution error: ${(e as Error).message}`,
      display: `❌ Error: ${(e as Error).message}`,
    }
  }
}

/* ── Web Tools ───────────────────────────────────── */

/**
 * Search the web using DuckDuckGo's HTML search (no API key needed).
 * Returns formatted results with titles, URLs, and snippets.
 */
async function searchWeb(query: string): Promise<string> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; BloomBot/1.0; +https://bloom.dev)',
    },
    signal: AbortSignal.timeout(12_000),
  })

  if (!res.ok) {
    throw new Error(`Search returned HTTP ${res.status}`)
  }

  const html = await res.text()

  // Parse DuckDuckGo HTML results
  const results: { title: string; url: string; snippet: string }[] = []
  const linkRegex =
    /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi
  const snippetRegex =
    /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi

  let linkMatch
  const links: { title: string; url: string }[] = []
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const rawUrl = linkMatch[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '')
    const decoded = decodeURIComponent(rawUrl)
    links.push({ url: decoded, title: linkMatch[2].replace(/<[^>]*>/g, '').trim() })
  }

  let snippetMatch
  const snippets: string[] = []
  while ((snippetMatch = snippetRegex.exec(html)) !== null) {
    snippets.push(snippetMatch[1].replace(/<[^>]*>/g, '').trim())
  }

  for (let i = 0; i < Math.min(links.length, snippets.length, 8); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || 'No description available',
    })
  }

  if (results.length === 0) {
    return `No search results found for "${query}". Try different keywords.`
  }

  return results
    .map(
      (r, i) =>
        `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`
    )
    .join('\n\n')
}

/**
 * Validate a URL for SSRF prevention. Only allows public HTTPS URLs.
 * Blocks private IPs, localhost, and internal hostnames.
 */
function validateUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, reason: 'Invalid URL format' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only HTTPS URLs are allowed' }
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block localhost and loopback
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0'
  ) {
    return { ok: false, reason: 'Localhost URLs are not allowed' }
  }

  // Block private IP ranges
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const parts = hostname.split('.').map(Number)
    const [a, b] = parts
    // 10.0.0.0/8
    if (a === 10) return { ok: false, reason: 'Private network URLs are not allowed' }
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return { ok: false, reason: 'Private network URLs are not allowed' }
    // 192.168.0.0/16
    if (a === 192 && b === 168) return { ok: false, reason: 'Private network URLs are not allowed' }
    // 127.0.0.0/8 (loopback)
    if (a === 127) return { ok: false, reason: 'Loopback URLs are not allowed' }
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return { ok: false, reason: 'Link-local URLs are not allowed' }
  }

  // Block common internal hostnames
  if (hostname === 'metadata.google.internal') {
    return { ok: false, reason: 'Internal hostnames are not allowed' }
  }

  return { ok: true, url: parsed.href }
}

/**
 * Fetch a web URL and extract text content. Strips HTML tags.
 */
async function fetchWeb(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: 'text/html, text/plain, application/json',
      'User-Agent':
        'Mozilla/5.0 (compatible; BloomBot/1.0; +https://bloom.dev)',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  const text = await res.text()

  // If JSON, return pretty-printed
  if (contentType.includes('json')) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2).slice(0, 6000)
    } catch {
      return text.slice(0, 6000)
    }
  }

  // Strip HTML tags, scripts, and styles
  const stripped = text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 8000)

  return stripped || '[No text content extracted — the page may be JavaScript-rendered]'
}

/* ── Tool Call Parsing ─────────────────────────────── */

/**
 * Parse tool calls from an OpenAI-compatible API response delta.
 */
export function parseToolCallsFromDelta(
  delta: Record<string, unknown>
): { index: number; id?: string; name?: string; arguments?: string }[] {
  const toolCalls = delta.tool_calls as
    | Array<{
        index: number
        id?: string
        function?: { name?: string; arguments?: string }
      }>
    | undefined
  if (!toolCalls) return []

  return toolCalls.map((tc) => ({
    index: tc.index,
    id: tc.id,
    name: tc.function?.name,
    arguments: tc.function?.arguments,
  }))
}
