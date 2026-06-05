export type AgentThinkingLevel = 'low' | 'medium' | 'high' | 'extra-high'

export interface AgentThinkingProfile {
  label: string
  shortLabel: string
  description: string
  maxTurns: number
  budgetMultiplier: number
}

export const DEFAULT_THINKING_LEVEL: AgentThinkingLevel = 'medium'

export const AGENT_THINKING_PROFILES: Record<AgentThinkingLevel, AgentThinkingProfile> = {
  low: {
    label: 'Low',
    shortLabel: 'Low',
    description: 'Faster run with concise planning and essential checks.',
    maxTurns: 16,
    budgetMultiplier: 0.45,
  },
  medium: {
    label: 'Medium',
    shortLabel: 'Med',
    description: 'Balanced planning, building, and verification.',
    maxTurns: 30,
    budgetMultiplier: 1,
  },
  high: {
    label: 'High',
    shortLabel: 'High',
    description: 'More deliberate planning with extra attention to polish and edge cases.',
    maxTurns: 40,
    budgetMultiplier: 1.45,
  },
  'extra-high': {
    label: 'Extra High',
    shortLabel: 'XHigh',
    description: 'Maximum planning and verification for complex builds.',
    maxTurns: 55,
    budgetMultiplier: 2,
  },
}

export function normalizeThinkingLevel(
  level: AgentThinkingLevel | null | undefined,
): AgentThinkingLevel {
  return level && level in AGENT_THINKING_PROFILES ? level : DEFAULT_THINKING_LEVEL
}

