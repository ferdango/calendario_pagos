-- Pago mensual recurrente: Cencosud, S/ 680, el 05 de cada mes.
-- Genera 12 cuotas desde el próximo vencimiento (05-oct-2026) hasta 05-sep-2027.
-- Idempotente: si se corre más de una vez, no duplica filas ya insertadas.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run.

insert into public.calendario_pagos (fecha, beneficiario, monto, moneda, categoria, estado)
select gs::date, 'Cencosud', 680.00, 'PEN', 'Préstamo bancario', 'Pendiente'
from generate_series('2026-10-05'::date, '2027-09-05'::date, interval '1 month') as gs
where not exists (
  select 1 from public.calendario_pagos c
  where c.beneficiario = 'Cencosud' and c.fecha = gs::date
);
