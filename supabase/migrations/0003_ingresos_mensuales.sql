-- Ingresos mensuales sincronizados desde el Drive de reservas.
-- Fuente: archivo "Reservas <Mes>" (Drive de reservas@transitur.pe),
-- pestaña "Facturacion", fila Total, columna "Pre Unit" (neto sin IGV, en USD).
-- La sincronización es manual: ver sección "Ingresos del mes" en el README.

create table if not exists public.ingresos_mensuales (
  mes            text primary key,           -- 'YYYY-MM'
  monto_usd      numeric(14,2) not null,
  servicios      integer,
  origen         text,
  actualizado_en timestamptz not null default now()
);

alter table public.ingresos_mensuales enable row level security;

drop policy if exists "lectura anon ingresos" on public.ingresos_mensuales;
create policy "lectura anon ingresos"
  on public.ingresos_mensuales for select
  to anon
  using (true);

-- Datos sincronizados al 2026-09-14.
-- Abril y setiembre quedan fuera a propósito: no tienen precios cargados en la
-- hoja, y una fila en 0 se leería como "no hubo ingresos" en vez de "sin datos".
insert into public.ingresos_mensuales (mes, monto_usd, servicios, origen) values
  ('2026-03',  214.00,   8, 'Reservas Marzo'),
  ('2026-05', 4173.50, 120, 'Reservas Mayo'),
  ('2026-06', 3708.00,  96, 'Reservas Junio'),
  ('2026-07', 4862.50, 146, 'Reservas Julio'),
  ('2026-08', 6555.00, 191, 'Reservas Agosto')
on conflict (mes) do update set
  monto_usd      = excluded.monto_usd,
  servicios      = excluded.servicios,
  origen         = excluded.origen,
  actualizado_en = now();
