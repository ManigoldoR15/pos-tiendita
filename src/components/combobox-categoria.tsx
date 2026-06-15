'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type Categoria = { id: string; nombre: string }

type Props = {
  categorias: Categoria[]
  placeholder?: string
  required?: boolean
  defaultCategoriaId?: string
}

export default function ComboboxCategoria({
  categorias,
  placeholder = 'Selecciona o escribe…',
  required,
  defaultCategoriaId = '',
}: Props) {
  const initialNombre = categorias.find((c) => c.id === defaultCategoriaId)?.nombre ?? ''

  const [open, setOpen] = useState(false)
  const [texto, setTexto] = useState(initialNombre)
  const [categoriaId, setCategoriaId] = useState(defaultCategoriaId)
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtradas = texto.trim()
    ? categorias.filter((c) =>
        c.nombre.toLowerCase().includes(texto.trim().toLowerCase()),
      )
    : categorias

  const exactMatch = categorias.some(
    (c) => c.nombre.toLowerCase() === texto.trim().toLowerCase(),
  )
  const mostrarCrear = texto.trim().length > 0 && !exactMatch

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function seleccionar(cat: Categoria) {
    setTexto(cat.nombre)
    setCategoriaId(cat.id)
    setNuevaCategoria('')
    setOpen(false)
  }

  function crearNueva() {
    const nombre = texto.trim()
    setCategoriaId('')
    setNuevaCategoria(nombre)
    setOpen(false)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setTexto(e.target.value)
    setCategoriaId('')
    setNuevaCategoria('')
    setOpen(true)
  }

  const showDropdown = open && (filtradas.length > 0 || mostrarCrear)

  return (
    <div ref={wrapperRef} className="relative">
      <input type="hidden" name="categoria_id" value={categoriaId} />
      <input type="hidden" name="nueva_categoria_nombre" value={nuevaCategoria} />

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={texto}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          required={required && !categoriaId && !nuevaCategoria}
          className="w-full rounded-lg border border-input bg-background px-3 py-3 pr-9 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setOpen((o) => !o)
            inputRef.current?.focus()
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-background shadow-lg">
          {filtradas.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                seleccionar(cat)
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent',
                categoriaId === cat.id && 'bg-primary/5 font-medium',
              )}
            >
              {categoriaId === cat.id ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>{cat.nombre}</span>
            </button>
          ))}
          {mostrarCrear && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                crearNueva()
              }}
              className="flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent"
            >
              + Crear &ldquo;{texto.trim()}&rdquo;
            </button>
          )}
        </div>
      )}

      {nuevaCategoria && (
        <p className="mt-1 text-xs text-muted-foreground">
          Se creará la categoría &ldquo;{nuevaCategoria}&rdquo; al guardar.
        </p>
      )}
    </div>
  )
}
