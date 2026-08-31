// js/main.js
// Dashboard de cotizadores Sanaré & Nomad (Firebase)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// CONFIG FIREBASE

const firebaseConfigSanare = {
  apiKey: "AIzaSyAX1AA7tTnlnApVZlnnuMkB42k3W5IlwoM",
  authDomain: "sanare-cotizador.firebaseapp.com",
  projectId: "sanare-cotizador",
  storageBucket: "sanare-cotizador.firebasestorage.app",
  messagingSenderId: "902613920907",
  appId: "1:902613920907:web:0e73bd5def3cf4396a788e"
};

const firebaseConfigNomad = {
  apiKey: "AIzaSyDhtKZlWpHdhFcnVzWovB93bRSVRkC1sDI",
  authDomain: "cotizador-nomad.firebaseapp.com",
  projectId: "cotizador-nomad",
  storageBucket: "cotizador-nomad.firebasestorage.app",
  messagingSenderId: "736481537624",
  appId: "1:736481537624:web:6f06667cf34bccc532642d"
};

const firebaseConfigNuevoSanare = {
  apiKey: "AIzaSyCUFENXy1PE7Q6lX7c54F8hH3RjStM9Fdc",
  authDomain: "cotizador-30.firebaseapp.com",
  projectId: "cotizador-30",
  storageBucket: "cotizador-30.firebasestorage.app",
  messagingSenderId: "150005004914",
  appId: "1:150005004914:web:5b217c06aa13e34b9960eb"
};

// IMPORTANTE: en ambos proyectos el nombre de la colección es "cotizaciones"
const SANARE_COLLECTION = "cotizaciones";
const NOMAD_COLLECTION  = "cotizaciones";

// Inicializar apps
const appSanare = initializeApp(firebaseConfigSanare, "sanareApp");
const appNomad  = initializeApp(firebaseConfigNomad, "nomadApp");
const appNuevoSanare = initializeApp(firebaseConfigNuevoSanare, "nuevoSanareApp");

const dbSanare = getFirestore(appSanare);
const dbNomad  = getFirestore(appNomad);
const dbNuevoSanare = getFirestore(appNuevoSanare);

// Estatus
const ESTATUS_1_OPCIONES = [
  "Sin seguimiento",
  "Cotización enviada",
  "En negociación",
  "Cerrada / aceptada",
  "Perdida / rechazada",
  "Cancelada"
];

const ESTATUS_2_OPCIONES = [
  "Sin aplicación",
  "Por programar",
  "Programada",
  "Aplicada",
  "No aplicada / vencida",
  "Reprogramada"
];

// Map teléfono -> sede Sanaré
const MAPA_SEDES_SANARE = {
  "722 197 08 36": "Toluca",
  "55 5255 8403": "Narvarte"
};

function obtenerSedePorTelefono(telefono) {
  if (!telefono) return "";
  return MAPA_SEDES_SANARE[telefono.trim()] || "Otra / sin clasificar";
}

// Estado en memoria
let sanareRows = [];
let nomadRows  = [];
let nuevoSanareRows = [];
let allRows    = [];

// DOM
const tbody = document.getElementById("tablaCotizacionesBody");
const totalGlobalElem       = document.getElementById("totalGlobal");
const totalSanareElem       = document.getElementById("totalSanare");
const totalNomadElem        = document.getElementById("totalNomad");
const totalGlobalCountElem  = document.getElementById("totalGlobalCount");
const totalSanareCountElem  = document.getElementById("totalSanareCount");
const totalNomadCountElem   = document.getElementById("totalNomadCount");
const ticketPromedioElem    = document.getElementById("ticketPromedio");
const contadorFilasElem     = document.getElementById("contadorFilas");

const filtroFechaInicio = document.getElementById("filtroFechaInicio");
const filtroFechaFin    = document.getElementById("filtroFechaFin");
const filtroTexto       = document.getElementById("filtroTexto");
const filtroStatus1     = document.getElementById("filtroStatus1");
const filtroStatus2     = document.getElementById("filtroStatus2");
const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");
const btnExportCsvResumen   = document.getElementById("btnExportCsvResumen");
const btnExportCsvDetallado = document.getElementById("btnExportCsvDetallado");
const filtrosMarca = document.querySelectorAll(".filtro-marca");

// Marymar y Ly pueden consultar el dashboard, pero no modificar los dos
// campos de seguimiento que aparecen en la tabla.
function puedeEditarEstatus() {
  return window.INNVIDA_DASHBOARD_ROLE !== "limited";
}

