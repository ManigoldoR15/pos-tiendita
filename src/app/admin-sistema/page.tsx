import { redirect } from 'next/navigation'

// Fase 1: el panel admin-sistema se fusionó dentro de /superadmin.
export default function AdminSistemaRedirect() {
  redirect('/superadmin/negocios')
}
