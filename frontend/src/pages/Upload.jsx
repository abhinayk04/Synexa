import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap, FileText, Cpu, Database, Sparkles, FolderOpen, ArrowRight, Layers } from 'lucide-react'
import UploadArea from '../components/UploadArea'
import { useChat } from '../context/ChatContext'

const PIPELINE_STEPS = [
  { icon: FileText, label: 'OCR & Parsing',       desc: 'Extracts text from PDFs & images' },
  { icon: Layers,   label: 'Parent-Child Chunking',desc: 'Links 400-char chunks to parent sections' },
  { icon: Zap,      label: 'Dense & Sparse Embeds',desc: 'FAISS 384-dim + BM25Okapi' },
  { icon: Database, label: 'RRF Indexing',        desc: 'Built for high-precision retrieval' },
]

export default function Upload() {
  const navigate = useNavigate()
  const { documents, switchChat } = useChat()

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col relative overflow-hidden">
      {/* Background glow effects */}
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

        {documents.length > 0 && (
          <button
            onClick={() => navigate('/documents')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white transition-all"
          >
            <FolderOpen size={14} className="text-blue-400" />
            My Documents ({documents.length})
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-3xl">
          
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 mb-4">
              <Sparkles size={12} fill="currentColor" />
              Interactive Knowledge Base
            </div>
            <h1 className="font-display font-black text-4xl md:text-5xl text-white tracking-tight mb-3">
              Upload your document
            </h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Upload any PDF, DOCX, or TXT document to create a vector-indexed RAG assistant.
            </p>
          </motion.div>

          {/* Main Upload Dropzone Area */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-10"
          >
            <UploadArea />
          </motion.div>

          {/* Pipeline Visualizer Steps */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl bg-[#1E293B]/60 border border-white/[0.06] backdrop-blur-md"
          >
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest text-center mb-6">
              What happens after upload
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {PIPELINE_STEPS.map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-2.5 text-blue-400 shadow-md">
                    <step.icon size={18} />
                  </div>
                  <p className="text-xs font-display font-bold text-white mb-1">{step.label}</p>
                  <p className="text-[11px] text-slate-400 leading-tight">{step.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  )
}