// Init selects de estatus
function initStatusFilters() {
  ESTATUS_1_OPCIONES.forEach(op => {
    const o = document.createElement("option");
    o.value = op;
    o.textContent = op;
    filtroStatus1.appendChild(o);
  });
  ESTATUS_2_OPCIONES.forEach(op => {
    const o = document.createElement("option");
    o.value = op;
    o.textContent = op;
    filtroStatus2.appendChild(o);
  });
}

function getSelectedValues(selectElem) {
  const values = [];
  for (const opt of selectElem.options) {
    if (opt.selected) values.push(opt.value);
  }
  return values;
}

// Listeners tiempo real
function initRealtimeListeners() {
  onSnapshot(collection(dbSanare, SANARE_COLLECTION), snap => {
    sanareRows = snap.docs.map(d => mapSanareDoc(d));
    recomputeAll();
  }, err => console.error("Sanaré listener error:", err));

  onSnapshot(collection(dbNomad, NOMAD_COLLECTION), snap => {
    nomadRows = snap.docs.map(d => mapNomadDoc(d));
    recomputeAll();
  }, err => console.error("Nomad listener error:", err));

  onSnapshot(collection(dbNuevoSanare, "cotizaciones"), snap => {
    nuevoSanareRows = snap.docs.map(d => mapNuevoSanareDoc(d));
    recomputeAll();
  }, err => console.error("Nuevo Sanare listener error:", err));
}

// Map docs
// Convierte montos guardados como número o texto (por ejemplo "$1,234.50")
// y evita presentar una cotización sin importe como si fuera de $0.
function leerMonto(valor) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) && valor > 0 ? valor : null;
  }
  if (typeof valor !== "string" || !valor.trim()) return null;

  const texto = valor.trim().replace(/[^0-9,.-]/g, "");
  if (!texto) return null;
  const numero = Number(texto.replace(/,/g, ""));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

// Suma conceptos cuando el documento no guardó un total general. Se usa para
// recuperar cotizaciones históricas que sí tienen servicios o medicamentos.
function calcularMontoConceptos(conceptos) {
  if (!Array.isArray(conceptos)) return null;

  let total = 0;
  let encontroMonto = false;
  conceptos.forEach(concepto => {
    if (!concepto || typeof concepto !== "object") return;

    const subtotal = leerMonto(
      concepto.subtotal ?? concepto.importe ?? concepto.total ?? concepto.monto
    );
    if (subtotal !== null) {
      total += subtotal;
      encontroMonto = true;
      return;
    }

    const precio = leerMonto(
      concepto.precioUnitario ?? concepto.precio ?? concepto.price ??
      concepto.costo ?? concepto.valor ?? concepto.BOLSILLO ?? concepto.bolsillo ??
      concepto.innovador?.BOLSILLO ?? concepto.patente?.BOLSILLO
    );
    if (precio === null) return;

    const cantidad = Number(concepto.cantidad ?? concepto.cant ?? concepto.qty ?? 1);
    total += precio * (Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1);
    encontroMonto = true;
  });

  return encontroMonto && total > 0 ? total : null;
}

function obtenerTotalConRespaldo(totalGuardado, ...listasDeConceptos) {
  const totalDirecto = leerMonto(totalGuardado);
  if (totalDirecto !== null) return totalDirecto;

  let total = 0;
  let encontroMonto = false;
  listasDeConceptos.forEach(lista => {
    const subtotal = calcularMontoConceptos(lista);
    if (subtotal !== null) {
      total += subtotal;
      encontroMonto = true;
    }
  });
  return encontroMonto ? total : null;
}

function mapSanareDoc(docSnap) {
  const data = docSnap.data();
  const servicios = Array.isArray(data.servicios) ? data.servicios : [];
  const medicamentos = Array.isArray(data.medicamentos) ? data.medicamentos : [];
  const total = obtenerTotalConRespaldo(data.total, servicios, medicamentos);

  const telefono = data.telefono || "";
  const sede     = obtenerSedePorTelefono(telefono);

  const status1 = data.status1 || "Sin seguimiento";
  const status2 = data.status2 || "Sin aplicación";
  const motivo  = data.motivo  || "";

  return {
    origen: "SANARE",
    idFirestore: docSnap.id,
    collection: SANARE_COLLECTION,
    folio: data.folio || "",
    fechaEmision: data.fechaEmision || "",
    fechaCierre: data.fechaCierre || "",
    fechaProgramacion: data.fechaProgramacion || "",
    fechaValidez: data.fechaValidez || "",
    createdAt: data.createdAt || "",
    paciente: data.paciente || "",
    medico: data.medico || "",
    kam: data.kam || "",
    aseguradora: data.aseguradora || "",
    telefono,
    sede,
    total,
    direccion: data.direccion || "",
    dx: data.dx || "",
    esquema: data.esquema || "",
    servicios,
    medicamentos,
    marca: "SANARE",
    status1,
    status2,
    motivo
  };
}

