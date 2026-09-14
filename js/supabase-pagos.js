// Conector Supabase -> Calendario de pagos.
// Lee vía REST (`/rest/v1/<tabla>?select=*`) y mapea columnas por nombre,
// sin distinguir mayúsculas ni separadores (ver docs/esquema-base-de-datos.md, sección 1).
(function (global) {
  const CANONICAL_FIELDS = {
    id: ["id"],
    fecha: ["fecha", "fecha_pago", "fecha_programada", "fecha_vencimiento", "date", "due_date"],
    beneficiario: ["beneficiario", "proveedor", "nombre", "razon_social", "descripcion", "payee"],
    monto: ["monto", "importe", "total", "amount", "valor"],
    moneda: ["moneda", "currency"],
    categoria: ["categoria", "tipo", "tipo_pago", "concepto", "category"],
    estado: ["estado", "status", "situacion"],
    referencia: ["referencia", "nro_factura", "numero_factura", "factura", "documento", "ref"],
    tipo_cambio: ["tipo_cambio", "tc", "exchange_rate"],
    fecha_pago_real: ["fecha_pago_real", "paid_at_date"],
    comprobante_url: ["comprobante_url", "receipt_url"],
    metodo_pago: ["metodo_pago", "payment_method"],
    cuenta_bancaria: ["cuenta_bancaria", "bank_account"],
    notas: ["notas", "notes", "observaciones"],
  };

  function normalizeKey(key) {
    return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  const ALIAS_LOOKUP = {};
  for (const [canonical, aliases] of Object.entries(CANONICAL_FIELDS)) {
    for (const alias of aliases) {
      ALIAS_LOOKUP[normalizeKey(alias)] = canonical;
    }
  }

  function mapRow(row) {
    const mapped = {};
    for (const [rawKey, value] of Object.entries(row)) {
      const canonical = ALIAS_LOOKUP[normalizeKey(rawKey)];
      const targetKey = canonical || rawKey;
      if (!(targetKey in mapped) || mapped[targetKey] == null) {
        mapped[targetKey] = value;
      }
    }
    return mapped;
  }

  // La columna `estado` en Postgres tiene default 'Pendiente' y nadie la mueve
  // cuando la fecha pasa, así que el vencimiento se deduce siempre por fecha.
  // Solo 'Pagado' es un estado explícito que hay que respetar.
  function deriveEstado(row, todayISO) {
    if (row.estado === "Pagado") return "Pagado";
    if (row.fecha && row.fecha < todayISO) return "Vencido";
    return row.estado || "Pendiente";
  }

  function restUrl(cfg, extra) {
    return `${cfg.url.replace(/\/$/, "")}/rest/v1/${encodeURIComponent(cfg.table)}${extra || ""}`;
  }

  async function fetchPagos(cfg) {
    const res = await fetch(restUrl(cfg, "?select=*&order=fecha.asc"), {
      headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
    });
    if (!res.ok) {
      throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
    }
    const rows = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    return rows
      .map(mapRow)
      .filter((r) => !!r.fecha) // "Sin fecha la fila se descarta"
      .map((r) => ({
        ...r,
        moneda: r.moneda || "PEN",
        categoria: r.categoria || "Gasto operacional",
        estado: deriveEstado(r, today),
        montoPen:
          Number(r.monto || 0) *
          ((r.moneda || "PEN") === "USD" ? Number(r.tipo_cambio) || cfg.tipoCambioDefault : 1),
      }));
  }

  // La policy "actualizar estado" permite al rol `anon`, por lo que la publishable key
  // alcanza para este PATCH sin sesión autenticada.
  async function marcarPagado(cfg, id, accessToken) {
    const res = await fetch(restUrl(cfg, `?id=eq.${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${accessToken || cfg.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        estado: "Pagado",
        fecha_pago_real: new Date().toISOString().slice(0, 10),
      }),
    });
    if (!res.ok) {
      throw new Error(`No se pudo marcar como pagado (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    return data[0];
  }

  // Ingresos sincronizados desde el Drive de reservas (pestaña Facturacion).
  // Devuelve un mapa 'YYYY-MM' -> { monto_usd, servicios, actualizado_en }.
  async function fetchIngresos(cfg) {
    const url = `${cfg.url.replace(/\/$/, "")}/rest/v1/${encodeURIComponent(
      cfg.tablaIngresos
    )}?select=*`;
    const res = await fetch(url, {
      headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
    });
    if (!res.ok) {
      throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
    }
    const porMes = {};
    for (const row of await res.json()) {
      porMes[row.mes] = row;
    }
    return porMes;
  }

  global.SupabasePagos = { fetchPagos, fetchIngresos, marcarPagado, mapRow, normalizeKey };
})(window);
