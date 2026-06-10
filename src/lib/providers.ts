export interface ProviderModel {
  name: string
  id: string
}

export type ProviderApiFormat =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'azure-openai'
  | 'bedrock'

export interface ProviderDef {
  id: string
  name: string
  baseUrl: string
  color: string
  logo: string
  apiFormat: ProviderApiFormat
  modelListPath?: string
  syncModels?: boolean
  testable: boolean
  testNote?: string
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    color: '#74AA9C',
    logo: '/assets/openai.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    color: '#D4A574',
    logo: '/assets/anthropic.png',
    apiFormat: 'anthropic',
    testable: true,
  },
  {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    color: '#4285F4',
    logo: '/assets/google.png',
    apiFormat: 'gemini',
    testable: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    color: '#4D6BFE',
    logo: '/assets/deepseek.webp',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    color: '#F59E0B',
    logo: '/assets/mistralai.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    color: '#F97316',
    logo: '/assets/groq.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    color: '#6366F1',
    logo: '/assets/togetherai.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'xai',
    name: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    color: '#E5E7EB',
    logo: '/assets/xai.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'cohere',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    color: '#39D353',
    logo: '/assets/cohere.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    color: '#20B2AA',
    logo: '/assets/perplexity.png',
    apiFormat: 'openai',
    modelListPath: '/v1/models',
    syncModels: false,
    testable: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    color: '#6B46C1',
    logo: '/assets/openrouter.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    color: '#374151',
    logo: '/assets/ollama.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    color: '#EF4444',
    logo: '/assets/fireworks.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    color: '#F59E0B',
    logo: '/assets/celebras.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    baseUrl: 'https://YOUR_RESOURCE.openai.azure.com/openai/v1',
    color: '#0078D4',
    logo: '/assets/azure.png',
    apiFormat: 'azure-openai',
    testable: true,
  },
  {
    id: 'bedrock',
    name: 'Amazon Bedrock',
    baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    color: '#FF9900',
    logo: '/assets/bedrock.png',
    apiFormat: 'bedrock',
    testable: false,
    testNote: 'Bedrock uses the AWS runtime/Converse API and cannot be tested through the generic browser model-list endpoint.',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    color: '#76B900',
    logo: '/assets/nvidia.png',
    apiFormat: 'openai',
    testable: true,
  },
]

export const PROVIDER_DEFS = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, provider]),
) as Record<string, ProviderDef>

export const LOGO_MAP = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, provider.logo]),
) as Record<string, string>

export const DEFAULT_BASE_URLS = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, provider.baseUrl]),
) as Record<string, string>

