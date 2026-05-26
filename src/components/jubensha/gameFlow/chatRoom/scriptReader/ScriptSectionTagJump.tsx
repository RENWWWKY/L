import { ChevronDown, Lock } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import {
  isScriptSectionUnlocked,
  type JBSStep,
  type ScriptSection,
  type ScriptSectionId,
} from '../jbsFlowTypes'

import { findFirstPageIndexForSection } from './buildScriptPages'
import type { ScriptPage } from './scriptReaderTypes'
import { resolveSectionTag } from './scriptSectionTag'

export type ScriptSectionTagJumpProps = {
  currentPage: ScriptPage
  pages: readonly ScriptPage[]
  sections: readonly ScriptSection[]
  step: JBSStep
  loopRound: number
  onJumpToPage: (pageIndex: number) => void
}

export function ScriptSectionTagJump({
  currentPage,
  pages,
  sections,
  step,
  loopRound,
  onJumpToPage,
}: ScriptSectionTagJumpProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current
      if (!el || el.contains(e.target as Node)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [close, open])

  const pickSection = (sectionId: ScriptSectionId) => {
    if (!isScriptSectionUnlocked(sectionId, step, loopRound)) return
    const idx = findFirstPageIndexForSection(pages, sectionId)
    if (idx < 0) return
    onJumpToPage(idx)
    close()
  }

  return (
    <div ref={wrapRef} className="jbs-script-section-tag-wrap">
      <button
        type="button"
        className="jbs-script-section-tag jbs-script-section-tag--jump jbs-font-serif"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 truncate">{currentPage.sectionTag}</span>
        <ChevronDown
          className={`size-3 shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="跳转至分幕"
          className="jbs-script-section-jump-menu jbs-font-serif"
        >
          <p className="jbs-script-section-jump-menu-title">跳转分幕</p>
          <ul className="jbs-script-section-jump-list">
            {sections.map((section) => {
              const unlocked = isScriptSectionUnlocked(section.id, step, loopRound)
              const tag = resolveSectionTag(section.id, section.title)
              const isCurrent = currentPage.sectionId === section.id
              const pageIdx = findFirstPageIndexForSection(pages, section.id)
              const canJump = unlocked && pageIdx >= 0

              return (
                <li key={section.id} role="option" aria-selected={isCurrent}>
                  <button
                    type="button"
                    disabled={!canJump}
                    className={`jbs-script-section-jump-item${isCurrent ? ' jbs-script-section-jump-item--current' : ''}`}
                    onClick={() => pickSection(section.id)}
                  >
                    <span className="jbs-script-section-jump-item-tag">{tag}</span>
                    <span className="jbs-script-section-jump-item-title">{section.title}</span>
                    {!unlocked ? (
                      <Lock className="size-3 shrink-0 opacity-45" strokeWidth={1.5} aria-hidden />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
