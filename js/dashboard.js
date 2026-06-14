/* ============================================================
   OICF - dashboard.js
   Lógica principal del dashboard
   ============================================================ */

const OICF = (() => {

  let precios = null;
  let produccion = null;
  let autoRefreshInterval = null;
  const REFRESH_MS = 5 * 60 * 1000; // 5 minutos

  /* ============================================================
     INICIALIZACIÓN
     ============================================================ */
  async function init() {
    applyTheme(getSavedTheme());
    showLoader();
    await loadData();
    hideLoader();
    setupSidebar();
    setupTopbar();
    buildTicker();
    renderKPIs();
    renderAlerts();
    renderOportunidades();
    buildMainChart('30d');
    buildProjectionCharts();
    buildProductionCharts();
    initMaps();
    await OICF_Noticias.cargarNoticias();
    renderIAPanel();
    startAutoRefresh();
    renderLastUpdate();
  }

  /* ---- Cargar datos ---- */
  async function loadData() {
    try {
      const [p, pr] = await Promise.all([
        fetch('/data/precios.json').then(r => r.json()),
        fetch('/data/produccion.json').then(r => r.json())
      ]);
      precios = p;
      produccion = pr;
    } catch (e) {
      showToast('Sin conexión al servidor. Usando datos de ejemplo.', 'warning');
      precios    = PRECIOS_DEMO;
      produccion = PRODUCCION_DEMO;
    }
  }

  /* ============================================================
     SIDEBAR
     ============================================================ */
  function setupSidebar() {
    const sidebar    = document.getElementById('sidebar');
    const topbar     = document.getElementById('topbar');
    const mainContent= document.getElementById('main-content');
    const toggleBtn  = document.getElementById('sidebar-toggle');
    const mobileOverlay = document.getElementById('mobile-overlay');

    if (!sidebar) return;

    toggleBtn?.addEventListener('click', () => {
      const isDesktop = window.innerWidth > 768;
      if (isDesktop) {
        sidebar.classList.toggle('collapsed');
        topbar?.classList.toggle('sidebar-collapsed');
        mainContent?.classList.toggle('sidebar-collapsed');
      } else {
        sidebar.classList.toggle('mobile-open');
        mobileOverlay?.classList.toggle('d-none');
      }
    });

    mobileOverlay?.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      mobileOverlay.classList.add('d-none');
    });

    /* Activar enlace actual */
    const links = document.querySelectorAll('.nav-link-oicf');
    links.forEach(l => {
      if (l.getAttribute('href') === location.pathname.split('/').pop()) {
        l.classList.add('active');
      }
    });
  }

  /* ============================================================
     TOPBAR
     ============================================================ */
  function setupTopbar() {
    const themeBtn = document.getElementById('theme-toggle');
    themeBtn?.addEventListener('click', toggleTheme);

    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn?.addEventListener('click', async () => {
      refreshBtn.querySelector('i')?.classList.add('fa-spin');
      await loadData();
      renderKPIs();
      renderAlerts();
      buildMainChart(window._currentPeriod || '30d');
      renderLastUpdate();
      setTimeout(() => refreshBtn.querySelector('i')?.classList.remove('fa-spin'), 1000);
      showToast('Datos actualizados', 'success');
    });
  }

  /* ============================================================
     TEMA
     ============================================================ */
  function applyTheme(mode) {
    document.body.classList.remove('dark-mode', 'light-mode');
    document.body.classList.add(mode + '-mode');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = mode === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('oicf-theme', mode);
    OICF_Maps?.refreshTheme?.();
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    applyTheme(isDark ? 'light' : 'dark');
  }

  function getSavedTheme() { return localStorage.getItem('oicf-theme') || 'dark'; }

  /* ============================================================
     TICKER
     ============================================================ */
  function buildTicker() {
    if (!precios) return;
    const items = [
      { name: 'Carbón Energético', val: precios.carbon_energetico.precio_actual, chg: precios.carbon_energetico.variacion_diaria_pct },
      { name: 'Carbón Coquizable', val: precios.carbon_coquizable.precio_actual, chg: precios.carbon_coquizable.variacion_diaria_pct },
      { name: 'Roca Fosfática',    val: precios.roca_fosfatica.precio_actual,    chg: precios.roca_fosfatica.variacion_diaria_pct }
    ];
    const doubled = [...items, ...items]; // loop continuo

    const tickerEl = document.getElementById('ticker-inner');
    if (!tickerEl) return;
    tickerEl.innerHTML = doubled.map(it => `
      <span class="ticker-item">
        <span class="ti-name">${it.name}</span>
        <span class="ti-price">$${it.val.toFixed(2)}</span>
        <span class="ti-chg ${it.chg >= 0 ? 'up' : 'down'}">
          ${it.chg >= 0 ? '▲' : '▼'} ${Math.abs(it.chg).toFixed(2)}%
        </span>
      </span>
    `).join('');
  }

  /* ============================================================
     KPIs
     ============================================================ */
  function renderKPIs() {
    if (!precios) return;

    const kpis = [
      {
        id: 'kpi-coal-thermal',
        commodity: 'carbon_energetico',
        data: precios.carbon_energetico,
        icon: 'fa-industry', gradient: 'gradient-coal',
        flete: 12  // USD/ton estimado FOB->CIF
      },
      {
        id: 'kpi-coal-coking',
        commodity: 'carbon_coquizable',
        data: precios.carbon_coquizable,
        icon: 'fa-hard-hat', gradient: 'gradient-coking',
        flete: 18
      },
      {
        id: 'kpi-phosphate',
        commodity: 'roca_fosfatica',
        data: precios.roca_fosfatica,
        icon: 'fa-seedling', gradient: 'gradient-phosph',
        flete: 8
      }
    ];

    const fuentesReg  = (precios.fuentes_registro || {});
    const fuentesSync = (precios.fuentes || {});

    kpis.forEach(k => {
      const el = document.getElementById(k.id);
      if (!el) return;
      const d = k.data;
      const up = d.variacion_diaria >= 0;
      const arr = up ? '▲' : '▼';
      const cls = up ? 'up' : 'down';

      /* ---- Tabla de precios por fuente (FOB / CIF) ---- */
      const lista = (fuentesReg[k.commodity] || [])
        .map(f => ({ ...f, sync: fuentesSync[f.key] }))
        .filter(f => f.sync && typeof f.sync.precio === 'number');

      const filasHtml = lista.length ? lista.map(f => {
        const fob = f.sync.precio;
        const cif = fob + k.flete;
        return `
          <div class="d-flex align-items-center justify-content-between" style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05)">
            <a href="${f.url || '#'}" target="_blank" rel="noopener" class="fs-xs" style="opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:54%;color:inherit;text-decoration:none" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'" title="Abrir fuente: ${f.nombre}">${f.sync.metodo==='scraping_real'?'<span title="Dato en vivo" style="color:#22c55e">●</span> ':''}${f.nombre} <i class="fas fa-external-link-alt" style="font-size:.6rem;opacity:.6"></i></a>
            <span class="fs-xs fw-600" style="white-space:nowrap">FOB $${fob.toFixed(2)} <span style="opacity:.45">/</span> CIF $${cif.toFixed(2)}</span>
          </div>
        `;
      }).join('') : `<div class="fs-xs text-muted text-center py-2">Sin datos de fuentes disponibles</div>`;

      el.innerHTML = `
        <div class="kpi-card card-oicf h-100">
          <div class="d-flex align-items-start gap-3 mb-3">
            <div class="kpi-icon ${k.gradient}">
              <i class="fas ${k.icon} text-white"></i>
            </div>
            <div style="flex:1">
              <div class="kpi-label">${d.nombre}</div>
              <div class="kpi-price mt-1">$${d.precio_actual.toFixed(2)}</div>
              <div class="kpi-unit">USD / Tonelada · Precio consenso</div>
            </div>
          </div>
          <div class="d-flex gap-2 flex-wrap mb-2">
            <span class="kpi-badge ${cls}">${arr} Hoy ${Math.abs(d.variacion_diaria).toFixed(2)}</span>
            <span class="kpi-badge ${d.variacion_mensual_pct>=0?'up':'down'}">${d.variacion_mensual_pct>=0?'▲':'▼'} Mes ${Math.abs(d.variacion_mensual_pct).toFixed(1)}%</span>
            <span class="kpi-badge ${d.variacion_anual_pct>=0?'up':'down'}">${d.variacion_anual_pct>=0?'▲':'▼'} Año ${Math.abs(d.variacion_anual_pct).toFixed(1)}%</span>
          </div>
          <div class="fs-xs text-muted fw-bold mb-1" style="text-transform:uppercase;letter-spacing:.05em">Precios por fuente</div>
          <div style="max-height:170px;overflow-y:auto">${filasHtml}</div>
          <div class="d-flex justify-content-between mt-2 pt-2" style="font-size:.7rem;opacity:.5;border-top:1px solid rgba(255,255,255,.08)">
            <span>Mín hist: $${d.min_historico}</span>
            <span>Máx hist: $${d.max_historico}</span>
          </div>
        </div>
      `;
    });
  }

  /* ============================================================
     ALERTAS
     ============================================================ */
  function renderAlerts() {
    if (!precios) return;
    const alerts = [];

    [precios.carbon_energetico, precios.carbon_coquizable, precios.roca_fosfatica].forEach(c => {
      const absVar = Math.abs(c.variacion_diaria_pct);
      if (absVar >= 10) {
        alerts.push({ level: 'critical', icon: '🚨', text: `<b>${c.nombre}</b>: variación extrema ${c.variacion_diaria_pct.toFixed(1)}% en 24h`, ts: 'Ahora' });
      } else if (absVar >= 5) {
        alerts.push({ level: 'warning', icon: '⚠️', text: `<b>${c.nombre}</b>: variación significativa ${c.variacion_diaria_pct.toFixed(1)}% en 24h`, ts: 'Ahora' });
      }
      if (c.precio_actual >= c.max_historico * 0.98) {
        alerts.push({ level: 'critical', icon: '📈', text: `<b>${c.nombre}</b>: precio cerca de máximo histórico ($${c.max_historico})`, ts: 'Ahora' });
      }
      if (c.precio_actual <= c.min_historico * 1.02) {
        alerts.push({ level: 'critical', icon: '📉', text: `<b>${c.nombre}</b>: precio cerca de mínimo histórico ($${c.min_historico})`, ts: 'Ahora' });
      }
    });

    if (!alerts.length) {
      alerts.push({ level: 'info', icon: '✅', text: 'Mercados estables. Sin alertas activas en este momento.', ts: 'Ahora' });
    }

    const el = document.getElementById('alerts-container');
    if (!el) return;
    el.innerHTML = alerts.map(a => `
      <div class="alert-item ${a.level}">
        <span class="alert-icon">${a.icon}</span>
        <div style="flex:1">
          <div style="font-size:.875rem">${a.text}</div>
          <div style="font-size:.7rem;opacity:.5;margin-top:2px">${a.ts}</div>
        </div>
      </div>
    `).join('');

    /* Badge en menú */
    const badge = document.getElementById('alerts-badge');
    if (badge) badge.textContent = alerts.length;
  }

  /* ============================================================
     GRÁFICO PRINCIPAL
     ============================================================ */
  function buildMainChart(period) {
    window._currentPeriod = period;
    if (!precios) return;
    OICF_Charts.buildMainChart('main-chart', precios, period);

    /* Highlight botón activo */
    document.querySelectorAll('.btn-period[data-period]').forEach(b => {
      b.classList.toggle('active', b.dataset.period === period);
    });
  }

  /* ============================================================
     PROYECCIONES
     ============================================================ */
  const PROJECTION_CONFIG = {
    carbon_energetico: { nombre: 'Carbón Energético', proj30: -8.5,  proj90: -15.2 },
    carbon_coquizable: { nombre: 'Carbón Coquizable', proj30: -6.0,  proj90: -10.5 },
    roca_fosfatica:    { nombre: 'Roca Fosfática',    proj30:  3.5,  proj90:   6.8 }
  };

  function buildProjectionCharts(mineral) {
    if (!precios) return;
    mineral = mineral || 'carbon_energetico';
    const cfg = PROJECTION_CONFIG[mineral];
    const h = precios[mineral].historico || {};
    const hist = (h['90d']?.length ? h['90d'] : (h['30d']?.length ? h['30d'] : (h['7d'] || [])));
    OICF_Charts.buildProjectionPlotly('projection-chart', hist, cfg.proj30, cfg.proj90, cfg.nombre);

    /* Tarjetas de proyección */
    renderProjectionCards(mineral);
  }

  function renderProjectionCards(mineral) {
    if (!precios) return;
    mineral = mineral || 'carbon_energetico';
    const d = precios[mineral];
    const base = d.precio_actual;
    const projections = [
      { label: '30 días',  val: base * 0.972, pct: -2.8 },
      { label: '90 días',  val: base * 0.948, pct: -5.2 },
      { label: '180 días', val: base * 0.921, pct: -7.9 },
      { label: '1 año',    val: base * 0.895, pct:-10.5 }
    ];

    const el = document.getElementById('proj-cards');
    if (!el) return;
    el.innerHTML = projections.map(p => `
      <div class="col-6 col-md-3">
        <div class="projection-card">
          <div class="proj-label">${p.label}</div>
          <div class="proj-value">$${p.val.toFixed(1)}</div>
          <div class="proj-change ${p.pct>=0?'up':'down'}">
            ${p.pct>=0?'▲':'▼'} ${Math.abs(p.pct).toFixed(1)}%
          </div>
        </div>
      </div>
    `).join('');
  }

  /* ============================================================
     GRÁFICOS DE PRODUCCIÓN
     ============================================================ */
  function buildProductionCharts() {
    if (!produccion) return;
    const coal = produccion.produccion_mundial.carbon_energetico_mt;
    const labels = Object.keys(coal);
    const data   = labels.map(k => coal[k].produccion);
    OICF_Charts.buildProductionBar('production-bar', data, labels, 'Producción Mt/año');

    const phos = produccion.produccion_mundial.fosfatos_mt;
    const pLabels = Object.keys(phos);
    const pData   = pLabels.map(k => phos[k].produccion);
    OICF_Charts.buildProductionBar('phosphate-bar', pData, pLabels, 'Producción fosfatos Mt/año');

    renderColombiaSection('carbon_energetico');
    renderTachiraPanel();
  }

  /* ---- Monitor Colombia: específico por mineral ---- */
  function renderColombiaSection(mineral) {
    if (!produccion) return;
    const col = produccion.colombia.por_mineral?.[mineral];
    if (!col) return;

    const dept = col.departamentos_productores;
    OICF_Charts.buildDonut('colombia-donut',
      Object.values(dept).map(v => v.produccion_pct),
      Object.keys(dept),
      ['#3b82f6','#06b6d4','#22c55e','#f59e0b','#a855f7']
    );

    const totalProd = col.produccion_trimestral_mt.reduce((a,b)=>a+b,0);
    const totalExp  = col.exportaciones_mt.reduce((a,b)=>a+b,0);
    const totalReg  = col.regalias_cop_billones.reduce((a,b)=>a+b,0);
    const totalFob  = col.valor_fob_usd_millones.reduce((a,b)=>a+b,0);

    const statsEl = document.getElementById('colombia-stats');
    if (statsEl) statsEl.innerHTML = `
      <div class="stat-row"><span>Producción anual</span><strong>${totalProd.toFixed(2)} Mt</strong></div>
      <div class="stat-row"><span>Exportaciones</span><strong>${totalExp.toFixed(2)} Mt</strong></div>
      <div class="stat-row"><span>Regalías</span><strong>COP ${totalReg.toFixed(2)} Bill.</strong></div>
      <div class="stat-row"><span>Valor FOB</span><strong>USD $${Number(totalFob.toFixed(0)).toLocaleString()}M</strong></div>
    `;

    const puertosBody = document.getElementById('colombia-puertos-body');
    if (puertosBody) puertosBody.innerHTML = Object.entries(col.puertos)
      .sort((a,b) => b[1].exportaciones_mt - a[1].exportaciones_mt)
      .map(([nombre,p]) => `<tr><td>${nombre}</td><td><strong>${p.exportaciones_mt}</strong></td><td>${p.departamento}</td></tr>`)
      .join('');

    const trimCanvas = document.getElementById('colombia-trim-chart');
    if (trimCanvas) {
      if (trimCanvas._chartInstance) trimCanvas._chartInstance.destroy();
      trimCanvas._chartInstance = new Chart(trimCanvas, {
        type: 'bar',
        data: {
          labels: ['Q1','Q2','Q3','Q4'],
          datasets: [
            { label:'Producción', data: col.produccion_trimestral_mt, backgroundColor:'rgba(96,165,250,.7)', borderRadius:4 },
            { label:'Exportación', data: col.exportaciones_mt, backgroundColor:'rgba(52,211,153,.7)', borderRadius:4 }
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ labels:{ color:'#94a3b8', font:{size:10} } } },
          scales:{
            x:{ grid:{display:false}, ticks:{color:'#94a3b8'} },
            y:{ grid:{color:'rgba(255,255,255,.05)'}, ticks:{color:'#94a3b8'} }
          }
        }
      });
    }

    OICF_Maps.renderColombiaMarkers(mineral, col);
  }

  /* ---- Táchira Panel ---- */
  function renderTachiraPanel() {
    if (!produccion) return;
    const tach = produccion.tachira_estrategico;
    const el   = document.getElementById('tachira-stats');
    if (!el) return;

    el.innerHTML = `
      <div class="row g-3">
        <div class="col-md-6">
          <div class="tachira-card">
            <h5><i class="fas fa-mountain me-2"></i>Potencial Carbonífero</h5>
            <div class="mt-3">
              <div class="tachira-stat">${tach.potencial_carbonifero.reservas_probadas_mt} Mt</div>
              <div class="tachira-label">Reservas Probadas (medidas)</div>
            </div>
            <div class="mt-2">
              <div class="tachira-stat">${tach.potencial_carbonifero.reservas_probables_mt} Mt</div>
              <div class="tachira-label">Recursos (probables)</div>
            </div>
            <div class="mt-2">
              <div class="tachira-stat" style="color:#34d399">${tach.potencial_carbonifero.reservas_totales_mt} Mt</div>
              <div class="tachira-label">Total certificado</div>
            </div>
            <div class="mt-2 fs-xs" style="color:rgba(255,255,255,.7)">
              ${tach.potencial_carbonifero.tipo_carbon}<br>
              PC: ${tach.potencial_carbonifero.poder_calorifico_kcal_kg} Kcal/kg | S: ${tach.potencial_carbonifero.contenido_azufre_pct}%<br>
              <span style="opacity:.6">Fuente: ${tach.potencial_carbonifero.fuente}</span>
            </div>
            <div class="mt-3 p-2" style="background:rgba(255,255,255,.08);border-radius:8px">
              <div class="fs-xs text-muted">Ingreso potencial anual</div>
              <div class="fw-700" style="font-size:1.3rem;color:#60a5fa">USD $${tach.potencial_carbonifero.ingreso_potencial_anual_musd}M</div>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="tachira-card">
            <h5><i class="fas fa-seedling me-2"></i>Potencial Fosfático</h5>
            <div style="font-size:.72rem;color:rgba(255,255,255,.5);margin-top:4px">Monte Fresco (Ayacucho) + Los Monos-Navay (Libertador)</div>
            <div class="mt-3">
              <div class="tachira-stat">${tach.potencial_fosfatico.reservas_monte_fresco_mt} Mt</div>
              <div class="tachira-label">Total Monte Fresco</div>
            </div>
            <div class="mt-2">
              <div class="tachira-stat">${tach.potencial_fosfatico.reservas_los_monos_navay_mt} Mt</div>
              <div class="tachira-label">Total Los Monos-Navay</div>
            </div>
            <div class="mt-2">
              <div class="tachira-stat" style="color:#34d399">${tach.potencial_fosfatico.reservas_totales_mt} Mt</div>
              <div class="tachira-label">Total combinado</div>
            </div>
            <div class="mt-2 fs-xs" style="color:rgba(255,255,255,.7)">
              Ley promedio: ${tach.potencial_fosfatico.ley_promedio_pct_p2o5}% P₂O₅<br>
              Mercados: ${tach.potencial_fosfatico.mercados_objetivo.join(', ')}<br>
              <span style="opacity:.6">Fuente: ${tach.potencial_fosfatico.fuente}</span>
            </div>
            <div class="mt-3 p-2" style="background:rgba(255,255,255,.08);border-radius:8px">
              <div class="fs-xs text-muted">Ingreso potencial anual</div>
              <div class="fw-700" style="font-size:1.3rem;color:#34d399">USD $${tach.potencial_fosfatico.ingreso_potencial_anual_musd}M</div>
            </div>
          </div>
        </div>
        <div class="col-12">
          <div class="card-oicf p-3">
            <h6 class="mb-3"><i class="fas fa-layer-group me-2"></i>Yacimientos de Carbón y Roca Fosfática del Táchira (TM)</h6>
            <div class="table-responsive">
              <table class="table table-sm table-oicf mb-0">
                <thead><tr>
                  <th>Yacimiento</th><th>Municipio</th><th>Tipo</th><th>Reservas (Mt)</th><th>Recursos (Mt)</th><th>Total (Mt)</th><th>Estudio realizado por / Año</th>
                </tr></thead>
                <tbody>
                  ${produccion.venezuela.carbon.tachira.yacimientos.map(y => `
                    <tr>
                      <td class="fw-600">${y.nombre}</td>
                      <td>${y.municipio}</td>
                      <td class="fs-xs text-uppercase">${y.tipo}</td>
                      <td>${y.reservas_mt.toFixed(2)}</td>
                      <td>${y.recursos_mt.toFixed(2)}</td>
                      <td class="fw-700">${y.total_mt.toFixed(2)}</td>
                      <td class="fs-xs">${y.operador || '—'}</td>
                    </tr>
                  `).join('')}
                  ${Object.values(produccion.venezuela.fosfatos).map(y => `
                    <tr>
                      <td class="fw-600">${y.nombre}</td>
                      <td>${y.municipio}</td>
                      <td class="fs-xs text-uppercase">fosfato</td>
                      <td>${y.reservas_mt.toFixed(2)}</td>
                      <td>${y.recursos_mt.toFixed(2)}</td>
                      <td class="fw-700">${y.total_mt.toFixed(2)}</td>
                      <td class="fs-xs">${y.operador || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="fs-xs mt-2" style="opacity:.6">Fuente: Gabinete de Minería - Gobernación del Táchira, 2023</div>
          </div>
        </div>
        <div class="col-12">
          <div class="card-oicf p-3">
            <h6 class="mb-3">Comparación Regional de Competidores</h6>
            <div class="table-responsive">
              <table class="table table-sm table-oicf mb-0">
                <thead><tr>
                  <th>País</th><th>Prod. carbón</th><th>Prod. fosfato</th><th>Fortalezas / Debilidades</th>
                </tr></thead>
                <tbody>
                  ${Object.entries(tach.competidores_regionales).map(([pais, info]) => `
                    <tr>
                      <td class="fw-600">${pais}</td>
                      <td>${info.produccion_mt} Mt</td>
                      <td>${info.produccion_fosfato_mt} Mt</td>
                      <td class="fs-xs">${(info.fortalezas||info.debilidades||[]).join(', ')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ============================================================
     MAPAS
     ============================================================ */
  function initMaps() {
    setTimeout(() => {
      OICF_Maps.initWorldMap('world-map');
      OICF_Maps.initColombiaMap('colombia-map');
    }, 300);
  }

  /* ============================================================
     IA PANEL
     ============================================================ */
  function renderIAPanel() {
    const el = document.getElementById('ia-response');
    if (!el) return;
  }

  async function generateIAReport(type) {
    const btn = document.getElementById('ia-gen-btn');
    const el  = document.getElementById('ia-response');
    if (!el) return;

    if (btn) btn.disabled = true;
    el.innerHTML = `<div class="ia-response"><span class="typing">Generando análisis inteligente</span></div>`;

    await sleep(1800);

    const reports = {
      diario: generateDailyReport(),
      semanal: generateWeeklyReport(),
      mensual: generateMonthlyReport(),
      alertas: generateAlertReport()
    };

    const text = reports[type] || reports.diario;
    if (btn) btn.disabled = false;

    el.innerHTML = `<div class="ia-response">${text}</div>`;
  }

  /* ---- Configuración descriptiva por mineral, usada para enriquecer los informes ---- */
  const IA_MINERAL_INFO = {
    carbon_energetico: {
      nombre: 'Carbón Energético (Newcastle)',
      icono: '🔥',
      mercado: 'Demandado principalmente por generación eléctrica en Asia (China, India, Indonesia). Colombia exporta a Europa y América; Venezuela/Táchira tiene potencial exportador hacia el Caribe y Centroamérica.',
      drivers: ['Demanda eléctrica de China e India', 'Política energética europea (transición vs. seguridad de suministro)', 'Costos de flete marítimo y disponibilidad de buques'],
    },
    carbon_coquizable: {
      nombre: 'Carbón Coquizable (Premium HCC)',
      icono: '⚙️',
      mercado: 'Insumo clave para la producción de acero (altos hornos). La demanda está atada al ciclo de la industria siderúrgica mundial, liderada por China, India y la UE.',
      drivers: ['Producción de acero crudo a nivel mundial', 'Exportaciones de Australia (principal productor)', 'Sustitución por procesos de reducción directa (DRI) en el largo plazo'],
    },
    roca_fosfatica: {
      nombre: 'Roca Fosfática',
      icono: '🌱',
      mercado: 'Materia prima esencial para fertilizantes (fósforo). La demanda es estacional, ligada a los ciclos de siembra en América Latina, Brasil y EE.UU. Marruecos (OCP) domina la oferta mundial.',
      drivers: ['Ciclos de siembra y demanda de fertilizantes', 'Política de exportación de China', 'Capacidad de Marruecos (OCP) y Rusia'],
    }
  };

  function getMineralSnapshot(key) {
    const d = precios?.[key];
    if (!d) return null;
    const info = IA_MINERAL_INFO[key];
    const proj = PROJECTION_CONFIG[key];
    return { key, d, info, proj };
  }

  function fmtPct(v) {
    const sign = v >= 0 ? '+' : '';
    return `${sign}${v.toFixed(2)}%`;
  }

  function tendenciaLabel(v) {
    return v >= 0 ? 'alcista 📈' : 'bajista 📉';
  }

  /* ---- Bloque común de precios/variación/prospectiva por mineral ---- */
  function buildMineralBlock(key, { incluirSemanal=true, incluirMensual=false } = {}) {
    const s = getMineralSnapshot(key);
    if (!s) return '';
    const { d, info, proj } = s;
    const rango = (d.max_historico && d.min_historico)
      ? `Rango histórico: $${d.min_historico.toFixed(2)} – $${d.max_historico.toFixed(2)} USD/Ton. `
      : '';
    const posicionRango = (d.max_historico && d.min_historico)
      ? Math.round(((d.precio_actual - d.min_historico) / (d.max_historico - d.min_historico)) * 100)
      : null;

    return `
      <div class="mb-2" style="padding:10px 12px;border-left:3px solid var(--bs-primary,#3b82f6);background:rgba(99,102,241,.06);border-radius:6px">
        <p class="mb-1"><strong>${info.icono} ${info.nombre}</strong></p>
        <p class="mb-1">Precio actual: <b>$${d.precio_actual.toFixed(2)} USD/Ton</b> · Variación diaria: <b>${fmtPct(d.variacion_diaria_pct)}</b> (tendencia ${tendenciaLabel(d.variacion_diaria_pct)})${incluirSemanal && d.variacion_semanal_pct !== undefined ? ` · Semanal: <b>${fmtPct(d.variacion_semanal_pct)}</b>` : ''}${incluirMensual && d.variacion_mensual_pct !== undefined ? ` · Mensual: <b>${fmtPct(d.variacion_mensual_pct)}</b>` : ''}${d.variacion_anual_pct !== undefined ? ` · Anual: <b>${fmtPct(d.variacion_anual_pct)}</b>` : ''}</p>
        <p class="mb-1">${rango}${posicionRango !== null ? `Posición actual en el rango histórico: <b>${posicionRango}%</b> ${posicionRango >= 80 ? '(cerca de máximos — riesgo de corrección)' : posicionRango <= 20 ? '(cerca de mínimos — posible oportunidad de entrada)' : '(zona media)'}.` : ''}</p>
        <p class="mb-1"><b>Mercado:</b> ${info.mercado}</p>
        <p class="mb-1"><b>Factores a vigilar:</b> ${info.drivers.join(' · ')}</p>
        ${proj ? `<p class="mb-0"><b>Prospectiva:</b> proyección a 30 días <b>${fmtPct(proj.proj30)}</b>, a 90 días <b>${fmtPct(proj.proj90)}</b>.</p>` : ''}
      </div>
    `;
  }

  function generateDailyReport() {
    if (!precios) return '';
    return `
      <p><strong>📊 Resumen Diario — ${new Date().toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</strong></p>
      <p>Análisis integral de precios, variación, mercado y prospectiva para los tres minerales monitoreados. Información orientada a la toma de decisiones de inversión.</p>
      ${buildMineralBlock('carbon_energetico')}
      ${buildMineralBlock('carbon_coquizable')}
      ${buildMineralBlock('roca_fosfatica')}
      <p><strong>🎯 Oportunidades identificadas:</strong></p>
      <ul style="margin:0;padding-left:18px">
        <li>Posición compradora en carbón coquizable ante recuperación siderúrgica asiática</li>
        <li>Ventana exportadora Colombia → India para carbón energético</li>
        <li>Táchira: potencial de reactivación minera con costos competitivos frente al precio de referencia actual</li>
      </ul>
      <p class="mb-0 mt-2"><strong>⚠️ Riesgos:</strong> Una desaceleración en China en el corto plazo puede presionar los tres mercados a la baja entre 10-15%. Monitorear inventarios portuarios y política comercial china.</p>
    `;
  }

  function generateWeeklyReport() {
    if (!precios) return '';
    return `
      <p><strong>📈 Análisis Semanal — Semana del ${new Date().toLocaleDateString('es-ES')}</strong></p>
      <p>Comparativo de precios, variación semanal, contexto de mercado y prospectiva de mediano plazo por mineral.</p>
      ${buildMineralBlock('carbon_energetico', { incluirSemanal: true })}
      ${buildMineralBlock('carbon_coquizable', { incluirSemanal: true })}
      ${buildMineralBlock('roca_fosfatica', { incluirSemanal: true })}
      <p><strong>🌍 Factores geopolíticos clave:</strong></p>
      <ul style="margin:0;padding-left:18px">
        <li>Sanciones a Rusia redirigen flujos de carbón hacia Colombia e Indonesia</li>
        <li>India consolida su posición como gran importador de carbón energético y coquizable</li>
        <li>OCP Marruecos amplía capacidad de exportación de fosfatos</li>
        <li>Venezuela/Táchira: evolución de marcos regulatorios para alianzas estratégicas en minería</li>
      </ul>
    `;
  }

  function generateMonthlyReport() {
    if (!precios) return '';
    const mesNombre = new Date().toLocaleDateString('es-ES', {month:'long', year:'numeric'});
    return `
      <p><strong>📋 Informe Mensual — ${mesNombre}</strong></p>
      <p>Visión de mediano y largo plazo: niveles de precio, variación mensual/anual, posición dentro del rango histórico y prospectiva, con foco en decisiones de inversión.</p>
      ${buildMineralBlock('carbon_energetico', { incluirSemanal: false, incluirMensual: true })}
      ${buildMineralBlock('carbon_coquizable', { incluirSemanal: false, incluirMensual: true })}
      ${buildMineralBlock('roca_fosfatica', { incluirSemanal: false, incluirMensual: true })}
      <p><strong>📊 Contexto regional:</strong></p>
      <ul style="margin:0;padding-left:18px">
        <li>Colombia mantiene posición competitiva en exportaciones de carbón energético y coquizable</li>
        <li>Táchira (Venezuela): reservas certificadas de carbón (353.30 Mt) y fosfatos (249.45 Mt) representan potencial exportador hacia el Caribe y Colombia</li>
        <li>La sustitución de flujos rusos sigue abriendo ventanas comerciales para productores latinoamericanos</li>
      </ul>
      <p class="mb-0"><strong>💡 Para el inversionista:</strong> evaluar entradas en niveles cercanos al mínimo histórico (mayor margen de seguridad) y considerar coberturas ante alta variación anual en carbón coquizable.</p>
    `;
  }

  function generateAlertReport() {
    if (!precios) return '';
    const items = [];
    ['carbon_energetico', 'carbon_coquizable', 'roca_fosfatica'].forEach(key => {
      const s = getMineralSnapshot(key);
      if (!s) return;
      const { d, info } = s;
      if (d.max_historico && d.precio_actual >= d.max_historico * 0.95) {
        items.push(`<li><b>${info.icono} ${info.nombre} — RIESGO:</b> precio cerca de su máximo histórico ($${d.max_historico.toFixed(2)}), posible corrección.</li>`);
      }
      if (d.min_historico && d.precio_actual <= d.min_historico * 1.05) {
        items.push(`<li><b>${info.icono} ${info.nombre} — OPORTUNIDAD:</b> precio cerca de su mínimo histórico ($${d.min_historico.toFixed(2)}), posible punto de entrada.</li>`);
      }
      if (Math.abs(d.variacion_diaria_pct) >= 2) {
        items.push(`<li><b>${info.icono} ${info.nombre}:</b> movimiento diario significativo de ${fmtPct(d.variacion_diaria_pct)}, monitorear continuidad de la tendencia.</li>`);
      }
    });

    return `
      <p><strong>🚨 Alertas Estratégicas — ${new Date().toLocaleDateString('es-ES')}</strong></p>
      <ul style="margin:0;padding-left:18px">
        ${items.join('') || '<li>Sin movimientos atípicos relevantes en la sesión actual.</li>'}
        <li><b>TÁCHIRA:</b> con el precio actual de carbón energético ($${precios.carbon_energetico.precio_actual.toFixed(2)}/Ton), la reactivación minera resulta atractiva frente a costos de producción estimados por debajo de $60/Ton.</li>
        <li><b>GEOPOLÍTICA:</b> monitorear negociaciones internacionales que puedan alterar flujos comerciales de carbón y fosfatos hacia/desde Rusia y China.</li>
      </ul>
    `;
  }

  /* ============================================================
     AUTO REFRESH
     ============================================================ */
  function startAutoRefresh() {
    autoRefreshInterval = setInterval(async () => {
      await loadData();
      renderKPIs();
      renderAlerts();
      renderOportunidades();
      buildTicker();
      renderLastUpdate();
    }, REFRESH_MS);
  }

  /* ============================================================
     OPORTUNIDADES DE NEGOCIO
     ============================================================ */
  function renderOportunidades() {
    const el = document.getElementById('oportunidades-negocio');
    if (!el || !precios) return;

    const ce = precios.carbon_energetico;
    const cc = precios.carbon_coquizable;
    const rf = precios.roca_fosfatica;
    const items = [];

    /* Táchira -> Caribe: viabilidad según margen sobre break-even */
    const BREAK_EVEN_TACHIRA = 60;
    const margen = ce.precio_actual - BREAK_EVEN_TACHIRA;
    const margenPct = Math.round((margen / BREAK_EVEN_TACHIRA) * 100);
    items.push({
      tipo: margen > 0 ? 'info' : 'warning',
      icono: margen > 0 ? '💡' : '⚠️',
      html: `<strong>Táchira → Caribe:</strong> Redirigir producción carbonífera hacia Cuba, Jamaica, Trinidad y Tobago. Precio break-even: $${BREAK_EVEN_TACHIRA}/Ton. Precio actual: $${ce.precio_actual.toFixed(2)}/Ton ${margen > 0 ? `(margen de +${margenPct}% sobre el break-even)` : `(por debajo del break-even, margen ${margenPct}%)`}.`
    });

    /* Fosfatos Monte Fresco -> Colombia, sensible al precio */
    items.push({
      tipo: 'info',
      icono: '💡',
      html: `<strong>Fosfatos Monte Fresco → Colombia:</strong> Colombia importa fosfatos. Con la roca fosfática cotizando a $${rf.precio_actual.toFixed(2)}/Ton (${fmtPct(rf.variacion_diaria_pct)} hoy), Monte Fresco (Mpio. Ayacucho, Táchira) podría abastecer parte de esa demanda regional.`
    });

    /* Carbón coquizable: oportunidad si tendencia alcista, riesgo si bajista fuerte */
    if (cc.variacion_semanal_pct >= 0) {
      items.push({
        tipo: 'info',
        icono: '💡',
        html: `<strong>Carbón Coquizable:</strong> precio en $${cc.precio_actual.toFixed(2)}/Ton, con variación semanal de ${fmtPct(cc.variacion_semanal_pct)}. Demanda siderúrgica al alza favorece posiciones exportadoras.`
      });
    } else {
      items.push({
        tipo: 'warning',
        icono: '⚠️',
        html: `<strong>Riesgo carbón coquizable:</strong> precio en $${cc.precio_actual.toFixed(2)}/Ton, con caída semanal de ${fmtPct(cc.variacion_semanal_pct)}. Posible corrección por menor demanda siderúrgica.`
      });
    }

    /* Riesgo sobreoferta si algún mineral está cerca del máximo histórico */
    [{ d: ce, n: 'Carbón Energético' }, { d: cc, n: 'Carbón Coquizable' }, { d: rf, n: 'Roca Fosfática' }].forEach(({ d, n }) => {
      if (d.max_historico && d.precio_actual >= d.max_historico * 0.95) {
        items.push({
          tipo: 'warning',
          icono: '⚠️',
          html: `<strong>Riesgo sobreoferta/corrección — ${n}:</strong> precio ($${d.precio_actual.toFixed(2)}/Ton) cerca de su máximo histórico ($${d.max_historico.toFixed(2)}/Ton). Posible corrección de precios.`
        });
      }
    });

    /* Geopolítica: siempre vigente */
    items.push({
      tipo: 'info',
      icono: '🌍',
      html: `<strong>Geopolítica favorable:</strong> sanciones rusas crean vacío que Colombia y Venezuela pueden ocupar en mercados asiáticos.`
    });

    el.innerHTML = items.map(it => `
      <div class="alert-item ${it.tipo} mb-2">
        <span class="alert-icon">${it.icono}</span>
        <div>${it.html}</div>
      </div>
    `).join('');
  }

  function renderLastUpdate() {
    const el = document.getElementById('last-update');
    if (el) el.textContent = new Date().toLocaleTimeString('es-ES');
  }

  /* ============================================================
     LOADER
     ============================================================ */
  function showLoader() {
    const l = document.getElementById('oicf-loader');
    if (l) l.style.display = 'flex';
  }
  function hideLoader() {
    const l = document.getElementById('oicf-loader');
    if (l) { l.style.opacity = '0'; setTimeout(() => l.style.display = 'none', 400); }
  }

  /* ============================================================
     TOAST
     ============================================================ */
  function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.innerHTML = `<span style="font-size:1.1rem">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  /* ============================================================
     HELPERS
     ============================================================ */
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* Demo data fallback */
  const PRECIOS_DEMO = {
    ultima_actualizacion: new Date().toISOString(),
    carbon_energetico: { nombre:'Carbón Energético (Newcastle)', unidad:'USD/Ton', precio_actual:132.45, variacion_diaria:-1.25, variacion_diaria_pct:-0.93, variacion_semanal_pct:-2.1, variacion_mensual_pct:3.8, variacion_anual_pct:-12.4, max_historico:457.90, min_historico:47.23, historico:{ '7d':[134.2,133.9,133.1,132.8,133.7,133.5,132.45], '30d':[128,129,130,131,132,131,132,132.45,131,130,132,133,134,133,133,132,133,133,132,131,131,132,133,134,133,132,131,132,133,132.45], '90d':[120,121,122,121,123,124,123,124,125,124,126,127,126,128,127,128,129,128,130,129,131,130,131,132,131,130,132,133,132,131,132,133,132.45,131,131,132,133,134,133,132,131,132,133,132.45,131,132,133,134,133,132,132.45,131,130,132,133,134,133,132,131,132,133,132.45,131,132,133,134,133,132,132.45,131,131,132,133,134,133,132,131,132,133,132.45,131,132,133,134,133,132,132.45,131,130] } },
    carbon_coquizable: { nombre:'Carbón Coquizable (Premium HCC)', unidad:'USD/Ton', precio_actual:198.75, variacion_diaria:2.15, variacion_diaria_pct:1.09, variacion_semanal_pct:1.8, variacion_mensual_pct:-2.3, variacion_anual_pct:-8.7, max_historico:670, min_historico:88.5, historico:{ '7d':[194.2,195.9,196.1,197.8,196.7,197.5,198.75], '30d':[191,192,193,194,195,193,194,196,194,193,194,196,197,196,196,195,196,196,195,194,193,195,196,197,196,195,194,195,196,198.75] } },
    roca_fosfatica:    { nombre:'Roca Fosfática (68% BPL)', unidad:'USD/Ton', precio_actual:87.5, variacion_diaria:0.75, variacion_diaria_pct:0.87, variacion_semanal_pct:2.9, variacion_mensual_pct:5.4, variacion_anual_pct:-3.2, max_historico:210.5, min_historico:38, historico:{ '7d':[85.2,85.9,86.1,86.8,86.7,87,87.5], '30d':[82,82,83,83,84,83,84,85,84,83,84,85,86,85,85,85,85,85,85,84,84,85,86,86,85,85,84,85,86,87.5] } }
  };

  const PRODUCCION_DEMO = {
    produccion_mundial: {
      carbon_energetico_mt: { China:{produccion:4560}, India:{produccion:850}, Indonesia:{produccion:720}, Australia:{produccion:510}, Rusia:{produccion:440}, Colombia:{produccion:57}, Venezuela:{produccion:0.8} },
      fosfatos_mt: { China:{produccion:95}, Marruecos:{produccion:40}, 'Estados Unidos':{produccion:24}, Rusia:{produccion:14}, Jordania:{produccion:10} }
    },
    colombia: {
      produccion_trimestral_mt:[8.7,9.1,8.4,8.9], exportaciones_mt:[7.8,8.2,7.6,8.0],
      regalias_cop_billones:[1.2,1.4,1.1,1.3], valor_fob_usd_millones:[1152,1230,1102,1195],
      departamentos_productores:{ Cesar:{produccion_pct:47}, 'La Guajira':{produccion_pct:37}, Boyacá:{produccion_pct:8}, Cundinamarca:{produccion_pct:4}, 'N. Santander':{produccion_pct:4} },
      por_mineral: {
        carbon_energetico: {
          nombre: 'Carbón Energético',
          produccion_trimestral_mt:[8.7,9.1,8.4,8.9], exportaciones_mt:[7.8,8.2,7.6,8.0],
          regalias_cop_billones:[1.2,1.4,1.1,1.3], valor_fob_usd_millones:[1152,1230,1102,1195],
          departamentos_productores:{ Cesar:{produccion_pct:51,principales_minas:['El Cerrejón','Prodeco','Drummond']}, 'La Guajira':{produccion_pct:40,principales_minas:['Cerrejón']}, Cundinamarca:{produccion_pct:5,principales_minas:['Varias']}, 'Norte de Santander':{produccion_pct:4,principales_minas:['Varias']} },
          puertos: { 'Puerto Bolivar':{exportaciones_mt:4.2,departamento:'La Guajira'}, 'Santa Marta':{exportaciones_mt:1.8,departamento:'Magdalena'}, Barranquilla:{exportaciones_mt:1.0,departamento:'Atlántico'}, Buenaventura:{exportaciones_mt:0.2,departamento:'Valle del Cauca'} }
        },
        carbon_coquizable: {
          nombre: 'Carbón Coquizable',
          produccion_trimestral_mt:[0.46,0.49,0.44,0.47], exportaciones_mt:[0.32,0.35,0.30,0.33],
          regalias_cop_billones:[0.06,0.07,0.06,0.06], valor_fob_usd_millones:[78,84,75,80],
          departamentos_productores:{ Boyacá:{produccion_pct:55,principales_minas:['Paz del Río','Samacá']}, 'Norte de Santander':{produccion_pct:35,principales_minas:['Cúcuta','El Zulia']}, Cundinamarca:{produccion_pct:10,principales_minas:['Varias']} },
          puertos: { Barranquilla:{exportaciones_mt:0.18,departamento:'Atlántico'}, Buenaventura:{exportaciones_mt:0.10,departamento:'Valle del Cauca'}, 'Santa Marta':{exportaciones_mt:0.05,departamento:'Magdalena'} }
        },
        roca_fosfatica: {
          nombre: 'Roca Fosfática',
          produccion_trimestral_mt:[0.13,0.14,0.12,0.13], exportaciones_mt:[0.05,0.06,0.05,0.05],
          regalias_cop_billones:[0.01,0.01,0.01,0.01], valor_fob_usd_millones:[9,10,8,9],
          departamentos_productores:{ Boyacá:{produccion_pct:60,principales_minas:['Sardinata','Pesca']}, Huila:{produccion_pct:25,principales_minas:['Aipe']}, 'Norte de Santander':{produccion_pct:15,principales_minas:['Pamplona']} },
          puertos: { Barranquilla:{exportaciones_mt:0.04,departamento:'Atlántico'}, 'Santa Marta':{exportaciones_mt:0.01,departamento:'Magdalena'} }
        }
      }
    },
    venezuela: {
      carbon: { zulia:{produccion_estimada_mt:0.5, estado:'operación reducida'}, tachira:{produccion_estimada_mt:0.3, estado:'suspendida'} },
      fosfatos: { monte_fresco:{reservas_estimadas_mt:150, municipio:'Ayacucho'} }
    },
    tachira_estrategico: {
      potencial_carbonifero:{ reservas_probadas_mt:129, reservas_probables_mt:250, tipo_carbon:'Bituminoso alta volatilidad', poder_calorifico_kcal_kg:6800, contenido_azufre_pct:0.8, ingreso_potencial_anual_musd:85.6 },
      potencial_fosfatico:{ yacimiento:'Monte Fresco', municipio:'Ayacucho', reservas_monte_fresco_mt:150, ley_promedio_pct_p2o5:18, mercados_objetivo:['Colombia','Brasil','Caribe'], ingreso_potencial_anual_musd:42.0 },
      competidores_regionales:{ Colombia:{produccion_mt:57, fortalezas:['Infraestructura','Logística']}, Brasil:{produccion_mt:8, fortalezas:['Mercado interno']}, Chile:{produccion_mt:0.1, fortalezas:['Estabilidad']}, Venezuela:{produccion_mt:0.8, debilidades:['Crisis energética']} }
    }
  };

  /* ---- Public API ---- */
  return { init, buildMainChart, generateIAReport, showToast, toggleTheme, renderColombiaSection, buildProjectionCharts };

})();

/* ---- Iniciar cuando el DOM esté listo ---- */
document.addEventListener('DOMContentLoaded', () => OICF.init());
