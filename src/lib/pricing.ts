export interface ModelPricing {
  inputPer1M: number
  outputPer1M: number
  cacheReadPer1M?: number
  cacheWritePer1M?: number
  verifiedAt: string
  sourceUrl: string
}

export interface ProviderData {
  [modelId: string]: ModelPricing
}

export interface PricingTable {
  $schema: string
  versionedAt: string
  anthropic: ProviderData
  openai: ProviderData
  gemini: ProviderData
  deepseek: ProviderData
  perplexity: ProviderData
}

const PRICING_URL = 'https://raw.githubusercontent.com/mannism/dlabs-toolkit/main/pricing/table.json'

let cached: PricingTable | null = null
let lastFetch = 0
const TTL = 3600000 // 1 hour

export async function fetchPricing(): Promise<PricingTable> {
  if (cached && Date.now() - lastFetch < TTL) return cached

  const res = await fetch(PRICING_URL)
  if (!res.ok) throw new Error(`Failed to fetch pricing: ${res.status}`)
  cached = await res.json()
  lastFetch = Date.now()
  return cached!
}

export function getModelDisplayName(id: string): string {
  return id
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Gpt/g, 'GPT')
    .replace(/Claude/g, 'Claude')
    .replace(/Gemini/g, 'Gemini')
    .replace(/Deepseek/g, 'DeepSeek')
    .replace(/Sonar/g, 'Sonar')
}

export function getProviderLabel(providerKey: string): string {
  const labels: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    gemini: 'Google',
    deepseek: 'DeepSeek',
    perplexity: 'Perplexity',
  }
  return labels[providerKey] || providerKey
}

export function pickBestValueModel(data: PricingTable): {
  provider: string
  id: string
  name: string
  input: number
  output: number
  label: string
}[] {
  const picks: { provider: string; id: string; input: number; output: number }[] = []

  for (const [providerKey, models] of Object.entries(data)) {
    if (providerKey === '$schema' || providerKey === 'versionedAt') continue
    const entries = Object.entries(models as ProviderData)
      .filter(([id]) => !id.includes('deprecated'))
      .map(([id, m]) => ({
        id,
        input: m.inputPer1M,
        output: m.outputPer1M,
        avg: (m.inputPer1M + m.outputPer1M) / 2,
      }))

    // Pick the cheapest model for each provider
    const cheapest = entries.sort((a, b) => a.avg - b.avg)[0]
    if (cheapest) {
      picks.push({
        provider: providerKey,
        ...cheapest,
      })
    }
  }

  return picks
    .sort((a, b) => a.output - b.output)
    .map((p) => ({
      ...p,
      name: getModelDisplayName(p.id),
      label: `$${p.input.toFixed(2)} / $${p.output.toFixed(2)} / MTok`,
    }))
}

export function getTopModels(data: PricingTable): {
  id: string
  provider: string
  name: string
  input: number
  output: number
}[] {
  const all: { id: string; provider: string; input: number; output: number }[] = []

  for (const [providerKey, models] of Object.entries(data)) {
    if (providerKey === '$schema' || providerKey === 'versionedAt') continue
    for (const [id, m] of Object.entries(models as ProviderData)) {
      if (id.includes('deprecated')) continue
      all.push({ id, provider: providerKey, input: m.inputPer1M, output: m.outputPer1M })
    }
  }

  // Sort by output cost, return top 12
  return all
    .sort((a, b) => a.output - b.output)
    .slice(0, 12)
    .map((m) => ({ ...m, name: getModelDisplayName(m.id) }))
}
