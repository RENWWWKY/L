import { useJBSFlow } from './JBSFlowEngine'

export function MyManuscriptTab() {
  const { manuscript, setManuscript } = useJBSFlow()

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-8 pt-2">
      <p className="jbs-font-serif jbs-gf-text-muted text-center text-[10px] tracking-[0.24em]">
        专属手稿 · 仅本局可见
      </p>
      <textarea
        value={manuscript}
        onChange={(e) => setManuscript(e.target.value)}
        placeholder="在此记录疑点、人物关系与线索推演……"
        className="jbs-gf-chat-manuscript jbs-font-kai-archive mt-4 min-h-[min(420px,55vh)] w-full flex-1 resize-none rounded-lg border-0 px-4 py-3 text-[14px] leading-[2rem] text-[#1a1a1a]/88 outline-none placeholder:text-[#5c3d2e]/35"
        spellCheck={false}
      />
    </div>
  )
}
