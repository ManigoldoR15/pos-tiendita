import { redirect } from 'next/navigation'

// Fase 1: la gestión de suscripción vive en la ficha única de /superadmin.
export default async function NegocioRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/superadmin/negocios/${id}`)
}
