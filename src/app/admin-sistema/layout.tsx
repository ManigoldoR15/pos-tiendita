// Fase 1: el panel admin-sistema se fusionó dentro de /superadmin.
// Todas sus rutas son redirects; este layout es un passthrough.
export default function AdminSistemaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
