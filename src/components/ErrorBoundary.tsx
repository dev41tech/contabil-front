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
            <h1 className="text-xl font-bold text-red-700 mb-2">Erro na renderização</h1>
            <p className="text-sm font-mono text-red-600 bg-red-50 p-3 rounded break-all">
              {this.state.error.message}
            </p>
            <pre className="text-xs text-gray-500 mt-4 overflow-auto max-h-64 bg-gray-50 p-3 rounded">
              {this.state.error.stack}
            </pre>
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
