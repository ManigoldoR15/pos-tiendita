-- =============================================================================
-- 060_temas_claro_oscuro.sql
--
-- Los temas estacionales eran paletas oscuras completas aplicadas igual en
-- modo claro y oscuro: a un usuario en modo claro le forzaban un fondo negro.
-- Ahora cada tema trae dos paletas:
--   css_vars      → modo claro: fondos tenues teñidos del color festivo
--   css_vars_dark → modo oscuro: carbón teñido + acento más vivo
-- El layout inyecta :root{css_vars} y html.dark{css_vars_dark}.
-- Ambas comparten las mismas llaves para que html.dark (mayor especificidad)
-- cubra todo lo que :root define.
-- =============================================================================

ALTER TABLE temas_estacionales
  ADD COLUMN IF NOT EXISTS css_vars_dark jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── Halloween 🎃 — calabaza sobre noche morada ──────────────────────────────
UPDATE temas_estacionales SET
css_vars = '{
  "--background":"oklch(0.976 0.012 65)","--card":"oklch(1 0 0)","--popover":"oklch(1 0 0)",
  "--primary":"oklch(0.58 0.19 45)","--primary-foreground":"oklch(0.99 0 0)",
  "--secondary":"oklch(0.950 0.018 70)","--muted":"oklch(0.950 0.018 70)","--muted-foreground":"oklch(0.46 0.025 55)",
  "--accent":"oklch(0.930 0.032 65)","--border":"oklch(0.900 0.020 65)","--input":"oklch(0.900 0.020 65)","--ring":"oklch(0.58 0.19 45)",
  "--chart-1":"oklch(0.65 0.19 45)","--chart-2":"oklch(0.55 0.18 300)","--chart-3":"oklch(0.55 0.12 150)","--chart-4":"oklch(0.75 0.15 85)","--chart-5":"oklch(0.60 0.20 25)",
  "--sidebar":"oklch(0.965 0.014 65)","--sidebar-primary":"oklch(0.58 0.19 45)","--sidebar-accent":"oklch(0.930 0.026 65)","--sidebar-border":"oklch(0.900 0.020 65)","--sidebar-ring":"oklch(0.58 0.19 45)"
}'::jsonb,
css_vars_dark = '{
  "--background":"oklch(0.125 0.022 300)","--card":"oklch(0.165 0.024 300)","--popover":"oklch(0.165 0.024 300)",
  "--primary":"oklch(0.74 0.18 48)","--primary-foreground":"oklch(0.13 0.030 48)",
  "--secondary":"oklch(0.200 0.026 300)","--muted":"oklch(0.200 0.026 300)","--muted-foreground":"oklch(0.640 0.020 300)",
  "--accent":"oklch(0.225 0.032 300)","--border":"oklch(0.260 0.030 300)","--input":"oklch(0.260 0.030 300)","--ring":"oklch(0.74 0.18 48)",
  "--chart-1":"oklch(0.74 0.18 48)","--chart-2":"oklch(0.65 0.18 300)","--chart-3":"oklch(0.65 0.14 150)","--chart-4":"oklch(0.80 0.14 85)","--chart-5":"oklch(0.66 0.20 25)",
  "--sidebar":"oklch(0.110 0.020 300)","--sidebar-primary":"oklch(0.74 0.18 48)","--sidebar-accent":"oklch(0.205 0.028 300)","--sidebar-border":"oklch(0.245 0.028 300)","--sidebar-ring":"oklch(0.74 0.18 48)"
}'::jsonb
WHERE slug = 'halloween';

