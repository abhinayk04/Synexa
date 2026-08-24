import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, User, Palette, Shield, Settings as SettingsIcon, Check, Moon, Sun, Lock, Sparkles, Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function SettingsModal({ isOpen, onClose, initialTab = 'profile' }) {
  const { user, displayName } = useAuth()
  const { theme, setTheme, themes } = useTheme()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl bg-[#1E293B] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[520px]"
        >
          {/* Left Navigation Sidebar */}
          <div className="w-full md:w-56 bg-[#0B1222] p-5 flex flex-col border-b md:border-b-0 md:border-r border-white/[0.06]">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <SettingsIcon size={18} />
              </div>
              <span className="font-display font-bold text-white text-base">Settings</span>
            </div>

            <nav className="space-y-1.5 flex-1">
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'profile'
                    ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <User size={15} /> Account & Profile
              </button>

              <button
                onClick={() => setActiveTab('appearance')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'appearance'
                    ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Palette size={15} /> Appearance & Themes
              </button>

              <button
                onClick={() => setActiveTab('security')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'security'
                    ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Shield size={15} /> Security & JWT
              </button>
            </nav>

            <div className="pt-4 border-t border-white/[0.06] mt-auto">
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user?.email || 'user@synexa.ai'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Tab Content Area */}
          <div className="flex-1 p-6 overflow-y-auto relative flex flex-col bg-[#1E293B]">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            {/* TAB 1: PROFILE */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white font-display">User Profile</h3>
                  <p className="text-xs text-slate-400 mt-1">Manage your account information and preferences.</p>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20">
                    {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{displayName}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{user?.email || 'user@synexa.ai'}</p>
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold">
                      Pro Member
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      readOnly
                      value={displayName}
                      className="w-full bg-[#0B1222] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      readOnly
                      value={user?.email || 'abhinaykota5183509@gmail.com'}
                      className="w-full bg-[#0B1222] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: APPEARANCE & THEMES */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white font-display">Appearance & Themes</h3>
                  <p className="text-xs text-slate-400 mt-1">Customize the visual theme of your Synexa workspace.</p>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`relative flex flex-col p-4 rounded-2xl border text-left transition-all duration-200 ${
                        theme === t.id
                          ? 'border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-500/10'
                          : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={`w-4 h-4 rounded-full border border-white/20 ${t.preview}`} />
                        {theme === t.id && (
                          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white">
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-bold text-white mb-0.5">{t.label}</span>
                      <span className="text-[10px] text-slate-400">
                        {t.id === 'midnight' ? 'Classic Deep Tech' : t.id === 'violet' ? 'Cyberpunk Purple' : t.id === 'emerald' ? 'Matrix Green Glass' : 'Clean Light Mode'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: SECURITY */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white font-display">Security & Session</h3>
                  <p className="text-xs text-slate-400 mt-1">Your session is protected with HMAC-SHA256 JWT tokens.</p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Authentication Method</span>
                    <span className="text-xs font-mono text-emerald-400 font-semibold">JWT Bearer (HS256)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Password Hashing</span>
                    <span className="text-xs font-mono text-blue-400 font-semibold">Direct bcrypt</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Vector Isolation</span>
                    <span className="text-xs font-mono text-cyan-400 font-semibold">Per-User Scoped Index</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
