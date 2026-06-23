'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'

export type PeriodoMuestreo = {
  id: string
  nombre: string | null
  activo: boolean
  fecha_inicio: string
  fecha_fin: string | null
}

export async function getMuestreoActivoAction(): Promise<PeriodoMuestreo | null> {
  const negocio = await getNegocioActual()
  if (!negocio) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('muestreo_periodos')
    .select('id, nombre, activo, fecha_inicio, fecha_fin')
    .eq('negocio_id', negocio.id)
    .eq('activo', true)
    .maybeSingle()

  return data ?? null
}

export async function listarPeriodosAction(): Promise<PeriodoMuestreo[]> {
  const negocio = await getNegocioActual()
  if (!negocio) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('muestreo_periodos')
    .select('id, nombre, activo, fecha_inicio, fecha_fin')
    .eq('negocio_id', negocio.id)
    .order('created_at', { ascending: false })
    .limit(12)

  return data ?? []
}

export async function activarMuestreoAction(nombre?: string): Promise<{ error?: string }> {
  const [negocio, rol] = await Promise.all([getNegocioActual(), getRolActual()])
  if (!negocio) return { error: 'Sin negocio activo' }
  if (rol !== 'dueno') return { error: 'Sin permiso' }

  const supabase = await createClient()
  const { error } = await supabase.from('muestreo_periodos').insert({
    negocio_id: negocio.id,
    nombre: nombre?.trim() || null,
    activo: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/muestreo')
  revalidatePath('/pos')
  return {}
}

export async function desactivarMuestreoAction(periodoId: string): Promise<{ error?: string }> {
  const [negocio, rol] = await Promise.all([getNegocioActual(), getRolActual()])
  if (!negocio) return { error: 'Sin negocio activo' }
  if (rol !== 'dueno') return { error: 'Sin permiso' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('muestreo_periodos')
    .update({ activo: false, fecha_fin: new Date().toISOString() })
    .eq('id', periodoId)
    .eq('negocio_id', negocio.id)

  if (error) return { error: error.message }
  revalidatePath('/muestreo')
  revalidatePath('/pos')
  return {}
}

export async function registrarRespuestaMuestreoAction(params: {
  periodoId: string
  ventaId: string
  sexo: string | null
  rangoEdad: string | null
  satisfaccion: string | null
}): Promise<{ error?: string }> {
  const negocio = await getNegocioActual()
  if (!negocio) return { error: 'Sin negocio activo' }

  const supabase = await createClient()
  const { error } = await supabase.from('muestreo_respuestas').insert({
    negocio_id: negocio.id,
    periodo_id: params.periodoId,
    venta_id: params.ventaId,
    sexo: params.sexo,
    rango_edad: params.rangoEdad,
    satisfaccion: params.satisfaccion,
  })

  if (error) return { error: error.message }
  return {}
}

export type AnalisisMuestreo = {
  totalRespuestas: number
  sexo: { hombre: number; mujer: number; sinRespuesta: number }
  edad: { nino: number; joven: number; adulto: number; mediana: number; mayor: number; sinRespuesta: number }
  satisfaccion: { buena: number; regular: number; mala: number; sinRespuesta: number }
}

export async function getAnalisisMuestreoAction(periodoId: string): Promise<AnalisisMuestreo> {
  const negocio = await getNegocioActual()
  if (!negocio) return emptyAnalisis()

  const supabase = await createClient()
  const { data } = await supabase
    .from('muestreo_respuestas')
    .select('sexo, rango_edad, satisfaccion')
    .eq('periodo_id', periodoId)
    .eq('negocio_id', negocio.id)

  if (!data || data.length === 0) return emptyAnalisis()

  return {
    totalRespuestas: data.length,
    sexo: {
      hombre: data.filter((r) => r.sexo === 'hombre').length,
      mujer: data.filter((r) => r.sexo === 'mujer').length,
      sinRespuesta: data.filter((r) => !r.sexo).length,
    },
    edad: {
      nino: data.filter((r) => r.rango_edad === 'nino').length,
      joven: data.filter((r) => r.rango_edad === 'joven').length,
      adulto: data.filter((r) => r.rango_edad === 'adulto').length,
      mediana: data.filter((r) => r.rango_edad === 'mediana').length,
      mayor: data.filter((r) => r.rango_edad === 'mayor').length,
      sinRespuesta: data.filter((r) => !r.rango_edad).length,
    },
    satisfaccion: {
      buena: data.filter((r) => r.satisfaccion === 'buena').length,
      regular: data.filter((r) => r.satisfaccion === 'regular').length,
      mala: data.filter((r) => r.satisfaccion === 'mala').length,
      sinRespuesta: data.filter((r) => !r.satisfaccion).length,
    },
  }
}

function emptyAnalisis(): AnalisisMuestreo {
  return {
    totalRespuestas: 0,
    sexo: { hombre: 0, mujer: 0, sinRespuesta: 0 },
    edad: { nino: 0, joven: 0, adulto: 0, mediana: 0, mayor: 0, sinRespuesta: 0 },
    satisfaccion: { buena: 0, regular: 0, mala: 0, sinRespuesta: 0 },
  }
}
