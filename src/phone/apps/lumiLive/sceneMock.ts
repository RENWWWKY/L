import type { LivePersonaSnapshot } from './livePersonaContext'
import type { LiveRoom, LiveSceneBeat, LiveSceneBeatKind, LiveScenePlayback } from './types'

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const SCENE_TEMPLATES = [
  '半暗室内，台灯只照亮一侧轮廓，画面几乎静止。',
  '镜头拉近，背景虚成柔光，空气里像有未说完的停顿。',
  '窗外夜色压得很低，玻璃上映出淡淡的人影。',
  '画面偏冷，只有领口与指尖的细节更清晰。',
  '连线画面忽然安静下来，像故意留白给你看。',
  '浅焦对准他侧脸，远处的灯成了散开的铂金斑点。',
] as const

const ACTION_TEMPLATES = [
  '他抬眼看向镜头，停了一拍。',
  '指尖在杯沿轻轻摩挲，又松开。',
  '偏过头，像在听你那句字。',
  '呼吸变浅，肩膀微微沉下去。',
  '伸手把镜头角度往下压了半寸。',
  '嘴角几不可察地动了一下，随即收回。',
  '视线移开，又很快落回屏幕。',
] as const

function dialogueFor(
  hostName: string,
  userText: string,
  persona?: LivePersonaSnapshot | null,
): string[] {
  const q = clip(userText, 18)
  // 只用已清洗的短句，绝不拼世界书条目标题
  const attitude = clip(persona?.speakableAttitude ?? '', 22)
  const tone = clip(persona?.speakableTone ?? persona?.toneHint ?? '', 20)
  return [
    `「……${q}？」`,
    `「看见了。别催。」`,
    attitude ? `「……${attitude}。」` : `「你发这个，是想听我说什么。」`,
    tone ? `「嗯。」` : `「嗯。我在。」`,
    `「${hostName}听见了。」`,
    `「先别期待太多。」`,
    `「……行吧。」`,
  ]
}

/**
 * 本地 mock：按设定时长生成画面时间轴（不生图）
 * 人设只作语气底色，不在画面旁白里念出世界书原文
 */
export function buildMockLiveScene(params: {
  room: LiveRoom
  userText: string
  durationMs: number
  recentUserBatch?: string[]
  recentFanBatch?: string[]
  recentHostBatch?: string[]
  persona?: LivePersonaSnapshot | null
}): LiveScenePlayback {
  const durationMs = Math.max(6000, Math.min(60000, Math.round(params.durationMs)))
  const hostName = params.persona?.displayName?.trim() || params.room.hostName
  const userText = params.userText.trim() || '……'
  const dialogues = dialogueFor(hostName, userText, params.persona)
  const userBatch = (params.recentUserBatch ?? []).map((t) => t.trim()).filter(Boolean)
  const fanBatch = (params.recentFanBatch ?? []).map((t) => t.trim()).filter(Boolean)
  const hostBatch = (params.recentHostBatch ?? []).map((t) => t.trim()).filter(Boolean)
  const fanHint = clip(fanBatch[fanBatch.length - 1] ?? '', 14)
  const hostHint = clip(hostBatch[hostBatch.length - 1] ?? '', 14)
  const userJoin = userBatch
    .slice(-3)
    .map((t) => `「${clip(t, 10)}」`)
    .join('、')
  const hostJoin = hostBatch
    .slice(-2)
    .map((t) => `「${clip(t, 10)}」`)
    .join('、')

  const beatCount = Math.max(4, Math.min(10, Math.round(durationMs / 2200)))
  const slot = durationMs / beatCount
  const pattern: LiveSceneBeatKind[] = [
    'scene',
    'action',
    'dialogue',
    'scene',
    'action',
    'dialogue',
    'scene',
    'action',
    'dialogue',
    'scene',
  ]

  const beats: LiveSceneBeat[] = []
  for (let i = 0; i < beatCount; i += 1) {
    const kind = pattern[i % pattern.length]!
    const atMs = Math.round(i * slot)
    const endMs = i === beatCount - 1 ? durationMs : Math.round((i + 1) * slot)
    let text = ''
    if (kind === 'scene') {
      if (i === 0) {
        text = userJoin
          ? `你这批弹幕 ${userJoin} 落下后，${pick(SCENE_TEMPLATES)}`
          : `你说「${clip(userText, 20)}」之后，${pick(SCENE_TEMPLATES)}`
      } else if (hostJoin && i === 3) {
        text = `他上一批刚回过 ${hostJoin}。${pick(SCENE_TEMPLATES)}`
      } else if (fanHint && i === 5) {
        text = `弹幕上一批还停在「${fanHint}」。${pick(SCENE_TEMPLATES)}`
      } else {
        text = pick(SCENE_TEMPLATES)
      }
    } else if (kind === 'action') {
      text =
        fanHint && i % 3 === 1
          ? `像在扫过上一批弹幕里「${fanHint}」那一行，${pick(ACTION_TEMPLATES)}`
          : hostHint && i % 3 === 2
            ? `想起自己上一批说过的「${hostHint}」，${pick(ACTION_TEMPLATES)}`
            : pick(ACTION_TEMPLATES)
    } else {
      text = pick(dialogues)
    }
    beats.push({
      id: uid(`beat-${i}`),
      kind,
      atMs,
      endMs,
      text,
    })
  }

  return {
    id: uid('scene'),
    triggerText: userText,
    hostName,
    durationMs,
    beats,
  }
}

export function resolveBeatAt(scene: LiveScenePlayback, progressMs: number): LiveSceneBeat | null {
  if (!scene.beats.length) return null
  const t = Math.max(0, Math.min(scene.durationMs, progressMs))
  for (const beat of scene.beats) {
    if (t >= beat.atMs && t < beat.endMs) return beat
  }
  return scene.beats[scene.beats.length - 1] ?? null
}

export function formatSceneClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
