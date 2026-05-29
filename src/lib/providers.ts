/**
 * Provider Configuration — Data Layer
 *
 * SECURITY NOTE: API keys are stored in Supabase with RLS enabled.
 * In production, upgrade RLS from `FOR ALL USING (true)` to require
 * authenticated users (auth.uid()). Consider encrypting keys with
 * pgcrypto or Supabase Vault for sensitive deployments.
 */
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

function validateBaseUrl(url: string): { ok: true; normalized: string } | { ok: false; message: string } {
  let parsed: URL
  try { parsed = new URL(url.endsWith('/') ? url : url + '/') } catch { return { ok: false, message: 'Invalid URL format' } }

  const hostname = parsed.hostname.toLowerCase()

  // Block local / internal addresses (SSRF prevention)
  const blocked = [
    'localhost', '127.0.0.1', '0.0.0.0', '[::1]', '[::]',
    '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16',
    'metadata.google.internal', 'metadata',
  ]

  if (blocked.some((b) => hostname === b || hostname.startsWith(b.replace('/8', '').replace('/12', '').replace('/16', '').split('.')[0] + '.')))) {
    // Check private ranges precisely
    const ipParts = hostname.split('.').map(Number)
    if (ipParts.length === 4 && !ipParts.some(isNaN)) {
      if (ipParts[0] === 10) return { ok: false, message: 'Private network URLs are not allowed' }
      if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) return { ok: false, message: 'Private network URLs are not allowed' }
      if (ipParts[0] === 192 && ipParts[1] === 168) return { ok: false, message: 'Private network URLs are not allowed' }
      if (ipParts[0] === 127) return { ok: false, message: 'Loopback URLs are not allowed' }
      if (ipParts[0] === 169 && ipParts[1] === 254) return { ok: false, message: 'Link-local URLs are not allowed' }
    }
    if (hostname === 'localhost' || hostname === 'metadata.google.internal') {
      return { ok: false, message: 'Internal hostnames are not allowed' }
    }
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    return { ok: false, message: 'Only HTTP and HTTPS URLs are supported' }
  }

  return { ok: true, normalized: parsed.origin }
}

export async function testProviderConnection(
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<{ ok: boolean; message: string }> {
  // Validate URL before making any request
  const validated = validateBaseUrl(baseUrl)
  if (!validated.ok) return validated

  try {
    const res = await fetch(`${validated.normalized}/chat/completions`, {
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