export const DEFAULT_PROVIDER_MODELS: Record<string, ProviderModel[]> = {
  openai: [
    { name: 'GPT-5.5', id: 'gpt-5.5' },
    { name: 'GPT-5.4', id: 'gpt-5.4' },
    { name: 'GPT-5.4 mini', id: 'gpt-5.4-mini' },
  ],
  anthropic: [
    { name: 'Claude Fable 5', id: 'claude-fable-5' },
    { name: 'Claude Opus 4.8', id: 'claude-opus-4-8' },
    { name: 'Claude Sonnet 4.6', id: 'claude-sonnet-4-6' },
    { name: 'Claude Haiku 4.5', id: 'claude-haiku-4-5-20251001' },
  ],
  google: [
    { name: 'Gemini 3.5 Flash', id: 'gemini-3.5-flash' },
    { name: 'Gemini 2.5 Pro', id: 'gemini-2.5-pro' },
    { name: 'Gemini 2.5 Flash', id: 'gemini-2.5-flash' },
    { name: 'Gemini 2.5 Flash-Lite', id: 'gemini-2.5-flash-lite' },
  ],
  deepseek: [
    { name: 'DeepSeek Chat', id: 'deepseek-chat' },
    { name: 'DeepSeek Reasoner', id: 'deepseek-reasoner' },
  ],
  mistral: [
    { name: 'Mistral Large', id: 'mistral-large-latest' },
    { name: 'Mistral Medium', id: 'mistral-medium-latest' },
    { name: 'Codestral', id: 'codestral-latest' },
  ],
  groq: [
    { name: 'GPT OSS 120B', id: 'openai/gpt-oss-120b' },
    { name: 'GPT OSS 20B', id: 'openai/gpt-oss-20b' },
    { name: 'Llama 3.3 70B Versatile', id: 'llama-3.3-70b-versatile' },
  ],
  together: [
    { name: 'Qwen3 Coder 480B', id: 'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8' },
    { name: 'DeepSeek V3.1', id: 'deepseek-ai/DeepSeek-V3.1' },
    { name: 'Llama 3.3 70B Turbo', id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  ],
  xai: [
    { name: 'Grok 4.3', id: 'grok-4.3' },
    { name: 'Grok 4.20 Reasoning', id: 'grok-4.20-reasoning' },
  ],
  cohere: [
    { name: 'Command A+', id: 'command-a-plus-05-2026' },
    { name: 'Command A', id: 'command-a-03-2025' },
    { name: 'Command R+', id: 'command-r-plus' },
  ],
  perplexity: [
    { name: 'Sonar Pro', id: 'sonar-pro' },
    { name: 'Sonar', id: 'sonar' },
    { name: 'Sonar Reasoning Pro', id: 'sonar-reasoning-pro' },
    { name: 'Sonar Deep Research', id: 'sonar-deep-research' },
  ],
  openrouter: [
    { name: 'Claude Opus 4.8', id: 'anthropic/claude-opus-4.8' },
    { name: 'GPT-5.5', id: 'openai/gpt-5.5' },
    { name: 'Gemini 3.5 Flash', id: 'google/gemini-3.5-flash' },
  ],
  ollama: [
    { name: 'Llama 3.2', id: 'llama3.2' },
    { name: 'Mistral', id: 'mistral' },
    { name: 'Qwen 2.5 Coder', id: 'qwen2.5-coder' },
  ],
  fireworks: [
    { name: 'DeepSeek V3', id: 'accounts/fireworks/models/deepseek-v3' },
    { name: 'Llama 3.3 70B Instruct', id: 'accounts/fireworks/models/llama-v3p3-70b-instruct' },
    { name: 'Qwen3 235B A22B', id: 'accounts/fireworks/models/qwen3-235b-a22b' },
  ],
  cerebras: [
    { name: 'GLM 4.7', id: 'zai-glm-4.7' },
    { name: 'GPT OSS 120B', id: 'gpt-oss-120b' },
    { name: 'Llama 3.3 70B', id: 'llama3.3-70b' },
  ],
  azure: [
    { name: 'Deployment name', id: 'YOUR_DEPLOYMENT_NAME' },
  ],
  bedrock: [
    { name: 'Claude Opus 4.8', id: 'anthropic.claude-opus-4-8-v1:0' },
    { name: 'Claude Sonnet 4.6', id: 'anthropic.claude-sonnet-4-6-v1:0' },
  ],
  nvidia: [
    { name: 'DeepSeek R1', id: 'deepseek-ai/deepseek-r1' },
    { name: 'Llama 3.1 Nemotron Ultra 253B', id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1' },
  ],
}

export function parseProviderModels(raw: string | null | undefined): ProviderModel[] {
  return (raw ?? '')
    .split(',')
    .map((item) => {
      const [name, id] = item.split('|').map((part) => part.trim())
      return { name: name || id || '', id: id || name || '' }
    })
    .filter((model) => model.id.length > 0)
}

export function serializeProviderModels(models: ProviderModel[]): string {
  return models.map((model) => `${model.name}|${model.id}`).join(', ')
}

export function providerModelsFor(providerId: string): ProviderModel[] {
  return DEFAULT_PROVIDER_MODELS[providerId] ?? []
}
