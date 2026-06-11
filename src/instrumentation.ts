export async function register() {
  // systemd-resolved tarda 2-3 intentos en resolver hostnames externos en este entorno.
  // Pre-calentamos la DNS/conexión a Supabase antes de que llegue el primer request real.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`
    for (let i = 0; i < 4; i++) {
      try {
        await fetch(url, { signal: AbortSignal.timeout(3000) })
        break
      } catch {
        // fallo de DNS transitorio — reintentar
        await new Promise((r) => setTimeout(r, 300))
      }
    }
  }
}
