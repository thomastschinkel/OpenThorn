export type AgentThinkingLevel = 'low' | 'medium' | 'high' | 'extra-high'

export interface AgentThinkingProfile {
  label: string
  shortLabel: string
  description: string
  maxTurns: number
  budgetMultiplier: number
  finalReviewDepth: 'basic' | 'standard' | 'deep'
}

export const DEFAULT_THINKING_LEVEL: AgentThinkingLevel = 'medium'

export const AGENT_THINKING_PROFILES: Record<AgentThinkingLevel, AgentThinkingProfile> = {
  low: {
    label: 'Low',
    shortLabel: 'Low',
    description: 'Faster run with concise planning and essential checks.',
    maxTurns: 16,
    budgetMultiplier: 0.45,
    finalReviewDepth: 'basic',
  },
  medium: {
    label: 'Medium',
    shortLabel: 'Med',
    description: 'Balanced planning, building, and verification.',
    maxTurns: 30,
    budgetMultiplier: 1,
    finalReviewDepth: 'standard',
  },
  high: {
    label: 'High',
    shortLabel: 'High',
    description: 'More deliberate planning with visual and self-review passes.',
    maxTurns: 40,
    budgetMultiplier: 1.45,
    finalReviewDepth: 'deep',
  },
  'extra-high': {
    label: 'Extra High',
    shortLabel: 'XHigh',
    description: 'Maximum planning and verification for complex builds.',
    maxTurns: 55,
    budgetMultiplier: 2,
    finalReviewDepth: 'deep',
  },
}

export function normalizeThinkingLevel(
  level: AgentThinkingLevel | null | undefined,
): AgentThinkingLevel {
  return level && level in AGENT_THINKING_PROFILES ? level : DEFAULT_THINKING_LEVEL
}