function mapNomadDoc(docSnap) {
  const data = docSnap.data();
  const pruebas = Array.isArray(data.pruebas) ? data.pruebas : [];
  const total = obtenerTotalConRespaldo(data.total, pruebas);

  const status1 = data.status1 || "Sin seguimiento";
  const status2 = data.status2 || "Sin aplicación";
  const motivo  = data.motivo  || "";

  return {
    origen: "NOMAD",
    idFirestore: docSnap.id,
    collection: NOMAD_COLLECTION,
    folio: data.folio || "",
    fechaEmision: data.fechaEmision || "",
    fechaCierre: data.fechaCierre || "",
    fechaProgramacion: data.fechaProgramacion || "",
    fechaValidez: data.fechaValidez || "",
    createdAt: data.createdAt || "",
    paciente: data.paciente || "",
    medico: data.medico || "",
    kam: data.kam || "",
    aseguradora: data.aseguradora || "",
    telefono: "",
    sede: "",
    total,
    diagnostico: data.diagnostico || "",
    marca: data.marca || "NOMAD",
    pruebas,
    status1,
    status2,
    motivo
  };
}

function mapNuevoSanareDoc(docSnap) {
  const data = docSnap.data();
  const total = obtenerTotalConRespaldo(data.total, data.state?.items);

  // El estado interno del nuevo cotizador (APPROVED, PENDING_*, etc.) no es
  // una aceptación comercial. El seguimiento sólo cambia cuando un usuario
  // selecciona y guarda manualmente el Estatus 1 en este dashboard.
  const status1 = "Sin seguimiento";

  const paciente = data.form ? data.form.paciente : (data.paciente || "");
  const medico = data.form ? data.form.medico : (data.medico || "");
  const sede = data.form ? data.form.sede : "";

  let fechaEmision = "";
  if (data.createdAt) {
      if (typeof data.createdAt.toDate === 'function') {
          fechaEmision = data.createdAt.toDate().toISOString().split('T')[0];
      } else if (typeof data.createdAt === 'number' || typeof data.createdAt === 'string') {
          try { fechaEmision = new Date(data.createdAt).toISOString().split('T')[0]; } catch(e){}
      }
  }

  return {
    origen: "SANARE_NUEVO",
    idFirestore: docSnap.id,
    collection: "cotizaciones",
    folio: data.folio || "",
    fechaEmision: fechaEmision,
    fechaCierre: data.fechaCierre || "",
    fechaProgramacion: "",
    fechaValidez: "",
    createdAt: data.createdAt || "",
    paciente: paciente,
    medico: medico,
    kam: data.kam || "",
    aseguradora: "",
    telefono: "",
    sede: sede,
    total: total,
    direccion: "",
    dx: "",
    esquema: "",
    servicios: [],
    medicamentos: [],
    marca: "SANARE",
    status1: data.status1 || status1,
    status2: data.status2 || "Sin aplicación",
    motivo: data.motivo || ""
  };
}

function recomputeAll() {
  allRows = [...sanareRows, ...nomadRows, ...nuevoSanareRows];
  aplicarFiltrosYRender();
}

