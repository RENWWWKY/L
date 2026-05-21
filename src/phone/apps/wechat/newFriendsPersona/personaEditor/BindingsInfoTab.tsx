import { useEffect, useState } from 'react'
import type { Character, PlayerIdentity } from '../types'
import { personaDb } from '../idb'
import { loadAccountsBundle } from '../../wechatAccountPersistence'
import {
  backfillCharacterPlayerIdentityLinkMeta,
  formatPlayerIdentityDisplayName,
  getCharacterBoundPlayerIdentityId,
  getCharacterLinkedPlayerIdentityIds,
} from '../../wechatCharacterPlayerIdentity'
import {
  formatWechatAccountLabel,
  resolvePlayerIdentityWechatAccountId,
} from '../../wechatContactIdentityPrompt'

type BindingRow = {
  identityId: string
  role: 'primary' | 'linked'
  identity: PlayerIdentity | null
  accountId: string
  accountLabel: string
}

function BindingCard({ row }: { row: BindingRow }) {
  const name = formatPlayerIdentityDisplayName(row.identity, row.identityId)
  const wxNick = row.identity?.wechatNickname?.trim()
  const title = row.identity?.identity?.trim()
  const isPrimary = row.role === 'primary'

  return (
    <div
      className={`rounded-[12px] border px-4 py-3.5 ${
        isPrimary ? 'border-[#D4AF37]/50 bg-[#FFFCF5]' : 'border-neutral-200/90 bg-neutral-50/80'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
            isPrimary ? 'bg-[#D4AF37]/15 text-[#8B6914]' : 'bg-neutral-200/80 text-neutral-600'
          }`}
        >
          {isPrimary ? '档案主绑定' : '副绑定 · 关联马甲'}
        </span>
        {row.accountId ? (
          <span className="min-w-0 truncate text-right text-[11px] font-medium text-[#1C1C1E]">
            {row.accountLabel}
          </span>
        ) : (
          <span className="text-[11px] text-neutral-400">未标注微信账号</span>
        )}
      </div>
      <p className="mt-2.5 text-[15px] font-semibold tracking-tight text-[#1C1C1E]">{name}</p>
      {wxNick && wxNick !== name ? (
        <p className="mt-0.5 text-[12px] text-neutral-500">微信昵称：{wxNick}</p>
      ) : null}
      {title ? <p className="mt-1 text-[12px] text-neutral-500">身份/职务：{title}</p> : null}
      <p className="mt-2 font-mono text-[10px] text-neutral-400">ID · {row.identityId}</p>
    </div>
  )
}

export function BindingsInfoTab({ character }: { character: Character }) {
  const [rows, setRows] = useState<BindingRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        await backfillCharacterPlayerIdentityLinkMeta(character.id)
        const fresh = (await personaDb.getCharacter(character.id)) ?? character
        const bundle = await loadAccountsBundle()
        const primary = getCharacterBoundPlayerIdentityId(fresh)
        const linked = getCharacterLinkedPlayerIdentityIds(fresh).filter((id) => id !== primary)
        const items: BindingRow[] = []

        const pushRow = async (identityId: string, role: 'primary' | 'linked') => {
          const identity = await personaDb.getPlayerIdentity(identityId)
          const accountId = resolvePlayerIdentityWechatAccountId(fresh, identityId, identity)
          items.push({
            identityId,
            role,
            identity,
            accountId,
            accountLabel: formatWechatAccountLabel(bundle, accountId),
          })
        }

        if (primary) await pushRow(primary, 'primary')
        for (const lid of linked) await pushRow(lid, 'linked')

        if (!cancelled) setRows(items)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    character.id,
    character.playerIdentityId,
    character.linkedPlayerIdentityIds,
    character.playerIdentityLinkMeta,
  ])

  return (
    <section className="rounded-[14px] border border-neutral-200/90 bg-white px-3 pb-6 pt-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="mb-4 border-b border-neutral-100 pb-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-neutral-400">02 LINK · 扮演绑定</p>
        <h2 className="mt-2 text-[17px] font-semibold tracking-tight text-[#1C1C1E]">绑定信息</h2>
        <p className="mt-1 text-[11px] font-light leading-relaxed text-neutral-500">
          查看该角色档案绑定的玩家扮演身份。主绑定为跨马甲共享的档案锚点；副绑定为其它微信号加好友后关联的马甲。AI
          私聊时会按「当前微信线」与「主绑定」分属账号区分，避免误判为换号。
        </p>
      </header>

      {loading ? (
        <p className="py-8 text-center text-[13px] text-neutral-400">加载绑定信息…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-neutral-200 bg-neutral-50/60 px-4 py-8 text-center">
          <p className="text-[14px] font-medium text-neutral-600">尚未绑定玩家身份</p>
          <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
            创建角色时选择身份，或在微信加好友通过后，系统会将对应马甲写入副绑定。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <BindingCard key={`${row.role}-${row.identityId}`} row={row} />
          ))}
        </div>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-neutral-400">
        修改跨角色绑定关系：返回角色列表，通过「绑定管理」入口操作。
      </p>
    </section>
  )
}
