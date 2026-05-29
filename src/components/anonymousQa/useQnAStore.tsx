/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import type { DelayedComment, QnADirectedPost } from './qnaStoreTypes'
import { countPendingDirectedComments } from './qnaUnifiedComments'
import {
  buildDelayedCommentsFromAi,
  getQnaDirectedPost,
  getQnaDirectedStoreSnapshot,
  getVisibleComments,
  hydrateQnaDirectedStore,
  revealAllDirectedPostComments,
  subscribeQnaDirectedStore,
  upsertQnaDirectedPost,
} from './qnaDirectedStore'

type QnAStoreContextValue = {
  now: number
  getPost: (id: string) => QnADirectedPost | null
  getVisibleCommentsForPost: (post: QnADirectedPost) => DelayedComment[]
  countPendingComments: (post: QnADirectedPost) => number
  revealAllComments: (postId: string) => void
  saveDirectedPost: (post: QnADirectedPost) => void
  buildDelayedComments: typeof buildDelayedCommentsFromAi
}

const QnAStoreContext = createContext<QnAStoreContextValue | null>(null)

export function QnAStoreProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeQnaDirectedStore, getQnaDirectedStoreSnapshot, getQnaDirectedStoreSnapshot)

  const getPost = useCallback((id: string) => getQnaDirectedPost(id), [snapshot])

  const getVisibleCommentsForPost = useCallback(
    (post: QnADirectedPost) => getVisibleComments(post, snapshot.now),
    [snapshot.now],
  )

  const saveDirectedPost = useCallback((post: QnADirectedPost) => {
    upsertQnaDirectedPost(post)
  }, [])

  const countPendingComments = useCallback(
    (post: QnADirectedPost) => countPendingDirectedComments(post, snapshot.now),
    [snapshot.now],
  )

  const revealAllComments = useCallback((postId: string) => {
    revealAllDirectedPostComments(postId, Date.now())
  }, [])

  const value = useMemo(
    (): QnAStoreContextValue => ({
      now: snapshot.now,
      getPost,
      getVisibleCommentsForPost,
      countPendingComments,
      revealAllComments,
      saveDirectedPost,
      buildDelayedComments: buildDelayedCommentsFromAi,
    }),
    [countPendingComments, getPost, getVisibleCommentsForPost, revealAllComments, saveDirectedPost, snapshot.now],
  )

  return <QnAStoreContext.Provider value={value}>{children}</QnAStoreContext.Provider>
}

export function useQnAStore(): QnAStoreContextValue {
  const ctx = useContext(QnAStoreContext)
  if (!ctx) throw new Error('useQnAStore must be used within QnAStoreProvider')
  return ctx
}

export function useQnADirectedPost(postId: string | null): QnADirectedPost | null {
  const { getPost, now } = useQnAStore()
  return useMemo(() => (postId ? getPost(postId) : null), [getPost, postId, now])
}

export { hydrateQnaDirectedStore }
