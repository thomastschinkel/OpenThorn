const SALT = 'openthorn-v1-key-encryption'

async function deriveKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(userId), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function encryptApiKey(plaintext: string, userId: string): Promise<string> {
  const key = await deriveKey(userId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  const ivHex = Array.from(iv, b => b.toString(16).padStart(2, '0')).join('')
  return `enc:${ivHex}:${bytesToBase64(new Uint8Array(ciphertext))}`
}

export async function decryptApiKey(stored: string, userId: string): Promise<string> {
  if (!stored.startsWith('enc:')) return stored
  const firstColon = stored.indexOf(':', 4)
  const ivHex = stored.slice(4, firstColon)
  const ctBase64 = stored.slice(firstColon + 1)
  const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const ct = base64ToBytes(ctBase64)
  const key = await deriveKey(userId)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(plain)
}
