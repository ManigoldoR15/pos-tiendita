import { redirect } from 'next/navigation'

// Fase 1: el alta de clientes vive en /superadmin/negocios/alta.
export default function NuevoClienteRedirect() {
  redirect('/superadmin/negocios/alta')
}
