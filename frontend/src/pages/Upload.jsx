import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageSquare, FileText, ArrowRight, FolderOpen } from 'lucide-react'
import UploadArea from '../components/UploadArea'
import { useChat } from '../context/ChatContext'

export default function Upload() {
  const navigate = useNavigate()
  const { chats, switchChat, documents } = useChat()

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col relative overflow-hidden">
      {/* Background glow */}
      <div className="fixed inset-0 bg-grid-pattern bg-grid opacity-30 pointer-events-none" />
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-[140px]" />

      {/* Top Navbar */}
      <div className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5 border-b border-white/[0.06] bg-[#0F172A]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
            title="Back to Home"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 p-1 flex items-center justify-center">
              <img src="/logo.png" alt="Synexa" className="w-full h-full object-contain" />
            </div>
            <span className="font-display font-bold text-white text-lg tracking-wide text-gradient">Synexa</span>
          </div>
        </div>

        {chats.length > 0 && (
          <button
            onClick={() => {
              switchChat(chats[0].id)
              navigate('/chat')
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-all shadow-lg shadow-blue-900/40"
          >
            <MessageSquare size={14} />
            Go to Recent Chat
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-xl">
          
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="font-display font-extrabold text-3xl md:text-4xl text-white tracking-tight mb-2">
              Start a New Chat
            </h1>
            <p className="text-sm text-slate-400">
              Upload a PDF, DOCX, or TXT document to begin asking questions.
            </p>
          </motion.div>

          {/* Clean Upload Dropzone Area */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <UploadArea />
          </motion.div>

          {/* Resume Old Chats List (If user has previous chats) */}
          {chats.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-5 rounded-2xl bg-[#1E293B]/70 border border-white/[0.08] backdrop-blur-md"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                  Or Continue an Existing Chat
                </span>
                <button
                  onClick={() => navigate('/documents')}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium flex items-center gap-1"
                >
                  All Documents ({documents.length}) <ArrowRight size={12} />
                </button>
              </div>

              <div className="space-y-2">
                {chats.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      switchChat(c.id)
                      navigate('/chat')
                    }}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] hover:border-blue-500/30 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                        <FileText size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate group-hover:text-blue-300 transition-colors">
                          {c.title}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {c.documentName}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs text-blue-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                      Open <ArrowRight size={12} />
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  )
}
