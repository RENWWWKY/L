import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = path.join(root, '剧本杀', '《雨夜归零》', '公开讨论1')

const SCENES = {
  沈知意: ['陆景川', '苏晚晴', '程予安', '陆景川', '苏晚晴', '程予安'],
  陆景川: ['沈知意', '苏晚晴', '程予安', '沈知意', '苏晚晴', '程予安'],
  苏晚晴: ['程予安', '陆景川', '沈知意', '程予安', '陆景川', '沈知意'],
  程予安: ['陆景川', '苏晚晴', '沈知意', '陆景川', '苏晚晴', '陆景川'],
}

function resolveFilename(speakers, lineIndex, speaker) {
  let occurrence = 0
  for (let i = 0; i <= lineIndex; i += 1) {
    if (speakers[i] === speaker) occurrence += 1
  }
  const candidates = []
  if (occurrence <= 1) {
    candidates.push(`${speaker}.wav`, `${speaker}1.wav`)
  } else {
    candidates.push(`${speaker}${occurrence}.wav`)
  }
  return candidates
}

let missing = 0
for (const [player, speakers] of Object.entries(SCENES)) {
  const dir = path.join(base, `玩家${player}`)
  const files = new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.wav')))
  console.log(`\n玩家${player}:`)
  speakers.forEach((speaker, index) => {
    const candidates = resolveFilename(speakers, index, speaker)
    const hit = candidates.find((c) => files.has(c))
    if (hit) console.log(`  ${index + 1}. ${speaker} -> ${hit}`)
    else {
      console.log(`  ${index + 1}. ${speaker} -> 缺失 (${candidates.join(' / ')})`)
      missing += 1
    }
  })
}
console.log(missing ? `\n共缺 ${missing} 个文件` : '\n全部匹配')
process.exit(missing ? 1 : 0)
