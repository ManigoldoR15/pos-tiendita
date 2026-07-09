import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { requireModulo } from '@/lib/modulos'
import { formatMXN } from '@/lib/dinero'
import { HandCoins, AlertTriangle } from 'lucide-react'
import ApartadoAcciones from './apartado-acciones'

type Apartado = {
  id: string
  cliente_nombre: string
  total: number
  estado: 'activo' | 'liquidado' | 'cancelado'
  fecha_limite: string | null
  creado_en: string
  apartado_items: { nombre_producto: string; variante_texto: string | null; cantidad: number }[]
  apartado_abonos: { monto: number }[]
}

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })

export default async function ApartadosPage() {
  await requireModulo('apartados')
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const supabase = await createClient()
  const { data } = await supabase
    .from('apartados')
    .select('id, cliente_nombre, total, estado, fecha_limite, creado_en, apartado_items(nombre_producto, variante_texto, cantidad), apartado_abonos(monto)')
    .eq('negocio_id', negocio.id)
    .order('creado_en', { ascending: false })
    .limit(200)

  const apartados = (data ?? []) as Apartado[]
  const activos = apartados.filter((a) => a.estado === 'activo')
  const historial = apartados.filter((a) => a.estado !== 'activo').slice(0, 30)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

  const abonado = (a: Apartado) => a.apartado_abonos.reduce((s, x) => s + x.monto, 0)
  const prendas = (a: Apartado) =>
    a.apartado_items
      .map((i) => `${i.cantidad > 1 ? `${Number(i.cantidad)}× ` : ''}${i.nombre_producto}${i.variante_texto ? ` (${i.variante_texto})` : ''}`)
      .join(', ')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <HandCoins className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-black tracking-tight">Apartados</h1>
          <p className="text-sm text-muted-foreground">
            Mercancía separada con anticipo. Se crea desde el POS con &quot;Apartar con anticipo&quot;.
          </p>
        </div>
      </div>

      {activos.length === 0 ? (
        <div className="card-soft p-10 text-center text-sm text-muted-foreground">
          No hay apartados activos.
        </div>
      ) : (
        <div className="card-soft divide-y divide-border/60">
          {activos.map((a) => {
            const pagado = abonado(a)
            const saldo = Math.max(0, a.total - pagado)
            const vencido = a.fecha_limite !== null && a.fecha_limite < hoy
            return (
              <div key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {a.cliente_nombre}
                    {vencido && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Vencido
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{prendas(a)}</p>
                  <p className="text-xs text-muted-foreground">
                    Apartado el {fmtFecha(a.creado_en)}
                    {a.fecha_limite && ` · límite ${fmtFecha(a.fecha_limite)}`}
                  </p>
                </div>
                <div className="flex items-center gap-4 sm:shrink-0">
                  <div className="text-right">
                    <p className="text-sm">
                      <span className="num-income font-bold">{formatMXN(pagado)}</span>
                      <span className="text-muted-foreground"> de {formatMXN(a.total)}</span>
                    </p>
                    <p className="text-sm font-bold">
                      Saldo: <span className="num-expense">{formatMXN(saldo)}</span>
                    </p>
                  </div>
                  <ApartadoAcciones apartadoId={a.id} saldo={saldo} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {historial.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Historial reciente</p>
          <div className="card-soft divide-y divide-border/60">
            {historial.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{a.cliente_nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">{prendas(a)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular-nums">{formatMXN(a.total)}</p>
                  <p className={a.estado === 'liquidado' ? 'text-xs font-semibold text-emerald-600 dark:text-emerald-400' : 'text-xs font-semibold text-muted-foreground'}>
                    {a.estado === 'liquidado' ? 'Liquidado' : 'Cancelado'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
