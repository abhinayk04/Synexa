import { motion } from 'framer-motion'
import { Zap, BookOpen, GraduationCap, Sparkles } from 'lucide-react'
import clsx from 'clsx'

const MODES = [
  { id: 'simple',   label: 'Concise',   icon: Zap,           desc: 'Quick, direct factual answer' },
  { id: 'detailed', label: 'Detailed',  icon: BookOpen,       desc: 'Comprehensive multi-paragraph explanation' },
  { id: 'exam',     label: 'Exam Prep', icon: GraduationCap, desc: 'Academic format: Definition, Details & Examples' },
  { id: 'summary',  label: 'Summary',   icon: Sparkles,      desc: 'Executive summary & top key takeaways' },
]

export default function AnswerModeSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-[#1E293B] border border-white/[0.08] rounded-xl p-1 shadow-md">
      {MODES.map(mode => (
        <button
          key={mode.id}
          onClick={() => onChange(mode.id)}
          title={mode.desc}
          className={clsx(
            'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
            value === mode.id ? 'text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          {value === mode.id && (
            <motion.div
              layoutId="mode-bg"
              className="absolute inset-0 bg-blue-600 rounded-lg shadow-md shadow-blue-600/30"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <mode.icon size={13} className="relative z-10 flex-shrink-0" />
          <span className="relative z-10">{mode.label}</span>
        </button>
      ))}
    </div>
  )
}
