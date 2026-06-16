'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { COLORES_CATEGORIA } from '@/lib/colores-categoria'
import { cn } from '@/lib/utils'

type Props = {
  defaultValue?: string | null
}

export default function SelectorColorCategoria({ defaultValue = null }: Props) {
  const [color, setColor] = useState<string | null>(defaultValue)

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">Color (opcional)</label>
      <input type="hidden" name="color" value={color ?? ''} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setColor(null)}
          title="Sin color"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border-2 bg-muted text-muted-foreground',
            color === null ? 'border-foreground' : 'border-transparent',
          )}
        >
          <span className="text-xs">✕</span>
        </button>
        {COLORES_CATEGORIA.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setColor(c.key)}
            title={c.label}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border-2',
              c.dot,
              color === c.key ? 'border-foreground' : 'border-transparent',
            )}
          >
            {color === c.key && <Check className="h-4 w-4 text-white" />}
          </button>
        ))}
      </div>
    </div>
  )
}
