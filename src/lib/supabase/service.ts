import 'server-only'
import { createClient } from '@supabase/supabase-js'

// El módulo 'server-only' hace que el build FALLE si este archivo llega a
// importarse desde un componente cliente — evita filtrar SUPABASE_SERVICE_ROLE_KEY
// (que bypasea RLS) al navegador.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
