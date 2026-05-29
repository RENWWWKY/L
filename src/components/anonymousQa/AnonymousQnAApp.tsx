import { ArrowLeft, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AnswerComposePage } from './AnswerComposePage'
import { AskQuestionModal } from './AskQuestionModal'
import { QnAGeneratorModal } from './QnAGeneratorModal'
import { EnvelopeReveal } from './EnvelopeReveal'
import { generateDynamicRepliesWithAi, generateQuestionsWithAi, type GeneratorStyle } from './aiGeneration'
import type { AnonymousQaWechatContext } from './buildAnonymousQaPersonaContext'
import { buildThreadCommentsFromDirectedOutput } from './directedInitialComments'
import { generateDirectedQuestionDualOutput } from './directedQuestionAi'
import { mapPersonaReplyToAnswer } from './personaAiGeneration'
import { QnAPendingOverlay } from './QnAPendingOverlay'
import { QnAPostDetailPage } from './QnAPostDetailPage'
import { PostDetailPage } from './PostDetailPage'
import { QnABottomNav } from './QnABottomNav'
import type { QnAProfileTab } from './types'
import { QnAProfilePage } from './QnAProfilePage'
import { QnAFeedPage } from './QnAFeedPage'
import type { MockContact, Question } from './types'
import type { QnADirectedPost } from './qnaStoreTypes'
import { getQnaDirectedPost, resetQnaDirectedStore } from './qnaDirectedStore'
import {
  filterLegacyMockQnaState,
  loadQnaMainState,
  saveQnaMainState,
} from './qnaPersistence'
import { QnAStoreProvider, useQnAStore, useQnADirectedPost, hydrateQnaDirectedStore } from './useQnAStore'
import { WECHAT_ACCOUNT_DEEP_ERASED_EVENT } from '../../phone/apps/wechat/wechatAccountDeepErase'

const QNA_BG_IMAGE_URL = new URL('../../../image/匿问我答背景图.png', import.meta.url).toString()

const EMPTY_LIST_BY_TAB: Record<string, string[]> = {
  received: [],
  asked: [],
  answered: [],
  liked: [],
  commented: [],
}

type AnonymousQnAAppProps = {
  onBack: () => void
  currentUserName?: string
  contacts?: MockContact[]
  wechatCtx?: AnonymousQaWechatContext | null
}

function questionFromDirectedPost(post: QnADirectedPost): Question {
  return {
    id: post.id,
    body: post.question,
    visibility: 'directed',
    targetUserIds: [post.targetContactId],
    targetDisplayNames: [post.targetCharacterName],
    targetCharacterId: post.targetCharacterId,
    createdAt: post.createdAt,
    askerDisplayName: '匿名',
    directedAiPostId: post.id,
    answers: [
      {
        id: `a-main-${post.id}`,
        createdAt: post.createdAt,
        authorId: post.targetCharacterId,
        authorName: post.targetCharacterName,
        isAnonymous: false,
        content: post.characterAnswer,
        likeCount: 0,
        dislikeCount: 0,
        replies: [],
      },
    ],
    topAnswerSnippet: {
      authorName: post.targetCharacterName,
      isAnonymous: false,
      text: post.characterAnswer,
      likeCount: 0,
    },
  }
}

