import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ChatContext = createContext(null)

const ACTIVE_CHAT_KEY = 'synexa_active_chat'
const CHATS_KEY       = 'synexa_chats'
function persistChats(chats) {
  try {
    const safe = chats.map(({ file: _f, ...rest }) => rest)
    sessionStorage.setItem(CHATS_KEY, JSON.stringify(safe))
  } catch { /* ignore quota errors */ }
}

function persistActiveChat(chat) {
  try {
    if (!chat) { sessionStorage.removeItem(ACTIVE_CHAT_KEY); return }
    const { file: _f, ...safe } = chat
    sessionStorage.setItem(ACTIVE_CHAT_KEY, JSON.stringify(safe))
  } catch { /* ignore */ }
}

function loadChats() {
  try {
    const raw = sessionStorage.getItem(CHATS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function loadActiveChat() {
  try {
    const raw = sessionStorage.getItem(ACTIVE_CHAT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function ChatProvider({ children }) {

  // ── Core state ────────────────────────────────────────
  const [chats, setChats]                = useState(loadChats)
  const [activeChat, setActiveChatState] = useState(loadActiveChat)

  // ── UI state ──────────────────────────────────────────
  const [isLoading, setIsLoading]               = useState(false)
  const [darkMode, setDarkMode]                 = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [viewerOpen, setViewerOpen]             = useState(true)

  // ── Viewer state ──────────────────────────────────────
  const [currentPage, setCurrentPage]         = useState(1)
  const [numPages, setNumPages]               = useState(null)
  const [zoomLevel, setZoomLevel]             = useState(1.0)
  const [highlightedPage, setHighlightedPage] = useState(null)
  const [highlightText, setHighlightText]     = useState('')

  // ── Internal setters ──────────────────────────────────
  const _setActiveChat = useCallback((chat) => {
    setActiveChatState(chat)
    persistActiveChat(chat)
  }, [])

  const _setChats = useCallback((updater) => {
    setChats(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      persistChats(next)
      return next
    })
  }, [])

  // ── Auto-sync backend documents on load ──────────────
  useEffect(() => {
    async function syncBackendDocuments() {
      try {
        const { getDocuments } = await import('../services/api')
        const remoteDocs = await getDocuments()
        if (remoteDocs && Array.isArray(remoteDocs) && remoteDocs.length > 0) {
          _setChats(prev => {
            const existingIds = new Set(prev.map(c => c.documentId))
            const newChats = [...prev]
            for (const rd of remoteDocs) {
              if (!existingIds.has(rd.document_id)) {
                newChats.push({
                  id: rd.chat_id || ('chat_' + rd.document_id.slice(4)),
                  title: rd.filename,
                  documentId: rd.document_id,
                  documentName: rd.filename,
                  chunks: rd.num_chunks || 12,
                  file: null,
                  fileUrl: rd.file_url || null,
                  pdfUrl: rd.pdf_url || null,
                  messages: [],
                  createdAt: rd.upload_time || new Date().toISOString(),
                })
              }
            }
            return newChats
          })
        }
      } catch (err) {
        console.warn('[ChatContext] Document sync warning:', err)
      }
    }
    syncBackendDocuments()
  }, [_setChats])

  // ── Derived ───────────────────────────────────────────
  const activeDocumentId = activeChat?.documentId || null
  const activeDocument = activeChat ? {
    name:       activeChat.documentName,
    documentId: activeChat.documentId,
    chunks:     activeChat.chunks || 12,
    file:       activeChat.file    ?? null,   
    fileUrl:    activeChat.fileUrl ?? null,   
    pdfUrl:     activeChat.pdfUrl  ?? null,   
  } : null

  const messages = activeChat?.messages || []

  const createChat = useCallback((
    chatId,
    documentId,
    documentName,
    file,
    fileUrl = null,   
    pdfUrl  = null,   
    chunks  = 12,
  ) => {
    const chat = {
      id:           chatId,
      title:        documentName,
      documentId,
      documentName,
      chunks:       chunks || 12,
      file,
      fileUrl,         
      pdfUrl,          
      messages:     [],
      createdAt:    new Date().toISOString(),
    }
    _setChats(prev => [chat, ...prev])
    _setActiveChat(chat)
    setCurrentPage(1)
    setNumPages(null)
    setHighlightedPage(null)
    setHighlightText('')
    return chat
  }, [_setChats, _setActiveChat])

  const newChat = useCallback(() => {
    if (activeDocument) {
      const newId = 'chat_' + Math.random().toString(36).substring(2, 11)
      createChat(
        newId,
        activeDocument.documentId,
        activeDocument.name,
        activeDocument.file,
        activeDocument.fileUrl,
        activeDocument.pdfUrl,
        activeDocument.chunks,
      )
    }
  }, [activeDocument, createChat])

  // ── switchChat ────────────────────────────────────────
  const switchChat = useCallback((chatId) => {
    const chat = chats.find(c => c.id === chatId)
    if (chat) {
      _setActiveChat(chat)
      setCurrentPage(1)
      setNumPages(null)
      setHighlightedPage(null)
      setHighlightText('')
    }
  }, [chats, _setActiveChat])

  // ── deleteChat ────────────────────────────────────────
  const deleteChat = useCallback(async (chatId) => {
    try {
      const { deleteChat: apiDelete } = await import('../services/api')
      await apiDelete(chatId)
    } catch (err) {
      console.warn('[ChatContext] deleteChat backend error:', err?.response?.data?.detail || err.message)
    }
    _setChats(prev => {
      const next = prev.filter(c => c.id !== chatId)
      if (activeChat?.id === chatId) {
        _setActiveChat(next[0] || null)
        setHighlightText('')
      }
      return next
    })
  }, [activeChat, _setChats, _setActiveChat])

  // ── deleteDocument ────────────────────────────────────
  const deleteDocument = useCallback(async (documentId) => {
    try {
      const { deleteDocument: apiDeleteDoc } = await import('../services/api')
      await apiDeleteDoc(documentId)
    } catch (err) {
      console.warn('[ChatContext] deleteDocument backend error:', err?.response?.data?.detail || err.message)
    }
    _setChats(prev => {
      const next = prev.filter(c => c.documentId !== documentId)
      if (activeChat?.documentId === documentId) {
        _setActiveChat(next[0] || null)
        setHighlightText('')
      }
      return next
    })
  }, [activeChat, _setChats, _setActiveChat])

  // ── renameChat ────────────────────────────────────────
  const renameChat = useCallback((chatId, newTitle) => {
    _setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c))
    if (activeChat?.id === chatId) {
      _setActiveChat({ ...activeChat, title: newTitle })
    }
  }, [activeChat, _setChats, _setActiveChat])

  // ── addMessage ────────────────────────────────────────
  const addMessage = useCallback((msg) => {
    if (!activeChat) return
    const full = { ...msg, id: Date.now() + Math.random(), timestamp: new Date() }

    _setChats(prev => prev.map(c => {
      if (c.id !== activeChat.id) return c
      const msgs  = [...(c.messages || []), full]
      const title = msgs.find(m => m.role === 'user')?.content?.slice(0, 50) || c.title
      return { ...c, messages: msgs, title }
    }))

    setActiveChatState(prev => {
      if (!prev || prev.id !== activeChat.id) return prev
      const msgs  = [...(prev.messages || []), full]
      const title = msgs.find(m => m.role === 'user')?.content?.slice(0, 50) || prev.title
      const next  = { ...prev, messages: msgs, title }
      persistActiveChat(next)
      return next
    })
  }, [activeChat, _setChats])

  // ── clearChat ─────────────────────────────────────────
  const clearChat = useCallback(() => {
    if (!activeChat) return
    _setChats(prev => prev.map(c =>
      c.id === activeChat.id ? { ...c, messages: [] } : c
    ))
    _setActiveChat({ ...activeChat, messages: [] })
    setHighlightText('')
  }, [activeChat, _setChats, _setActiveChat])

  // ── Documents list (for /documents page) ─────────────
  const documents = chats.reduce((acc, chat) => {
    if (!acc.find(d => d.documentId === chat.documentId)) {
      acc.push({
        documentId:   chat.documentId,
        documentName: chat.documentName,
        file:         chat.file    ?? null,
        fileUrl:      chat.fileUrl ?? null,   
        pdfUrl:       chat.pdfUrl  ?? null,   
        uploadedAt:   chat.createdAt,
      })
    }
    return acc
  }, [])

  // ── Legacy shims (Sidebar compatibility) ─────────────
  const sessions        = chats
  const activeSessionId = activeChat?.id || null
  const activeSession   = activeChat

  const switchSession = useCallback((id) => switchChat(id), [switchChat])
  const renameSession = useCallback((id, t) => renameChat(id, t), [renameChat])
  const deleteSession = useCallback((id) => deleteChat(id), [deleteChat])

  // UploadArea shim: addDocument({ chatId, documentId, name, file, fileUrl, pdfUrl, chunks })
  const addDocument = useCallback((doc) => {
    createChat(
      doc.chatId, doc.documentId, doc.name, doc.file,
      doc.fileUrl ?? null,
      doc.pdfUrl  ?? null,
      doc.chunks  ?? 12,
    )
  }, [createChat])

  // ── Viewer helpers ────────────────────────────────────
  const jumpToPage = useCallback((page) => {
    const p = parseInt(page)
    if (isNaN(p) || p <= 0) return
    setViewerOpen(true)
    setCurrentPage(p)
    setHighlightedPage(p)
    setTimeout(() => setHighlightedPage(null), 3000)
  }, [])

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      return next
    })
  }, [])

  return (
    <ChatContext.Provider value={{
      // Chat model
      chats, activeChat,
      createChat, switchChat, deleteChat, renameChat, deleteDocument,
      // Messages
      messages, addMessage, clearChat,
      // Derived (backward compat)
      activeDocument,      
      activeDocumentId,
      documents,           
      addDocument,
      // Legacy session API (Sidebar)
      sessions, activeSession, activeSessionId,
      newChat, switchSession, renameSession, deleteSession,
      // UI
      isLoading, setIsLoading,
      darkMode, toggleDarkMode,
      sidebarCollapsed, setSidebarCollapsed,
      viewerOpen, setViewerOpen,
      // Viewer
      currentPage, setCurrentPage,
      numPages, setNumPages,
      zoomLevel, setZoomLevel,
      highlightedPage, jumpToPage,
      highlightText, setHighlightText,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
