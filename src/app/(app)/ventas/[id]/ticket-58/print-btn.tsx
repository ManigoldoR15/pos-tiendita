'use client'

import { Printer } from 'lucide-react'

export default function PrintBtn58() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
    >
      <Printer className="h-4 w-4" />
      Imprimir 58mm
    </button>
  )
}