-- ─── Día de Muertos 💀 — cempasúchil y magenta sobre morado noche ────────────
UPDATE temas_estacionales SET
css_vars = '{
  "--background":"oklch(0.975 0.014 80)","--card":"oklch(1 0 0)","--popover":"oklch(1 0 0)",
  "--primary":"oklch(0.60 0.17 55)","--primary-foreground":"oklch(0.99 0 0)",
  "--secondary":"oklch(0.948 0.020 80)","--muted":"oklch(0.948 0.020 80)","--muted-foreground":"oklch(0.46 0.028 70)",
  "--accent":"oklch(0.930 0.035 340)","--border":"oklch(0.895 0.022 75)","--input":"oklch(0.895 0.022 75)","--ring":"oklch(0.60 0.17 55)",
  "--chart-1":"oklch(0.68 0.18 58)","--chart-2":"oklch(0.60 0.22 345)","--chart-3":"oklch(0.55 0.18 300)","--chart-4":"oklch(0.58 0.13 150)","--chart-5":"oklch(0.76 0.14 85)",
  "--sidebar":"oklch(0.963 0.016 80)","--sidebar-primary":"oklch(0.60 0.17 55)","--sidebar-accent":"oklch(0.928 0.028 80)","--sidebar-border":"oklch(0.895 0.022 75)","--sidebar-ring":"oklch(0.60 0.17 55)"
}'::jsonb,
css_vars_dark = '{
  "--background":"oklch(0.125 0.028 310)","--card":"oklch(0.165 0.030 310)","--popover":"oklch(0.165 0.030 310)",
  "--primary":"oklch(0.76 0.18 60)","--primary-foreground":"oklch(0.14 0.030 60)",
  "--secondary":"oklch(0.200 0.032 310)","--muted":"oklch(0.200 0.032 310)","--muted-foreground":"oklch(0.645 0.025 310)",
  "--accent":"oklch(0.235 0.048 340)","--border":"oklch(0.260 0.036 310)","--input":"oklch(0.260 0.036 310)","--ring":"oklch(0.76 0.18 60)",
  "--chart-1":"oklch(0.76 0.18 60)","--chart-2":"oklch(0.68 0.21 345)","--chart-3":"oklch(0.62 0.18 300)","--chart-4":"oklch(0.66 0.14 150)","--chart-5":"oklch(0.82 0.13 85)",
  "--sidebar":"oklch(0.110 0.026 310)","--sidebar-primary":"oklch(0.76 0.18 60)","--sidebar-accent":"oklch(0.205 0.034 310)","--sidebar-border":"oklch(0.245 0.034 310)","--sidebar-ring":"oklch(0.76 0.18 60)"
}'::jsonb
WHERE slug = 'dia-muertos';

-- ─── Navidad 🎄 — rojo nochebuena, pino y dorado ─────────────────────────────
UPDATE temas_estacionales SET
css_vars = '{
  "--background":"oklch(0.976 0.008 145)","--card":"oklch(1 0 0)","--popover":"oklch(1 0 0)",
  "--primary":"oklch(0.52 0.19 27)","--primary-foreground":"oklch(0.99 0 0)",
  "--secondary":"oklch(0.945 0.015 145)","--muted":"oklch(0.945 0.015 145)","--muted-foreground":"oklch(0.45 0.020 150)",
  "--accent":"oklch(0.930 0.028 100)","--border":"oklch(0.900 0.014 145)","--input":"oklch(0.900 0.014 145)","--ring":"oklch(0.52 0.19 27)",
  "--chart-1":"oklch(0.58 0.20 27)","--chart-2":"oklch(0.52 0.14 152)","--chart-3":"oklch(0.74 0.14 85)","--chart-4":"oklch(0.60 0.12 240)","--chart-5":"oklch(0.55 0.10 60)",
  "--sidebar":"oklch(0.963 0.010 145)","--sidebar-primary":"oklch(0.52 0.19 27)","--sidebar-accent":"oklch(0.925 0.020 145)","--sidebar-border":"oklch(0.900 0.014 145)","--sidebar-ring":"oklch(0.52 0.19 27)"
}'::jsonb,
css_vars_dark = '{
  "--background":"oklch(0.125 0.020 155)","--card":"oklch(0.162 0.022 155)","--popover":"oklch(0.162 0.022 155)",
  "--primary":"oklch(0.64 0.19 27)","--primary-foreground":"oklch(0.98 0 0)",
  "--secondary":"oklch(0.198 0.024 155)","--muted":"oklch(0.198 0.024 155)","--muted-foreground":"oklch(0.640 0.020 150)",
  "--accent":"oklch(0.235 0.035 100)","--border":"oklch(0.255 0.026 155)","--input":"oklch(0.255 0.026 155)","--ring":"oklch(0.64 0.19 27)",
  "--chart-1":"oklch(0.66 0.19 27)","--chart-2":"oklch(0.64 0.15 152)","--chart-3":"oklch(0.80 0.13 85)","--chart-4":"oklch(0.66 0.13 240)","--chart-5":"oklch(0.62 0.10 60)",
  "--sidebar":"oklch(0.110 0.018 155)","--sidebar-primary":"oklch(0.64 0.19 27)","--sidebar-accent":"oklch(0.205 0.026 155)","--sidebar-border":"oklch(0.240 0.024 155)","--sidebar-ring":"oklch(0.64 0.19 27)"
}'::jsonb
WHERE slug = 'navidad';