function AnonymousQnAAppInner({
  onBack,
  currentUserName = '我',
  contacts: contactsProp,
  wechatCtx = null,
}: AnonymousQnAAppProps) {
  const { saveDirectedPost } = useQnAStore()
  const [qnaHydrated, setQnaHydrated] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [listByTab, setListByTab] = useState<Record<string, string[]>>(() => ({ ...EMPTY_LIST_BY_TAB }))
  const [nav, setNav] = useState<'home' | 'profile'>('home')
  const [profileTab, setProfileTab] = useState<QnAProfileTab>('asked')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [answerForId, setAnswerForId] = useState<string | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [aiReplying, setAiReplying] = useState(false)
  const [envelopeOpen, setEnvelopeOpen] = useState(false)
  const [pendingCharacterName, setPendingCharacterName] = useState<string | null>(null)
  const envelopeTargetRef = useRef<string | null>(null)
  const timersRef = useRef<number[]>([])

  const contacts = useMemo(() => {
    const base = (contactsProp ?? []).map((c) => ({ ...c }))
    const hasSelf = base.some((c) => c.id === 'self')
    const withSelf = hasSelf
      ? base.map((c) => (c.id === 'self' ? { ...c, remarkName: currentUserName } : c))
      : [{ id: 'self', remarkName: currentUserName }, ...base]
    return withSelf
  }, [contactsProp, currentUserName])

  const directedPost = useQnADirectedPost(detailId)

  const detailQuestion = useMemo(() => questions.find((q) => q.id === detailId) ?? null, [detailId, questions])
  const answerQuestion = useMemo(
    () => questions.find((q) => q.id === answerForId) ?? null,
    [answerForId, questions],
  )

  const openQuestion = useCallback(
    (id: string, opts?: { fromReceivedUnread?: boolean }) => {
      const q = questions.find((x) => x.id === id)
      if (!q) return
      if (opts?.fromReceivedUnread && q.unreadForCurrentUser && q.visibility === 'directed') {
        envelopeTargetRef.current = id
        setEnvelopeOpen(true)
        return
      }
      if (q.directedAiPostId && getQnaDirectedPost(q.directedAiPostId)) {
        setDetailId(q.directedAiPostId)
        return
      }
      if (q.visibility === 'directed' && q.answers.length === 0) {
        setAnswerForId(id)
        return
      }
      setDetailId(id)
    },
    [questions],
  )

  const closeDetail = () => setDetailId(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [main] = await Promise.all([loadQnaMainState(), hydrateQnaDirectedStore()])
        if (cancelled) return
        if (main) {
          const cleaned = filterLegacyMockQnaState(main)
          if (cleaned.questions.length) setQuestions(cleaned.questions)
          if (Object.keys(cleaned.listByTab).length) {
            setListByTab({ ...EMPTY_LIST_BY_TAB, ...cleaned.listByTab })
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setQnaHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!qnaHydrated) return
    void saveQnaMainState({ questions, listByTab }).catch(() => {})
  }, [questions, listByTab, qnaHydrated])

  useEffect(() => {
    const onErased = () => {
      setQuestions([])
      setListByTab({ ...EMPTY_LIST_BY_TAB })
      void resetQnaDirectedStore()
    }
    window.addEventListener(WECHAT_ACCOUNT_DEEP_ERASED_EVENT, onErased)
    return () => window.removeEventListener(WECHAT_ACCOUNT_DEEP_ERASED_EVENT, onErased)
  }, [])

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  const onEnvelopeRevealed = useCallback(() => {
    const id = envelopeTargetRef.current
    if (!id) return
    let shouldCompose = false
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q
        shouldCompose = q.visibility === 'directed' && q.answers.length === 0 && !q.directedAiPostId
        return { ...q, unreadForCurrentUser: false }
      }),
    )
    if (shouldCompose) setAnswerForId(id)
    else setDetailId(id)
    envelopeTargetRef.current = null
    setEnvelopeOpen(false)
  }, [])

  const handleSubmitPublic = (body: string) => {
    const id = `q-pub-${Date.now()}`
    const next: Question = {
      id,
      body,
      visibility: 'public',
      createdAt: Date.now(),
      askerDisplayName: '匿名',
      answers: [],
      topAnswerSnippet: undefined,
    }
    setQuestions((prev) => [next, ...prev])
    setListByTab((prev) => ({ ...prev, asked: [id, ...(prev.asked ?? [])] }))
  }

  const runDirectedAiForTarget = useCallback(
    async (body: string, target: MockContact): Promise<string> => {
      const cid = target.characterId!.trim()
      setPendingCharacterName(target.remarkName)
      try {
        const output = await generateDirectedQuestionDualOutput({
          questionBody: body,
          targetContact: target,
          contacts,
          wechatCtx,
        })
        const baseMs = Date.now()
        const id = `q-d-ai-${baseMs}-${cid.slice(0, 8)}`
        const threadComments = await buildThreadCommentsFromDirectedOutput({
          output,
          baseMs,
          contacts,
          targetCharacterId: cid,
          targetCharacterName: target.remarkName,
          targetCharacterAvatar: target.avatarUrl,
        })
        const post: QnADirectedPost = {
          id,
          question: body,
          targetCharacterId: cid,
          targetCharacterName: target.remarkName,
          targetCharacterAvatar:
            target.avatarUrl?.trim() || '/image/个人名片默认头像1.png',
          targetContactId: target.id,
          characterAnswer: output.characterAnswer,
          createdAt: baseMs,
          comments: [],
          threadComments,
        }
        saveDirectedPost(post)
        const q = questionFromDirectedPost(post)
        setQuestions((prev) => [q, ...prev])
        setListByTab((prev) => ({
          ...prev,
          asked: [id, ...(prev.asked ?? [])],
        }))
        return id
      } finally {
        setPendingCharacterName(null)
      }
    },
    [contacts, saveDirectedPost, wechatCtx],
  )

  const handleSubmitDirected = useCallback(
    async (body: string, targets: MockContact[]) => {
      const aiTargets = targets.filter((t) => t.characterId?.trim())
      const legacyTargets = targets.filter((t) => !t.characterId?.trim())

      if (legacyTargets.length) {
        const ts = Date.now()
        const newQs: Question[] = legacyTargets.map((t, i) => ({
          id: `q-d-${ts}-${i}`,
          body,
          visibility: 'directed',
          targetUserIds: [t.id],
          targetDisplayNames: [t.remarkName],
          createdAt: Date.now(),
          askerDisplayName: '匿名',
          answers: [],
        }))
        setQuestions((prev) => [...newQs, ...prev])
        setListByTab((prev) => ({
          ...prev,
          asked: [...newQs.map((q) => q.id), ...(prev.asked ?? [])],
        }))
      }

      let lastId: string | null = null
      for (const t of aiTargets) {
        lastId = await runDirectedAiForTarget(body, t)
      }
      if (lastId) {
        setDetailId(lastId)
        setNav('home')
      }
    },
    [runDirectedAiForTarget],
  )

  const handleAnswerSubmit = (text: string) => {
    if (!answerForId) return
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== answerForId) return q
        return {
          ...q,
          topAnswerSnippet: q.topAnswerSnippet ?? {
            authorName: currentUserName,
            isAnonymous: false,
            text,
            likeCount: 0,
          },
          answers: [
            ...q.answers,
            {
              id: `a-${Date.now()}`,
              createdAt: Date.now(),
              authorId: 'self',
              authorName: currentUserName,
              isAnonymous: false,
              content: text,
              likeCount: 0,
              dislikeCount: 0,
              replies: [],
            },
          ],
        }
      }),
    )
    setListByTab((prev) => ({
      ...prev,
      answered: [answerForId, ...(prev.answered ?? []).filter((id) => id !== answerForId)],
    }))
    setAnswerForId(null)
    setNav('profile')
    setProfileTab('answered')
    const postedQuestion = questions.find((q) => q.id === answerForId)
    if (postedQuestion) {
      void enqueueAiReplies(postedQuestion, text)
    }
  }

  const enqueueAiReplies = useCallback(
    async (question: Question, userComment: string) => {
      if (question.directedAiPostId) return
      const recent = question.answers
        .slice(-3)
        .map((a) => `${a.authorName}: ${a.content}`)
        .join('\n')
      setAiReplying(true)
      const rows = await generateDynamicRepliesWithAi({
        postBody: question.body,
        isContact: !!question.isContact,
        contactCharacterId: question.contactCharacterId,
        recentComments: recent,
        userComment,
        wechatCtx,
      })
      const delay = 2000 + Math.floor(Math.random() * 2000)
      const timer = window.setTimeout(() => {
        setQuestions((prev) =>
          prev.map((q) => {
            if (q.id !== question.id) return q
            const targetAnswerId = q.answers[0]?.id
            if (!targetAnswerId) {
              const newAnswers = rows.map((r) => mapPersonaReplyToAnswer(r, contacts))
              return { ...q, answers: [...q.answers, ...newAnswers] }
            }
            return {
              ...q,
              answers: q.answers.map((a) =>
                a.id !== targetAnswerId
                  ? a
                  : {
                      ...a,
                      replies: [
                        ...a.replies,
                        ...rows.map((r) => ({
                          id: `r-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                          createdAt: Date.now(),
                          authorId: `ai-${Math.random().toString(36).slice(2, 7)}`,
                          authorName: r.authorMask,
                          isAnonymous: true,
                          content: r.content,
                          likeCount: Math.floor(Math.random() * 10),
                          dislikeCount: 0,
                          children: [],
                        })),
                      ],
                    },
              ),
            }
          }),
        )
        setAiReplying(false)
      }, delay)
      timersRef.current.push(timer)
    },
    [contacts, wechatCtx],
  )

  const handleDetailComment = useCallback(
    (text: string) => {
      if (!detailId || directedPost) return
      let snapshot: Question | null = null
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== detailId) return q
          const ts = Date.now()
          snapshot = q
          if (!q.answers.length) {
            return {
              ...q,
              answers: [
                {
                  id: `a-${ts}`,
                  createdAt: ts,
                  authorId: 'self',
                  authorName: currentUserName,
                  isAnonymous: false,
                  content: text,
                  likeCount: 0,
                  dislikeCount: 0,
                  replies: [],
                },
              ],
            }
          }
          return {
            ...q,
            answers: q.answers.map((a, idx) =>
              idx !== 0
                ? a
                : {
                    ...a,
                    replies: [
                      ...a.replies,
                      {
                        id: `r-self-${ts}`,
                        createdAt: ts,
                        authorId: 'self',
                        authorName: currentUserName,
                        isAnonymous: false,
                        content: text,
                        likeCount: 0,
                        dislikeCount: 0,
                        children: [],
                      },
                    ],
                  },
            ),
          }
        }),
      )
      if (snapshot) {
        void enqueueAiReplies(snapshot, text)
      }
    },
    [currentUserName, detailId, directedPost, enqueueAiReplies],
  )

  const handleGeneratePosts = useCallback(
    async (params: { style: GeneratorStyle; count: number; includeContacts: boolean }) => {
      setGenerating(true)
      try {
        const generated = await generateQuestionsWithAi({
          style: params.style,
          count: params.count,
          includeContacts: params.includeContacts,
          contacts,
          wechatCtx,
        })
        setQuestions((prev) => [...generated, ...prev])
      } finally {
        setGenerating(false)
        setGeneratorOpen(false)
      }
    },
    [contacts, wechatCtx],
  )

  const showChrome = !detailId && !answerForId && !pendingCharacterName

  return (
    <div
      className="relative flex h-full min-h-0 flex-col text-[#111827]"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(250,250,250,0.36), rgba(250,250,250,0.46)), url(${QNA_BG_IMAGE_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
      }}
    >
      <QnAPendingOverlay open={!!pendingCharacterName} characterName={pendingCharacterName ?? ''} />

      {showChrome ? (
        <header
          className="flex shrink-0 items-center justify-between border-b border-black/6 bg-white/95 px-3 pb-2 backdrop-blur-md"
          style={{ paddingTop: 'max(0px, env(safe-area-inset-top, 0px))' }}
        >
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#111827]"
          >
            <ArrowLeft className="size-5" />
          </motion.button>
          <h1 className="text-[16px] font-semibold text-[#111827]">匿问我答</h1>
          <div className="h-9 w-9" aria-hidden />
        </header>
      ) : null}

      <AnimatePresence mode="wait">
        {answerForId && answerQuestion ? (
          <AnswerComposePage
            key="answer"
            questionBody={answerQuestion.body}
            onBack={() => setAnswerForId(null)}
            onSubmit={handleAnswerSubmit}
          />
        ) : detailId && directedPost ? (
          <QnAPostDetailPage
            key="directed-detail"
            post={directedPost}
            onBack={closeDetail}
            currentUserName={currentUserName}
            contacts={contacts}
            wechatCtx={wechatCtx}
          />
        ) : detailId ? (
          <PostDetailPage
            key="detail"
            question={detailQuestion}
            onBack={closeDetail}
            onSubmitComment={handleDetailComment}
            aiReplying={aiReplying}
          />
        ) : nav === 'home' ? (
          <motion.div key="home" className="flex min-h-0 flex-1 flex-col" initial={false}>
            <QnAFeedPage questions={questions} onOpenPost={(id) => setDetailId(id)} />
          </motion.div>
        ) : (
          <motion.div key="profile" className="flex min-h-0 flex-1 flex-col" initial={false}>
            <QnAProfilePage
              questions={questions}
              listByTab={listByTab}
              activeTab={profileTab}
              onTab={setProfileTab}
              onOpenQuestion={openQuestion}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showChrome ? (
        <QnABottomNav
          active={nav}
          onHome={() => setNav('home')}
          onProfile={() => setNav('profile')}
          onAsk={() => setAskOpen(true)}
        />
      ) : null}

      {showChrome ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => setGeneratorOpen(true)}
          className="fixed bottom-[88px] right-4 z-[1200] inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/92 px-3 py-2 text-[12px] text-[#111827] shadow-[0_8px_20px_rgba(0,0,0,0.12)] backdrop-blur-md"
        >
          <Sparkles className="size-3.5" />
          AI 生成
        </motion.button>
      ) : null}

      <AskQuestionModal
        open={askOpen}
        onClose={() => setAskOpen(false)}
        contacts={contacts}
        onSubmitPublic={handleSubmitPublic}
        onSubmitDirected={(body, targets) => {
          void handleSubmitDirected(body, targets)
        }}
      />

      <QnAGeneratorModal
        open={generatorOpen}
        loading={generating}
        onClose={() => setGeneratorOpen(false)}
        onGenerate={handleGeneratePosts}
      />

      <EnvelopeReveal
        open={envelopeOpen}
        onClose={() => {
          setEnvelopeOpen(false)
          envelopeTargetRef.current = null
        }}
        onRevealed={onEnvelopeRevealed}
      />
    </div>
  )
}

export function AnonymousQnAApp(props: AnonymousQnAAppProps) {
  return (
    <QnAStoreProvider>
      <AnonymousQnAAppInner {...props} />
    </QnAStoreProvider>
  )
}