function aplicarFiltrosYRender() {
  let filas = [...allRows];

  const marcasSeleccionadas = Array.from(filtrosMarca)
    .filter(cb => cb.checked)
    .map(cb => cb.value);
  if (marcasSeleccionadas.length > 0) {
    filas = filas.filter(r => marcasSeleccionadas.includes(r.marca));
  }

  const inicio = filtroFechaInicio.value;
  const fin    = filtroFechaFin.value;
  if (inicio) filas = filas.filter(r => r.fechaEmision && r.fechaEmision >= inicio);
  if (fin)    filas = filas.filter(r => r.fechaEmision && r.fechaEmision <= fin);

  const texto = filtroTexto.value.trim().toLowerCase();
  if (texto) {
    filas = filas.filter(r =>
      (r.folio || "").toLowerCase().includes(texto) ||
      (r.paciente || "").toLowerCase().includes(texto) ||
      (r.medico || "").toLowerCase().includes(texto) ||
      (r.kam || "").toLowerCase().includes(texto)
    );
  }

  const st1 = getSelectedValues(filtroStatus1);
  const st2 = getSelectedValues(filtroStatus2);
  if (st1.length) filas = filas.filter(r => st1.includes(r.status1));
  if (st2.length) filas = filas.filter(r => st2.includes(r.status2));

  renderTabla(filas);
  actualizarTotales(filas);
  actualizarGraficos(filas);
}

function renderTabla(filas) {
  tbody.innerHTML = "";
  filas.forEach(row => {
    const tr = document.createElement("tr");
    tr.dataset.id = row.idFirestore;
    tr.dataset.marca = row.marca;
    tr.dataset.collection = row.collection;

    const tdMarca   = document.createElement("td"); tdMarca.textContent = row.marca;
    const tdFolio   = document.createElement("td"); tdFolio.textContent = row.folio;
    const tdFecha   = document.createElement("td"); tdFecha.textContent = row.fechaEmision || "";

    const tdFechaCierre = document.createElement("td");
    const inpFechaCierre = document.createElement("input");
    inpFechaCierre.type = "date";
    inpFechaCierre.value = row.fechaCierre || "";
    inpFechaCierre.title = "Fecha de cierre";
    tdFechaCierre.appendChild(inpFechaCierre);

    const tdPac     = document.createElement("td"); tdPac.textContent = row.paciente || "";
    const tdMed     = document.createElement("td"); tdMed.textContent = row.medico || "";
    const tdKam     = document.createElement("td"); tdKam.textContent = row.kam || "";
    const tdAseg    = document.createElement("td"); tdAseg.textContent = row.aseguradora || "";
    const tdTotal   = document.createElement("td"); tdTotal.textContent = formatearMoneda(row.total); tdTotal.style.textAlign = "right";
    const tdTel     = document.createElement("td"); tdTel.textContent = row.telefono || "";
    const tdSede    = document.createElement("td"); tdSede.textContent = row.sede || "";

    const tdStatus1 = document.createElement("td");
    const sel1 = document.createElement("select");
    ESTATUS_1_OPCIONES.forEach(op => {
      const o = document.createElement("option");
      o.value = o.textContent = op;
      if (op === row.status1) o.selected = true;
      sel1.appendChild(o);
    });
    sel1.disabled = !puedeEditarEstatus();
    if (!puedeEditarEstatus()) sel1.title = "No tienes permiso para modificar Estatus 1";
    tdStatus1.appendChild(sel1);

    const tdStatus2 = document.createElement("td");
    const sel2 = document.createElement("select");
    ESTATUS_2_OPCIONES.forEach(op => {
      const o = document.createElement("option");
      o.value = o.textContent = op;
      if (op === row.status2) o.selected = true;
      sel2.appendChild(o);
    });
    sel2.disabled = !puedeEditarEstatus();
    if (!puedeEditarEstatus()) sel2.title = "No tienes permiso para modificar Estatus 2";
    tdStatus2.appendChild(sel2);

    const tdMotivo = document.createElement("td");
    const inpMotivo = document.createElement("input");
    inpMotivo.type = "text";
    inpMotivo.value = row.motivo || "";
    inpMotivo.placeholder = "Motivo / comentario...";
    tdMotivo.appendChild(inpMotivo);

    const guardar = async () => {
      try {
        let db;
        if (row.origen === "SANARE_NUEVO") db = dbNuevoSanare;
        else if (row.origen === "SANARE") db = dbSanare;
        else db = dbNomad;
        const ref = doc(db, row.collection, row.idFirestore);
        const cambios = {
          motivo:  inpMotivo.value,
          fechaCierre: inpFechaCierre.value || ""
        };
        if (puedeEditarEstatus()) {
          cambios.status1 = sel1.value;
          cambios.status2 = sel2.value;
        }
        await updateDoc(ref, cambios);
      } catch (e) {
        console.error("Error actualizando seguimiento:", e);
        alert("No se pudo guardar en Firebase. Revisa consola.");
      }
    };

    // La fecha de cierre se registra de forma independiente: poner una fecha
    // nunca debe aceptar/cerrar una cotización automáticamente.
    inpFechaCierre.addEventListener("change", guardar);

    if (puedeEditarEstatus()) {
      sel1.addEventListener("change", guardar);
      sel2.addEventListener("change", guardar);
    }
    inpMotivo.addEventListener("blur", guardar);
    inpMotivo.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        guardar();
      }
    });

    tr.appendChild(tdMarca);
    tr.appendChild(tdFolio);
    tr.appendChild(tdFecha);
    tr.appendChild(tdFechaCierre);
    tr.appendChild(tdPac);
    tr.appendChild(tdMed);
    tr.appendChild(tdKam);
    tr.appendChild(tdAseg);
    tr.appendChild(tdTotal);
    tr.appendChild(tdTel);
    tr.appendChild(tdSede);
    tr.appendChild(tdStatus1);
    tr.appendChild(tdStatus2);
    tr.appendChild(tdMotivo);

    tbody.appendChild(tr);
  });

  contadorFilasElem.textContent = filas.length + " filas";
}

