(function () {
  const state = {
    pagos: [],
    ingresos: {}, // 'YYYY-MM' -> fila de ingresos_mensuales
    monthCursor: startOfMonth(new Date()),
    view: "calendar", // "calendar" | "list"
  };

  const fmtPen = (n) =>
    "S/ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtUsd = (n) =>
    "US$ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtMonto = (r) =>
    (r.moneda === "USD" ? "US$ " : "S/ ") +
    Number(r.monto || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function fmtFechaCorta(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("es-PE", {
      day: "numeric",
      month: "short",
    });
  }

  function pagosDelMesVisible() {
    const year = state.monthCursor.getFullYear();
    const month = state.monthCursor.getMonth(); // 0-based
    return state.pagos.filter((p) => {
      const [y, m] = p.fecha.split("-").map(Number);
      return y === year && m - 1 === month;
    });
  }

  function estadoDotClass(estado) {
    if (estado === "Pagado") return "dot-pagado";
    if (estado === "Vencido") return "dot-vencido";
    return "dot-pendiente";
  }

  function estadoRowClass(estado) {
    if (estado === "Pagado") return "estado-pagado";
    if (estado === "Vencido") return "estado-vencido";
    return "";
  }

  function checkIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("class", "check-icon");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Pagado");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M4 12.5 L9.5 18 L20 6.5");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  async function load() {
    try {
      state.pagos = await SupabasePagos.fetchPagos(window.SUPABASE_CONFIG);
    } catch (err) {
      console.error(err);
      state.pagos = [];
      alert("No se pudo cargar el calendario de pagos: " + err.message);
    }
    // Los ingresos son un extra: si fallan, el calendario igual funciona.
    try {
      state.ingresos = await SupabasePagos.fetchIngresos(window.SUPABASE_CONFIG);
    } catch (err) {
      console.error("No se pudieron cargar los ingresos:", err);
      state.ingresos = {};
    }
    renderAll();
  }

  async function marcarPagadoRequest(id) {
    await SupabasePagos.marcarPagado(window.SUPABASE_CONFIG, id);
    await load();
  }

  function renderMonthDependent() {
    renderCalendar();
    renderKpis();
    if (state.view === "list") renderTimelineList();
  }

  function renderAll() {
    renderMonthDependent();
    renderUpcoming();
  }

  function renderKpis() {
    const sums = { Pagado: 0, Pendiente: 0, Vencido: 0 };
    let totalMes = 0;
    for (const p of pagosDelMesVisible()) {
      sums[p.estado] = (sums[p.estado] || 0) + p.montoPen;
      totalMes += p.montoPen;
    }
    document.getElementById("kpiTotalMes").textContent = fmtPen(totalMes);
    document.getElementById("kpiPagado").textContent = fmtPen(sums.Pagado);
    document.getElementById("kpiPendiente").textContent = fmtPen(sums.Pendiente);
    document.getElementById("kpiVencido").textContent = fmtPen(sums.Vencido);
    renderIngresos();
  }

  function renderIngresos() {
    const y = state.monthCursor.getFullYear();
    const m = String(state.monthCursor.getMonth() + 1).padStart(2, "0");
    const fila = state.ingresos[`${y}-${m}`];
    const valorEl = document.getElementById("kpiIngresos");
    const notaEl = document.getElementById("kpiIngresosNota");

    if (!fila) {
      valorEl.textContent = "—";
      notaEl.textContent = "sin facturación cargada";
      return;
    }
    const usd = Number(fila.monto_usd || 0);
    valorEl.textContent = fmtPen(usd * window.SUPABASE_CONFIG.tipoCambioDefault);
    notaEl.textContent = `${fmtUsd(usd)} · ${fila.servicios || 0} servicios`;
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
    for (const p of state.pagos) {
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
        // Día saldado por completo: se llena de verde con un check y se ocultan
        // monto y dots, porque ya no hay nada que revisar ahí.
        if (items.every((p) => p.estado === "Pagado")) {
          cell.classList.add("day-pagado");
          cell.appendChild(checkIcon());
        } else {
          if (items.some((p) => p.estado === "Vencido")) {
            cell.classList.add("day-vencido");
          }

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
        }

        cell.addEventListener("click", () => openDayPanel(iso, items));
      }

      grid.appendChild(cell);
    }
  }

  // Fila reutilizable para un pago: usada en "Próximos vencimientos", la vista Lista
  // y el panel del día. Incluye una acción rápida "Marcar pagado" (si aplica),
  // sin necesidad de abrir el detalle completo.
  function buildEventRow(p, opts = {}) {
    const { showDate = false, onOpen, onPaid } = opts;

    const li = document.createElement("li");
    li.className = "event-row " + estadoRowClass(p.estado);

    const main = document.createElement("div");
    main.className = "event-main";
    const title = document.createElement("div");
    title.className = "event-title";
    title.textContent = p.beneficiario;
    const sub = document.createElement("div");
    sub.className = "event-sub";
    sub.textContent = showDate ? `${fmtFechaCorta(p.fecha)} · ${p.categoria}` : p.categoria;
    main.append(title, sub);

    const side = document.createElement("div");
    side.className = "event-side";
    const amount = document.createElement("span");
    amount.className = "event-amount";
    amount.textContent = fmtMonto(p);
    side.appendChild(amount);

    if (p.estado !== "Pagado") {
      const btn = document.createElement("button");
      btn.className = "quick-pay-btn";
      btn.textContent = "Marcar pagado";
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        btn.textContent = "…";
        try {
          await marcarPagadoRequest(p.id);
          if (onPaid) onPaid();
        } catch (err) {
          console.error(err);
          btn.disabled = false;
          btn.textContent = "Marcar pagado";
          alert("No se pudo marcar como pagado: " + err.message);
        }
      });
      side.appendChild(btn);
    }

    li.append(main, side);
    li.addEventListener("click", () => (onOpen ? onOpen(p) : openDetail(p)));
    return li;
  }

  function renderUpcoming() {
    const todayIso = isoDate(new Date());
    const list = document.getElementById("upcomingList");
    list.innerHTML = "";
    const upcoming = state.pagos
      .filter((p) => p.estado !== "Pagado" && p.fecha >= todayIso)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 10);

    if (!upcoming.length) {
      const li = document.createElement("li");
      li.className = "timeline-empty";
      li.textContent = "Sin vencimientos próximos.";
      list.appendChild(li);
      return;
    }

    upcoming.forEach((p) => list.appendChild(buildEventRow(p, { showDate: true })));
  }

  function renderTimelineList() {
    const wrap = document.getElementById("timelineList");
    wrap.innerHTML = "";
    const items = pagosDelMesVisible().slice().sort((a, b) => a.fecha.localeCompare(b.fecha));

    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "timeline-empty";
      empty.textContent = "Sin pagos este mes.";
      wrap.appendChild(empty);
      return;
    }

    let lastDate = null;
    items.forEach((p) => {
      if (p.fecha !== lastDate) {
        lastDate = p.fecha;
        const heading = document.createElement("li");
        heading.className = "timeline-day-heading";
        heading.textContent = new Date(p.fecha + "T00:00:00").toLocaleDateString("es-PE", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        wrap.appendChild(heading);
      }
      wrap.appendChild(buildEventRow(p));
    });
  }

  function openDayPanel(iso, items) {
    document.getElementById("dayPanelTitle").textContent = new Date(iso + "T00:00:00").toLocaleDateString(
      "es-PE",
      { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    );
    const list = document.getElementById("dayPanelList");
    list.innerHTML = "";
    items.forEach((p) => {
      list.appendChild(
        buildEventRow(p, {
          onOpen: (payment) => {
            closeDayPanel();
            openDetail(payment);
          },
          onPaid: closeDayPanel,
        })
      );
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
    document.getElementById("detailFecha").textContent = new Date(
      p.fecha + "T00:00:00"
    ).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
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

  async function marcarPagadoDesdeDetalle() {
    if (!currentDetail) return;
    const errEl = document.getElementById("detailError");
    errEl.hidden = true;
    try {
      await marcarPagadoRequest(currentDetail.id);
      closeDetail();
    } catch (err) {
      errEl.textContent = "No se pudo actualizar: " + err.message;
      errEl.hidden = false;
      console.error(err);
    }
  }

  function setView(view) {
    state.view = view;
    const calBtn = document.getElementById("viewCalendarBtn");
    const listBtn = document.getElementById("viewListBtn");
    calBtn.classList.toggle("active", view === "calendar");
    calBtn.setAttribute("aria-selected", String(view === "calendar"));
    listBtn.classList.toggle("active", view === "list");
    listBtn.setAttribute("aria-selected", String(view === "list"));
    document.getElementById("calendarWrap").hidden = view !== "calendar";
    document.getElementById("listWrap").hidden = view !== "list";
    if (view === "list") renderTimelineList();
  }

  document.getElementById("prevMonth").addEventListener("click", () => {
    state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() - 1, 1);
    renderMonthDependent();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() + 1, 1);
    renderMonthDependent();
  });
  document.getElementById("todayBtn").addEventListener("click", () => {
    state.monthCursor = startOfMonth(new Date());
    renderMonthDependent();
  });
  document.getElementById("viewCalendarBtn").addEventListener("click", () => setView("calendar"));
  document.getElementById("viewListBtn").addEventListener("click", () => setView("list"));
  document.getElementById("detailClose").addEventListener("click", closeDetail);
  document.getElementById("detailOverlay").addEventListener("click", (e) => {
    if (e.target.id === "detailOverlay") closeDetail();
  });
  document.getElementById("dayPanelClose").addEventListener("click", closeDayPanel);
  document.getElementById("dayPanel").addEventListener("click", (e) => {
    if (e.target.id === "dayPanel") closeDayPanel();
  });
  document.getElementById("marcarPagadoBtn").addEventListener("click", marcarPagadoDesdeDetalle);

  load();
})();
