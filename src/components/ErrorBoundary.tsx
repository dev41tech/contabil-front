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
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-8">
          <div className="max-w-2xl w-full bg-white rounded-lg border border-red-200 p-6 shadow">
            <h1 className="text-xl font-bold text-red-700 mb-2">Não foi possível carregar esta página</h1>
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded">
              Tente voltar ao login. Se o problema continuar, acione o suporte.
            </p>
            <button
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
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
