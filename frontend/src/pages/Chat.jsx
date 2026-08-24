import { useEffect, Component } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from '../components/Sidebar'
import ChatBox from '../components/ChatBox'
import DocumentViewer from '../components/DocumentViewer'
import { useChat } from '../context/ChatContext'
import { useNavigate } from 'react-router-dom'

class ViewerErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[DocumentViewer ErrorBoundary caught]:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-[#080F1E] text-slate-400">
          <p className="text-xs font-semibold text-slate-300 mb-1">Document Preview Unavailable</p>
          <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
            Your document RAG chat is still active and working. Re-upload or refresh to reload preview.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Chat() {
  const { viewerOpen, setViewerOpen, sidebarCollapsed, activeChat } = useChat()
  const navigate = useNavigate()

  useEffect(() => {
    const handle = () => {
      if (window.innerWidth < 1200) setViewerOpen(false)
      else setViewerOpen(true)
    }
    handle()
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [setViewerOpen])

  const sideW = sidebarCollapsed ? '64px' : '260px'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0F172A]">

      {/* LEFT — Sidebar */}
      <div
        className="h-full flex-shrink-0 border-r border-white/[0.06] overflow-hidden"
        style={{
          width: sideW,
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <Sidebar />
      </div>

      {/* CENTER — Chat Box */}
      <div className="h-full flex-1 min-w-0 overflow-hidden flex flex-col">
        {activeChat ? (
          <ChatBox />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <p className="text-slate-400 font-medium">No active chat selected</p>
            <p className="text-slate-600 text-xs">Upload a new document or pick a chat from the sidebar.</p>
            <button
              onClick={() => navigate('/upload')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/40 transition-all"
            >
              Upload a Document
            </button>
          </div>
        )}
      </div>

      {/* RIGHT — Document Preview Viewer */}
      <AnimatePresence initial={false}>
        {viewerOpen && activeChat && (
          <motion.div
            key="pdf-viewer"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '40vw', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="h-full flex-shrink-0 border-l border-white/[0.06] overflow-hidden"
            style={{ minWidth: 0 }}
          >
            <div className="w-full h-full">
              <ViewerErrorBoundary>
                <DocumentViewer />
              </ViewerErrorBoundary>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