-- ─── San Valentín 💕 — rosa intenso y crema ──────────────────────────────────
UPDATE temas_estacionales SET
css_vars = '{
  "--background":"oklch(0.978 0.010 350)","--card":"oklch(1 0 0)","--popover":"oklch(1 0 0)",
  "--primary":"oklch(0.58 0.20 3)","--primary-foreground":"oklch(0.99 0 0)",
  "--secondary":"oklch(0.948 0.016 350)","--muted":"oklch(0.948 0.016 350)","--muted-foreground":"oklch(0.47 0.026 355)",
  "--accent":"oklch(0.932 0.030 350)","--border":"oklch(0.905 0.018 350)","--input":"oklch(0.905 0.018 350)","--ring":"oklch(0.58 0.20 3)",
  "--chart-1":"oklch(0.62 0.21 3)","--chart-2":"oklch(0.60 0.18 330)","--chart-3":"oklch(0.55 0.16 300)","--chart-4":"oklch(0.74 0.13 85)","--chart-5":"oklch(0.58 0.13 25)",
  "--sidebar":"oklch(0.966 0.012 350)","--sidebar-primary":"oklch(0.58 0.20 3)","--sidebar-accent":"oklch(0.930 0.024 350)","--sidebar-border":"oklch(0.905 0.018 350)","--sidebar-ring":"oklch(0.58 0.20 3)"
}'::jsonb,
css_vars_dark = '{
  "--background":"oklch(0.130 0.026 345)","--card":"oklch(0.168 0.028 345)","--popover":"oklch(0.168 0.028 345)",
  "--primary":"oklch(0.70 0.18 358)","--primary-foreground":"oklch(0.13 0.030 358)",
  "--secondary":"oklch(0.202 0.030 345)","--muted":"oklch(0.202 0.030 345)","--muted-foreground":"oklch(0.645 0.024 350)",
  "--accent":"oklch(0.230 0.040 350)","--border":"oklch(0.262 0.034 345)","--input":"oklch(0.262 0.034 345)","--ring":"oklch(0.70 0.18 358)",
  "--chart-1":"oklch(0.70 0.18 358)","--chart-2":"oklch(0.68 0.17 330)","--chart-3":"oklch(0.62 0.16 300)","--chart-4":"oklch(0.80 0.12 85)","--chart-5":"oklch(0.64 0.14 25)",
  "--sidebar":"oklch(0.115 0.024 345)","--sidebar-primary":"oklch(0.70 0.18 358)","--sidebar-accent":"oklch(0.208 0.032 345)","--sidebar-border":"oklch(0.248 0.030 345)","--sidebar-ring":"oklch(0.70 0.18 358)"
}'::jsonb
WHERE slug = 'san-valentin';

