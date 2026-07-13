import { motion } from 'framer-motion'
import { MapPin, X } from 'lucide-react'

import { Pressable } from '../../../../components/Pressable'
import { PULSE_SHEET_SPRING } from '../../constants'

export const PULSE_PUBLISH_LOCATIONS = [
  '上海 · 外滩滨江',
  '北京 · 三里屯',
  '杭州 · 西湖畔',
  '成都 · 宽窄巷子',
  '深圳 · 湾畔步道',
  '广州 · 珠江新城',
  '南京 · 梧桐大道',
  '苏州 · 平江路',
  '重庆 · 洪崖洞',
  '西安 · 城墙根',
] as const

export function PublishLocationSheet({
  selected,
  onPick,
  onClear,
  onClose,
}: {
  selected?: string
  onPick: (label: string) => void
  onClear: () => void
  onClose: () => void
}) {
  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1270] bg-black/20 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label="关闭"
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[1280] max-h-[58vh] overflow-hidden rounded-t-[28px] bg-white/95 shadow-[0_-12px_48px_rgba(0,0,0,0.08)] backdrop-blur-xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_SHEET_SPRING}
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <p className="text-[13px] font-medium text-[#1C1C1E]">添加位置</p>
          <Pressable type="button" onClick={onClose} className="text-neutral-400" aria-label="关闭">
            <X className="size-5" strokeWidth={1.5} />
          </Pressable>
        </div>
        <div className="max-h-[44vh] overflow-y-auto px-4 pb-4">
          {selected ? (
            <Pressable
              type="button"
              onClick={onClear}
              className="mb-3 w-full rounded-2xl bg-[#F5F5F4] px-4 py-3 text-left text-[12px] text-neutral-500"
            >
              清除当前位置 · {selected}
            </Pressable>
          ) : null}
          <div className="grid gap-2">
            {PULSE_PUBLISH_LOCATIONS.map((label) => {
              const active = selected === label
              return (
                <Pressable
                  key={label}
                  type="button"
                  onClick={() => onPick(label)}
                  className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-left ${
                    active ? 'bg-[#1C1C1E] text-white' : 'bg-[#FAFAFA] text-[#1C1C1E]'
                  }`}
                >
                  <MapPin className="size-4 shrink-0 opacity-70" strokeWidth={1.5} />
                  <span className="text-[13px]">{label}</span>
                </Pressable>
              )
            })}
          </div>
        </div>
      </motion.div>
    </>
  )
}
