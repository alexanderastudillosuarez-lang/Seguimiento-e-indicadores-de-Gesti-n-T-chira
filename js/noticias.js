/* ============================================================
   OICF - noticias.js  v2.0
   Centro de Noticias — filtros por mineral + enlace a fuente
   ============================================================ */

const OICF_Noticias = (() => {

  let allNews = [];
  let filtroActivo = 'todos';

  /* ---- URLs canónicas por nombre de fuente ---- */
  const FUENTE_URLS = {
    'Trading Economics':          'https://es.tradingeconomics.com/commodity/coal',
    'Trading Economics Coking':   'https://es.tradingeconomics.com/commodity/coking-coal',
    'La República':               'https://www.larepublica.co/indicadores-economicos/commodities/carbon',
    'La República Colombia':      'https://www.larepublica.co/indicadores-economicos/commodities/carbon',
    'UPME':                       'https://www.upme.gov.co/',
    'ACM Minería':                'https://acmineria.com.co/',
    'País Minero':                'https://www.paisminero.com/',
    'SunSirs':                    'https://www.sunsirs.com/es',
    'World Bank':                 'https://www.worldbank.org/en/research/commodity-markets',
    'IndexMundi Coal':            'https://www.indexmundi.com/commodities/?commodity=coal&months=60',
    'IndexMundi Phosphate':       'https://www.indexmundi.com/commodities/?commodity=phosphate-rock',
    'IEA':                        'https://www.iea.org/data-and-statistics',
    'Argus Media':                'https://www.argusmedia.com/en/coal-coke-and-biomass',
    'SGX':                        'https://www.sgx.com/derivatives/products/coking-coal',
    'Fastmarkets':                'https://www.fastmarkets.com/commodities/metals/minor-metals',
    'World Steel Association':    'https://www.worldsteel.org/steel-by-topic/raw-materials/coal.html',
    'IFA':                        'https://www.fertilizer.org/statistics/',
    'USGS':                       'https://www.usgs.gov/centers/national-minerals-information-center/phosphate-rock-statistics-and-information',
    'MinDesarrollo Minero Venezuela': 'https://desarrollominero.gob.ve/',
    'Minem Venezuela':            'https://desarrollominero.gob.ve/',
    'OICF':                       '#'
  };

  /* ---- Mapa categoría → mineral ---- */
  const CAT_MINERAL = {
    carbon:        'carbon_energetico',   // default; se puede especificar en el objeto
    fosfatos:      'roca_fosfatica',
    fertilizantes: 'roca_fosfatica',
    energia:       'carbon_energetico',
    geopolitica:   null,
    todos:         null
  };

  const MINERALES = {
    carbon_energetico:  { label: 'Carbón Energético',  icon: 'fa-fire',     color: '#f97316', dot: '#f97316' },
    carbon_coquizable:  { label: 'Carbón Coquizable',  icon: 'fa-industry', color: '#6366f1', dot: '#818cf8' },
    roca_fosfatica:     { label: 'Roca Fosfática',     icon: 'fa-seedling', color: '#34d399', dot: '#34d399' }
  };

  const CATEGORIAS = {
    todos:             { label: 'Todos',              icon: 'fa-globe',    color: '#60a5fa' },
    carbon_energetico: { label: 'Carbón Energético',  icon: 'fa-fire',     color: '#f97316' },
    carbon_coquizable: { label: 'Carbón Coquizable',  icon: 'fa-industry', color: '#6366f1' },
    roca_fosfatica:    { label: 'Roca Fosfática',     icon: 'fa-seedling', color: '#34d399' },
    geopolitica:       { label: 'Geopolítica',        icon: 'fa-flag',     color: '#ef4444' }
  };

  const SENTIMIENTO = {
    positivo: { icon: '🟢', label: 'Positivo', color: '#22c55e' },
    negativo: { icon: '🔴', label: 'Negativo', color: '#ef4444' },
    neutral:  { icon: '🟡', label: 'Neutral',  color: '#f59e0b' }
  };

  /* ---- Derivar mineral de cada noticia ---- */
  function getMineralKey(n) {
    if (n.mineral) return n.mineral;
    return CAT_MINERAL[n.categoria] || null;
  }

  /* ---- Resolver URL de fuente ---- */
  function getFuenteUrl(n) {
    if (n.url && n.url !== '#') return n.url;
    // Buscar por nombre de fuente
    for (const [key, url] of Object.entries(FUENTE_URLS)) {
      if (n.fuente && n.fuente.toLowerCase().includes(key.toLowerCase())) return url;
    }
    return null;
  }

  /* ---- Cargar noticias ---- */
  async function cargarNoticias() {
    try {
      const resp = await fetch('/data/noticias.json');
      const data = await resp.json();
      allNews = (data.noticias || []).map(normalizar);
    } catch {
      allNews = NOTICIAS_FALLBACK.map(normalizar);
    }
    renderFiltros();
    renderNoticias();
    renderResumenSentimiento();
  }

  function normalizar(n) {
    // Enriquece cada noticia con mineral y url resuelta
    return {
      ...n,
      mineral:     getMineralKey(n),
      _url_fuente: getFuenteUrl(n)
    };
  }

  /* ---- Filtrar lista según filtro activo ---- */
  function listaFiltrada() {
    if (filtroActivo === 'todos') return allNews;
    return allNews.filter(n =>
      n.mineral === filtroActivo || n.categoria === filtroActivo
    );
  }

  function countFor(key) {
    if (key === 'todos') return allNews.length;
    return allNews.filter(n => n.mineral === key || n.categoria === key).length;
  }

  /* ---- Render filtros ---- */
  function renderFiltros(containerId = 'news-filtros') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = Object.entries(CATEGORIAS).map(([key, val]) => {
      const cnt = countFor(key);
      if (cnt === 0 && key !== 'todos') return '';
      return `
        <button class="btn-period ${filtroActivo === key ? 'active' : ''}"
                onclick="OICF_Noticias.filtrar('${key}')">
          <i class="fas ${val.icon} me-1" style="color:${val.color}"></i>
          ${val.label}
          <span class="ms-1" style="font-size:.68rem;opacity:.7">(${cnt})</span>
        </button>
      `;
    }).join('');
  }

  /* ---- Render noticias ---- */
  function renderNoticias(containerId = 'news-container') {
    const el = document.getElementById(containerId);
    if (!el) return;
    const lista = listaFiltrada();
    if (!lista.length) {
      el.innerHTML = `<div class="text-center py-5 text-muted"><i class="fas fa-newspaper fa-2x mb-3 d-block"></i>No hay noticias en esta categoría</div>`;
      return;
    }
    el.innerHTML = lista.map(n => buildNewsCard(n)).join('');
  }

  function buildNewsCard(n) {
    const cat   = CATEGORIAS[n.mineral] || CATEGORIAS[n.categoria] || CATEGORIAS.todos;
    const sent  = SENTIMIENTO[n.sentimiento] || SENTIMIENTO.neutral;
    const min   = n.mineral ? MINERALES[n.mineral] : null;
    const fecha = formatFecha(n.fecha);
    const tags  = (n.tags || []).map(t =>
      `<span class="badge bg-secondary me-1" style="font-size:.62rem">${t}</span>`
    ).join('');

    const mineralBadge = min
      ? `<span style="display:inline-flex;align-items:center;gap:4px;background:${min.color}18;color:${min.color};border:1px solid ${min.color}44;border-radius:6px;padding:1px 7px;font-size:.65rem;font-weight:600">
           <i class="fas ${min.icon}" style="font-size:.6rem"></i>${min.label}
         </span>`
      : '';

    const verFuente = n._url_fuente && n._url_fuente !== '#'
      ? `<a href="${n._url_fuente}" target="_blank" rel="noopener noreferrer"
            class="btn-ver-fuente"
            title="Ir a la página de monitoreo de ${n.fuente} (sección general, puede no mostrar esta noticia específica)">
           <i class="fas fa-external-link-alt me-1" style="font-size:.6rem"></i>Fuente: ${n.fuente}
         </a>`
      : `<span class="btn-ver-fuente disabled" title="Fuente interna">
           <i class="fas fa-lock me-1" style="font-size:.6rem"></i>Fuente OICF
         </span>`;

    return `
      <div class="news-card">
        <div class="d-flex align-items-start gap-3">
          <div style="flex-shrink:0">
            <div style="width:42px;height:42px;border-radius:10px;background:${cat.color}22;display:flex;align-items:center;justify-content:center">
              <i class="fas ${cat.icon}" style="color:${cat.color};font-size:1rem"></i>
            </div>
          </div>
          <div style="flex:1;min-width:0">
            <!-- Fila superior: mineral + sentimiento + fuente -->
            <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
              ${mineralBadge}
              <span style="font-size:.72rem">${sent.icon} <span style="color:${sent.color};font-weight:600">${sent.label}</span></span>
              <span class="ms-auto" style="font-size:.7rem;opacity:.65">${n.fuente}</span>
            </div>

            <!-- Título clicable si hay URL -->
            ${n._url_fuente && n._url_fuente !== '#'
              ? `<a href="${n._url_fuente}" target="_blank" rel="noopener noreferrer"
                    class="news-title d-block text-decoration-none"
                    style="color:inherit">${n.titulo}</a>`
              : `<h6 class="news-title">${n.titulo}</h6>`
            }

            <p class="fs-xs text-muted mb-2" style="line-height:1.5">${n.resumen}</p>

            <!-- Fila inferior: tags + fecha + botón ver fuente -->
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-1">
              <div>${tags}</div>
              <div class="d-flex align-items-center gap-2">
                <span style="font-size:.68rem;opacity:.55">${fecha}</span>
                ${verFuente}
              </div>
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

    // Mini breakdown por mineral
    const byMin = {};
    allNews.forEach(n => {
      if (n.mineral) {
        byMin[n.mineral] = (byMin[n.mineral] || 0) + 1;
      }
    });

    const minBreakdown = Object.entries(byMin).map(([k, v]) => {
      const m = MINERALES[k];
      return m ? `<span style="display:inline-flex;align-items:center;gap:3px;background:${m.color}18;color:${m.color};border-radius:5px;padding:1px 6px;font-size:.62rem;font-weight:600"><i class="fas ${m.icon}" style="font-size:.55rem"></i>${v}</span>` : '';
    }).join(' ');

    el.innerHTML = `
      ${Object.entries(counts).map(([key, val]) => {
        const s = SENTIMIENTO[key];
        const pct = Math.round((val/total)*100);
        return `
          <div class="d-flex align-items-center gap-2 mb-2">
            <span style="font-size:.9rem">${s.icon}</span>
            <span class="fs-xs" style="width:68px">${s.label}</span>
            <div style="flex:1;height:6px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${s.color};border-radius:4px;transition:width .4s"></div>
            </div>
            <span class="fs-xs fw-600" style="width:30px;text-align:right">${val}</span>
          </div>
        `;
      }).join('')}
      ${minBreakdown ? `<div class="mt-2 pt-2" style="border-top:1px solid rgba(255,255,255,.08)">
        <div class="fs-xs text-muted mb-1">Por mineral</div>
        <div class="d-flex gap-1 flex-wrap">${minBreakdown}</div>
      </div>` : ''}
    `;
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
    if (isNaN(d)) return '';
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 60)   return `Hace ${diff} min`;
    if (diff < 1440) return `Hace ${Math.floor(diff/60)}h`;
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ---- Fallback ---- */
  const NOTICIAS_FALLBACK = [
    { id:1, titulo:'Mercado del carbón energético en alerta por demanda asiática',
      resumen:'Los precios del carbón energético se mantienen elevados ante fuerte demanda de China e India.',
      fuente:'Trading Economics', fecha:new Date().toISOString(),
      mineral:'carbon_energetico', categoria:'carbon', sentimiento:'positivo',
      url:'https://es.tradingeconomics.com/commodity/coal', tags:['China','demanda'] },
    { id:2, titulo:'Carbón coquizable: Australia bate récord de exportaciones',
      resumen:'Las exportaciones australianas de carbón metalúrgico alcanzan máximos históricos.',
      fuente:'World Steel Association', fecha:new Date(Date.now()-3600000).toISOString(),
      mineral:'carbon_coquizable', categoria:'carbon', sentimiento:'positivo',
      url:'https://www.worldsteel.org/steel-by-topic/raw-materials/coal.html', tags:['Australia','exportaciones'] },
    { id:3, titulo:'Fosfatos: Marruecos consolida liderazgo mundial',
      resumen:'OCP Group reporta récord de exportaciones en el primer semestre del año.',
      fuente:'IndexMundi', fecha:new Date(Date.now()-7200000).toISOString(),
      mineral:'roca_fosfatica', categoria:'fosfatos', sentimiento:'positivo',
      url:'https://www.indexmundi.com/commodities/?commodity=phosphate-rock', tags:['Marruecos','OCP'] }
  ];

  return { cargarNoticias, filtrar, CATEGORIAS, SENTIMIENTO, MINERALES };

})();
