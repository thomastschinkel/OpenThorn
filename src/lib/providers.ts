import { supabase } from './supabase'

export interface ProviderPreset {
  provider_key: string
  display_name: string
  icon_color: string
  base_url: string
  models: string[]
  docs_url: string | null
}

export interface ProviderConfig {
  id: string
  label: string
  provider_key: string
  api_key: string
  base_url: string | null
  default_model: string | null
  enabled_models: string[]
  is_custom: boolean
  created_at: string
  updated_at: string
  last_tested: string | null
}

export async function fetchPresets(): Promise<ProviderPreset[]> {
  const { data, error } = await supabase
    .from('provider_presets')
    .select('*')
    .order('display_name')
  if (error) throw error
  return data
}

export async function fetchProviders(): Promise<ProviderConfig[]> {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createProvider(p: {
  label: string
  provider_key: string
  api_key: string
  base_url?: string | null
  default_model?: string | null
  enabled_models?: string[]
  is_custom?: boolean
}): Promise<ProviderConfig> {
  const { data, error } = await supabase
    .from('providers')
    .insert({
      label: p.label,
      provider_key: p.provider_key,
      api_key: p.api_key,
      base_url: p.base_url ?? null,
      default_model: p.default_model ?? null,
      enabled_models: p.enabled_models ?? [],
      is_custom: p.is_custom ?? false,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProvider(
  id: string,
  p: Partial<{
    label: string
    api_key: string
    base_url: string | null
    default_model: string | null
    enabled_models: string[]
  }>
): Promise<void> {
  const { error } = await supabase
    .from('providers')
    .update({ ...p, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteProvider(id: string): Promise<void> {
  const { error } = await supabase.from('providers').delete().eq('id', id)
  if (error) throw error
}

export async function testProviderConnection(
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) return { ok: true, message: 'Connection successful' }
    const err = await res.json().catch(() => ({}))
    return { ok: false, message: (err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}
