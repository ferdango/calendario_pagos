// Configuración pública del proyecto Supabase.
// La "publishable key" está diseñada para exponerse en el cliente (equivalente a la anon key);
// respeta las políticas RLS definidas en supabase/migrations/0001_calendario_pagos_schema.sql.
window.SUPABASE_CONFIG = {
  url: "https://rbcnjosixvyoodyunjkt.supabase.co",
  anonKey: "sb_publishable_vemYiTnRpBgS-ZLWRbL0MA_z-QxXdqT",
  table: "calendario_pagos",
  tipoCambioDefault: 3.35,
};
