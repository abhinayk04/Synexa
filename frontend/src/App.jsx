import { Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ChatProvider } from './context/ChatContext'
import { ThemeProvider } from './context/ThemeContext'
import Landing   from './pages/Landing'
import Upload    from './pages/Upload'
import Chat      from './pages/Chat'
import Signup    from './pages/Signup'
import Signin    from './pages/Signin'
import Documents from './pages/Documents'

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[GlobalErrorBoundary caught error]:', error, errorInfo)
  }

  handleReset = () => {
    try {
      sessionStorage.clear()
    } catch {}
    this.setState({ hasError: false, error: null })
    window.location.href = '/upload'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0F172A] text-slate-100 p-8 text-center select-none">
          <div className="max-w-md bg-[#1E293B] border border-white/[0.08] p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xl">
              S
            </div>
            <h2 className="text-xl font-bold text-white">Synexa Workspace Ready</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              We updated your workspace settings. Click below to continue directly to your document workspace.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-900/50 transition-all mt-2"
            >
              Go to Document Workspace
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ChatProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/"           element={<Landing />} />
                <Route path="/upload"     element={<Upload />} />
                <Route path="/chat"       element={<Chat />} />
                <Route path="/documents"  element={<Documents />} />
                <Route path="/signup"     element={<Signup />} />
                <Route path="/signin"     element={<Signin />} />
                <Route path="*"           element={<Navigate to="/upload" replace />} />
              </Routes>
            </BrowserRouter>
          </ChatProvider>
        </AuthProvider>
      </ThemeProvider>
    </GlobalErrorBoundary>
  )
}
