/**
 * Project state — stores generated website files in memory.
 * When the AI generates code, it's stored here and rendered in the preview iframe.
 */

export interface ProjectFile {
  name: string
  content: string
}

export interface ProjectState {
  html: string
  css: string
  js: string
  files: ProjectFile[]
}

let project: ProjectState = {
  html: '',
  css: '',
  js: '',
  files: [],
}

const listeners = new Set<() => void>()

export function getProject(): ProjectState {
  return project
}

export function updateProject(update: Partial<ProjectState>) {
  project = { ...project, ...update }
  listeners.forEach((l) => l())
}

export function setProjectFile(name: string, content: string) {
  const existing = project.files.findIndex((f) => f.name === name)
  if (existing >= 0) {
    project.files[existing].content = content
  } else {
    project.files.push({ name, content })
  }

  if (name.endsWith('.html') || name === 'index.html') project.html = content
  else if (name.endsWith('.css')) project.css = content
  else if (name.endsWith('.js')) project.js = content

  project = { ...project }
  listeners.forEach((l) => l())
}

export function buildPreviewHtml(): string {
  const { html, css, js } = project
  if (!html && !css && !js) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{background:#0b0b0b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;text-align:center;padding:40px}span{font-size:14px;color:rgba(255,255,255,0.3)}</style></head><body><span>Describe what you want to build to get started</span></body></html>`
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css}</style>
</head>
<body>${html}<script>${js}<\/script>
</body>
</html>`
}

export function subscribeToProject(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function parseCodeBlocks(text: string): ProjectFile[] {
  const files: ProjectFile[] = []
  const regex = /```(\w+)?\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const lang = match[1]?.toLowerCase() ?? 'text'
    const content = match[2].trim()
    const nameMap: Record<string, string> = {
      html: 'index.html',
      css: 'styles.css',
      javascript: 'script.js',
      js: 'script.js',
      json: 'package.json',
    }
    files.push({ name: nameMap[lang] ?? `file.${lang}`, content })
  }
  return files
}
