'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Refresca los datos del servidor cada N segundos (mapa en vivo). */
export default function AutoRefresh({ segundos }: { segundos: number }) {
  const router = useRouter()
  useEffect(() => {
    const t = setInterval(() => router.refresh(), segundos * 1000)
    return () => clearInterval(t)
  }, [router, segundos])
  return null
}
