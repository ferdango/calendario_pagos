# Calendario de Pagos — Transitur

Calendario mensual de pagos conectado a Supabase: vista Calendario/Lista, KPIs del mes (Total / Pagado / Pendiente / Vencido / Ingresos), próximos vencimientos y detalle de pago con acción "Marcar pagado".

En la grilla, un día con todos sus pagos saldados se llena de verde con un check; un día con algún pago vencido queda con fondo rojo sutil.

## Estructura

- `index.html`, `css/styles.css`, `js/app.js` — front-end (vanilla HTML/CSS/JS, sin build step).
- `js/supabase-pagos.js` — conector: lee la tabla vía REST y mapea columnas por nombre (acepta alias como `fecha_pago`, `proveedor`, `importe`, etc. — ver `docs/esquema-base-de-datos.md`).
- `js/config.js` — URL del proyecto y publishable key de Supabase (segura para exponer en el cliente).
- `supabase/migrations/0001_calendario_pagos_schema.sql` — DDL: columnas, índices y policies RLS.
- `docs/esquema-base-de-datos.md` — especificación completa del esquema.

## Puesta en marcha

1. **Base de datos**: copiar el contenido de `supabase/migrations/0001_calendario_pagos_schema.sql` en Supabase → SQL Editor → Run. Esto renombra la tabla `Calendario Pagos Transitur` a `calendario_pagos`, agrega las columnas necesarias y habilita las policies de lectura (`anon`) y actualización de estado (`authenticated`).
2. **Front-end**: servir la carpeta con cualquier servidor estático, por ejemplo:
   ```bash
   npx serve .
   ```
   o
   ```bash
   python3 -m http.server 8080
   ```
   y abrir `http://localhost:8080` (no abrir `index.html` como `file://`: algunos navegadores restringen `fetch` en ese modo).

## Notas

- "Marcar pagado" hace un `PATCH` a la tabla; la policy de update permite al rol `anon`, así que funciona con la key pública sin necesidad de login. Ten en cuenta que esto también significa que cualquiera con la key puede modificar el estado de un pago — si más adelante se necesita restringirlo, hay que volver a policies por `authenticated`.
- El tipo de cambio USD→PEN usa `tipo_cambio` de la fila si existe, o el valor por defecto en `js/config.js` (`3.35`).
- El estado `Vencido` se deduce en el front por fecha, no se lee de la base: la columna `estado` tiene default `'Pendiente'` y nada la actualiza cuando la fecha pasa. Solo `'Pagado'` se respeta como estado explícito.

## Ingresos del mes

La card "Ingresos del mes" no sale del calendario de pagos: viene del Drive de reservas (`reservas@transitur.pe`), un archivo por mes llamado `Reservas <Mes>`, pestaña **Facturacion**, fila **Total**, columna **Pre Unit** (neto sin IGV, en USD).

Esos totales se copian a la tabla `ingresos_mensuales` en Supabase (`mes`, `monto_usd`, `servicios`, `origen`). El front lee esa tabla y convierte a soles con el tipo de cambio de `js/config.js`.

**La sincronización es manual.** El sitio es estático y no puede leer Drive: la hoja no es pública y el navegador la bloquea por CORS (redirige al login de Google). Para refrescar hay que volver a leer los archivos de Drive y hacer upsert en `ingresos_mensuales`.

Un mes sin fila en la tabla muestra "—" en vez de `S/ 0.00`, para no confundir "sin datos cargados" con "no hubo ingresos". Es el caso del mes en curso hasta que se cargan los precios en la hoja.
