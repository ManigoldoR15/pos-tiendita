import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Settings, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { hoyMX } from '@/lib/fecha'
import {
  calcularEstado, diasRestantesTexto,
  ESTADO_CONFIG, ESTADO_ORDEN,
  UBICACION_LABELS,
  type EstadoLote,
} from '@/lib/caducidad'
import { cn } from '@/lib/utils'
import { marcarNegroAction, darDeBajaAction, seedCategoriasIfEmpty } from './actions'

export default async function CaducidadPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>
}) {
  const { estado: filtroEstado } = await searchParams
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const rol = await getRolActual()

  // Sembrar categorías por defecto en primer uso
  await seedCategoriasIfEmpty(negocio.id)

  const supabase = await createClient()
  const { data: lotes } = await supabase
    .from('lotes_producto')
    .select(`
      id, cantidad, fecha_recepcion, ubicacion, fecha_caducidad,
      estado_manual, notas, activo,
      productos(id, nombre, tipo_caducidad)
    `)
    .eq('negocio_id', negocio.id)
    .eq('activo', true)
    .not('fecha_caducidad', 'is', null)
    .order('fecha_caducidad', { ascending: true })

  const hoy = hoyMX()

  // Calcular estado de cada lote
  type LoteConEstado = {
    id: string
    cantidad: number
    fecha_recepcion: string
    ubicacion: string
    fecha_caducidad: string
    estado_manual: string | null
    notas: string | null
    productoNombre: string
    tipoCaducidad: 'envasado' | 'fresco' | null
    estado: EstadoLote
    diasRestantes: number
  }

  const lotesConEstado: LoteConEstado[] = (lotes ?? []).map((l) => {
    const prod = l.productos as unknown as { id: string; nombre: string; tipo_caducidad: string | null } | null
    const tipoCaducidad = (prod?.tipo_caducidad ?? null) as 'envasado' | 'fresco' | null
    const estado = calcularEstado({
      fechaCaducidad: l.fecha_caducidad,
      fechaRecepcion: l.fecha_recepcion,
      tipoCaducidad,
      estadoManual: l.estado_manual,
      hoy,
    })
    const msDay = 86_400_000
    const diasRestantes = Math.round(
      (new Date(l.fecha_caducidad + 'T12:00:00Z').getTime() - new Date(hoy + 'T12:00:00Z').getTime()) / msDay,
    )
    return {
      id: l.id,
      cantidad: l.cantidad,
      fecha_recepcion: l.fecha_recepcion,
      ubicacion: l.ubicacion,
      fecha_caducidad: l.fecha_caducidad,
      estado_manual: l.estado_manual,
      notas: l.notas,
      productoNombre: prod?.nombre ?? '—',
      tipoCaducidad,
      estado,
      diasRestantes,
    }
  })

  // Filtrar por estado si hay filtro activo
  const lotesFiltrados = filtroEstado
    ? lotesConEstado.filter((l) => l.estado === filtroEstado)
    : lotesConEstado

  // Ordenar: negro→rojo→amarillo→verde, luego por fecha caducidad
  const ORDEN_IDX: Record<EstadoLote, number> = { negro: 0, rojo: 1, amarillo: 2, verde: 3 }
  lotesFiltrados.sort((a, b) =>
    ORDEN_IDX[a.estado] - ORDEN_IDX[b.estado] || a.diasRestantes - b.diasRestantes,
  )

  // Conteos por estado
  const conteos = Object.fromEntries(
    ESTADO_ORDEN.map((e) => [e, lotesConEstado.filter((l) => l.estado === e).length]),
  ) as Record<EstadoLote, number>

  const puedeGestionarStock = rol === 'dueno'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Caducidad</h1>
        <div className="flex flex-wrap items-center gap-2">
          {puedeGestionarStock && (
            <Link
              href="/caducidad/configuracion"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4" />
              Categorías
            </Link>
          )}
        </div>
      </div>

      {/* Aviso de principio de seguridad */}
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800/30 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Sugerencia según fecha — verifica siempre el producto.</strong>{' '}
          El semáforo es una guía de apoyo. El estado real lo determina la persona al ver, oler y tocar. Nunca te bases solo en la fecha.
        </span>
      </div>

      {/* Filtros por estado */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/caducidad"
          className={cn(
            'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
            !filtroEstado ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
          )}
        >
          Todos ({lotesConEstado.length})
        </Link>
        {ESTADO_ORDEN.map((e) => {
          const cfg = ESTADO_CONFIG[e]
          const n = conteos[e]
          return (
            <Link
              key={e}
              href={`/caducidad?estado=${e}`}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                filtroEstado === e ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'hover:bg-accent',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
              {cfg.labelCorto} ({n})
            </Link>
          )
        })}
      </div>

      {/* Lista de lotes */}
      {lotesFiltrados.length === 0 ? (
        <div className="mt-12 text-center text-muted-foreground">
          {lotesConEstado.length === 0 ? (
            <>
              <p className="text-lg">No hay lotes con fecha de caducidad registrados.</p>
              <p className="mt-1 text-sm">
                Agrega lotes desde{' '}
                <Link href="/productos" className="font-medium text-primary hover:underline">
                  Productos
                </Link>{' '}
                (botón &quot;Agregar lote&quot;) con fecha de caducidad para que aparezcan aquí.
              </p>
            </>
          ) : (
            <p className="text-lg">No hay lotes en estado &quot;{ESTADO_CONFIG[filtroEstado as EstadoLote]?.label}&quot;.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {lotesFiltrados.map((lote) => {
            const cfg = ESTADO_CONFIG[lote.estado]
            return (
              <div
                key={lote.id}
                className={cn(
                  'rounded-xl border px-4 py-3 shadow-sm',
                  cfg.bg, cfg.border,
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  {/* Info del lote */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', cfg.dot)} />
                      <span className="font-semibold text-sm">{lote.productoNombre}</span>
                      <span className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-semibold',
                        cfg.bg, cfg.text, cfg.border,
                      )}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Cantidad: <strong className="text-foreground">{lote.cantidad}</strong></span>
                      <span>{UBICACION_LABELS[lote.ubicacion] ?? lote.ubicacion}</span>
                      <span>
                        Caduca:{' '}
                        <strong className={cn(cfg.text)}>
                          {lote.fecha_caducidad}{' '}
                          ({diasRestantesTexto(lote.diasRestantes)})
                        </strong>
                      </span>
                    </div>
                    {lote.notas && (
                      <p className="mt-1 text-xs text-muted-foreground italic">{lote.notas}</p>
                    )}
                    {/* Advertencia rojo para envasados — nunca para frescos */}
                    {lote.estado === 'rojo' && lote.tipoCaducidad === 'envasado' && (
                      <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                        Considera rematar el precio — verifica el producto antes.
                      </p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {lote.estado !== 'negro' && (
                      <form action={marcarNegroAction}>
                        <input type="hidden" name="lote_id" value={lote.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          Echado a perder
                        </button>
                      </form>
                    )}
                    {puedeGestionarStock && (
                      <form action={darDeBajaAction}>
                        <input type="hidden" name="lote_id" value={lote.id} />
                        <button
                          type="submit"
                          title="Desactiva el lote y descuenta del inventario"
                          className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          Dar de baja
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