-- ─── Día de las Madres 🌹 — rosa suave y lila ────────────────────────────────
UPDATE temas_estacionales SET
css_vars = '{
  "--background":"oklch(0.978 0.008 335)","--card":"oklch(1 0 0)","--popover":"oklch(1 0 0)",
  "--primary":"oklch(0.55 0.17 345)","--primary-foreground":"oklch(0.99 0 0)",
  "--secondary":"oklch(0.950 0.014 335)","--muted":"oklch(0.950 0.014 335)","--muted-foreground":"oklch(0.47 0.022 340)",
  "--accent":"oklch(0.932 0.024 300)","--border":"oklch(0.905 0.015 335)","--input":"oklch(0.905 0.015 335)","--ring":"oklch(0.55 0.17 345)",
  "--chart-1":"oklch(0.62 0.17 345)","--chart-2":"oklch(0.58 0.15 300)","--chart-3":"oklch(0.66 0.14 25)","--chart-4":"oklch(0.74 0.12 85)","--chart-5":"oklch(0.58 0.12 240)",
  "--sidebar":"oklch(0.966 0.010 335)","--sidebar-primary":"oklch(0.55 0.17 345)","--sidebar-accent":"oklch(0.932 0.020 335)","--sidebar-border":"oklch(0.905 0.015 335)","--sidebar-ring":"oklch(0.55 0.17 345)"
}'::jsonb,
css_vars_dark = '{
  "--background":"oklch(0.135 0.022 330)","--card":"oklch(0.172 0.024 330)","--popover":"oklch(0.172 0.024 330)",
  "--primary":"oklch(0.72 0.16 345)","--primary-foreground":"oklch(0.14 0.028 345)",
  "--secondary":"oklch(0.205 0.026 330)","--muted":"oklch(0.205 0.026 330)","--muted-foreground":"oklch(0.648 0.022 335)",
  "--accent":"oklch(0.232 0.034 300)","--border":"oklch(0.265 0.030 330)","--input":"oklch(0.265 0.030 330)","--ring":"oklch(0.72 0.16 345)",
  "--chart-1":"oklch(0.72 0.16 345)","--chart-2":"oklch(0.66 0.15 300)","--chart-3":"oklch(0.70 0.14 25)","--chart-4":"oklch(0.80 0.11 85)","--chart-5":"oklch(0.64 0.13 240)",
  "--sidebar":"oklch(0.120 0.020 330)","--sidebar-primary":"oklch(0.72 0.16 345)","--sidebar-accent":"oklch(0.210 0.028 330)","--sidebar-border":"oklch(0.250 0.026 330)","--sidebar-ring":"oklch(0.72 0.16 345)"
}'::jsonb
WHERE slug = 'dia-madres';

-- ─── Buen Fin 🛒 — azul eléctrico con dorado ─────────────────────────────────
UPDATE temas_estacionales SET
css_vars = '{
  "--background":"oklch(0.975 0.006 255)","--card":"oklch(1 0 0)","--popover":"oklch(1 0 0)",
  "--primary":"oklch(0.48 0.19 258)","--primary-foreground":"oklch(0.99 0 0)",
  "--secondary":"oklch(0.947 0.010 255)","--muted":"oklch(0.947 0.010 255)","--muted-foreground":"oklch(0.46 0.018 258)",
  "--accent":"oklch(0.925 0.038 90)","--border":"oklch(0.900 0.010 255)","--input":"oklch(0.900 0.010 255)","--ring":"oklch(0.48 0.19 258)",
  "--chart-1":"oklch(0.55 0.20 258)","--chart-2":"oklch(0.74 0.14 85)","--chart-3":"oklch(0.60 0.16 210)","--chart-4":"oklch(0.56 0.14 150)","--chart-5":"oklch(0.58 0.18 300)",
  "--sidebar":"oklch(0.962 0.008 255)","--sidebar-primary":"oklch(0.48 0.19 258)","--sidebar-accent":"oklch(0.928 0.014 255)","--sidebar-border":"oklch(0.900 0.010 255)","--sidebar-ring":"oklch(0.48 0.19 258)"
}'::jsonb,
css_vars_dark = '{
  "--background":"oklch(0.125 0.026 260)","--card":"oklch(0.162 0.028 260)","--popover":"oklch(0.162 0.028 260)",
  "--primary":"oklch(0.62 0.19 258)","--primary-foreground":"oklch(0.98 0 0)",
  "--secondary":"oklch(0.198 0.030 260)","--muted":"oklch(0.198 0.030 260)","--muted-foreground":"oklch(0.645 0.024 258)",
  "--accent":"oklch(0.240 0.045 90)","--border":"oklch(0.258 0.032 260)","--input":"oklch(0.258 0.032 260)","--ring":"oklch(0.62 0.19 258)",
  "--chart-1":"oklch(0.64 0.19 258)","--chart-2":"oklch(0.80 0.13 85)","--chart-3":"oklch(0.68 0.15 210)","--chart-4":"oklch(0.64 0.14 150)","--chart-5":"oklch(0.66 0.17 300)",
  "--sidebar":"oklch(0.110 0.024 260)","--sidebar-primary":"oklch(0.62 0.19 258)","--sidebar-accent":"oklch(0.204 0.032 260)","--sidebar-border":"oklch(0.244 0.030 260)","--sidebar-ring":"oklch(0.62 0.19 258)"
}'::jsonb
WHERE slug = 'buen-fin';

