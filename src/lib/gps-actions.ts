'use server'

import { createClient } from '@/lib/supabase/server'

/** Guarda la posición GPS del usuario autenticado en su bitácora del día. */
export async function registrarGpsAction(lat: number, lon: number, precision?: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
  const supabase = await createClient()
  await supabase.rpc('log_gps', {
    p_lat: lat,
    p_lon: lon,
    p_precision: Number.isFinite(precision) ? precision : null,
  })
}
