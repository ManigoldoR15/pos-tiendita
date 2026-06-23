import { redirect } from 'next/navigation'

export default function NegociosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  // La lista de negocios vive en el dashboard principal
  void searchParams
  redirect('/admin-sistema')
}
