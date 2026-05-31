export interface BenchmarkEntry {
  model: string
  provider: string
  sweScore: number
  outputCost: number
}

// Curated from SWE-bench verified reports, research papers, and official API pricing.
// Updated: May 2026
const curated: BenchmarkEntry[] = [
  { model: 'DeepSeek V4 Pro', provider: 'DeepSeek', sweScore: 80.6, outputCost: 0.87 },
  { model: 'DeepSeek V4 Flash', provider: 'DeepSeek', sweScore: 79.0, outputCost: 0.28 },
  { model: 'Claude Opus 4.7', provider: 'Anthropic', sweScore: 87.6, outputCost: 25.0 },
  { model: 'Claude Sonnet 4.6', provider: 'Anthropic', sweScore: 82.0, outputCost: 15.0 },
  { model: 'Claude Haiku 4.5', provider: 'Anthropic', sweScore: 72.0, outputCost: 5.0 },
  { model: 'GPT-5.5', provider: 'OpenAI', sweScore: 88.7, outputCost: 30.0 },
  { model: 'GPT-4.1', provider: 'OpenAI', sweScore: 76.0, outputCost: 8.0 },
  { model: 'Gemini 2.5 Pro', provider: 'Google', sweScore: 75.0, outputCost: 10.0 },
  { model: 'Gemini 2.5 Flash', provider: 'Google', sweScore: 68.0, outputCost: 2.5 },
  { model: 'Mistral Medium 3.5', provider: 'Mistral', sweScore: 77.6, outputCost: 3.0 },
  { model: 'Qwen 3.6 27B', provider: 'Alibaba', sweScore: 77.2, outputCost: 0.35 },
  { model: 'Kimi K2.6', provider: 'Moonshot', sweScore: 80.2, outputCost: 1.5 },
]

// Also try live HF for additional models
const HF_API = 'https://huggingface.co/api/datasets/SWE-bench/SWE-bench_Verified/leaderboard'

export async function fetchBenchmarks(): Promise<BenchmarkEntry[]> {
  // Return curated data immediately
  const results = [...curated]

  // Try to supplement with live HF data
  try {
    const res = await fetch(HF_API)
    if (res.ok) {
      const json = await res.json()
      const entries: { modelId: string; value: number }[] = Array.isArray(json) ? json : []

      const seen = new Set(results.map((r) => r.model.toLowerCase()))
      for (const e of entries) {
        if (!e.modelId || typeof e.value !== 'number') continue
        const name = e.modelId.replace(/^.*\//, '').replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .replace(/Gpt/g, 'GPT').replace(/Claude/g, 'Claude')
          .replace(/Gemini/g, 'Gemini').replace(/Deepseek/g, 'DeepSeek')
          .replace(/Qwen/g, 'Qwen').replace(/Mistral/g, 'Mistral')
          .replace(/Kimi/g, 'Kimi').replace(/Glm/g, 'GLM')
        if (seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())
        results.push({
          model: name,
          provider: guessProvider(e.modelId),
          sweScore: Math.round(e.value * 10) / 10,
          outputCost: 0, // unknown, won't show on chart
        })
      }
    }
  } catch {
    // fine, use curated only
  }

  return results
}

function guessProvider(modelId: string): string {
  const m = modelId.toLowerCase()
  if (m.includes('anthropic') || m.includes('claude')) return 'Anthropic'
  if (m.includes('openai') || m.includes('gpt')) return 'OpenAI'
  if (m.includes('google') || m.includes('gemini')) return 'Google'
  if (m.includes('deepseek')) return 'DeepSeek'
  if (m.includes('mistral')) return 'Mistral'
  if (m.includes('qwen') || m.includes('alibaba')) return 'Alibaba'
  if (m.includes('meta') || m.includes('llama')) return 'Meta'
  if (m.includes('kimi') || m.includes('moonshot')) return 'Moonshot'
  if (m.includes('glm') || m.includes('zai-org')) return 'Zhipu'
  if (m.includes('minimax')) return 'MiniMax'
  return 'Other'
}
