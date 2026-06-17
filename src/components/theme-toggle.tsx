'use client'

import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  return (
    <button
      onClick={toggleTheme}
      aria-label="Cambiar tema"
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
        className,
      )}
    >
      {mounted
        ? theme === 'dark'
          ? <Sun className="h-4 w-4" />
          : <Moon className="h-4 w-4" />
        : <span className="h-4 w-4" />}
    </button>
  )
}
