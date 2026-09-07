// Estado del modo tutorial, guardado en este navegador por usuario
// (misma convención que el tema claro/oscuro: `ayuda:<uid>`).
//
// Va en localStorage y no en la base de datos a propósito: es una preferencia
// de lectura, no un dato del negocio. Si el dueño entra desde otra compu vuelve
// a ver las ayudas, que para alguien que apenas está aprendiendo es lo deseable.
//
// Se expone como store para `useSyncExternalStore`: así los componentes leen
// localStorage sin effects ni desajustes de hidratación.

export type AyudaEstado = {
  /** Si está encendido, la tarjeta se abre sola al entrar a cada pantalla. */
  activo: boolean
  /** Rutas cuya ayuda ya cerró con la X — no se vuelven a abrir solas. */
  cerradas: string[]
}

export const AYUDA_DEFAULT: AyudaEstado = { activo: true, cerradas: [] }

/** Evento propio: mantiene sincronizados la tarjeta y el switch de Configuración. */
const AYUDA_EVENTO = 'ayuda-cambio'

function parsear(raw: string | null): AyudaEstado {
  if (!raw) return AYUDA_DEFAULT
  try {
    const p = JSON.parse(raw) as Partial<AyudaEstado>
    return {
      activo: p.activo !== false,
      cerradas: Array.isArray(p.cerradas) ? p.cerradas : [],
    }
  } catch {
    return AYUDA_DEFAULT
  }
}

function leerRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// useSyncExternalStore exige que el snapshot sea estable mientras nada cambie:
// si devolviéramos un objeto nuevo en cada lectura, React entraría en bucle.
const cache = new Map<string, { raw: string | null; valor: AyudaEstado }>()

export function snapshotAyuda(key: string): AyudaEstado {
  const raw = leerRaw(key)
  const previo = cache.get(key)
  if (previo && previo.raw === raw) return previo.valor
  const valor = parsear(raw)
  cache.set(key, { raw, valor })
  return valor
}

/** En el servidor no hay localStorage: se asume tutorial encendido. */
export function snapshotAyudaServidor(): AyudaEstado {
  return AYUDA_DEFAULT
}

export function suscribirAyuda(alCambiar: () => void): () => void {
  // 'storage' cubre el caso de otra pestaña abierta; el evento propio, esta misma.
  window.addEventListener(AYUDA_EVENTO, alCambiar)
  window.addEventListener('storage', alCambiar)
  return () => {
    window.removeEventListener(AYUDA_EVENTO, alCambiar)
    window.removeEventListener('storage', alCambiar)
  }
}

export function guardarAyuda(key: string, estado: AyudaEstado) {
  try {
    localStorage.setItem(key, JSON.stringify(estado))
  } catch {
    // Modo privado o storage lleno: el tutorial simplemente no se acuerda.
  }
  window.dispatchEvent(new CustomEvent(AYUDA_EVENTO))
}
