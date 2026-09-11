-- Calendario de pagos — esquema inicial
-- Renombra la tabla existente "Calendario Pagos Transitur" (vacía) a `calendario_pagos`
-- y agrega las columnas requeridas + recomendadas descritas en esquema-base-de-datos.md.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run.

alter table if exists public."Calendario Pagos Transitur"
  rename to calendario_pagos;

-- Columnas requeridas
alter table public.calendario_pagos
  add column if not exists id              uuid primary key default gen_random_uuid(),
  add column if not exists fecha           date not null,
  add column if not exists beneficiario    text not null,
  add column if not exists monto           numeric(14,2) not null check (monto >= 0),
  add column if not exists moneda          text not null default 'PEN' check (moneda in ('PEN','USD')),
  add column if not exists categoria       text not null check (categoria in (
                    'Gasto operacional','Compra de bienes','Compra de activos',
                    'Impuestos','Préstamo bancario')),
  add column if not exists estado          text not null default 'Pendiente'
                    check (estado in ('Pagado','Pendiente','Vencido')),
  add column if not exists referencia      text,
  -- Columnas recomendadas (siguiente iteración)
  add column if not exists tipo_cambio     numeric(8,4),
  add column if not exists fecha_pago_real date,
  add column if not exists comprobante_url text,
  add column if not exists metodo_pago     text,
  add column if not exists cuenta_bancaria text,
  add column if not exists notas           text,
  add column if not exists created_at      timestamptz not null default now(),
  add column if not exists updated_at      timestamptz not null default now();

create index if not exists calendario_pagos_fecha_idx     on public.calendario_pagos (fecha);
create index if not exists calendario_pagos_categoria_idx on public.calendario_pagos (categoria);
create index if not exists calendario_pagos_estado_idx    on public.calendario_pagos (estado);

-- RLS: hoy la tabla no tiene policy de lectura para "anon", por eso el REST devuelve [].
alter table public.calendario_pagos enable row level security;

drop policy if exists "lectura anon" on public.calendario_pagos;
create policy "lectura anon"
  on public.calendario_pagos for select
  to anon
  using (true);

drop policy if exists "actualizar estado" on public.calendario_pagos;
create policy "actualizar estado"
  on public.calendario_pagos for update
  to authenticated
  using (true) with check (true);
