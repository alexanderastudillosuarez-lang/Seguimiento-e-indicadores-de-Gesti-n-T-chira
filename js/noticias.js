/* ============================================================
   OICF - noticias.js
   Centro de Noticias y análisis de sentimiento
   ============================================================ */

const OICF_Noticias = (() => {

  let allNews = [];
  let filtroActivo = 'todos';

  const CATEGORIAS = {
    todos:        { label: 'Todos',        icon: 'fa-globe',    color: '#60a5fa' },
    carbon:       { label: 'Carbón',       icon: 'fa-industry', color: '#6b7280' },
    fosfatos:     { label: 'Fosfatos',     icon: 'fa-seedling', color: '#34d399' },
    energia:      { label: 'Energía',      icon: 'fa-bolt',     color: '#f59e0b' },
    fertilizantes:{ label: 'Fertilizantes',icon: 'fa-leaf',     color: '#22c55e' },
    geopolitica:  { label: 'Geopolítica',  icon: 'fa-flag',     color: '#ef4444' }
  };

  const SENTIMIENTO = {
    positivo: { icon: '🟢', label: 'Positivo', color: '#22c55e' },
    negativo: { icon: '🔴', label: 'Negativo', color: '#ef4444' },
    neutral:  { icon: '🟡', label: 'Neutral',  color: '#f59e0b' }
  };

  /* ---- Cargar noticias ---- */
  async function cargarNoticias() {
    try {
      const resp = await fetch('/data/noticias.json');
      const data = await resp.json();
      allNews = data.noticias || [];
    } catch {
      allNews = NOTICIAS_FALLBACK;
    }
    renderFiltros();
    renderNoticias();
    renderResumenSentimiento();
  }

  /* ---- Render filtros ---- */
  function renderFiltros(containerId = 'news-filtros') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = Object.entries(CATEGORIAS).map(([key, val]) => `
      <button class="btn-period ${filtroActivo === key ? 'active' : ''}"
              onclick="OICF_Noticias.filtrar('${key}')">
        <i class="fas ${val.icon} me-1" style="color:${val.color}"></i>
        ${val.label}
        <span class="ms-1 text-muted" style="font-size:.7rem">(${key === 'todos' ? allNews.length : allNews.filter(n=>n.categoria===key).length})</span>
      </button>
    `).join('');
  }

  /* ---- Render noticias ---- */
  function renderNoticias(containerId = 'news-container') {
    const el = document.getElementById(containerId);
    if (!el) return;

    const lista = filtroActivo === 'todos'
      ? allNews
      : allNews.filter(n => n.categoria === filtroActivo);

    if (!lista.length) {
      el.innerHTML = `<div class="text-center py-5 text-muted"><i class="fas fa-newspaper fa-2x mb-3"></i><p>No hay noticias en esta categoría</p></div>`;
      return;
    }

    el.innerHTML = lista.map(n => buildNewsCard(n)).join('');
  }

  function buildNewsCard(n) {
    const cat = CATEGORIAS[n.categoria] || CATEGORIAS.todos;
    const sent = SENTIMIENTO[n.sentimiento] || SENTIMIENTO.neutral;
    const fecha = formatFecha(n.fecha);
    const tags = (n.tags || []).map(t => `<span class="badge bg-secondary me-1" style="font-size:.65rem">${t}</span>`).join('');

    return `
      <div class="news-card">
        <div class="d-flex align-items-start gap-3">
          <div style="flex-shrink:0">
            <div style="width:40px;height:40px;border-radius:8px;background:${cat.color}22;display:flex;align-items:center;justify-content:center">
              <i class="fas ${cat.icon}" style="color:${cat.color}"></i>
            </div>
          </div>
          <div style="flex:1;min-width:0">
            <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <span class="news-tag" style="background:${cat.color}22;color:${cat.color}">${cat.label}</span>
              <span title="${sent.label}" class="fs-xs">${sent.icon} ${sent.label}</span>
              <span class="ms-auto news-meta">${n.fuente}</span>
            </div>
            <h6 class="news-title">${n.titulo}</h6>
            <p class="fs-xs text-muted mb-2" style="line-height:1.5">${n.resumen}</p>
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-1">
              <div>${tags}</div>
              <span class="news-meta">${fecha}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ---- Resumen sentimiento ---- */
  function renderResumenSentimiento(containerId = 'sentimiento-resumen') {
    const el = document.getElementById(containerId);
    if (!el) return;

    const counts = { positivo: 0, neutral: 0, negativo: 0 };
    allNews.forEach(n => { if (counts[n.sentimiento] !== undefined) counts[n.sentimiento]++; });
    const total = allNews.length || 1;

    el.innerHTML = Object.entries(counts).map(([key, val]) => {
      const s = SENTIMIENTO[key];
      const pct = Math.round((val/total)*100);
      return `
        <div class="d-flex align-items-center gap-2 mb-2">
          <span style="font-size:1rem">${s.icon}</span>
          <span class="fs-xs" style="width:70px">${s.label}</span>
          <div style="flex:1;height:6px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${s.color};border-radius:4px"></div>
          </div>
          <span class="fs-xs fw-600" style="width:32px;text-align:right">${val}</span>
        </div>
      `;
    }).join('');
  }

  /* ---- Filtrar ---- */
  function filtrar(categoria) {
    filtroActivo = categoria;
    renderFiltros();
    renderNoticias();
  }

  /* ---- Helpers ---- */
  function formatFecha(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 60)   return `Hace ${diff} min`;
    if (diff < 1440) return `Hace ${Math.floor(diff/60)}h`;
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ---- Fallback data ---- */
  const NOTICIAS_FALLBACK = [
    {
      id: 1, titulo: 'Mercado del carbón en alerta por demanda asiática',
      resumen: 'Los precios del carbón energético se mantienen elevados ante fuerte demanda de China e India.',
      fuente: 'OICF', fecha: new Date().toISOString(),
      categoria: 'carbon', sentimiento: 'positivo', tags: ['China', 'demanda']
    },
    {
      id: 2, titulo: 'Fosfatos: Marruecos consolida liderazgo mundial',
      resumen: 'OCP Group reporta récord de exportaciones en el primer semestre del año.',
      fuente: 'OICF', fecha: new Date(Date.now()-3600000).toISOString(),
      categoria: 'fosfatos', sentimiento: 'positivo', tags: ['Marruecos', 'OCP']
    }
  ];

  /* ---- API Pública ---- */
  return { cargarNoticias, filtrar, CATEGORIAS, SENTIMIENTO };

})();
