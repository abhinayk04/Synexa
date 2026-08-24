import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, FileText, ArrowRight, FolderOpen, Clock, Sparkles, Plus, Search } from 'lucide-react'
import UploadArea from '../components/UploadArea'
import Sidebar from '../components/Sidebar'
import { useChat } from '../context/ChatContext'
import { useAuth } from '../context/AuthContext'

export default function Upload() {
  const navigate = useNavigate()
  const { chats, switchChat, documents } = useChat()
  const { displayName } = useAuth()

  return (
    <div className="flex h-screen bg-[#0F172A] overflow-hidden">
      {/* Persistent Left Sidebar */}
      <Sidebar />

      {/* Main Right Workspace Area */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto relative bg-[#0B1222]">
        {/* Background glow effects */}
        <div className="fixed inset-0 bg-grid-pattern bg-grid opacity-20 pointer-events-none" />
        <div className="pointer-events-none fixed top-0 right-0 w-[600px] h-[300px] bg-blue-600/10 rounded-full blur-[140px]" />

        {/* Workspace Top Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06] bg-[#0B1222]/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 p-1 flex items-center justify-center">
              <img src="/logo.png" alt="Synexa" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="font-display font-bold text-white text-base leading-tight">Document Workspace</h2>
              <p className="text-[11px] text-slate-400">Upload documents or resume chat history</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {chats.length > 0 && (
              <button
                onClick={() => {
                  switchChat(chats[0].id)
                  navigate('/chat')
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-all shadow-lg shadow-blue-900/40"
              >
                <MessageSquare size={14} />
                Open Active Chat
              </button>
            )}
          </div>
        </div>

        {/* Workspace Content */}
        <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 relative z-10 space-y-10">

          {/* Section 1: Upload Drag & Drop Area */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-2"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400">
                <Sparkles size={12} fill="currentColor" /> RAG Knowledge Assistant
              </div>
              <h1 className="font-display font-extrabold text-3xl md:text-4xl text-white tracking-tight">
                Start a New Document Chat
              </h1>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Drag & drop any PDF, DOCX, or TXT file below to create an instant AI assistant.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <UploadArea />
            </motion.div>
          </div>

          {/* Section 2: Recent Document Chats & Past History */}
          {chats.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-blue-400" />
                  <h3 className="font-display font-bold text-white text-base">Recent Chat History</h3>
                  <span className="text-xs text-slate-500 font-mono">({chats.length} active sessions)</span>
                </div>

                <button
                  onClick={() => navigate('/documents')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                >
                  View All Documents <ArrowRight size={12} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chats.map((c) => (
                  <motion.div
                    key={c.id}
                    whileHover={{ scale: 1.01, y: -2 }}
                    onClick={() => {
                      switchChat(c.id)
                      navigate('/chat')
                    }}
                    className="p-4 rounded-2xl bg-[#1E293B]/60 hover:bg-[#1E293B] border border-white/[0.08] hover:border-blue-500/40 cursor-pointer transition-all duration-200 shadow-xl flex flex-col justify-between group"
                  >
                    <div className="flex items-start gap-3.5 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-blue-300 transition-colors">
                          {c.title}
                        </h4>
                        <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">
                          {c.documentName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
                      <span className="text-[11px] text-slate-500 font-mono">
                        {c.uploadedAt || 'Recent'}
                      </span>
                      <span className="text-xs font-semibold text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Resume Chat <ArrowRight size={12} />
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  )
}