// Helper: define si una fila debe excluirse del resumen global
function esExcluidaDeResumenGlobal(row) {
  const st1 = (row.status1 || "").toLowerCase();
  const st2 = (row.status2 || "").toLowerCase();

  const exclStatus1 =
    st1 === "perdida / rechazada" ||
    st1 === "cancelada";

  const exclStatus2 =
    st2 === "no aplicada / vencida";

  return exclStatus1 || exclStatus2;
}

// Totales
function actualizarTotales(filas) {
  // Para el resumen global excluimos:
  // - Estatus 1: "Perdida / rechazada" y "Cancelada"
  // - Estatus 2: "No aplicada / vencida"
  const filasResumen = filas.filter(r => !esExcluidaDeResumenGlobal(r));

  const totalGlobal = filasResumen.reduce((acc, r) => acc + (r.total || 0), 0);
  const sanare = filasResumen.filter(r => r.marca === "SANARE");
  const nomad  = filasResumen.filter(r => r.marca === "NOMAD");
  const totalSanare = sanare.reduce((a,r) => a + (r.total || 0), 0);
  const totalNomad  = nomad.reduce((a,r) => a + (r.total || 0), 0);
  const ticket      = filasResumen.length ? totalGlobal / filasResumen.length : 0;

  totalGlobalElem.textContent = formatearMoneda(totalGlobal);
  totalSanareElem.textContent = formatearMoneda(totalSanare);
  totalNomadElem.textContent  = formatearMoneda(totalNomad);
  totalGlobalCountElem.textContent = filasResumen.length;
  totalSanareCountElem.textContent = sanare.length;
  totalNomadCountElem.textContent  = nomad.length;
  ticketPromedioElem.textContent   = formatearMoneda(ticket);
}

// Charts
let chartKams, chartSedes, chartPruebas, chartMeses, chartStatus1;

function crearOActualizarChart(ref, id, type, data, options) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  if (ref instanceof Chart) {
    ref.data = data;
    ref.options = options || {};
    ref.update();
    return ref;
  }
  return new Chart(ctx, { type, data, options });
}

function actualizarGraficos(filas) {
  // KAM
  const porKam = {};
  filas.forEach(r => {
    const k = r.kam || "Sin KAM";
    porKam[k] = (porKam[k] || 0) + (r.total || 0);
  });
  chartKams = crearOActualizarChart(chartKams, "chartKams", "bar", {
    labels: Object.keys(porKam),
    datasets: [{ label: "Total por KAM", data: Object.values(porKam) }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }}});

  // Sedes Sanaré
  const sanare = filas.filter(r => r.marca === "SANARE");
  const porSede = {};
  sanare.forEach(r => {
    const s = r.sede || "Sin sede";
    porSede[s] = (porSede[s] || 0) + (r.total || 0);
  });
  chartSedes = crearOActualizarChart(chartSedes, "chartSedes", "bar", {
    labels: Object.keys(porSede),
    datasets: [{ label: "Total por sede", data: Object.values(porSede) }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }}});

  // Pruebas Nomad (solo pruebas, excluyendo biomarcadores)
