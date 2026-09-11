(function () {
  const CATEGORIAS = [
    "Gasto operacional",
    "Compra de bienes",
    "Compra de activos",
    "Impuestos",
    "Préstamo bancario",
  ];

  const state = {
    pagos: [],
    activeCategorias: new Set(CATEGORIAS),
    monthCursor: startOfMonth(new Date()),
  };

  const fmtPen = (n) =>
    "S/ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtMonto = (r) =>
    (r.moneda === "USD" ? "US$ " : "S/ ") +
    Number(r.monto || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function estadoDotClass(estado) {
    if (estado === "Pagado") return "dot-pagado";
    if (estado === "Vencido") return "dot-vencido";
    return "dot-pendiente";
  }

  async function load() {
    try {
      state.pagos = await SupabasePagos.fetchPagos(window.SUPABASE_CONFIG);
    } catch (err) {
      console.error(err);
      state.pagos = [];
      alert("No se pudo cargar el calendario de pagos: " + err.message);
    }
    renderChips();
    renderAll();
  }

  function visiblePagos() {
    return state.pagos.filter((p) => state.activeCategorias.has(p.categoria));
  }

  function renderChips() {
    const wrap = document.getElementById("categoryChips");
    wrap.innerHTML = "";
    CATEGORIAS.forEach((cat) => {
      const chip = document.createElement("button");
      chip.className = "chip" + (state.activeCategorias.has(cat) ? " active" : "");
      chip.textContent = cat;
      chip.addEventListener("click", () => {
        if (state.activeCategorias.has(cat)) state.activeCategorias.delete(cat);
        else state.activeCategorias.add(cat);
        renderChips();
        renderAll();
      });
      wrap.appendChild(chip);
    });
  }

  function renderAll() {
    renderKpis();
    renderCalendar();
    renderUpcoming();
  }

  function renderKpis() {
    const pagos = visiblePagos();
    const sums = { Pagado: 0, Pendiente: 0, Vencido: 0 };
    let usdCount = 0;
    for (const p of pagos) {
      sums[p.estado] = (sums[p.estado] || 0) + p.montoPen;
      if (p.moneda === "USD") usdCount += 1;
    }
    document.getElementById("kpiPagado").textContent = fmtPen(sums.Pagado);
    document.getElementById("kpiPendiente").textContent = fmtPen(sums.Pendiente);
    document.getElementById("kpiVencido").textContent = fmtPen(sums.Vencido);
    document.getElementById("kpiUsdCount").textContent = String(usdCount);
  }

  function renderCalendar() {
    const cursor = state.monthCursor;
    document.getElementById("monthLabel").textContent = cursor.toLocaleDateString("es-PE", {
      month: "long",
      year: "numeric",
    });

    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";

    const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const leadingBlanks = (firstDay.getDay() + 6) % 7; // lunes=0

    const byDate = {};
    for (const p of visiblePagos()) {
      (byDate[p.fecha] ||= []).push(p);
    }

    const todayIso = isoDate(new Date());

    for (let i = 0; i < leadingBlanks; i++) {
      const cell = document.createElement("div");
      cell.className = "day-cell empty";
      grid.appendChild(cell);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateObj = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      const iso = isoDate(dateObj);
      const items = byDate[iso] || [];
      const total = items.reduce((sum, p) => sum + p.montoPen, 0);

      const cell = document.createElement("div");
      cell.className = "day-cell" + (iso === todayIso ? " today" : "");

      const num = document.createElement("div");
      num.className = "day-number";
      num.textContent = String(day);
      cell.appendChild(num);

      if (items.length) {
        const totalEl = document.createElement("div");
        totalEl.className = "day-total";
        totalEl.textContent = fmtPen(total);
        cell.appendChild(totalEl);

        const dots = document.createElement("div");
        dots.className = "day-dots";
        items.slice(0, 8).forEach((p) => {
          const dot = document.createElement("span");
          dot.className = "dot " + estadoDotClass(p.estado);
          dots.appendChild(dot);
        });
        cell.appendChild(dots);

        cell.addEventListener("click", () => openDayPanel(iso, items));
      }

      grid.appendChild(cell);
    }
  }

  function renderUpcoming() {
    const todayIso = isoDate(new Date());
    const list = document.getElementById("upcomingList");
    list.innerHTML = "";
    const upcoming = visiblePagos()
      .filter((p) => p.estado !== "Pagado" && p.fecha >= todayIso)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 10);

    if (!upcoming.length) {
      const li = document.createElement("li");
      li.textContent = "Sin vencimientos próximos.";
      list.appendChild(li);
      return;
    }

    upcoming.forEach((p) => {
      const li = document.createElement("li");
      li.innerHTML = `<div class="upcoming-date">${p.fecha}</div><div>${p.beneficiario}</div>`;
      li.addEventListener("click", () => openDetail(p));
      list.appendChild(li);
    });
  }

  function openDayPanel(iso, items) {
    document.getElementById("dayPanelTitle").textContent = iso;
    const list = document.getElementById("dayPanelList");
    list.innerHTML = "";
    items.forEach((p) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${p.beneficiario}</span><strong>${fmtMonto(p)}</strong>`;
      li.addEventListener("click", () => {
        closeDayPanel();
        openDetail(p);
      });
      list.appendChild(li);
    });
    document.getElementById("dayPanel").hidden = false;
  }

  function closeDayPanel() {
    document.getElementById("dayPanel").hidden = true;
  }

  let currentDetail = null;

  function openDetail(p) {
    currentDetail = p;
    document.getElementById("detailCategoria").textContent = p.categoria;
    document.getElementById("detailBeneficiario").textContent = p.beneficiario;
    document.getElementById("detailMonto").textContent = fmtMonto(p);
    document.getElementById("detailFecha").textContent = p.fecha;
    document.getElementById("detailEstado").textContent = p.estado;
    document.getElementById("detailReferencia").textContent = p.referencia || "—";
    document.getElementById("detailCuenta").textContent = p.cuenta_bancaria || "—";
    document.getElementById("detailMetodo").textContent = p.metodo_pago || "—";
    document.getElementById("detailNotas").textContent = p.notas || "—";

    const comprobante = document.getElementById("detailComprobante");
    if (p.comprobante_url) {
      comprobante.href = p.comprobante_url;
      comprobante.hidden = false;
    } else {
      comprobante.hidden = true;
    }

    const btn = document.getElementById("marcarPagadoBtn");
    btn.disabled = p.estado === "Pagado";
    btn.textContent = p.estado === "Pagado" ? "Ya pagado" : "Marcar pagado";
    document.getElementById("detailError").hidden = true;

    document.getElementById("detailOverlay").hidden = false;
  }

  function closeDetail() {
    document.getElementById("detailOverlay").hidden = true;
    currentDetail = null;
  }

  async function marcarPagado() {
    if (!currentDetail) return;
    const errEl = document.getElementById("detailError");
    errEl.hidden = true;
    try {
      await SupabasePagos.marcarPagado(window.SUPABASE_CONFIG, currentDetail.id);
      closeDetail();
      await load();
    } catch (err) {
      errEl.textContent = "No se pudo actualizar: " + err.message;
      errEl.hidden = false;
      console.error(err);
    }
  }

  document.getElementById("prevMonth").addEventListener("click", () => {
    state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() - 1, 1);
    renderCalendar();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() + 1, 1);
    renderCalendar();
  });
  document.getElementById("detailClose").addEventListener("click", closeDetail);
  document.getElementById("detailOverlay").addEventListener("click", (e) => {
    if (e.target.id === "detailOverlay") closeDetail();
  });
  document.getElementById("dayPanelClose").addEventListener("click", closeDayPanel);
  document.getElementById("dayPanel").addEventListener("click", (e) => {
    if (e.target.id === "dayPanel") closeDayPanel();
  });
  document.getElementById("marcarPagadoBtn").addEventListener("click", marcarPagado);

  load();
})();
