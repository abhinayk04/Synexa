import { motion, AnimatePresence } from 'framer-motion'
import { X, User, Palette, LogOut, Check, Sparkles, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'

export default function AccountDrawer({ isOpen, onClose }) {
  const { user, displayName, logout } = useAuth()
  const { theme, setTheme, themes } = useTheme()
  const navigate = useNavigate()

  if (!isOpen) return null

  const handleLogout = () => {
    logout()
    onClose()
    navigate('/')
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Right Sliding Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-[#111827] border-l border-white/[0.08] shadow-2xl flex flex-col overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] bg-[#0F172A]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <User size={18} />
            </div>
            <h3 className="font-display font-bold text-white text-base">My Account</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* User Profile Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-navy-800 to-navy-900 border border-white/[0.08] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20">
                {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-white truncate">{displayName}</h4>
                <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email || 'user@synexa.ai'}</p>
                <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
                  <Sparkles size={10} /> Active Member
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: Account Information */}
          <div className="space-y-3">
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-widest px-1">
              Account Details
            </p>
            
            <div className="space-y-2.5">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User size={15} className="text-slate-400" />
                  <span className="text-xs text-slate-300">Name</span>
                </div>
                <span className="text-xs font-semibold text-white">{displayName}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail size={15} className="text-slate-400" />
                  <span className="text-xs text-slate-300">Email</span>
                </div>
                <span className="text-xs font-mono text-slate-300 truncate max-w-[200px]">
                  {user?.email || 'user@synexa.ai'}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: UI Themes */}
          <div className="space-y-3">
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-widest px-1">
              Interface Theme
            </p>

            <div className="grid grid-cols-2 gap-3">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex flex-col p-3.5 rounded-xl border text-left transition-all duration-200 ${
                    theme === t.id
                      ? 'border-blue-500 bg-blue-600/10 shadow-md shadow-blue-500/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`w-3.5 h-3.5 rounded-full border border-white/20 ${t.preview}`} />
                    {theme === t.id && (
                      <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white">
                        <Check size={10} />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-white">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Logout Button */}
        <div className="p-6 border-t border-white/[0.06] bg-[#0F172A]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold text-xs transition-colors"
          >
            <LogOut size={16} /> Sign Out of Account
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
