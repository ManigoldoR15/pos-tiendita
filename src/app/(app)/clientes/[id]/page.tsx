import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, MessageCircle, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { formatMXN } from '@/lib/dinero'
import { fmtFechaCorta, fmtFechaHoraCorta } from '@/lib/fecha'
import FormAbono from '@/app/(app)/fiados/[clienteId]/form-abono'
import FormListaNegra from '@/app/(app)/fiados/[clienteId]/form-lista-negra'
import EstadoCuentaImprimible from '@/app/(app)/fiados/[clienteId]/estado-cuenta-imprimible'
import PreciosEspecialesManager from './precios-especiales-manager'
import { listarPreciosEspecialesAction } from './actions-precios'
import EstatusForm from './estatus-form'
import { EstatusCliente } from '@/components/estatus-cliente'
import type { EstatusClienteType } from './actions-estatus'

export default async function ClienteHubPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clienteId } = await params
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const [supabase, rolActual] = await Promise.all([createClient(), getRolActual()])
  const esDueno = rolActual === 'dueno'

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, notas, en_lista_negra, motivo_lista_negra, estatus, estatus_nota')
    .eq('id', clienteId)
    .eq('negocio_id', negocio.id)
    .single()

  if (!cliente) notFound()

  const [preciosEspeciales, { data: productos }, { data: notas }, { data: abonos }, { data: historial }] =
    await Promise.all([
      listarPreciosEspecialesAction(clienteId),

      // Productos disponibles para asignar precios especiales
      supabase
        .from('productos')
        .select('id, nombre, precio_venta, precio_costo')
        .eq('negocio_id', negocio.id)
        .eq('activo', true)
        .order('nombre'),

      // Fiados
      supabase
        .from('fiados_por_venta')
        .select('venta_id, created_at, monto_fiado, monto_abonado, deuda')
        .eq('cliente_id', clienteId)
        .eq('negocio_id', negocio.id)
        .order('created_at', { ascending: false }),

      // Abonos
      supabase
        .from('abonos')
        .select('id, monto, fecha, notas, venta_id')
        .eq('cliente_id', clienteId)
        .eq('negocio_id', negocio.id)
        .order('fecha', { ascending: false }),

      // Historial de compras (con precio especial info)
      supabase
        .from('ventas')
        .select('id, created_at, total, estado, venta_items(precio_unitario, precio_normal, cantidad, productos(precio_costo))')
        .eq('cliente_id', clienteId)
        .eq('negocio_id', negocio.id)
        .eq('estado', 'completada')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

  // Fiados
  const notaIds = (notas ?? []).map((n) => n.venta_id)
  const itemsPorNota: Map<string, { nombre: string; cantidad: number; precio_unitario: number }[]> = new Map()

  if (notaIds.length > 0) {
    const { data: items } = await supabase
      .from('venta_items')
      .select('venta_id, cantidad, precio_unitario, productos(nombre), es_fiado')
      .in('venta_id', notaIds)
      .eq('es_fiado', true)

    for (const it of items ?? []) {
      const nombre =
        (it.productos as unknown as { nombre: string } | null)?.nombre ?? 'Producto eliminado'
      const existing = itemsPorNota.get(it.venta_id) ?? []
      existing.push({ nombre, cantidad: it.cantidad, precio_unitario: it.precio_unitario })
      itemsPorNota.set(it.venta_id, existing)
    }
  }

  const deudaTotal = (notas ?? []).reduce((s, n) => s + Math.max(0, n.deuda), 0)
  const notasPendientes = (notas ?? []).filter((n) => n.deuda > 0)

  // Análisis de compras
  type VentaItem = {
    precio_unitario: number
    precio_normal: number | null
    cantidad: number
    productos: { precio_costo: number | null } | null
  }
  type Venta = { id: string; created_at: string; total: number; venta_items: VentaItem[] }

  const ventas = (historial ?? []) as unknown as Venta[]
  const totalComprado = ventas.reduce((s, v) => s + v.total, 0)
  const totalAhorrado = ventas.reduce((s, v) =>
    s + v.venta_items.reduce((si, i) =>
      si + (i.precio_normal !== null ? (i.precio_normal - i.precio_unitario) * Number(i.cantidad) : 0), 0), 0)
  const gananciaEstimada = ventas.reduce((s, v) =>
    s + v.venta_items.reduce((si, i) => {
      const costo = i.productos?.precio_costo
      if (costo === null || costo === undefined) return si
      return si + (i.precio_unitario - costo) * Number(i.cantidad)
    }, 0), 0)
  const fechaPrimera = ventas.length > 0 ? ventas[ventas.length - 1].created_at : null
  const fechaUltima = ventas.length > 0 ? ventas[0].created_at : null

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/clientes"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black tracking-tight">{cliente.nombre}</h1>
            <EstatusCliente
              estatus={cliente.estatus as EstatusClienteType | null}
              nota={cliente.estatus_nota}
              size="md"
            />
          </div>
          {cliente.telefono && <p className="text-muted-foreground">{cliente.telefono}</p>}
          {cliente.notas && <p className="text-sm text-muted-foreground mt-1">{cliente.notas}</p>}
          {cliente.en_lista_negra && (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-0.5 text-sm font-medium text-destructive">
              Lista negra: {cliente.motivo_lista_negra ?? 'sin motivo'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {cliente.telefono && deudaTotal > 0 && (
            <a
              href={`https://wa.me/52${cliente.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                `Hola ${cliente.nombre}, te recordamos que tienes un saldo pendiente de ${formatMXN(deudaTotal)} con ${negocio.nombre}. ¿Cuándo puedes venir a liquidar? 🙏`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <MessageCircle className="h-4 w-4" />
              Cobrar por WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Análisis rápido */}
      {ventas.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card-soft p-4">
            <p className="text-xs text-muted-foreground mb-1">Compras</p>
            <p className="text-2xl font-black">{ventas.length}</p>
          </div>
          <div className="card-soft p-4">
            <p className="text-xs text-muted-foreground mb-1">Total gastado</p>
            <p className="text-lg font-black text-primary">{formatMXN(totalComprado)}</p>
          </div>
          {totalAhorrado > 0 && (
            <div className="card-soft p-4">
              <p className="text-xs text-muted-foreground mb-1">Ahorrado</p>
              <p className="text-lg font-black text-blue-600 dark:text-blue-400">{formatMXN(totalAhorrado)}</p>
            </div>
          )}
          {gananciaEstimada > 0 && (
            <div className="card-soft p-4">
              <p className="text-xs text-muted-foreground mb-1">Tu ganancia</p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatMXN(gananciaEstimada)}</p>
            </div>
          )}
          {fechaPrimera && (
            <div className="card-soft p-4 col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Periodo</p>
              <p className="text-sm font-medium">
                {fmtFechaCorta(fechaPrimera)} → {fechaUltima ? fmtFechaCorta(fechaUltima) : '—'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Precios especiales */}
      <section className="card-soft p-5 space-y-4">
        <PreciosEspecialesManager
          clienteId={clienteId}
          clienteNombre={cliente.nombre}
          precios={preciosEspeciales}
          productos={productos ?? []}
          esDueno={esDueno}
        />
      </section>

      {/* Fiados */}
      {deudaTotal > 0 && (
        <div className="card-soft relative overflow-hidden bg-primary/[0.05] p-5">
          <p className="text-xs text-muted-foreground mb-1">Deuda total</p>
          <p className="text-4xl font-black tracking-tight text-primary">{formatMXN(deudaTotal)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {notasPendientes.length} nota{notasPendientes.length !== 1 ? 's' : ''} pendiente{notasPendientes.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {deudaTotal > 0 && (
        <FormAbono
          clienteId={clienteId}
          deudaTotal={deudaTotal}
          notasPendientes={notasPendientes.map((n) => ({
            ventaId: n.venta_id,
            fecha: n.created_at,
            deuda: n.deuda,
          }))}
        />
      )}

      {(notas ?? []).length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold">Fiados</h2>
          {(notas ?? []).map((nota) => {
            const saldada = nota.deuda <= 0
            const items = itemsPorNota.get(nota.venta_id) ?? []
            return (
              <div key={nota.venta_id} className={`card-soft overflow-hidden ${saldada ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{fmtFechaHoraCorta(nota.created_at)}</p>
                    <Link href={`/ventas/${nota.venta_id}`} className="text-xs text-primary hover:underline">
                      Ver venta →
                    </Link>
                  </div>
                  {saldada ? (
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Saldada</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">Pendiente</span>
                  )}
                </div>
                {items.length > 0 && (
                  <div className="divide-y px-4">
                    {items.map((it, i) => (
                      <div key={i} className="flex justify-between py-2 text-sm">
                        <span className="text-muted-foreground">{it.cantidad} × {it.nombre}</span>
                        <span>{formatMXN(it.precio_unitario * it.cantidad)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-4 py-3 border-t bg-muted/20 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monto fiado</span>
                    <span>{formatMXN(nota.monto_fiado)}</span>
                  </div>
                  {nota.monto_abonado > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Abonado</span>
                      <span>−{formatMXN(nota.monto_abonado)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>Resta</span>
                    <span className={nota.deuda > 0 ? 'text-primary' : 'text-emerald-600'}>
                      {formatMXN(Math.max(0, nota.deuda))}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {(abonos ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold">Historial de abonos</h2>
          <div className="card-soft divide-y">
            {(abonos ?? []).map((ab) => (
              <div key={ab.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-emerald-600">+{formatMXN(ab.monto)}</p>
                  <p className="text-xs text-muted-foreground">{fmtFechaHoraCorta(ab.fecha)}</p>
                  {ab.notas && <p className="text-xs text-muted-foreground">{ab.notas}</p>}
                </div>
                {ab.venta_id == null && <span className="text-xs text-muted-foreground">Abono general</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Historial de compras */}
      {ventas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold">Historial de compras</h2>
          <div className="card-soft divide-y">
            {ventas.map((v) => {
              const tuvoEspecial = v.venta_items.some((i) => i.precio_normal !== null)
              return (
                <Link
                  key={v.id}
                  href={`/ventas/${v.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{fmtFechaHoraCorta(v.created_at)}</p>
                    {tuvoEspecial && (
                      <span className="text-xs text-blue-600 dark:text-blue-400">Precio especial aplicado</span>
                    )}
                  </div>
                  <p className="font-bold text-sm">{formatMXN(v.total)}</p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Estatus del cliente — dueño/admin puede cambiar, todos ven */}
      {esDueno && (
        <section className="card-soft p-5">
          <EstatusForm
            clienteId={clienteId}
            estatusActual={(cliente.estatus as EstatusClienteType | null) ?? null}
            notaActual={cliente.estatus_nota ?? null}
          />
        </section>
      )}

      {/* Lista negra — dueño/admin */}
      {esDueno && (
        <FormListaNegra
          clienteId={clienteId}
          enListaNegra={cliente.en_lista_negra}
          motivoActual={cliente.motivo_lista_negra}
        />
      )}

      {/* Estado de cuenta imprimible */}
      <EstadoCuentaImprimible
        negocioNombre={negocio.nombre}
        cliente={cliente}
        notas={(notas ?? []).map((n) => ({
          fecha: n.created_at,
          items: itemsPorNota.get(n.venta_id) ?? [],
          montoFiado: n.monto_fiado,
          montoAbonado: n.monto_abonado,
          deuda: n.deuda,
        }))}
        abonos={(abonos ?? []).map((ab) => ({ fecha: ab.fecha, monto: ab.monto, notas: ab.notas }))}
        deudaTotal={deudaTotal}
      />
    </div>
  )
}
