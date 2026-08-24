import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Zap, FileText, Search, Shield, ArrowRight, Star, MessageSquare, Brain, LogOut, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'

const FEATURES = [
  {
    icon: Brain,
    title: 'Semantic Understanding',
    desc: 'Goes beyond keyword search — understands the meaning of your question and finds contextually relevant answers.',
  },
  {
    icon: FileText,
    title: 'Multi-Document Knowledge',
    desc: 'Upload multiple PDFs and ask questions across your entire document library in one unified interface.',
  },
  {
    icon: Search,
    title: 'Source Citations',
    desc: 'Every answer comes with exact page references so you can verify and explore the original source material.',
  },
  {
    icon: Shield,
    title: 'Runs Locally',
    desc: 'Your documents never leave your machine. The entire RAG pipeline runs locally with open-source models.',
  },
]

const STEPS = [
  { num: '01', title: 'Upload your PDF', desc: 'Drag and drop any PDF document.' },
  { num: '02', title: 'Ask a question', desc: 'Type any question in natural language.' },
  { num: '03', title: 'Get cited answers', desc: 'Receive answers with source page references.' },
]

export default function Landing() {
  const navigate = useNavigate()
  const { isLoggedIn, logout, displayName } = useAuth()

  const handleStartChat = () => {
    if (isLoggedIn) {
      navigate('/upload')
    } else {
      navigate('/signup')
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 overflow-x-hidden">
      {/* Background grid */}
      <div className="fixed inset-0 bg-grid-pattern bg-grid opacity-40 pointer-events-none" />
      <div className="fixed inset-0 bg-hero-gradient pointer-events-none" />

      {/* Modern Top Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5 max-w-7xl mx-auto border-b border-white/[0.06]">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 p-1.5 shadow-lg shadow-blue-500/10">
            <img src="/logo.png" alt="Synexa" className="w-full h-full object-contain" />
          </div>
          <span className="text-gradient text-2xl font-bold tracking-wide drop-shadow-[0_0_12px_rgba(59,130,246,0.5)] font-display">
            Synexa
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Selector */}
          <ThemeToggle />

          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-[10px] font-bold text-blue-400">
                  {displayName.charAt(0)}
                </div>
                <span className="text-xs text-slate-300 font-medium">{displayName}</span>
              </div>

              <button
                onClick={() => navigate('/upload')}
                className="btn-primary text-xs sm:text-sm px-4 py-2"
              >
                Dashboard
              </button>

              <button
                onClick={() => {
                  logout()
                  navigate('/')
                }}
                className="btn-ghost text-xs text-slate-400 hover:text-red-400 p-2"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/signin')}
                className="btn-ghost text-xs sm:text-sm px-4 py-2 font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="btn-primary text-xs sm:text-sm px-4 py-2"
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-24 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 mb-8 backdrop-blur-md shadow-inner">
            <Star size={12} fill="currentColor" className="text-blue-400" />
            Advanced RAG · Open Source · Hybrid Search
          </div>

          <h1 className="font-display font-extrabold text-5xl md:text-7xl text-white leading-[1.05] tracking-tight mb-6">
            Chat with your{' '}
            <span className="text-gradient">documents</span>
            <br />intelligently.
          </h1>

          <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto mb-10">
            Synexa uses retrieval-augmented generation to let you ask natural language questions
            about your PDFs and get precise, cited answers powered by local AI.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartChat}
              className="btn-primary flex items-center gap-2 text-base px-8 py-3.5 shadow-xl shadow-blue-600/30"
            >
              Start Chatting with Your Documents
              <ArrowRight size={18} />
            </motion.button>
          </div>
        </motion.div>

        {/* Hero Visual Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-16 w-full max-w-2xl"
        >
          <div className="bg-navy-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/80">
            {/* Browser Header Chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-navy-900/80 backdrop-blur-md">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              <div className="flex-1 mx-4 bg-navy-700/60 rounded-md px-3 py-1 text-[10px] text-slate-500 font-mono">
                localhost:5173/chat
              </div>
            </div>
            {/* Chat Preview */}
            <div className="p-6 space-y-4 text-left">
              <FakeChatMessage role="user" text="What are the key skills of the candidate?" />
              <FakeChatMessage
                role="ai"
                text="The candidate has expertise in **Python**, **FastAPI**, **React**, and **Hybrid Search RAG**. They built production AI document search engines with 92% retrieval precision."
                sources={[{ doc: 'resume.pdf', page: 2 }]}
                confidence={94}
              />
            </div>
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="relative z-10 px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-2">How it works</p>
          <h2 className="font-display font-bold text-3xl text-white">Three steps to instant answers</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="card relative border-white/[0.08] hover:border-blue-500/30"
            >
              <p className="font-display font-black text-5xl text-blue-500/10 absolute top-4 right-4">{step.num}</p>
              <p className="font-display font-bold text-white text-base mb-2 relative z-10">{step.title}</p>
              <p className="text-sm text-slate-400 relative z-10">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-2">Features</p>
          <h2 className="font-display font-bold text-3xl text-white">Built for serious document work</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="card flex gap-4 border-white/[0.08] hover:border-blue-500/30"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <f.icon size={18} className="text-blue-400" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-white text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative z-10 px-6 py-20 text-center border-t border-white/[0.06]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto"
        >
          <h2 className="font-display font-extrabold text-4xl text-white mb-4">
            Ready to ask your documents anything?
          </h2>
          <p className="text-slate-400 mb-8 text-sm">Upload your first PDF and start getting AI-powered answers in seconds.</p>
          <button
            onClick={handleStartChat}
            className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3.5 shadow-xl shadow-blue-600/30"
          >
            Upload Your First Document <ArrowRight size={18} />
          </button>
        </motion.div>
      </section>
    </div>
  )
}

function FakeChatMessage({ role, text, sources, confidence }) {
  return (
    <div className={`flex items-start gap-3 ${role === 'user' ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0
        ${role === 'user' ? 'bg-blue-600/30 border border-blue-500/40 text-blue-400' : 'bg-navy-700 border border-white/10 text-blue-400'}`}>
        {role === 'user' ? <User size={14} /> : <Zap size={14} />}
      </div>
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-md
        ${role === 'user' ? 'bg-blue-600 text-white rounded-tr-xs' : 'bg-navy-700 text-slate-200 rounded-tl-xs border border-white/5'}`}
      >
        <p dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
        {sources && (
          <div className="mt-2.5 flex items-center gap-2 border-t border-white/10 pt-2">
            {sources.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-navy-800 border border-white/10 rounded-md px-2 py-0.5 text-slate-400">
                <FileText size={10} /> {s.doc} p.{s.page}
              </span>
            ))}
            {confidence && (
              <span className="text-[10px] text-emerald-400 font-mono ml-auto font-semibold">{confidence}% Match</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
