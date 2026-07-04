'use client'

import { useEffect } from 'react'
import { marcarAvisosLeidosAction } from './actions'

/** Al abrir la página, marca los avisos como leídos para este usuario. */
export default function MarcarLeidos() {
  useEffect(() => {
    void marcarAvisosLeidosAction()
  }, [])
  return null
}
