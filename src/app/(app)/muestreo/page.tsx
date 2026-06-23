import { redirect } from 'next/navigation'
import { PieChart } from 'lucide-react'
import { getNegocioActual } from '@/lib/negocio'
import { getRolActual } from '@/lib/rol'
import { fmtFechaCorta } from '@/lib/fecha'
import { getMuestreoActivoAction, listarPeriodosAction, getAnalisisMuestreoAction } from './actions'
import ToggleMuestreo from './toggle-muestreo'

type SearchParams = { periodo?: string }

function pct(n: number, total: number) {
  if (total === 0) return 0
  return Math.round((n / total) * 100)
}

function BarraRow({
  label,
  n,
  total,
  color = 'bg-primary',
}: {
  label: string
  n: number
  total: number
  color?: string
}) {
  const p = pct(n, total)
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 rounded-full bg-muted h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${p}%` }}
        />
      </div>
      <span className="w-14 text-right font-semibold tabular-nums">
        {n} <span className="text-muted-foreground font-normal">({p}%)</span>
      </span>
    </div>
  )
}

export default async function MuestreoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [negocio, rol] = await Promise.all([getNegocioActual(), getRolActual()])
  if (!negocio) redirect('/crear-negocio')
  if (rol !== 'dueno') redirect('/')

  const { periodo: periodoParam } = await searchParams

  const [periodoActivo, periodos] = await Promise.all([
    getMuestreoActivoAction(),
    listarPeriodosAction(),
  ])

  // Periodo a mostrar: param > activo > más reciente
  const periodoId = periodoParam ?? periodoActivo?.id ?? periodos[0]?.id ?? null

  const analisis = periodoId ? await getAnalisisMuestreoAction(periodoId) : null
  const periodoSeleccionado = periodos.find((p) => p.id === periodoId) ?? null

  const totalSexo = analisis
    ? analisis.sexo.hombre + analisis.sexo.mujer
    : 0
  const totalEdad = analisis
    ? analisis.edad.nino + analisis.edad.joven + analisis.edad.adulto + analisis.edad.mediana + analisis.edad.mayor
    : 0
  const totalSat = analisis
    ? analisis.satisfaccion.buena + analisis.satisfaccion.regular + analisis.satisfaccion.mala
    : 0

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <PieChart className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-black tracking-tight">Muestreo demográfico</h1>
          <p className="text-sm text-muted-foreground">Conoce quién compra en tu local</p>
        </div>
      </div>

      {/* Toggle activo/inactivo */}
      <ToggleMuestreo periodoActivo={periodoActivo} />

      {/* Selector de periodo */}
      {periodos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold">Periodos</h2>
          <div className="flex flex-wrap gap-2">
            {periodos.map((p) => (
              <a
                key={p.id}
                href={`/muestreo?periodo=${p.id}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  p.id === periodoId
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                {p.nombre ?? fmtFechaCorta(p.fecha_inicio)}
                {p.activo && ' 🟢'}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Análisis */}
      {analisis && periodoSeleccionado && (
        <section className="space-y-6">
          <div className="flex items-baseline gap-3">
            <h2 className="text-sm font-bold">
              {periodoSeleccionado.nombre ?? fmtFechaCorta(periodoSeleccionado.fecha_inicio)}
            </h2>
            <span className="text-xs text-muted-foreground">
              {analisis.totalRespuestas} respuesta{analisis.totalRespuestas !== 1 ? 's' : ''}
            </span>
          </div>

          {analisis.totalRespuestas === 0 ? (
            <div className="card-soft py-12 text-center text-muted-foreground text-sm">
              Aún no hay respuestas en este periodo.
            </div>
          ) : (
            <>
              {/* Sexo */}
              {totalSexo > 0 && (
                <div className="card-soft p-5 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Sexo <span className="font-normal">({totalSexo} respuestas)</span>
                  </h3>
                  <BarraRow label="Hombre" n={analisis.sexo.hombre} total={totalSexo} color="bg-blue-500" />
                  <BarraRow label="Mujer" n={analisis.sexo.mujer} total={totalSexo} color="bg-pink-500" />
                </div>
              )}

              {/* Edad */}
              {totalEdad > 0 && (
                <div className="card-soft p-5 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Rango de edad <span className="font-normal">({totalEdad} respuestas)</span>
                  </h3>
                  <BarraRow label="🧒 Niño"      n={analisis.edad.nino}    total={totalEdad} color="bg-violet-500" />
                  <BarraRow label="🧑 Joven"     n={analisis.edad.joven}   total={totalEdad} color="bg-indigo-500" />
                  <BarraRow label="👤 Adulto"    n={analisis.edad.adulto}  total={totalEdad} color="bg-primary" />
                  <BarraRow label="🧓 Mediana"   n={analisis.edad.mediana} total={totalEdad} color="bg-orange-500" />
                  <BarraRow label="👴 Mayor"     n={analisis.edad.mayor}   total={totalEdad} color="bg-amber-600" />
                </div>
              )}

              {/* Satisfacción */}
              {totalSat > 0 && (
                <div className="card-soft p-5 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Satisfacción <span className="font-normal">({totalSat} respuestas)</span>
                  </h3>
                  <BarraRow label="😊 Bien"    n={analisis.satisfaccion.buena}   total={totalSat} color="bg-emerald-500" />
                  <BarraRow label="😐 Regular" n={analisis.satisfaccion.regular} total={totalSat} color="bg-yellow-500" />
                  <BarraRow label="😞 Mal"     n={analisis.satisfaccion.mala}    total={totalSat} color="bg-red-500" />
                </div>
              )}

              {/* Resumen textual */}
              <div className="card-soft p-5 space-y-2 bg-muted/30">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Perfil típico del cliente
                </h3>
                <p className="text-sm">
                  {[
                    totalSexo > 0 &&
                      (analisis.sexo.mujer > analisis.sexo.hombre
                        ? `Principalmente mujeres (${pct(analisis.sexo.mujer, totalSexo)}%)`
                        : analisis.sexo.hombre > analisis.sexo.mujer
                        ? `Principalmente hombres (${pct(analisis.sexo.hombre, totalSexo)}%)`
                        : 'Paridad de género'),
                    totalEdad > 0 &&
                      (() => {
                        const maxEdad = Object.entries({
                          nino: analisis.edad.nino,
                          joven: analisis.edad.joven,
                          adulto: analisis.edad.adulto,
                          mediana: analisis.edad.mediana,
                          mayor: analisis.edad.mayor,
                        }).sort((a, b) => b[1] - a[1])[0]
                        const nombres: Record<string, string> = {
                          nino: 'niños',
                          joven: 'jóvenes',
                          adulto: 'adultos',
                          mediana: 'personas de mediana edad',
                          mayor: 'adultos mayores',
                        }
                        return `Mayoría ${nombres[maxEdad[0]]} (${pct(maxEdad[1], totalEdad)}%)`
                      })(),
                    totalSat > 0 &&
                      `Satisfacción: ${pct(analisis.satisfaccion.buena, totalSat)}% positiva`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Sin datos suficientes aún.'}
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {periodos.length === 0 && (
        <div className="card-soft py-16 text-center space-y-2">
          <PieChart className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">Aún no hay periodos de muestreo.</p>
          <p className="text-sm text-muted-foreground">Activa el muestreo arriba para empezar a recolectar datos.</p>
        </div>
      )}
    </div>
  )
}
