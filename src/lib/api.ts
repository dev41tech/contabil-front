import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  // Não define Content-Type global: o axios seta 'application/json' automaticamente
  // para objetos via transformRequest, e para FormData deixa o browser gerar o
  // boundary correto. Forçar 'application/json' aqui faz o axios serializar
  // FormData como JSON (hasJSONContentType=true), quebrando uploads multipart.
})

// ── CSRF: injeta token nos verbos de escrita ──────────────────────────────────
api.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase() ?? ''
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = sessionStorage.getItem('csrf_token')
    if (csrf) config.headers['X-CSRF-Token'] = csrf
  }
  return config
})

// ── 401: renova silenciosamente via refresh token antes de redirecionar ───────
//
// Fluxo:
//   1. Requisição retorna 401.
//   2. Se não for endpoint de auth, tenta POST /auth/refresh (usa cookie httpOnly).
//   3. Sucesso → salva novo csrf_token, reemite requisições pendentes + original.
//   4. Falha   → limpa sessão e redireciona para /login.
//
// Proteção de concorrência: enquanto o refresh está em andamento, outras
// requisições com 401 são enfileiradas e reemitidas após o refresh terminar
// (evita múltiplos POSTs simultâneos para /auth/refresh).

let isRefreshing = false
let pendingRequests: Array<() => void> = []

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const url: string = err.config?.url ?? ''
    const isAuthEndpoint =
      url.includes('/auth/me') ||
      url.includes('/auth/login') ||
      url.includes('/auth/refresh')

    // ── 403 de CSRF: o token desta aba divergiu do cookie ────────────────────
    //
    // O cookie de CSRF é do NAVEGADOR; o token guardado é da ABA
    // (sessionStorage). Eles divergem quando outra aba faz um login novo, e o
    // 403 daí não é falta de permissão — é um token velho, que se resolve
    // buscando o atual e repetindo. Por isso o backend marca este caso com
    // `CSRF_INVALID`, distinto de um 403 de permissão, que não deve repetir.
    if (
      err.response?.status === 403 &&
      err.response?.data?.error === 'CSRF_INVALID' &&
      !isAuthEndpoint &&
      !err.config?._csrfRetry
    ) {
      err.config._csrfRetry = true
      try {
        const { data } = await api.get('/auth/me')
        if (!data.csrf_token) throw new Error('sem csrf')
        sessionStorage.setItem('csrf_token', data.csrf_token)
        return api(err.config)
      } catch {
        return Promise.reject(err)
      }
    }

    if (err.response?.status === 401 && !isAuthEndpoint && !err.config?._retry) {
      // Já estamos renovando → enfileira e aguarda
      if (isRefreshing) {
        return new Promise<void>((resolve) => {
          pendingRequests.push(resolve)
        }).then(() => api(err.config))
      }

      err.config._retry = true
      isRefreshing = true

      try {
        const { data } = await api.post('/auth/refresh')
        sessionStorage.setItem('csrf_token', data.csrf_token)

        // Libera requisições enfileiradas
        pendingRequests.forEach(resolve => resolve())
        pendingRequests = []
        isRefreshing = false

        // Reemite a requisição original (cookie de acesso já foi atualizado)
        return api(err.config)
      } catch {
        pendingRequests = []
        isRefreshing = false
        sessionStorage.removeItem('csrf_token')
        window.location.href = '/login'
        return Promise.reject(err)
      }
    }

    return Promise.reject(err)
  },
)
