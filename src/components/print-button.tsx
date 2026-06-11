'use client'

export function PrintButton({ label = 'Imprimir / Guardar PDF' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
    >
      {label}
    </button>
  )
}