-- ─── Año Nuevo 🎆 — dorado champagne sobre medianoche ────────────────────────
UPDATE temas_estacionales SET
css_vars = '{
  "--background":"oklch(0.977 0.008 90)","--card":"oklch(1 0 0)","--popover":"oklch(1 0 0)",
  "--primary":"oklch(0.55 0.12 82)","--primary-foreground":"oklch(0.99 0 0)",
  "--secondary":"oklch(0.948 0.012 90)","--muted":"oklch(0.948 0.012 90)","--muted-foreground":"oklch(0.46 0.022 85)",
  "--accent":"oklch(0.930 0.032 88)","--border":"oklch(0.900 0.015 88)","--input":"oklch(0.900 0.015 88)","--ring":"oklch(0.55 0.12 82)",
  "--chart-1":"oklch(0.68 0.14 85)","--chart-2":"oklch(0.55 0.16 270)","--chart-3":"oklch(0.60 0.16 210)","--chart-4":"oklch(0.60 0.15 150)","--chart-5":"oklch(0.60 0.18 300)",
  "--sidebar":"oklch(0.964 0.010 90)","--sidebar-primary":"oklch(0.55 0.12 82)","--sidebar-accent":"oklch(0.930 0.018 90)","--sidebar-border":"oklch(0.900 0.015 88)","--sidebar-ring":"oklch(0.55 0.12 82)"
}'::jsonb,
css_vars_dark = '{
  "--background":"oklch(0.115 0.022 272)","--card":"oklch(0.155 0.024 272)","--popover":"oklch(0.155 0.024 272)",
  "--primary":"oklch(0.80 0.14 88)","--primary-foreground":"oklch(0.15 0.030 85)",
  "--secondary":"oklch(0.190 0.028 272)","--muted":"oklch(0.190 0.028 272)","--muted-foreground":"oklch(0.640 0.024 272)",
  "--accent":"oklch(0.225 0.036 272)","--border":"oklch(0.250 0.032 272)","--input":"oklch(0.250 0.032 272)","--ring":"oklch(0.80 0.14 88)",
  "--chart-1":"oklch(0.80 0.14 88)","--chart-2":"oklch(0.64 0.16 270)","--chart-3":"oklch(0.68 0.15 210)","--chart-4":"oklch(0.68 0.14 150)","--chart-5":"oklch(0.66 0.17 300)",
  "--sidebar":"oklch(0.100 0.020 272)","--sidebar-primary":"oklch(0.80 0.14 88)","--sidebar-accent":"oklch(0.196 0.030 272)","--sidebar-border":"oklch(0.236 0.028 272)","--sidebar-ring":"oklch(0.80 0.14 88)"
}'::jsonb
WHERE slug = 'ano-nuevo';
