import type { ApiConfig } from '../../../api/types'
import type { Character, PlayerIdentity } from '../types'
import { WorldBooksEditor } from '../WorldBooksEditor'

export function WorldbookTab({
  apiConfig,
  character,
  worldBackgroundPrompt,
  identityContext,
  linkedNpcsContext,
  onChange,
}: {
  apiConfig: ApiConfig | null
  character: Character
  worldBackgroundPrompt: string
  identityContext: PlayerIdentity | null
  linkedNpcsContext: string
  onChange: (next: Character) => void
}) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-neutral-200/90 bg-[#FAFAFA] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="border-b border-neutral-100/90 bg-white/80 px-4 py-4 backdrop-blur-sm">
        <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-neutral-400">05 LORE · 叙事书架</p>
        <h2 className="mt-2 text-[17px] font-semibold tracking-tight text-[#1C1C1E]">世界书</h2>
        <p className="mt-1 text-[11px] font-light text-neutral-500">每卷设定左侧铂金装帧线由下列卡片隐喻呈现。</p>
      </header>
      <div className="persona-worldbook-shelf">
        <WorldBooksEditor
          apiConfig={apiConfig}
          character={character}
          forPlayerIdentity={false}
          worldBackgroundPrompt={worldBackgroundPrompt}
          identityContext={identityContext}
          linkedNpcsContext={linkedNpcsContext}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
