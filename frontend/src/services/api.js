import axios from 'axios'

// Direct connection to FastAPI backend
const API_BASE_URL = 'http://127.0.0.1:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000,
})

// ── JWT helpers ───────────────────────────────────────────
const TOKEN_KEY = 'synexa_token'

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// ── Interceptor: attach JWT to every request ─────────────
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`)
  return config
})

// ── Interceptor: surface backend error messages ───────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail
    const status = error.response?.status
    console.error(`[API] Error ${status}:`, detail || error.message)
    return Promise.reject(error)
  }
)

// ── Auth ──────────────────────────────────────────────────

export async function signupUser(email, password) {
  const response = await api.post('/auth/signup', { email, password })
  return response.data
}

export async function loginUser(email, password) {
  const response = await api.post('/auth/login', { email, password })
  if (response.data.access_token) {
    saveToken(response.data.access_token)
  }
  return response.data
}

export async function uploadDocument(file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)

  const fileSize = file.size || 1

  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const total = progressEvent.total || fileSize
        const percent = Math.min(99, Math.round((progressEvent.loaded * 100) / total))
        onProgress(percent)
      }
    },
  })
  if (onProgress) onProgress(100)
  return response.data
}

export async function askQuestion(question, mode = 'simple', chatId = null, documentId = null) {
  const response = await api.post('/ask', {
    question,
    mode,
    chat_id: chatId,
    document_id: documentId,
  })
  return response.data
}

export async function askQuestionStream({ question, mode = 'simple', chatId = null, documentId = null, onMeta, onToken, onDone, onError }) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(`${API_BASE_URL}/ask/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question,
        mode,
        chat_id: chatId,
        document_id: documentId,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const rawData = trimmed.replace(/^data:\s*/, '')
        if (rawData === '[DONE]') {
          if (onDone) onDone()
          return
        }

        try {
          const parsed = JSON.parse(rawData)
          if (parsed.type === 'meta' && onMeta) {
            onMeta(parsed)
          } else if (parsed.type === 'token' && onToken) {
            onToken(parsed.content)
          }
        } catch (e) {
          console.warn('[SSE] Parse warning:', e)
        }
      }
    }
    if (onDone) onDone()
  } catch (err) {
    console.error('[SSE] Error:', err)
    if (onError) onError(err)
  }
}

export async function getDocument(documentId) {
  const response = await api.get(`/documents/${documentId}`)
  return response.data
}

export async function getDocuments() {
  const response = await api.get('/documents')
  return response.data
}

export async function getUserChats() {
  const response = await api.get('/chats')
  return response.data
}

export async function getChatHistory(chatId) {
  const response = await api.get(`/chat/${chatId}`)
  return response.data
}

export async function deleteDocument(documentId) {
  const response = await api.delete(`/documents/${documentId}`)
  return response.data
}

export function getFileUrl(filename) {
  return `${API_BASE_URL}/files/${encodeURIComponent(filename)}`
}
