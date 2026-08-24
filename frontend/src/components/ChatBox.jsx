import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, FileText,
  PanelRight, PanelRightClose, Upload, UserCircle2,
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
    activeDocument, activeChat,
    viewerOpen, setViewerOpen,
  } = useChat()

  const { isGuest, isLoggedIn, displayName } = useAuth()

  const [input, setInput] = useState('')
  const [mode, setMode] = useState('simple')

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

    if (!activeChat?.id) {
      addMessage({
        role: 'ai',
        content: '⚠️ Please upload a document first before asking questions.',
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

    try {
      await askQuestionStream({
        question: q,
        mode,
        chatId: activeChat.id,
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
          // Instant HTTP POST Fallback if SSE stream encounters network error
          try {
            const data = await askQuestion(q, mode, activeChat.id)
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
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.06] bg-[#0F172A] flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
          <div className="min-w-0">
            <h2 className="font-semibold text-[13px] text-white truncate">
              {activeDocument ? activeDocument.name : 'Synexa Chat'}
            </h2>
            {activeDocument && (
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                {activeDocument.chunks || 12} chunks indexed
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="py-6 pb-32 space-y-6 max-w-3xl mx-auto w-full px-4 flex flex-col">
          <AnimatePresence>
            {messages.length === 0
              ? <EmptyState activeDocument={activeDocument} onSuggestion={sendMessage} />
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
              placeholder={activeDocument ? `Ask anything about ${activeDocument.name}…` : 'Upload a document to start chatting…'}
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

function EmptyState({ activeDocument, onSuggestion }) {
  const suggestions = activeDocument
    ? [
        `What are the main conclusions in ${activeDocument.name}?`,
        'Is this JD matching with my resume?',
        'Summarize the key experience and technical skills.',
        'List all major projects and tools mentioned.',
      ]
    : [
        'Upload your resume or JD to get started',
        'Compare JD requirements against your experience',
        'Summarize key insights and recommendations',
      ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center my-auto"
    >
      <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400 shadow-xl shadow-blue-500/10">
        <Sparkles size={26} />
      </div>

      <h3 className="font-display font-bold text-white text-lg">
        {activeDocument ? activeDocument.name : 'Welcome to Synexa Document AI'}
      </h3>
      <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
        {activeDocument
          ? 'Ask specific questions about this document or perform multi-document RAG comparison.'
          : 'Upload a PDF or DOCX file to analyze content, compare JDs with resumes, and extract insights.'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-8 w-full max-w-xl">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => onSuggestion(s)}
            className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#1E293B]/60 border border-white/[0.06] hover:border-blue-500/40 hover:bg-[#1E293B] text-left transition-all group"
          >
            <FileText size={14} className="text-blue-400 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-xs text-slate-300 group-hover:text-white leading-snug">{s}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}