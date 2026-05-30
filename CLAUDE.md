# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Bloom is a BYOK (Bring Your Own Key) vibe-coding website builder. Users bring their own provider API keys — no server-side AI costs. It's a client-side React 19 + TypeScript + Vite SPA with a two-panel layout: AI chat on the left, live website preview on the right.

The preview is powered by **WebContainers** (`@webcontainer/api`) — a WASM-based Linux environment that boots inside the browser, runs `npm install && npm run dev`, and exposes a Vite dev server URL to the preview iframe. Real TypeScript, real npm packages, real HMR.

## Commands

```bash
npm run dev          # Start dev server (HMR)
npm run build        # Type-check (tsc -b) then production build (vite build)
npm run preview      # Preview production build locally
npm run lint         # ESLint on all files
npm test             # Run all Vitest tests (108 tests, 7 files)
npm run test:watch   # Watch mode — re-runs on file changes
```

Type-check without building: `npx tsc --noEmit`.

## Architecture

### Agent loop (core AI system)

```
ChatPanel (chat/)
  └─ handleSend → runAgentLoop()  ← master orchestrator
       ├─ buildSystemPrompt()     ← system-prompt.ts (ADIHQ workflow, 12 tools)
       ├─ enhanceUserPrompt()     ← wraps raw prompt with project context
       ├─ API call via adapters   ← OpenAI / Anthropic / Gemini
       └─ executeTool()           ← agent-tools.ts (12 tool implementations)
            ├─ list_files, search_files, read_file
            ├─ write_file, edit_file, delete_file
            ├─ execute_build, get_errors
            ├─ run_command (shell in WebContainer)
            ├─ web_search (DuckDuckGo), web_fetch (URL reader)
            └─ ask_user (pauses loop, shows inline question card)
```

**Key files:**
- `src/lib/agent-loop.ts` — async generator that yields streaming events (text, tool_call, tool_result, error, done, ask_user). Runs until agent finishes or 3 consecutive build failures. No iteration cap.
- `src/lib/agent-tools.ts` — 12 tool definitions (OpenAI JSON Schema) + execution layer. Each tool description follows "what → when → when NOT → common mistakes" pattern. Also contains `validateUrl()` for SSRF protection and `searchWeb()`/`fetchWeb()` helpers.
- `src/lib/system-prompt.ts` — ~250 lines: Environment, Behavior, Code Quality, File Structure, Tool Selection Guide, Real Type Checking, ADIHQ Workflow, Error Recovery Protocol, Project Memory, Anti-Patterns, Self-Review Checklist, Styling Philosophy. Mode-specific instructions (Plan vs Build).
- `src/lib/webcontainer.ts` — WebContainer lifecycle: eager boot at module import, `ensureRunning()` (mount → npm install → npm run dev → server-ready), `updateFile()` for HMR, `spawnCommand()` for shell access. Polls for `tsc` on disk after install. Detects `package.json` changes and auto-reinstalls.

### Preview system

```
PreviewPanel
  ├─ PreviewToolbar   ← route bar, device switcher (phone/tablet/pc), 3-dot menu
  ├─ PreviewFrame     ← iframe with key-based lifecycle + progress srcdoc
  └─ CodePanel        ← file tree + syntax-highlighted code viewer (react-syntax-highlighter)
```

- **PreviewFrame** uses React `key` prop to control iframe lifecycle — never sets `src` and `srcDoc` simultaneously (browsers prioritize `srcDoc`). When the WebContainer dev server is ready, the key changes, React mounts a fresh iframe with the URL. Code changes increment a `reloadKey` counter, forcing a fresh load.
- **Workspace → WebContainer flow**: `getWorkspace().files` → `ensureRunning(files)` → writes to WC virtual FS → Vite HMR or full reload.

### Workspace (project file store)

`src/lib/workspace.ts` — in-memory file store with CRUD, path validation (no traversal, no absolute paths), build pipeline (syntax checker), and subscription-based change notification. Default scaffold: TypeScript, React 19, Vite, Tailwind CSS v3 — `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `src/vite-env.d.ts`, `src/index.css`, `src/main.tsx`, `src/App.tsx`.

### Provider adapters

`src/lib/adapters.ts` — `ProviderAdapter` interface with `buildHeaders`, `buildPayload`, `parseStreamChunk`, `parseError`, `buildUrl`. Implementations for OpenAI, Anthropic, Gemini. OpenAI-compatible providers (DeepSeek, Groq, Together, Mistral) reuse the OpenAI adapter.

### Data layer

`src/lib/providers.ts` — CRUD for provider configs stored in Supabase with RLS. `src/lib/supabase.ts` — Supabase client init.

### Legacy files (not used by current agent system)

`src/lib/chat.ts` and `src/lib/project.ts` are from the pre-agent-loop architecture. Nothing imports from them. They are safe to delete or ignore.

## Design system

All tokens are CSS custom properties in `src/styles/globals.css`:

| Category | Key variables |
|----------|--------------|
| Backgrounds | `--bg-root`, `--bg-panel`, `--bg-elevated`, `--bg-field`, `--bg-hover` |
| Accent | `--accent` (#4f8fff), `--accent-glow`, `--accent-soft` |
| Text | `--text-primary` (#e8e8ed), `--text-secondary`, `--text-tertiary`, `--text-disabled` |
| Borders | `--border-subtle` (rgba white 0.04), `--border-default` (0.07), `--border-strong` (0.11) |
| Typography | `--font-display` (Syne), `--font-body` (Manrope), `--font-mono` (Fira Code) |
| Radii | `--radius-xs` through `--radius-2xl` |
| Shadows | `--shadow-sm`, `--shadow-panel`, `--shadow-elevated`, `--shadow-glow`, `--shadow-input` |

Every component uses **CSS Modules** (`*.module.css`), co-located with the component. Tokens accessed via `var(--name)`.

## Vite config

`vite.config.ts` includes three important additions beyond the defaults:
1. **COOP/COEP headers** — required by WebContainers for `SharedArrayBuffer`
2. **Vitest config** — `test.globals`, `test.environment: 'jsdom'`, `test.setupFiles`
3. **CSS module config** — `classNameStrategy: 'non-scoped'` for tests

## Key patterns

- **No router yet** — single-page app with conditional rendering (`view === 'settings'` vs `view === 'builder'`)
- **Module-level side effects** — `webcontainer.ts` calls `WebContainer.boot()` at import time to overlap WASM download with React rendering
- **Subscription model** — both workspace (`subscribeToWorkspace`) and WebContainer state (`subscribeWcState`) use callback sets
- **SSRF protection** — `validateUrl()` in `agent-tools.ts` blocks private IPs, localhost, and cloud metadata endpoints before any `web_fetch` call
- **Path traversal guards** — `workspace.ts` validates user paths; `webcontainer.ts` has `sanitizePath()` as defense-in-depth at the FS boundary
- **Click-outside handling** — dropdowns use a `useEffect` that adds a window `click` listener when open, checking `ref.current.contains(e.target)`
