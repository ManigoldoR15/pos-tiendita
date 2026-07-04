'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeCtx = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: 'light',
  toggleTheme: () => {},
})

// Runs synchronously on the client; returns 'light' during SSR to avoid mismatch.
// storageKey es por usuario (theme:<uid>) — cada cuenta guarda su propio tema
// en este navegador, sin heredarlo de otra sesión.
function readTheme(storageKey: string): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function ThemeProvider({
  children,
  storageKey = 'theme',
}: {
  children: React.ReactNode
  storageKey?: string
}) {
  // Lazy initializer: runs once synchronously — no useEffect race condition.
  const [theme, setTheme] = useState<Theme>(() => readTheme(storageKey))

  // Si cambia el usuario (otra clave), re-leer y aplicar su tema
  useEffect(() => {
    const t = readTheme(storageKey)
    setTheme(t)
    document.documentElement.classList.toggle('dark', t === 'dark')
  }, [storageKey])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem(storageKey, next) } catch {}
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  return <ThemeCtx.Provider value={{ theme, toggleTheme }}>{children}</ThemeCtx.Provider>
}

export function useTheme() {
  return useContext(ThemeCtx)
}
