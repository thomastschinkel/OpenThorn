export interface BenchmarkEntry {
  model: string
  score: number
  provider: string
}

const HF_API = 'https://huggingface.co/api/datasets/SWE-bench/SWE-bench_Verified/leaderboard'

let cachedBenchmarks: BenchmarkEntry[] | null = null
let lastBenchFetch = 0
const BENCH_TTL = 3600000

const providerMap: Record<string, string> = {
  anthropic: 'Anthropic',
  claude: 'Anthropic',
  openai: 'OpenAI',
  gpt: 'OpenAI',
  google: 'Google',
  gemini: 'Google',
  deepseek: 'DeepSeek',
  meta: 'Meta',
  llama: 'Meta',
  mistral: 'Mistral',
  qwen: 'Alibaba',
  alibaba: 'Alibaba',
}

function guessProvider(modelId: string): string {
  const lower = modelId.toLowerCase()
  for (const [key, label] of Object.entries(providerMap)) {
    if (lower.includes(key)) return label
  }
  return 'Other'
}

function cleanModelName(raw: string): string {
  return raw
    .replace(/^.*\//, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Gpt/g, 'GPT')
    .replace(/Claude/g, 'Claude')
    .replace(/Gemini/g, 'Gemini')
    .replace(/Deepseek/g, 'DeepSeek')
    .replace(/Qwen/g, 'Qwen')
    .replace(/Llama/g, 'Llama')
    .replace(/Mistral/g, 'Mistral')
}

export async function fetchBenchmarks(): Promise<BenchmarkEntry[]> {
  if (cachedBenchmarks && Date.now() - lastBenchFetch < BENCH_TTL) return cachedBenchmarks

  const res = await fetch(HF_API)
  if (!res.ok) {
    if (cachedBenchmarks) return cachedBenchmarks
    throw new Error(`Benchmark fetch failed: ${res.status}`)
  }

  const json = await res.json()
  const entries: BenchmarkEntry[] = (json.leaderboard || json || [])
    .filter((e: { model_id?: string; value?: number }) => e.model_id && typeof e.value === 'number')
    .map((e: { model_id: string; value: number }) => ({
      model: cleanModelName(e.model_id),
      score: Math.round(e.value * 100) / 100,
      provider: guessProvider(e.model_id),
    }))

  cachedBenchmarks = entries
  lastBenchFetch = Date.now()
  return entries
}