const nomadFilas = filas.filter(r => r.marca === "NOMAD");
const porPrueba = {};
nomadFilas.forEach(r => {
  if (Array.isArray(r.pruebas)) {
    r.pruebas.forEach(p => {
      if (!p) return;

      const rawName = (p.prueba || "").toString();
      const tipo    = ((p.tipo || p.categoria || p.clasificacion || "") + "").toLowerCase();

      // Heurística para detectar biomarcadores:
      const nombreLower = rawName.toLowerCase();
      const esBiomarcador =
        tipo.includes("biomarc") ||
        tipo.includes("marcador") ||
        nombreLower.includes("biomarc") ||
        nombreLower.includes("marcador tumoral");

      // Si es biomarcador, lo excluimos del gráfico
      if (esBiomarcador) return;

      const nombre = rawName || "Sin nombre";
      const subtotal = Number(p.subtotal || p.total || p.precio || 0);
      porPrueba[nombre] = (porPrueba[nombre] || 0) + subtotal;
    });
  }
});
chartPruebas = crearOActualizarChart(chartPruebas, "chartPruebas", "bar", {
  labels: Object.keys(porPrueba),
  datasets: [{ label: "Total por prueba", data: Object.values(porPrueba) }]
}, { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true }}});// Meses
  const porMes = {};
  filas.forEach(r => {
    const mes = formatearMes(r.fechaEmision);
    porMes[mes] = (porMes[mes] || 0) + (r.total || 0);
  });
  const labelsMes = Object.keys(porMes).sort();
  chartMeses = crearOActualizarChart(chartMeses, "chartMeses", "line", {
    labels: labelsMes,
    datasets: [{ label: "Total por mes", data: labelsMes.map(l => porMes[l]) }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }}});

  // Estatus 1
  const conteo = {};
  filas.forEach(r => {
    const st = r.status1 || "Sin seguimiento";
    conteo[st] = (conteo[st] || 0) + 1;
  });
  chartStatus1 = crearOActualizarChart(chartStatus1, "chartStatus1", "pie", {
    labels: Object.keys(conteo),
    datasets: [{ label: "Cotizaciones por estatus 1", data: Object.values(conteo) }]
  }, {
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || "";
            const value = context.raw || 0;
            const data = context.chart.data.datasets[0].data || [];
            const total = data.reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0);
            const porcentaje = total ? ((value * 100) / total).toFixed(1) : 0;
            return `${label}: ${value} (${porcentaje}%)`;
          }
        }
      }
    }
  });
}

function formatearMes(fecha) {
  if (!fecha) return "Sin fecha";
  const partes = fecha.split("-");
  if (partes.length < 2) return "Sin fecha";
  const [y, m] = partes;
  return y + "-" + m;
}

// CSV
function formatearListaParaCsv(lista) {
  // Convierte arreglos de objetos (servicios, medicamentos, pruebas) en texto legible
  if (!Array.isArray(lista) || !lista.length) return "";
  return lista.map(item => {
    if (item === null || typeof item !== "object") return String(item);

    const nombre    = (item.prueba || item.nombre || item.descripcion || item.concepto || "").toString().trim();
    const codigo    = (item.codigo || item.clave || "").toString().trim();
    const cantidad  = (item.cantidad || item.cant || "").toString().trim();
    const subtotal  = (item.subtotal || item.total || item.precio || "").toString().trim();

    const partes = [];
    if (nombre)   partes.push(nombre);
    if (codigo)   partes.push("cod:" + codigo);
    if (cantidad) partes.push("cant:" + cantidad);
    if (subtotal) partes.push("sub:" + subtotal);

    const texto = partes.join(" | ");
    return texto || JSON.stringify(item);
  }).join(" || ");
}

