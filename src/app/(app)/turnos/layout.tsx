import { redirect } from 'next/navigation'
import { getRolActual } from '@/lib/rol'

export default async function TurnosLayout({ children }: { children: React.ReactNode }) {
  const rol = await getRolActual()
  if (rol !== 'dueno') redirect('/')
  return <>{children}</>
}
