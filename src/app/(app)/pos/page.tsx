import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import PosClient from './pos-client'
import { getModulos } from '@/lib/modulos'
import { getPlazaActual } from '@/lib/plaza'
import { getMuestreoActivoAction } from '@/app/(app)/muestreo/actions'

export default async function PosPage() {
  const modulos = await getModulos()
  const negocio = await getNegocioActual()
  if (!negocio) redirect('/crear-negocio')

  const plaza = await getPlazaActual()
  const supabase = await createClient()
  const [{ data: productos }, { data: categorias }, { data: metodosPago }, { data: listasRaw }, muestreoActivo] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, precio_venta, precio_costo, existencias, categoria_id, codigo_barras, unidad_medida, tiene_variantes, atributo1, atributo2, variantes:variantes_producto(id, valor1, valor2, existencias, codigo_barras)')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('categorias_producto')
      .select('id, nombre, color')
      .eq('negocio_id', negocio.id)
      .order('nombre'),
    supabase
      .from('metodos_pago')
      .select('id, nombre')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('listas_precio')
      .select('id, nombre, lista_precio_items(producto_id, precio)')
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .order('nombre'),
    getMuestreoActivoAction(),
  ])

  // Con plaza asignada, la venta solo puede consumir lotes de esa plaza
  // (registrar_venta lo valida). Mostrar el total del negocio haría que el cobro
  // tronara frente al cliente, así que aquí se reemplaza por el stock real de la
  // plaza. Sin plaza no se ejecuta nada de esto: el POS queda idéntico.
  let productosVisibles = productos ?? []
  if (plaza) {
    const { data: lotesPlaza } = await supabase
      .from('lotes_producto')
      .select('producto_id, variante_id, cantidad_actual')
      .eq('negocio_id', negocio.id)
      .eq('local_id', plaza.id)
      .eq('activo', true)
      .gt('cantidad_actual', 0)

    const stockProducto = new Map<string, number>()
    const stockVariante = new Map<string, number>()
    for (const l of lotesPlaza ?? []) {
      const cantidad = Number(l.cantidad_actual)
      stockProducto.set(l.producto_id, (stockProducto.get(l.producto_id) ?? 0) + cantidad)
      if (l.variante_id) {
        stockVariante.set(l.variante_id, (stockVariante.get(l.variante_id) ?? 0) + cantidad)
      }
    }

    productosVisibles = productosVisibles.map((p) => ({
      ...p,
      existencias: stockProducto.get(p.id) ?? 0,
      variantes: (p.variantes ?? []).map((v) => ({
        ...v,
        existencias: stockVariante.get(v.id) ?? 0,
      })),
    }))
  }

  type ListaItem = { producto_id: string; precio: number }
  type Lista = { id: string; nombre: string; items: Record<string, number> }
  const listas: Lista[] = (listasRaw ?? []).map((l) => ({
    id: l.id,
    nombre: l.nombre,
    items: Object.fromEntries(
      ((l.lista_precio_items ?? []) as unknown as ListaItem[]).map((i) => [i.producto_id, i.precio]),
    ),
  }))

  return (
    <PosClient
      productos={productosVisibles}
      categorias={categorias ?? []}
      metodosPago={metodosPago ?? []}
      negocioNombre={negocio.nombre}
      plazaNombre={plaza?.nombre ?? null}
      listas={listas}
      muestreoPeriodoId={muestreoActivo?.id ?? null}
      moduloApartados={modulos.apartados}
    />
  )
}
