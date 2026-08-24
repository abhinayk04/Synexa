import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, FileText, Check, Layers,
  PanelRight, PanelRightClose, Upload, UserCircle2, X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useChat } from '../context/ChatContext'
import { useAuth } from '../context/AuthContext'
import { askQuestion, askQuestionStream } from '../services/api'
import MessageBubble, { TypingIndicator } from './MessageBubble'
import AnswerModeSelector from './AnswerModeSelector'
import clsx from 'clsx'

export default function ChatBox() {
  const navigate = useNavigate()
  const {
    messages, addMessage, isLoading, setIsLoading,
    activeDocument, activeChat, documents,
    selectedDocIds, toggleDocSelection, clearDocSelection,
    viewerOpen, setViewerOpen,
  } = useChat()

  const { isGuest, isLoggedIn, displayName } = useAuth()

  const [input, setInput] = useState('')
  const [mode, setMode] = useState('simple')
  const [multiDocOpen, setMultiDocOpen] = useState(false)

  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  const sendMessage = async (question) => {
    const q = (question || input).trim()
    if (!q || isLoading) return

    if (!activeChat?.id && selectedDocIds.length === 0) {
      addMessage({
        role: 'ai',
        content: '⚠️ Please select or upload a document first before asking questions.',
        sources: [],
        confidence: 0,
      })
      return
    }

    setInput('')
    addMessage({ role: 'user', content: q })
    setIsLoading(true)

    // Fast SSE streaming for sub-50ms TTFT
    let streamedText = ''
    let metaData = { sources: [], confidence: 0 }

    const targetDocIds = selectedDocIds.length > 0 ? selectedDocIds : (activeChat?.documentId ? [activeChat.documentId] : null)

    try {
      await askQuestionStream({
        question: q,
        mode,
        chatId: activeChat?.id,
        documentId: activeChat?.documentId,
        documentIds: targetDocIds,
        onMeta: (meta) => {
          metaData = meta
        },
        onToken: (token) => {
          streamedText += token
        },
        onDone: () => {
          addMessage({
            role: 'ai',
            content: streamedText || 'Information not found in documents.',
            sources: metaData.sources || [],
            confidence: metaData.confidence || 0,
            mode,
          })
          setIsLoading(false)
        },
        onError: async () => {
          try {
            const data = await askQuestion(q, mode, activeChat?.id, activeChat?.documentId, targetDocIds)
            addMessage({
              role: 'ai',
              content: data.answer,
              sources: data.sources || [],
              confidence: data.confidence,
              mode: data.mode,
            })
          } catch (err) {
            const detail = err.response?.data?.detail
            const msg = err.response?.status === 401
              ? '🔒 Session expired. Please sign in again.'
              : `**Error:** ${detail || err.message || 'Backend error'}`
            addMessage({ role: 'ai', content: msg, sources: [], confidence: 0 })
          } finally {
            setIsLoading(false)
          }
        }
      })
    } catch {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const initialLetter = (displayName || 'User').charAt(0).toUpperCase()

  return (
    <div className="flex flex-col h-full w-full bg-[#0F172A] overflow-hidden relative">

      {/* Top Bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.06] bg-[#0F172A] flex-shrink-0 relative z-20">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
          <div className="min-w-0 flex items-center gap-2">
            <h2 className="font-semibold text-[13px] text-white truncate">
              {selectedDocIds.length > 0
                ? `Multi-Doc RAG (${selectedDocIds.length} docs selected)`
                : (activeDocument ? activeDocument.name : 'Synexa Document AI')}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Multi-Doc Selector Toggle */}
          <button
            onClick={() => setMultiDocOpen(p => !p)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all border",
              selectedDocIds.length > 0
                ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400 shadow-md shadow-cyan-900/30"
                : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/10"
            )}
            title="Select multiple uploaded documents for cross-document RAG search"
          >
            <Layers size={13} />
            {selectedDocIds.length > 0 ? `${selectedDocIds.length} Selected` : 'Multi-Doc RAG'}
          </button>

          {isLoggedIn && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold">
                {initialLetter}
              </div>
              <span className="text-[11px] text-slate-400">{displayName || 'User'}</span>
            </div>
          )}

          {!activeDocument && (
            <button
              onClick={() => navigate('/upload')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400"
            >
              <Upload size={12} /> Upload PDF
            </button>
          )}

          {isGuest && (
            <button onClick={() => navigate('/signup')}>
              <UserCircle2 size={12} />
            </button>
          )}

          <button onClick={() => setViewerOpen(p => !p)}>
            {viewerOpen ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
          </button>
        </div>
      </div>

      {/* Multi-Document Selection Drawer Dropdown */}
      <AnimatePresence>
        {multiDocOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-12 right-12 z-50 w-80 bg-[#1E293B] border border-white/[0.1] rounded-2xl shadow-2xl p-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-cyan-400" />
                <span className="text-xs font-bold text-white">Select Documents for RAG</span>
              </div>
              <button
                onClick={() => setMultiDocOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={13} />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 mb-3 leading-relaxed">
              Check multiple documents below to cross-reference and chat across all selected files simultaneously.
            </p>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {documents.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No documents uploaded yet.</p>
              ) : (
                documents.map(doc => {
                  const isSelected = selectedDocIds.includes(doc.documentId)
                  return (
                    <div
                      key={doc.documentId}
                      onClick={() => toggleDocSelection(doc.documentId)}
                      className={clsx(
                        "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border text-xs",
                        isSelected
                          ? "bg-cyan-500/10 border-cyan-500/30 text-white font-medium"
                          : "bg-white/[0.03] border-white/[0.05] text-slate-300 hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <FileText size={14} className={isSelected ? "text-cyan-400" : "text-slate-500"} />
                        <span className="truncate">{doc.documentName}</span>
                      </div>
                      <div className={clsx(
                        "w-4 h-4 rounded flex items-center justify-center border transition-all",
                        isSelected ? "bg-cyan-500 border-cyan-400 text-white" : "border-slate-600"
                      )}>
                        {isSelected && <Check size={11} />}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {selectedDocIds.length > 0 && (
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.08]">
                <button
                  onClick={clearDocSelection}
                  className="text-[11px] text-slate-400 hover:text-red-400 transition-colors"
                >
                  Clear Selection
                </button>
                <span className="text-[11px] text-cyan-400 font-semibold">
                  {selectedDocIds.length} files active
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="py-6 pb-32 space-y-6 max-w-3xl mx-auto w-full px-4 flex flex-col">
          <AnimatePresence>
            {messages.length === 0
              ? <EmptyState activeDocument={activeDocument} selectedDocIds={selectedDocIds} onSuggestion={sendMessage} />
              : messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
            }
          </AnimatePresence>

          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/90 to-transparent">
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="flex items-center justify-between px-1">
            <AnswerModeSelector value={mode} onChange={setMode} />
          </div>

          <div className="relative flex items-center bg-[#1E293B] border border-white/[0.08] rounded-2xl shadow-2xl focus-within:border-blue-500/50 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedDocIds.length > 0
                  ? `Ask anything across ${selectedDocIds.length} selected documents…`
                  : (activeDocument ? `Ask anything about ${activeDocument.name}…` : 'Upload a document to start chatting…')
              }
              disabled={isLoading}
              rows={1}
              className="w-full py-3.5 pl-4 pr-12 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none resize-none max-h-32 min-h-[44px]"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className={clsx(
                'absolute right-2.5 p-2 rounded-xl transition-all duration-200',
                input.trim() && !isLoading
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-white/[0.05] text-slate-500 cursor-not-allowed'
              )}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

function EmptyState({ activeDocument, selectedDocIds, onSuggestion }) {
  const suggestions = selectedDocIds.length > 0
    ? [
        'Compare key topics across all selected documents',
        'Summarize shared facts and key differences',
        'What are the main conclusions across these files?',
        'Synthesize an executive summary of selected documents',
      ]
    : (activeDocument
      ? [
          'Provide a comprehensive summary of this document',
          'What are the key takeaways and main objectives?',
          'List all important requirements, facts, or topics mentioned',
          'Explain the core concepts covered in this file',
        ]
      : [
          'Upload a PDF or document to start analyzing content',
          'Summarize key insights and main recommendations',
          'Extract core topics and important details from files',
        ])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 text-center my-auto"
    >
      <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400 shadow-xl shadow-blue-500/10">
        <Sparkles size={26} />
      </div>

      <h3 className="font-display font-bold text-white text-lg max-w-md truncate px-4">
        {selectedDocIds.length > 0
          ? `Multi-Document RAG Workspace (${selectedDocIds.length} files selected)`
          : (activeDocument ? activeDocument.name : 'Welcome to Synexa Document AI')}
      </h3>
      <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed px-4">
        {selectedDocIds.length > 0
          ? 'Asking questions will cross-reference and retrieve facts from all selected documents simultaneously.'
          : (activeDocument
            ? 'Ask specific questions about this document or select multiple files for Multi-Doc RAG.'
            : 'Upload a PDF, DOCX, or presentation file to analyze content and extract insights.')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-8 w-full max-w-xl px-4">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => onSuggestion(s)}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#1E293B]/60 border border-white/[0.08] hover:border-blue-500/50 hover:bg-[#1E293B] text-left transition-all group shadow-sm hover:shadow-md hover:shadow-blue-500/5"
          >
            <FileText size={15} className="text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-slate-300 group-hover:text-white leading-snug line-clamp-2">{s}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}