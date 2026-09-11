# Calendario de Pagos — Transitur

Calendario mensual de pagos conectado a Supabase: grilla por día, chips de filtro por categoría, KPIs (Pagado / Pendiente / Vencido), lista de próximos vencimientos y detalle de pago con acción "Marcar pagado".

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
- El tipo de cambio USD→PEN usa `tipo_cambio` de la fila si existe, o el valor por defecto en `js/config.js` (`3.75`).
