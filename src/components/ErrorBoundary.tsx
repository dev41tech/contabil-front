import React from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-canvas p-8">
          <div className="max-w-2xl w-full bg-surface rounded-lg border border-danger/40 p-6 shadow">
            <h1 className="text-xl font-bold text-danger mb-2">Não foi possível carregar esta página</h1>
            <p className="text-sm text-danger bg-danger/15 p-3 rounded-sm">
              Tente voltar ao login. Se o problema continuar, acione o suporte.
            </p>
            <button
              className="mt-4 px-4 py-2 bg-danger text-on-brand rounded-sm text-sm hover:bg-danger/90"
              onClick={() => { this.setState({ error: null }); window.location.href = '/login' }}
            >
              Voltar ao login
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
