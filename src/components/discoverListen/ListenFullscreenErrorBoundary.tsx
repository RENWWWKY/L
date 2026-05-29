import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  onClose?: () => void
}

type State = {
  error: Error | null
}

/** 全屏播放页崩溃时避免整页白屏 */
export class ListenFullscreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ListenFullscreen]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-stone-50 px-8 text-center">
          <p className="text-base font-medium text-stone-700">播放页加载异常</p>
          <p className="mt-2 text-sm text-stone-500">已拦截闪退，请返回后重试播放</p>
          <button
            type="button"
            className="mt-6 rounded-full bg-white px-6 py-2.5 text-sm text-stone-700 shadow-sm ring-1 ring-stone-200"
            onClick={() => {
              this.setState({ error: null })
              this.props.onClose?.()
            }}
          >
            返回
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