function exportarCsv(nombre, filas, detallado = false) {
  if (!filas.length) {
    alert("No hay filas para exportar.");
    return;
  }

  let encabezados, rows;
  if (!detallado) {
    encabezados = [
      "marca","folio","fechaEmision","fechaCierre","paciente","medico","kam",
      "aseguradora","total","telefono","sede","status1","status2","motivo"
    ];
    rows = filas.map(r => [
      r.marca || "", r.folio || "", r.fechaEmision || "", r.fechaCierre || "",
      r.paciente || "", r.medico || "", r.kam || "",
      r.aseguradora || "", r.total ?? "",
      r.telefono || "", r.sede || "",
      r.status1 || "", r.status2 || "", r.motivo || ""
    ]);
  } else {
    encabezados = [
      "marca","folio","fechaEmision","fechaCierre","fechaProgramacion","fechaValidez",
      "paciente","medico","kam","aseguradora","total",
      "telefono","sede",
      "direccion","dx","esquema",
      "servicios","medicamentos",
      "diagnostico","pruebas",
      "status1","status2","motivo"
    ];
    rows = filas.map(r => [
      r.marca || "", r.folio || "", r.fechaEmision || "", r.fechaCierre || "",
      r.fechaProgramacion || "", r.fechaValidez || "",
      r.paciente || "", r.medico || "", r.kam || "",
      r.aseguradora || "", r.total ?? "",
      r.telefono || "", r.sede || "",
      r.direccion || "", r.dx || "", r.esquema || "",
      formatearListaParaCsv(r.servicios || []),
      formatearListaParaCsv(r.medicamentos || []),
      r.diagnostico || "",
      formatearListaParaCsv(r.pruebas || []),
      r.status1 || "", r.status2 || "", r.motivo || ""
    ]);
  }

  const sep = ";"; // Usamos ';' y forzamos a Excel a reconocerlo con la primera línea
  // Agregamos BOM para que Excel respete UTF-8 y muestre bien acentos y caracteres especiales
  let csv = "\uFEFF";
  csv += "sep=" + sep + "\n";
  csv += encabezados.join(sep) + "\n";

  rows.forEach(r => {
    const linea = r.map(v => {
      if (v === null || v === undefined) return "";
      const str = String(v).replace(/"/g, '""');
      if (str.includes(sep) || str.includes("\n")) return `"\${str}"`;
      return str;
    }).join(sep);
    csv += linea + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatearMoneda(valor) {
  const num = leerMonto(valor);
  if (num === null) return "Sin monto";
  return num.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0
  });
}

// UI events
function initUIEvents() {
  filtroFechaInicio.addEventListener("change", aplicarFiltrosYRender);
  filtroFechaFin.addEventListener("change", aplicarFiltrosYRender);
  filtroTexto.addEventListener("input", aplicarFiltrosYRender);
  filtroStatus1.addEventListener("change", aplicarFiltrosYRender);
  filtroStatus2.addEventListener("change", aplicarFiltrosYRender);
  filtrosMarca.forEach(cb => cb.addEventListener("change", aplicarFiltrosYRender));

  btnLimpiarFiltros.addEventListener("click", () => {
    filtroFechaInicio.value = "";
    filtroFechaFin.value = "";
    filtroTexto.value = "";
    for (const o of filtroStatus1.options) o.selected = false;
    for (const o of filtroStatus2.options) o.selected = false;
    filtrosMarca.forEach(cb => cb.checked = true);
    aplicarFiltrosYRender();
  });

  btnExportCsvResumen.addEventListener("click", () => {
    exportarCsv("cotizaciones_resumen.csv", getFilasFiltradasParaExport(), false);
  });
  btnExportCsvDetallado.addEventListener("click", () => {
    exportarCsv("cotizaciones_detallado.csv", getFilasFiltradasParaExport(), true);
  });
}

function getFilasFiltradasParaExport() {
  let filas = [...allRows];

  const marcasSeleccionadas = Array.from(filtrosMarca)
    .filter(cb => cb.checked)
    .map(cb => cb.value);
  if (marcasSeleccionadas.length > 0) {
    filas = filas.filter(r => marcasSeleccionadas.includes(r.marca));
  }

  const inicio = filtroFechaInicio.value;
  const fin    = filtroFechaFin.value;
  if (inicio) filas = filas.filter(r => r.fechaEmision && r.fechaEmision >= inicio);
  if (fin)    filas = filas.filter(r => r.fechaEmision && r.fechaEmision <= fin);

  const texto = filtroTexto.value.trim().toLowerCase();
  if (texto) {
    filas = filas.filter(r =>
      (r.folio || "").toLowerCase().includes(texto) ||
      (r.paciente || "").toLowerCase().includes(texto) ||
      (r.medico || "").toLowerCase().includes(texto) ||
      (r.kam || "").toLowerCase().includes(texto)
    );
  }

  const st1 = getSelectedValues(filtroStatus1);
  const st2 = getSelectedValues(filtroStatus2);
  if (st1.length) filas = filas.filter(r => st1.includes(r.status1));
  if (st2.length) filas = filas.filter(r => st2.includes(r.status2));

  return filas;
}

function init() {
  initStatusFilters();
  initUIEvents();
  initRealtimeListeners();
  document.addEventListener("innvida-session-ready", aplicarFiltrosYRender);
}

document.addEventListener("DOMContentLoaded", init);
