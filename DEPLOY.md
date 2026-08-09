# Deploy a Railway — POS Tiendita

## Estado del build

```
✅ npm run build       — 0 errores TypeScript, 24 rutas compiladas
✅ 44/44 tests E2E    — seguridad de RPCs y RLS incluida
✅ nixpacks.toml       — configurado para Railway (Node 20, npm ci, npm start)
✅ PORT               — start script usa ${PORT:-3000}, Railway inyecta PORT automáticamente
```

---

## Variables de entorno en Railway

Se necesitan **3 variables** en producción:

| Variable | Dónde obtenerla |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → **anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → **service_role** |

> ⚠️ `NEXT_PUBLIC_*` se incrustan en el bundle **al momento del build**.
> Configúralas en Railway **antes** del primer deploy (o antes de hacer redeploy).

> 🔐 `SUPABASE_SERVICE_ROLE_KEY` la usan **solo acciones de servidor** (crear
> cuentas de empleados desde Configuración, borrar usuarios huérfanos desde el
> panel de superadmin). Vive en `src/lib/supabase/service.ts`, que importa
> `server-only`: si alguien la importara desde un componente cliente, el build
> falla — nunca llega al navegador. Sin esta variable, el alta de empleados
> truena en producción.

---

## Configuración de Railway

El repo ya tiene `nixpacks.toml` — Railway lo detecta automáticamente. No se necesita `railway.json`.

```toml
# nixpacks.toml (ya existe en el repo)
[phases.setup]
nixPkgs = ["nodejs_20"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"        # → next start -p ${PORT:-3000}
```

---

## Pasos exactos para el deploy

### 1 — Prepara Supabase producción

1. Crea un **proyecto nuevo** en [supabase.com](https://supabase.com) (elige región México/US-East).
2. En **SQL Editor**, ejecuta las migraciones en orden (copia y pega cada archivo):
   - `supabase/migrations/001_schema_inicial.sql`
   - `supabase/migrations/002_anular_venta.sql`
   - `supabase/migrations/003_descuentos.sql`
   - `supabase/migrations/004_roles_vendedor.sql`
   - `supabase/migrations/005_proveedores.sql`
   - `supabase/migrations/006_metas.sql`
   - `supabase/migrations/007_rol_administrador.sql`
   - `supabase/migrations/008_busqueda_trgm.sql`
   - `supabase/migrations/009_presupuesto_categoria.sql`
   - `supabase/migrations/010_seguridad_rpc_rls.sql`  ← seguridad crítica
3. Copia **Project URL** y **anon key** (Settings → API) — los necesitas en el paso 2.

### 2 — Crea el servicio en Railway

1. Abre [railway.app](https://railway.app) → New Project → **Deploy from GitHub repo**.
2. Selecciona el repo `pos-tiendita`.
3. Railway detectará `nixpacks.toml` automáticamente.
4. En la pestaña **Variables**, agrega antes de que empiece el build:
   ```
   NEXT_PUBLIC_SUPABASE_URL      = <Project URL de Supabase>
   NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon key de Supabase>
   ```
5. Haz clic en **Deploy** (o Railway lo inicia solo). El build tarda ~2-3 min.
6. Al terminar, Railway te da una URL tipo `https://pos-tiendita.up.railway.app`.

### 3 — Configura Supabase Auth para producción

En Supabase Dashboard → **Authentication**:

1. **Providers → Email:**
   - Desactiva "Disable email confirmations" → los usuarios reales deben confirmar su correo.
2. **URL Configuration:**
   - **Site URL:** `https://<tu-url-de-railway>.up.railway.app`
   - **Redirect URLs:** agrega `https://<tu-url-de-railway>.up.railway.app/**`

### 4 — Carga el negocio demo (para demos de venta)

1. Abre la app en Railway y regístrate con `demo@tudominio.com`.
2. Crea el negocio: **"Tiendita La Esperanza"**.
3. En Supabase SQL Editor, ejecuta todo el contenido de:
   ```
   supabase/seed_demo.sql
   ```
   El script carga automáticamente sobre el primer negocio que encuentre:
   - 18 productos (bebidas, botanas, dulces, abarrotes, papelería)
   - 5 categorías de producto y 6 de gasto
   - 3 clientes frecuentes (Doña Carmen, Juan Carlos, Rosa María)
   - 12 ventas repartidas en 7 días con mezcla de métodos de pago
   - 6 gastos del mes (luz, agua, renta, mercancía, gasolina, sueldos)
   - 1 corte de caja cerrado (hace 2 días, con faltante de $15 — realista)
   - Balance positivo: ventas > gastos en el período

4. Navega a `/finanzas` — deberías ver KPIs, semáforo y gráficas con datos.

---

## Checklist de pre-lanzamiento

### Supabase
- [ ] 10 migraciones aplicadas en orden en producción
- [ ] "Confirm email" activado (Disable email confirmations = OFF)
- [ ] Site URL apunta a la URL de Railway
- [ ] Redirect URLs incluye `https://<railway-url>/**`

### Seguridad
- [ ] `SUPABASE_SERVICE_ROLE_KEY` NO está en las variables de Railway
- [ ] Solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` están en Railway
- [ ] Confirmar en Supabase → Settings → API que la service_role key **no aparece** en ningún lugar del cliente
- [ ] Migración `010_seguridad_rpc_rls.sql` aplicada (valida rol en `anular_venta`, `cerrar_corte`, `get_miembros_negocio`)

### App
- [ ] Login funciona con cuenta nueva (correo de confirmación llega)
- [ ] POS carga productos y registra venta
- [ ] `/finanzas` muestra datos (tras seed demo)
- [ ] Anular venta como dueño funciona; como empleado falla con error
- [ ] Export Excel/PDF descarga sin error

### Demo
- [ ] Negocio "Tiendita La Esperanza" creado
- [ ] `seed_demo.sql` ejecutado — `/finanzas` muestra semáforo verde
- [ ] Cuenta demo separada de la cuenta del dueño real
