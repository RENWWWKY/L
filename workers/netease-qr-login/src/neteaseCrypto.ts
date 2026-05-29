/** 网易云 weapi 加密（Web Crypto + BigInt，适配 Cloudflare Workers） */

const PRESET_KEY = '0CoJUm6Qyw8W8jud'
const IV = new TextEncoder().encode('0102030405060708')
const PUBLIC_KEY = '010001'
const MODULUS =
  '00e0b90f8ece75da7eac459fb7400b1ad15176ec011ba428da0ed6f4f64fc90dc27f274e45de5dadc0141e0fa561eb860a5a9f875a4ce80142d5228eaeb9220e2fe580e90d85675eabc546a2ab9fdeee1fba95f9df78ce5c9e93b977454fdc48691977fa469c310ca7d'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

async function aesEncryptToBase64(plainText: string, secKey: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secKey),
    { name: 'AES-CBC', length: 128 },
    false,
    ['encrypt'],
  )
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: IV },
    cryptoKey,
    new TextEncoder().encode(plainText),
  )
  return bytesToBase64(new Uint8Array(encrypted))
}

function rsaEncrypt(text: string): string {
  const reversed = text.split('').reverse().join('')
  const bytes = new TextEncoder().encode(reversed)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  const biText = BigInt(`0x${hex}`)
  const biEx = BigInt(`0x${PUBLIC_KEY}`)
  const biMod = BigInt(`0x${MODULUS}`)
  let result = 1n
  let base = biText % biMod
  let exp = biEx
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % biMod
    exp /= 2n
    base = (base * base) % biMod
  }
  return result.toString(16).padStart(256, '0')
}

function randomSecretKey(len = 16): string {
  const pool =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const rnd = new Uint8Array(len)
  crypto.getRandomValues(rnd)
  let out = ''
  for (let i = 0; i < len; i += 1) out += pool[rnd[i]! % pool.length]!
  return out
}

export async function encryptWeapi(data: Record<string, unknown>) {
  const text = JSON.stringify(data)
  const secretKey = randomSecretKey(16)
  const params = await aesEncryptToBase64(
    await aesEncryptToBase64(text, PRESET_KEY),
    secretKey,
  )
  const encSecKey = rsaEncrypt(secretKey)
  return { params, encSecKey }
}
