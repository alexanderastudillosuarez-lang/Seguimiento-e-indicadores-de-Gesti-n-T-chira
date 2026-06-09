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
        data: precios.carbon_energetico,
        icon: 'fa-industry', gradient: 'gradient-coal',
        sparkId: 'spark-coal-thermal',
        histKey: '7d'
      },
      {
        id: 'kpi-coal-coking',
        data: precios.carbon_coquizable,
        icon: 'fa-hard-hat', gradient: 'gradient-coking',
        sparkId: 'spark-coal-coking',
        histKey: '7d'
      },
      {
        id: 'kpi-phosphate',
        data: precios.roca_fosfatica,
        icon: 'fa-seedling', gradient: 'gradient-phosph',
        sparkId: 'spark-phosphate',
        histKey: '7d'
      }
    ];

    kpis.forEach(k => {
      const el = document.getElementById(k.id);
      if (!el) return;
      const d = k.data;
      const up = d.variacion_diaria >= 0;
      const arr = up ? '▲' : '▼';
      const cls = up ? 'up' : 'down';

      el.innerHTML = `
        <div class="kpi-card card-oicf h-100">
          <div class="d-flex align-items-start gap-3 mb-3">
            <div class="kpi-icon ${k.gradient}">
              <i class="fas ${k.icon} text-white"></i>
            </div>
            <div style="flex:1">
              <div class="kpi-label">${d.nombre}</div>
              <div class="kpi-price mt-1">$${d.precio_actual.toFixed(2)}</div>
              <div class="kpi-unit">USD / Tonelada</div>
            </div>
          </div>
          <div class="d-flex gap-2 flex-wrap mb-2">
            <span class="kpi-badge ${cls}">${arr} Hoy ${Math.abs(d.variacion_diaria).toFixed(2)}</span>
            <span class="kpi-badge ${d.variacion_mensual_pct>=0?'up':'down'}">${d.variacion_mensual_pct>=0?'▲':'▼'} Mes ${Math.abs(d.variacion_mensual_pct).toFixed(1)}%</span>
            <span class="kpi-badge ${d.variacion_anual_pct>=0?'up':'down'}">${d.variacion_anual_pct>=0?'▲':'▼'} Año ${Math.abs(d.variacion_anual_pct).toFixed(1)}%</span>
          </div>
          <canvas id="${k.sparkId}" class="kpi-sparkline"></canvas>
          <div class="d-flex justify-content-between mt-2" style="font-size:.7rem;opacity:.5">
            <span>Mín hist: $${d.min_historico}</span>
            <span>Máx hist: $${d.max_historico}</span>
          </div>
        </div>
      `;

      /* Sparkline */
      const hist = d.historico?.[k.histKey] || [];
      if (hist.length) OICF_Charts.createSparkline(k.sparkId, hist, null, up);
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
  function buildProjectionCharts() {
    if (!precios) return;
    const hist = precios.carbon_energetico.historico?.['90d'] || [];
    OICF_Charts.buildProjectionPlotly('projection-chart', hist, -8.5, -15.2, 'Carbón Energético');

    /* Tarjetas de proyección */
    renderProjectionCards();
  }

  function renderProjectionCards() {
    if (!precios) return;
    const d = precios.carbon_energetico;
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

    /* Donut Colombia */
    const col = produccion.colombia.departamentos_productores;
    OICF_Charts.buildDonut('colombia-donut',
      Object.values(col).map(v => v.produccion_pct),
      Object.keys(col),
      ['#3b82f6','#06b6d4','#22c55e','#f59e0b','#a855f7']
    );

    renderColombiaStats();
    renderVenezuelaStats();
    renderTachiraPanel();
  }

  /* ---- Colombia Stats ---- */
  function renderColombiaStats() {
    if (!produccion) return;
    const col = produccion.colombia;
    const el = document.getElementById('colombia-stats');
    if (!el) return;

    const totalProd = col.produccion_trimestral_mt.reduce((a,b)=>a+b,0).toFixed(1);
    const totalExp  = col.exportaciones_mt.reduce((a,b)=>a+b,0).toFixed(1);
    const totalReg  = col.regalias_cop_billones.reduce((a,b)=>a+b,0).toFixed(2);
    const totalFob  = col.valor_fob_usd_millones.reduce((a,b)=>a+b,0).toFixed(0);

    el.innerHTML = `
      <div class="stat-row"><span>Producción anual</span><strong>${totalProd} Mt</strong></div>
      <div class="stat-row"><span>Exportaciones</span><strong>${totalExp} Mt</strong></div>
      <div class="stat-row"><span>Regalías</span><strong>COP ${totalReg} Bill.</strong></div>
      <div class="stat-row"><span>Valor FOB</span><strong>USD $${Number(totalFob).toLocaleString()}M</strong></div>
    `;
  }

  /* ---- Venezuela Stats ---- */
  function renderVenezuelaStats() {
    if (!produccion) return;
    const ven = produccion.venezuela;
    const el = document.getElementById('venezuela-stats');
    if (!el) return;

    el.innerHTML = `
      <div class="stat-row"><span>Carbón Zulia</span><strong>${ven.carbon.zulia.produccion_estimada_mt} Mt/año (est.)</strong></div>
      <div class="stat-row"><span>Estado Zulia</span><em class="text-warning">${ven.carbon.zulia.estado}</em></div>
      <div class="stat-row"><span>Carbón Táchira</span><strong>${ven.carbon.tachira.produccion_estimada_mt} Mt/año (est.)</strong></div>
      <div class="stat-row"><span>Estado Táchira</span><em class="text-danger">${ven.carbon.tachira.estado}</em></div>
      <div class="stat-row"><span>Fosfatos Navay</span><strong>${ven.fosfatos.navay.reservas_estimadas_mt} Mt reservas</strong></div>
      <div class="stat-row"><span>Fosfatos Riecito</span><strong>${ven.fosfatos.riecito.reservas_estimadas_mt} Mt reservas</strong></div>
    `;
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
              <div class="tachira-label">Reservas Probadas</div>
            </div>
            <div class="mt-2">
              <div class="tachira-stat">${tach.potencial_carbonifero.reservas_probables_mt} Mt</div>
              <div class="tachira-label">Reservas Probables</div>
            </div>
            <div class="mt-2 fs-xs" style="color:rgba(255,255,255,.7)">
              ${tach.potencial_carbonifero.tipo_carbon}<br>
              PC: ${tach.potencial_carbonifero.poder_calorifico_kcal_kg} Kcal/kg | S: ${tach.potencial_carbonifero.contenido_azufre_pct}%
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
            <div class="mt-3">
              <div class="tachira-stat">${tach.potencial_fosfatico.reservas_navay_mt} Mt</div>
              <div class="tachira-label">Reservas Navay</div>
            </div>
            <div class="mt-2">
              <div class="tachira-stat">${tach.potencial_fosfatico.ley_promedio_pct_p2o5}% P₂O₅</div>
              <div class="tachira-label">Ley promedio</div>
            </div>
            <div class="mt-2 fs-xs" style="color:rgba(255,255,255,.7)">
              Mercados: ${tach.potencial_fosfatico.mercados_objetivo.join(', ')}
            </div>
            <div class="mt-3 p-2" style="background:rgba(255,255,255,.08);border-radius:8px">
              <div class="fs-xs text-muted">Ingreso potencial anual</div>
              <div class="fw-700" style="font-size:1.3rem;color:#34d399">USD $${tach.potencial_fosfatico.ingreso_potencial_anual_musd}M</div>
            </div>
          </div>
        </div>
        <div class="col-12">
          <div class="card-oicf p-3">
            <h6 class="mb-3">Comparación Regional de Competidores</h6>
            <div class="table-responsive">
              <table class="table table-sm table-oicf mb-0">
                <thead><tr>
                  <th>País</th><th>Prod. carbón</th><th>Fortalezas / Debilidades</th>
                </tr></thead>
                <tbody>
                  ${Object.entries(tach.competidores_regionales).map(([pais, info]) => `
                    <tr>
                      <td class="fw-600">${pais}</td>
                      <td>${info.produccion_mt} Mt</td>
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

  function generateDailyReport() {
    if (!precios) return '';
    const c = precios.carbon_energetico;
    const f = precios.roca_fosfatica;
    const sentDir = c.variacion_diaria >= 0 ? 'alcista' : 'bajista';
    return `
      <p><strong>📊 Resumen Diario — ${new Date().toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</strong></p>
      <p>El mercado de carbón energético muestra una tendencia <b>${sentDir}</b> con el precio Newcastle en <b>$${c.precio_actual.toFixed(2)} USD/Ton</b>, una variación diaria de <b>${c.variacion_diaria >= 0 ? '+' : ''}${c.variacion_diaria.toFixed(2)} USD</b> (${c.variacion_diaria_pct.toFixed(2)}%).</p>
      <p>La roca fosfática cotiza en <b>$${f.precio_actual.toFixed(2)} USD/Ton</b> con tendencia ${f.variacion_diaria >= 0 ? 'positiva' : 'negativa'} de ${Math.abs(f.variacion_diaria_pct).toFixed(2)}% en la sesión.</p>
      <p><strong>🎯 Oportunidades identificadas:</strong></p>
      <ul style="margin:0;padding-left:18px">
        <li>Posición compradora en carbón coquizable ante recuperación siderúrgica europea</li>
        <li>Ventana exportadora Colombia → India para carbón energético Q3 2026</li>
        <li>Táchira: momento favorable para iniciar trámites de titulación minera</li>
      </ul>
      <p class="mb-0 mt-2"><strong>⚠️ Riesgos:</strong> Desaceleración china en segundo semestre puede presionar precios a la baja 10-15%.</p>
    `;
  }

  function generateWeeklyReport() {
    return `
      <p><strong>📈 Análisis Semanal — Semana del ${new Date().toLocaleDateString('es-ES')}</strong></p>
      <p>Durante la semana se observó <b>consolidación de precios</b> en carbón energético con soporte en $130 USD/Ton. El carbón coquizable muestra fortaleza relativa impulsado por demanda siderúrgica asiática.</p>
      <p>Los fosfatos continúan en fase de <b>recuperación gradual</b>, con señales de acumulación por parte de importadores latinoamericanos ante restricciones chinas.</p>
      <p><strong>🌍 Factores geopolíticos clave:</strong></p>
      <ul style="margin:0;padding-left:18px">
        <li>Sanciones rusas redirigen flujos hacia Colombia e Indonesia</li>
        <li>India supera a Japón como 2do importador mundial</li>
        <li>OCP Marruecos amplía capacidad portuaria en 15 Mt/año</li>
      </ul>
    `;
  }

  function generateMonthlyReport() {
    return `
      <p><strong>📋 Informe Mensual — Junio 2026</strong></p>
      <p>El mercado de carbón refleja un <b>ciclo de corrección moderada</b> tras los picos de 2022-2023. Los precios se han estabilizado en rangos más sostenibles de largo plazo.</p>
      <p>Colombia mantiene su posición competitiva con exportaciones crecientes al 8% interanual. La ventana de oportunidad para Venezuela y Táchira se abre con el reposicionamiento de flujos post-sanciones rusas.</p>
      <p><strong>📊 Métricas clave del mes:</strong></p>
      <ul style="margin:0;padding-left:18px">
        <li>Carbón Energético: promedio mensual $131.2 USD/Ton</li>
        <li>Carbón Coquizable: promedio mensual $196.8 USD/Ton</li>
        <li>Fosfatos: promedio mensual $85.9 USD/Ton</li>
        <li>Colombia: exportaciones estimadas 8.0 Mt en mayo</li>
      </ul>
    `;
  }

  function generateAlertReport() {
    return `
      <p><strong>🚨 Alertas Estratégicas — ${new Date().toLocaleDateString('es-ES')}</strong></p>
      <ul style="margin:0;padding-left:18px">
        <li><b>OPORTUNIDAD:</b> Diferencial Newcastle-Colombia en mínimos de 3 años → margen exportador favorable</li>
        <li><b>RIESGO:</b> Sobreoferta indonesia puede deprimir precios en Q3 2026</li>
        <li><b>TÁCHIRA:</b> Precio actual $132/Ton hace rentable reactivación minera con costos &lt;$60/Ton</li>
        <li><b>FOSFATOS:</b> Restricciones chinas crean escasez temporal en mercado spot</li>
        <li><b>GEOPOLÍTICA:</b> Monitorear negociaciones Rusia-Occidente que podrían relajar sanciones</li>
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
      buildTicker();
      renderLastUpdate();
    }, REFRESH_MS);
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
      departamentos_productores:{ Cesar:{produccion_pct:47}, 'La Guajira':{produccion_pct:37}, Boyacá:{produccion_pct:8}, Cundinamarca:{produccion_pct:4}, 'N. Santander':{produccion_pct:4} }
    },
    venezuela: {
      carbon: { zulia:{produccion_estimada_mt:0.5, estado:'operación reducida'}, tachira:{produccion_estimada_mt:0.3, estado:'suspendida'} },
      fosfatos: { navay:{reservas_estimadas_mt:150}, riecito:{reservas_estimadas_mt:80} }
    },
    tachira_estrategico: {
      potencial_carbonifero:{ reservas_probadas_mt:129, reservas_probables_mt:250, tipo_carbon:'Bituminoso alta volatilidad', poder_calorifico_kcal_kg:6800, contenido_azufre_pct:0.8, ingreso_potencial_anual_musd:85.6 },
      potencial_fosfatico:{ reservas_navay_mt:150, ley_promedio_pct_p2o5:18, mercados_objetivo:['Colombia','Brasil','Caribe'], ingreso_potencial_anual_musd:42.0 },
      competidores_regionales:{ Colombia:{produccion_mt:57, fortalezas:['Infraestructura','Logística']}, Brasil:{produccion_mt:8, fortalezas:['Mercado interno']}, Chile:{produccion_mt:0.1, fortalezas:['Estabilidad']}, Venezuela:{produccion_mt:0.8, debilidades:['Crisis energética']} }
    }
  };

  /* ---- Public API ---- */
  return { init, buildMainChart, generateIAReport, showToast, toggleTheme };

})();

/* ---- Iniciar cuando el DOM esté listo ---- */
document.addEventListener('DOMContentLoaded', () => OICF.init());
