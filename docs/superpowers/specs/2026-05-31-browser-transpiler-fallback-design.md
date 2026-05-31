# Browser Transpiler Fallback — Design Spec

**Date:** 2026-05-31
**Status:** Draft

## Overview

Add an in-browser transpilation fallback that runs when WebContainers cannot (no SharedArrayBuffer, iOS Safari, etc.). Uses `@babel/standalone` to transpile JSX/TSX → JavaScript in pure JS (no WASM), resolves npm imports via CDN (esm.sh), and renders the result as an `srcdoc` iframe.

## Motivation

WebContainers requires `SharedArrayBuffer`, which needs COOP/COEP headers. These headers break cross-origin embeds (auth providers, analytics, font CDNs). Additionally, WebContainers doesn't work on iOS Safari at all (~15-20% of potential users). The fallback covers these users with a slightly reduced but functional preview.

## Architecture

```
PreviewFrame
  ├─ capabilities.ts          ← detect "webcontainer" | "transpiler"
  ├─ Path A: WebContainers    ← existing code, unchanged
  └─ Path B: Transpiler       ← NEW
       ├─ transpiler.ts        ← file → srcdoc pipeline
       │    ├─ resolveImports() ← npm→CDN via esm.sh
       │    ├─ transpileFiles() ← Babel standalone
       │    └─ assembleHtml()   ← final srcdoc string
       └─ iframe srcDoc        ← renders inline
```

### Capability Detection (`src/lib/capabilities.ts`)

```typescript
export type PreviewCapability = 'webcontainer' | 'transpiler' | 'unsupported'

export function detectCapability(): PreviewCapability {
  // Test SharedArrayBuffer availability — the hard requirement for WebContainers
  try {
    if (typeof SharedArrayBuffer !== 'undefined') {
      new SharedArrayBuffer(1)
      return 'webcontainer'
    }
  } catch { /* blocked by COOP/COEP */ }

  // Check if basic Babel requirements are met
  try {
    new Function('return true')() // eval-like dynamic code execution
    return 'transpiler'
  } catch {
    return 'unsupported'
  }
}
```

Returns `"webcontainer"` when SharedArrayBuffer is functional, `"transpiler"` when it's not but JS execution works, `"unsupported"` as a last-resort guard.

### Transpiler Pipeline (`src/lib/transpiler.ts`)

**Input:** `WorkspaceFile[]` (all files from the workspace)
**Output:** `string` (complete HTML document suitable for `iframe.srcdoc`)

**Pipeline stages:**

1. **Entry point selection** — find `index.html`, extract `<title>`, locate `<script src="./src/main.tsx">`
2. **Dependency resolution** — read `package.json`, build an import map of `packageName → esm.sh URL`. Example: `"react" → "https://esm.sh/react@19.2.0"`
3. **Recursive transpilation** — walk the import graph from `src/main.tsx`, for each `.tsx/.ts/.jsx` file: run through `@babel/standalone` with `preset-react` and `preset-typescript`. Replace bare imports with CDN URLs.
4. **CSS processing** — strip `@tailwind` directives (not functional without PostCSS), keep all custom CSS, inject `<script src="https://cdn.tailwindcss.com">` for runtime Tailwind.
5. **HTML assembly** — produce final `<html>` with `<head>` (meta, title, Tailwind CDN, inline styles), `<body>` (`<div id="root">`, module script with transpiled code).

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ index.html   │───▶│ Babel        │───▶│ Final srcdoc │
│ package.json │    │ Transpile    │    │ string set   │
│ src/main.tsx │    │ Import→CDN   │    │ on iframe    │
│ src/App.tsx  │    │ Tailwind CDN │    │              │
│ src/*.css    │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

### PreviewFrame Changes (`src/components/preview/PreviewFrame.tsx`)

**Current behavior:** Always boots WebContainer, subscribes to WC state, syncs workspace.

**New behavior:**

```typescript
const capability = detectCapability()

// Path A: WebContainer (existing code, unchanged)
if (capability === 'webcontainer') {
  // ... boot, ensureRunning, src={url}
}

// Path B: Transpiler (new)
if (capability === 'transpiler') {
  const srcdoc = buildTranspiledPreview(getWorkspace().files)
  // set srcdoc directly, no URL loading
  // on file change: rebuild srcdoc, update iframe
}
```

**Key differences from WebContainer path:**
- No async boot phase — transpilation is synchronous (< 100ms for typical projects)
- No URL-based `src` — all content is `srcDoc` inline
- No `npm install` — imports resolved from CDN
- No HMR — full srcdoc rebuild on each change (fast enough that it feels instant)

### System Prompt Changes (`src/lib/system-prompt.ts`)

When `detectCapability()` returns `"transpiler"`, inject a section into the system prompt:

```
## Fallback Mode (No Node.js Runtime)

You are running in browser-transpiler mode. Keep in mind:
- No npm install — all dependencies resolve from CDN (esm.sh)
- Avoid packages with native Node.js dependencies (fs, path, crypto, child_process, net, tls)
- Prefer client-side packages: React, ReactDOM, chart libraries, UI kits, state management
- Tailwind is available via CDN but @apply/@layer directives won't work — use inline utility classes
- You CAN use: react, react-dom, react-router-dom, zustand, axios, tanstack-query, lucide-react, recharts, date-fns, etc.
```

### Error Handling

| Failure | User sees |
|---------|-----------|
| Babel parse error | Overlay in iframe: `❌ Parse error in src/App.tsx:15 — Unexpected token` |
| Import not in package.json | Overlay: `⚠️ Package "lodash" not found — add it to package.json` |
| esm.sh resolution fails | Overlay: `⚠️ Unable to resolve "some-pkg" — may have native Node deps` |
| Entry file missing | Falls back to default App component |
| CSS parse error | Silently skipped (non-blocking) |

Errors are rendered as an HTML overlay inside the iframe itself — the user always sees something, even if it's an error page.

### Limitations (Shown in UI)

A small banner/indicator in PreviewToolbar when in transpiler mode:
"⚡ Browser preview — some features limited" (clickable tooltip explaining limitations)

### Security

- **CDN integrity**: Tailwind CDN script tag uses `crossorigin="anonymous"`. SRI `integrity` hash not available for `cdn.tailwindcss.com` (no stable version pinning), so we rely on HTTPS transport security.
- **esm.sh imports**: Resolved over HTTPS. Import map is built from the project's `package.json` only — no user-supplied URLs pass through unvalidated.
- **`new Function` in capability detection**: Uses only hardcoded string literals (`'return true'`), never user input — safe from injection.

### Dependencies

- `@babel/standalone` — added to `package.json` dependencies
- No other new deps

### Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/capabilities.ts` | **New** | Feature detection |
| `src/lib/transpiler.ts` | **New** | Transpile pipeline |
| `src/components/preview/PreviewFrame.tsx` | **Modify** | Dual-path branching |
| `src/lib/system-prompt.ts` | **Modify** | Fallback-aware instructions |
| `package.json` | **Modify** | Add @babel/standalone |

### Testing

- **Unit tests** for `capabilities.ts`: mock SharedArrayBuffer presence/absence
- **Unit tests** for `transpiler.ts`: transpile TSX, resolve imports, assemble HTML; verify output is valid
- **Integration test**: full pipeline from workspace files to srcdoc string
- Existing 108 tests must continue to pass
