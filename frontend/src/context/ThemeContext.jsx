import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)
const THEME_KEY = 'synexa_theme'

export const THEMES = [
  { id: 'midnight', label: 'Midnight Navy', color: '#0F172A', preview: 'bg-[#0F172A]' },
  { id: 'violet', label: 'Cyberpunk Violet', color: '#110C26', preview: 'bg-[#110C26]' },
  { id: 'emerald', label: 'Emerald Matrix', color: '#061912', preview: 'bg-[#061912]' },
  { id: 'light', label: 'Slate Light', color: '#F8FAFC', preview: 'bg-[#F8FAFC]' },
]

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved && THEMES.some(t => t.id === saved)) return saved
  } catch {}
  return 'midnight'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'light') {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    }
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const changeTheme = (newTheme) => {
    if (THEMES.some(t => t.id === newTheme)) {
      setTheme(newTheme)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: changeTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
