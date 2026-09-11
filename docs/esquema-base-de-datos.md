# Esquema de base de datos — Calendario de pagos (Supabase)

Tabla actual: `Calendario Pagos Transitur` (schema `public`).
El conector `supabase-pagos.js` lee vía REST (`/rest/v1/<tabla>?select=*`) y mapea columnas por nombre, sin distinguir mayúsculas ni separadores (`fecha_pago`, `FechaPago` y `fecha pago` funcionan igual).

---

## 1. Columnas requeridas (mínimo para que todo funcione)

| Columna | Tipo | Nulo | Descripción | Usada en |
| --- | --- | --- | --- | --- |
| `id` | `uuid` (default `gen_random_uuid()`) o `bigint identity` | no | Clave primaria. Identifica el pago seleccionado y la acción "Marcar pagado". | Selección en el popup, estado local |
| `fecha` | `date` | no | Fecha programada del pago. **Sin ella la fila se descarta.** | Ubicación en la grilla, agrupación por día, "Próximos vencimientos" |
| `beneficiario` | `text` | no | Proveedor / acreedor / entidad (ej. "SUNAT — IGV mensual"). | Título de la tarjeta y del detalle |
| `monto` | `numeric(14,2)` | no | Importe en la moneda de la fila (positivo). | Totales del mes, monto del día, monto grande del detalle |
| `moneda` | `text` (`'PEN'` \| `'USD'`) | no, default `'PEN'` | Moneda del importe. USD se convierte a soles para los totales. | Tag de moneda, equivalencia, conteo "n en USD" |
| `categoria` | `text` | no | Una de: `Gasto operacional`, `Compra de bienes`, `Compra de activos`, `Impuestos`, `Préstamo bancario`. | Chips de filtro, tag del detalle |
| `estado` | `text` (`'Pagado'` \| `'Pendiente'` \| `'Vencido'`) | no, default `'Pendiente'` | Estado del pago. Si viene vacío, la app lo deduce por fecha. | Colores de la grilla, tags, KPIs Pagado/Pendiente/Vencido |
| `referencia` | `text` | sí | N.º de factura, orden o cuota (ej. `F412-8830`, `PDT-517-2204`). | Fila "N.º factura / ref." |

### Nombres alternativos aceptados por el conector
- `fecha`: `fecha_pago`, `fecha_programada`, `fecha_vencimiento`, `date`, `due_date`
- `beneficiario`: `proveedor`, `nombre`, `razon_social`, `descripcion`, `payee`
- `categoria`: `tipo`, `tipo_pago`, `concepto`, `category`
- `monto`: `importe`, `total`, `amount`, `valor`
- `referencia`: `nro_factura`, `numero_factura`, `factura`, `documento`, `ref`
- `estado`: `status`, `situacion`

---

## 2. Columnas recomendadas (siguiente iteración)

| Columna | Tipo | Para qué |
| --- | --- | --- |
| `tipo_cambio` | `numeric(8,4)` | Guardar el TC real de cada pago en USD en vez del 3.75 fijo del front |
| `fecha_pago_real` | `date` | Distinguir la fecha programada de la fecha en que se pagó |
| `pagado_por` | `uuid` (FK a `auth.users`) | Auditoría de quién marcó el pago |
| `pagado_en` | `timestamptz` | Momento del "Marcar pagado" |
| `comprobante_url` | `text` | Habilitar el botón "Ver comprobante" (archivo en Supabase Storage) |
| `cuenta_bancaria` | `text` | Mostrar la cuenta de cargo en el detalle |
| `metodo_pago` | `text` | Transferencia, cheque, débito automático, detracción |
| `empresa_id` / `centro_costo` | `uuid` / `text` | Filtrar por empresa o centro de costo |
| `notas` | `text` | Observaciones libres en el detalle |
| `created_at` | `timestamptz` default `now()` | Auditoría |
| `updated_at` | `timestamptz` default `now()` | Auditoría |

---

## 3. DDL sugerido

```sql
create table public.calendario_pagos (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null,
  beneficiario    text not null,
  monto           numeric(14,2) not null check (monto >= 0),
  moneda          text not null default 'PEN' check (moneda in ('PEN','USD')),
  categoria       text not null check (categoria in (
                    'Gasto operacional','Compra de bienes','Compra de activos',
                    'Impuestos','Préstamo bancario')),
  estado          text not null default 'Pendiente'
                    check (estado in ('Pagado','Pendiente','Vencido')),
  referencia      text,
  tipo_cambio     numeric(8,4),
  fecha_pago_real date,
  comprobante_url text,
  metodo_pago     text,
  cuenta_bancaria text,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index calendario_pagos_fecha_idx     on public.calendario_pagos (fecha);
create index calendario_pagos_categoria_idx on public.calendario_pagos (categoria);
create index calendario_pagos_estado_idx    on public.calendario_pagos (estado);
```

---

## 4. Permisos (por qué hoy devuelve `[]`)

La tabla responde `200` con lista vacía: RLS está activo sin policy de lectura para el rol `anon`.

```sql
alter table public.calendario_pagos enable row level security;

-- Lectura pública (solo si el dato no es sensible; si lo es, usa authenticated)
create policy "lectura anon"
  on public.calendario_pagos for select
  to anon
  using (true);

-- Marcar pagado desde la app (opcional, requiere usuario autenticado)
create policy "actualizar estado"
  on public.calendario_pagos for update
  to authenticated
  using (true) with check (true);
```

> Si el nombre de la tabla mantiene espacios (`Calendario Pagos Transitur`), el REST exige codificarlo (`Calendario%20Pagos%20Transitur`) — el conector ya lo hace. Aun así, recomiendo renombrarla a `calendario_pagos`.

---

## 5. Fila de ejemplo

```json
{
  "id": "8f1c…",
  "fecha": "2026-09-18",
  "beneficiario": "SUNAT — IGV mensual",
  "monto": 18450.00,
  "moneda": "PEN",
  "categoria": "Impuestos",
  "estado": "Pendiente",
  "referencia": "PDT-517-2204"
}
```
