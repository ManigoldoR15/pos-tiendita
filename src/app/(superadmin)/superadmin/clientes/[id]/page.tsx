import { redirect } from 'next/navigation'

// Fase 1: la ficha del cliente ahora es única en /superadmin/negocios/[id].
export default async function ClienteRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/superadmin/negocios/${id}`)
}
