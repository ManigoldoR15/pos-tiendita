export type EstatusClienteValue = 'verde' | 'amarillo' | 'rojo' | null | undefined

const CONFIG = {
  verde: {
    emoji: '😊',
    label: 'Buen cliente',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  amarillo: {
    emoji: '😐',
    label: 'Con pendientes',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
  rojo: {
    emoji: '😟',
    label: 'Cliente difícil',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
  },
} as const

type Props = {
  estatus: EstatusClienteValue
  nota?: string | null
  size?: 'sm' | 'md' | 'lg'
}

export function EstatusCliente({ estatus, nota, size = 'md' }: Props) {
  if (!estatus) return null
  const { emoji, label, bg, text } = CONFIG[estatus]

  if (size === 'sm') {
    return (
      <span
        title={`${label}${nota ? `: ${nota}` : ''}`}
        className="text-base leading-none select-none"
        aria-label={label}
      >
        {emoji}
      </span>
    )
  }

  if (size === 'lg') {
    return (
      <div className={`inline-flex flex-col items-center gap-2 rounded-2xl px-6 py-4 ${bg}`}>
        <span className="text-5xl leading-none select-none" aria-hidden>
          {emoji}
        </span>
        <span className={`text-sm font-bold ${text}`}>{label}</span>
        {nota && (
          <span className="text-xs text-muted-foreground max-w-xs text-center leading-snug">{nota}</span>
        )}
      </div>
    )
  }

  // md
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${bg} ${text}`}
    >
      <span className="leading-none select-none" aria-hidden>
        {emoji}
      </span>
      {label}
    </span>
  )
}
