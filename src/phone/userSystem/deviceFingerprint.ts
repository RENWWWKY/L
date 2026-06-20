/**
 * 浏览器内设备标识（localStorage，各浏览器独立）
 * - 用于后台溯源、同浏览器防多账号
 * - 不能当作「手机硬件 ID」：Safari/Chrome 数据隔离，纯网页无法读取真机序列号
 * - 跨浏览器「一机一号」靠注册时的公网 IP 校验（见 Worker API）
 */
const LEGACY_KEY = 'lc_device_fingerprint_v1'
const MACHINE_KEY = 'us_machine_id_v2'

function detectDeviceType(): 'mobile' | 'desktop' {
  const ua = navigator.userAgent || ''
  if (/Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return 'mobile'
  }
  return 'desktop'
}

function createMachineId(): string {
  if (crypto.randomUUID) return `mach_${crypto.randomUUID().replace(/-/g, '')}`
  return `mach_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

export async function getDeviceFingerprint(): Promise<{ deviceId: string; deviceType: 'mobile' | 'desktop' }> {
  const deviceType = detectDeviceType()
  try {
    const raw = localStorage.getItem(MACHINE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { machineId?: string; deviceType?: string }
      if (parsed.machineId) {
        return { deviceId: parsed.machineId, deviceType: (parsed.deviceType as 'mobile' | 'desktop') || deviceType }
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const leg = JSON.parse(legacy) as { deviceId?: string; deviceType?: string }
      if (leg.deviceId) return { deviceId: leg.deviceId, deviceType: (leg.deviceType as 'mobile' | 'desktop') || deviceType }
    }
  } catch {
    /* ignore */
  }
  const machineId = createMachineId()
  try {
    localStorage.setItem(MACHINE_KEY, JSON.stringify({ machineId, deviceType }))
  } catch {
    /* ignore */
  }
  return { deviceId: machineId, deviceType }
}

export async function getPublicIp(): Promise<string> {
  const apis = [
    { url: 'https://api.ipify.org?format=json', pick: (d: { ip?: string }) => d.ip },
    { url: 'https://api.ip.sb/json', pick: (d: { ip?: string }) => d.ip },
  ]
  for (const api of apis) {
    try {
      const res = await fetch(api.url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const data = (await res.json()) as { ip?: string }
      const ip = api.pick(data)
      if (ip) return ip.trim()
    } catch {
      /* try next */
    }
  }
  return 'unknown'
}
