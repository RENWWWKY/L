import type { ClawReactionKey } from '../../types'

/** 抓娃娃机 · 预置伴玩台词（后续可接 LLM 预生成） */
export const CLAW_REACTION_BANK: Record<ClawReactionKey, string[]> = {
  drawPlayerFirst: ['你先抓，我看你怎么操作。', '先手让给你了，别失手。', '你先请，我等着看。'],
  drawCharFirst: ['我先来咯，学着点。', '我先抓一把，给你打个样。', '我先手，你可看好了。'],
  playerGrab: ['这一爪还行。', '落点不错嘛。', '嗯，有点准。'],
  playerMiss: ['偏了偏了。', '空爪… 下次看准点。', '手抖了？'],
  charGrab: ['抓到了，该你了。', '嘿嘿，落袋。', '这个归我。'],
  charMiss: ['失手了…', '这爪子今天不太听话。', '空抓，轮到你了。'],
  playerRare: ['稀有款！运气不错。', '这个分值高，赚大了。', '哇，好货。'],
  charRare: ['这个我要的！', '高分玩偶到手。', '被我抢到了吧。'],
  thinking: ['让我看看抓哪个…', '瞄准中…', '别催，我在算落点。'],
  win: ['我赢啦，下次再来。', '今天手气在我这边。', '承让承让。'],
  lose: ['你赢了… 下把我不放水。', '行吧，这局算你的。', '抓不过你。'],
  draw: ['平分秋色。', '平局，都不亏。', '一样多，和局。'],
  gameStart: ['来，看看谁抓得多。', '娃娃机开动了，各凭本事。', '三回合，比谁战利品多。'],
}

export function pickClawReactionLine(
  key: ClawReactionKey,
  used: Set<string>,
): string | null {
  const pool = CLAW_REACTION_BANK[key]
  if (!pool?.length) return null
  const fresh = pool.filter((l) => !used.has(l))
  const pickFrom = fresh.length > 0 ? fresh : pool
  const line = pickFrom[Math.floor(Math.random() * pickFrom.length)]!
  used.add(line)
  return line
}

export function buildDefaultClawSessionSetup() {
  return {
    difficulty: 3 as const,
    thinkDelayMinMs: 700,
    thinkDelayMaxMs: 2000,
  }
}

export type ClawSessionSetup = ReturnType<typeof buildDefaultClawSessionSetup>
