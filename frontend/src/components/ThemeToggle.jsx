import { useState, useRef, useEffect } from 'react'
import { Palette, Check } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentTheme = themes.find(t => t.id === theme) || themes[0]

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08]
                   border border-white/[0.08] text-xs font-medium transition-all duration-150"
        title="Change UI Theme"
      >
        <Palette size={14} className="text-blue-400" />
        <span className="hidden md:inline">{currentTheme.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-[#1E293B] border border-white/[0.1]
                        shadow-2xl shadow-black/60 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-3 py-1.5">
            Select Theme
          </p>
          <div className="space-y-1">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id)
                  setOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs
                           transition-all duration-150 ${
                             theme === t.id
                               ? 'bg-blue-600/20 text-blue-400 font-semibold'
                               : 'hover:bg-white/[0.05] text-slate-300'
                           }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full border border-white/20 ${t.preview}`} />
                  <span>{t.label}</span>
                </div>
                {theme === t.id && <Check size={14} className="text-blue-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
