import { redirect } from 'next/navigation'

// Fase 1: Clientes se fusionó con Negocios en una sola lista.
export default function ClientesRedirect() {
  redirect('/superadmin/negocios')
}
