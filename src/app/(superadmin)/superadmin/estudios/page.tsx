import { requireSuperAdmin } from '@/lib/superadmin'
import { tipoLabel } from '@/lib/tipos-negocio'
import { formatMXN } from '@/lib/dinero'
import { FlaskConical, AlertTriangle, TrendingUp, Users } from 'lucide-react'

type RetencionRow = { bucket: string; cantidad: number }
type CrecimientoRow = { mes: string; nuevos: number }
type SegmentacionRow = { tipo: string; cantidad: number; ventas_mes: number; pct_sat: number }

const BUCKET_INFO: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  activo_7d:       { label: 'Activos 7 días',   color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-700/40', desc: 'Vendieron en los últimos 7 días' },
  activo_30d:      { label: 'Activos 30 días',   color: 'text-blue-400',    bg: 'bg-blue-900/30 border-blue-700/40',    desc: 'Vendieron en los últimos 30 días' },
  inactivo_30_90d: { label: 'En riesgo',          color: 'text-orange-400',  bg: 'bg-orange-900/30 border-orange-700/40', desc: 'Sin ventas entre 30 y 90 días' },
  inactivo_90d_mas:{ label: 'Inactivos +90 días', color: 'text-red-400',     bg: 'bg-red-900/30 border-red-700/40',     desc: 'Sin ventas hace más de 90 días' },
}

const MES_LABELS: Record<string, string> = {
  '01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May','06':'Jun',
  '07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic',
}

export default async function EstudiosPage() {
  const { supabase } = await requireSuperAdmin()

  const [{ data: retData }, { data: crData }, { data: segData }] = await Promise.all([
    supabase.rpc('sa_estudios_retencion'),
    supabase.rpc('sa_estudios_crecimiento'),
    supabase.rpc('sa_estudios_segmentacion'),
  ])

  const retencion = (retData as RetencionRow[] | null) ?? []
  const crecimiento = (crData as CrecimientoRow[] | null) ?? []
  const segmentacion = (segData as SegmentacionRow[] | null) ?? []

  const totalNegocios = retencion.reduce((s, r) => s + r.cantidad, 0)
  const enRiesgo = retencion.find((r) => r.bucket === 'inactivo_30_90d')?.cantidad ?? 0
  const inactivos = retencion.find((r) => r.bucket === 'inactivo_90d_mas')?.cantidad ?? 0
  const pctSatTotal = segmentacion.length > 0
    ? Math.round(segmentacion.reduce((s, r) => s + (r.pct_sat * r.cantidad), 0) / Math.max(totalNegocios, 1))
    : 0

  const maxNuevos = Math.max(...crecimiento.map((c) => c.nuevos), 1)
  const maxSeg = Math.max(...segmentacion.map((s) => s.cantidad), 1)

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-violet-400" />
          <h1 className="text-3xl font-black text-white tracking-tight">Estudios de mercado</h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Análisis de tus clientes, retención y segmentación del mercado informal
        </p>
      </div>

      {/* Alertas rápidas */}
      {(enRiesgo > 0 || inactivos > 0) && (
        <div className="rounded-xl bg-orange-950/40 border border-orange-700/40 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
          <div className="text-sm text-orange-200">
            {enRiesgo > 0 && <p><strong>{enRiesgo} negocios</strong> llevan entre 30 y 90 días sin vender — candidatos a reactivar.</p>}
            {inactivos > 0 && <p className="mt-0.5"><strong>{inactivos} negocios</strong> llevan más de 90 días sin actividad.</p>}
          </div>
        </div>
      )}

      {/* Retención */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <h2 className="text-base font-black text-white">Retención de clientes</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(['activo_7d','activo_30d','inactivo_30_90d','inactivo_90d_mas'] as const).map((bucket) => {
            const row = retencion.find((r) => r.bucket === bucket)
            const info = BUCKET_INFO[bucket]
            const pct = totalNegocios > 0 ? Math.round(((row?.cantidad ?? 0) / totalNegocios) * 100) : 0
            return (
              <div key={bucket} className={`rounded-xl border p-4 ${info.bg}`}>
                <p className={`text-2xl font-black ${info.color} tabular-nums`}>{row?.cantidad ?? 0}</p>
                <p className={`text-xs font-bold ${info.color} mt-0.5`}>{info.label}</p>
                <p className="text-[10px] text-slate-500 mt-1">{info.desc}</p>
                <div className="mt-2 h-1 rounded-full bg-slate-800">
                  <div className={`h-full rounded-full ${info.color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{pct}% del total</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Crecimiento mensual */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-400" />
          <h2 className="text-base font-black text-white">Crecimiento mensual</h2>
          <span className="ml-auto text-xs text-slate-500">Últimos 12 meses</span>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          {crecimiento.length > 0 ? (
            <>
              <div className="flex items-end gap-2 h-32">
                {crecimiento.map((c, i) => {
                  const h = Math.round((c.nuevos / maxNuevos) * 100)
                  const [year, mon] = c.mes.split('-')
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
                      <span className="text-[10px] text-slate-500 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                        {c.nuevos}
                      </span>
                      <div
                        className="w-full rounded-t bg-violet-500/70 group-hover/bar:bg-violet-400 transition-colors"
                        style={{ height: `${Math.max(h, 2)}%` }}
                        title={`${c.nuevos} nuevos`}
                      />
                      <span className="text-[9px] text-slate-500 whitespace-nowrap">
                        {MES_LABELS[mon]}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-slate-500 mt-3 text-center">
                Total últimos 12 meses: {crecimiento.reduce((s, c) => s + c.nuevos, 0)} negocios registrados
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Sin datos de crecimiento aún</p>
          )}
        </div>
      </section>

      {/* Segmentación */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-slate-400" />
          <h2 className="text-base font-black text-white">Segmentación por tipo de negocio</h2>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cantidad</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ventas este mes</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">% SAT</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Distribución</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {segmentacion.map((s, i) => {
                const pct = Math.round((s.cantidad / maxSeg) * 100)
                return (
                  <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-200">{tipoLabel(s.tipo)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="text-sm font-bold text-white">{s.cantidad}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm text-emerald-400 tabular-nums font-semibold">{formatMXN(s.ventas_mes)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-xs font-bold ${s.pct_sat > 0 ? 'text-violet-400' : 'text-slate-500'}`}>
                        {s.pct_sat}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="h-2 rounded-full bg-slate-800 w-full">
                        <div
                          className="h-full rounded-full bg-violet-500/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {segmentacion.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-10">Sin datos de segmentación</p>
          )}
        </div>
      </section>

      {/* SAT resumen */}
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <h2 className="text-sm font-bold text-slate-200 mb-4">Formalidad del mercado atendido</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Inscritos SAT</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              {segmentacion.reduce((s, r) => s + Math.round((r.pct_sat / 100) * r.cantidad), 0)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">negocios con RFC</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Informales</p>
            <p className="text-2xl font-black text-slate-300 mt-1">
              {totalNegocios - segmentacion.reduce((s, r) => s + Math.round((r.pct_sat / 100) * r.cantidad), 0)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">sin RFC declarado</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">% informal</p>
            <p className="text-2xl font-black text-violet-400 mt-1">{100 - pctSatTotal}%</p>
            <p className="text-xs text-slate-500 mt-0.5">del mercado atendido</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-3 rounded-full bg-slate-800 w-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${pctSatTotal}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>SAT {pctSatTotal}%</span>
            <span>Informal {100 - pctSatTotal}%</span>
          </div>
        </div>
      </section>
    </div>
  )
}
