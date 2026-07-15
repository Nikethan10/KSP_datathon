import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="glass rounded-xl px-8 py-6 text-center max-w-md">
            <div className="text-lg font-semibold text-red-400 mb-2">Data unavailable</div>
            <div className="text-sm text-slate-400 mb-4">
              Unable to load analytics data. Check your connection and try again.
            </div>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 rounded-md bg-sky-500/20 text-sky-300 text-sm font-medium hover:bg-sky-500/30 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
