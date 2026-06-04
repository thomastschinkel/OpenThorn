/**
 * Visual Review (the agent's "eyes").
 *
 * ## Why this exists
 *
 * The agent only ever knew whether #root rendered without throwing. It never
 * SAW the result — so white-on-white text, broken mobile layouts, overlapping
 * elements, and generic-template ugliness all sailed past. This module closes
 * the code→pixels loop: screenshots of the built app are sent to a vision model
 * with the original request, and the critique is fed back so the agent can fix
 * visible defects before finishing.
 *
 * This file is deliberately provider-agnostic and pure: it builds the review
 * prompt and parses the verdict. The actual multimodal model call lives in
 * agent.ts, which owns provider plumbing.
 */

import type { CapturedView } from './preview-screenshot'

export interface VisualReviewVerdict {
  /** 'pass' = ship it; 'revise' = visible defects must be fixed. */
  verdict: 'pass' | 'revise'
  /** Subjective design quality 1–10 (best effort parse; 0 if absent). */
  score: number
  /** Concrete, actionable visual defects to fix. */
  issues: string[]
  /** The raw model text, for logging / display. */
  raw: string
}

/** Image block in our internal message representation. */
export interface VisionImage {
  base64: string
  mediaType: 'image/png'
  label: string
}

/**
 * System instruction for the visual reviewer. Soft, specific, and biased toward
 * catching the failure modes screenshots are uniquely good at.
 */
export const VISUAL_REVIEW_SYSTEM = `You are a meticulous senior product designer reviewing screenshots of a web app a developer just built. You are given the user's original request and one or more screenshots (desktop and/or mobile).

Judge ONLY what you can see. Look hard for:
- Text that is unreadable (low contrast, white-on-white, clipped, overflowing).
- Broken or cramped layout, overlapping elements, content touching screen edges.
- Mobile view that is clearly broken (horizontal scroll, squished, unusable).
- Generic-template feel: unstyled plain text column, default blue links, no hierarchy, no spacing rhythm.
- Missing obvious requested sections/elements.
- Empty or nearly-empty pages where content was expected.

Be fair: if it looks genuinely polished and matches the request, pass it. Do not invent problems.

Respond in EXACTLY this format:
VERDICT: pass OR revise
SCORE: <integer 1-10>
ISSUES:
- <one concrete, fixable visual problem>
- <another>
(If verdict is pass, write "ISSUES:" followed by "- none".)`

/**
 * Build the user-facing review prompt text (the images are attached separately
 * by the caller as multimodal blocks).
 */
export function buildVisualReviewPrompt(goal: string, views: CapturedView[]): string {
  const shots = views.map((v) => `${v.label} (${v.width}px)`).join(', ')
  return [
    `Original request: "${goal.trim()}"`,
    '',
    `Attached screenshot(s): ${shots || 'none'}.`,
    'Review the design against the request and report your verdict in the required format.',
  ].join('\n')
}

/** Convert captured views into vision image blocks for the model call. */
export function viewsToVisionImages(views: CapturedView[]): VisionImage[] {
  return views.map((v) => ({ base64: v.base64, mediaType: v.mediaType, label: v.label }))
}

/**
 * Parse the reviewer's freeform response into a structured verdict. Tolerant of
 * formatting drift: defaults to 'pass' only when it clearly says pass, otherwise
 * leans toward 'revise' when concrete issues are present.
 */
export function parseVisualReview(raw: string): VisualReviewVerdict {
  const text = (raw || '').trim()

  // Verdict
  const verdictMatch = text.match(/verdict\s*:\s*(pass|revise|fail|approve|approved)/i)
  let verdict: 'pass' | 'revise' = 'pass'
  if (verdictMatch) {
    const v = verdictMatch[1].toLowerCase()
    verdict = v === 'revise' || v === 'fail' ? 'revise' : 'pass'
  }

  // Score
  let score = 0
  const scoreMatch = text.match(/score\s*:\s*(\d{1,2})/i)
  if (scoreMatch) score = Math.min(10, Math.max(0, Number(scoreMatch[1])))

  // Issues: lines under an ISSUES: header, or any bullet lines.
  const issues: string[] = []
  const issuesSection = text.split(/issues\s*:/i)[1] ?? ''
  for (const line of issuesSection.split('\n')) {
    const m = line.match(/^\s*[-*•]\s*(.+)$/)
    if (m) {
      const item = m[1].trim()
      if (item && !/^none\b/i.test(item)) issues.push(item)
    }
  }

  // Safety nets: if it said revise but gave no issues, keep a generic note;
  // if it listed real issues but the verdict parsed as pass, trust the issues.
  if (verdict === 'revise' && issues.length === 0) {
    issues.push('The reviewer flagged the design for revision but listed no specifics — re-examine readability, spacing, and the mobile layout.')
  }
  if (verdict === 'pass' && issues.length > 0 && score > 0 && score < 6) {
    verdict = 'revise'
  }

  return { verdict, score, issues, raw: text }
}

/** Format the verdict as agent-readable feedback for a revision turn. */
export function formatVisualFeedback(v: VisualReviewVerdict): string {
  const lines = [
    '## Visual review found problems (from screenshots of your app)',
    v.score > 0 ? `Design score: ${v.score}/10` : '',
    '',
    'Fix these visible issues, then compile and finish again:',
  ].filter(Boolean)
  v.issues.forEach((issue, i) => lines.push(`  ${i + 1}. ${issue}`))
  lines.push(
    '',
    'These came from actually looking at the rendered output — trust them over your assumptions about how the CSS should look.',
  )
  return lines.join('\n')
}
