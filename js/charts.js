/* ============================================================
   OICF - charts.js
   Gestión de gráficos con Chart.js y Plotly
   ============================================================ */

const OICF_Charts = (() => {

  const COLORS = {
    coal_thermal: { line: '#60a5fa', fill: 'rgba(96,165,250,.12)', gradient_start: 'rgba(96,165,250,.3)' },
    coal_coking:  { line: '#a78bfa', fill: 'rgba(167,139,250,.12)', gradient_start: 'rgba(167,139,250,.3)' },
    phosphate:    { line: '#34d399', fill: 'rgba(52,211,153,.12)', gradient_start: 'rgba(52,211,153,.3)' },
    positive:     '#22c55e',
    negative:     '#ef4444',
    neutral:      '#f59e0b'
  };

  function isDark() { return document.body.classList.contains('dark-mode'); }

  function chartDefaults() {
    const dark = isDark();
    return {
      textColor: dark ? '#94a3b8' : '#64748b',
      gridColor: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)',
      bgColor:   dark ? '#111827' : '#ffffff'
    };
  }

  /* ---- Gradient helper ---- */
  function buildGradient(ctx, colorStart, colorEnd) {
    const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    g.addColorStop(0, colorStart);
    g.addColorStop(1, colorEnd || 'rgba(0,0,0,0)');
    return g;
  }

  /* ---- Sparkline mini charts ---- */
  function createSparkline(canvasId, data, color, positive) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (canvas._chartInstance) canvas._chartInstance.destroy();

    const lineColor = positive === undefined ? color :
                      (positive ? COLORS.positive : COLORS.negative);

    canvas._chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((_,i) => i),
        datasets: [{
          data, borderColor: lineColor, borderWidth: 2,
          pointRadius: 0, fill: false, tension: 0.4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false }
        },
        animation: { duration: 500 }
      }
    });
  }

  /* ---- Main price history chart ---- */
  let mainChart = null;

  function buildMainChart(canvasId, precios, period) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (mainChart) mainChart.destroy();

    const d = chartDefaults();
    const datasets = [];

    const commodities = [
      { key: 'carbon_energetico', label: 'Carbón Energético', colors: COLORS.coal_thermal, axis: 'yCarbonEnergetico', position: 'left'  },
      { key: 'carbon_coquizable', label: 'Carbón Coquizable',  colors: COLORS.coal_coking,  axis: 'yCarbonCoquizable', position: 'right' },
      { key: 'roca_fosfatica',    label: 'Roca Fosfática',     colors: COLORS.phosphate,    axis: 'yRocaFosfatica',    position: 'right' }
    ];

    let labels = [];
    const scales = {
      x: {
        grid: { color: d.gridColor },
        ticks: { color: d.textColor, maxTicksLimit: 10, font: { size: 11 } }
      }
    };

    commodities.forEach(c => {
      const raw = precios[c.key]?.historico?.[period] || [];
      if (!raw.length) return;
      if (!labels.length) {
        labels = generateDateLabels(raw.length, period);
      }
      const grad = buildGradient(ctx, c.colors.gradient_start, 'rgba(0,0,0,0)');
      datasets.push({
        label: c.label,
        data: raw,
        borderColor: c.colors.line,
        backgroundColor: grad,
        borderWidth: 2.5,
        pointRadius: raw.length > 60 ? 0 : 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.4,
        yAxisID: c.axis
      });

      scales[c.axis] = {
        position: c.position,
        grid: { color: c.axis === 'yCarbonEnergetico' ? d.gridColor : 'transparent', drawOnChartArea: c.axis === 'yCarbonEnergetico' },
        ticks: {
          color: c.colors.line, font: { size: 11 },
          callback: v => '$' + v.toFixed(0)
        },
        title: { display: true, text: c.label, color: c.colors.line, font: { size: 11 } }
      };
    });

    mainChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'point', intersect: true },
        plugins: {
          legend: {
            display: true,
            labels: { color: d.textColor, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } }
          },
          tooltip: {
            mode: 'point',
            intersect: true,
            backgroundColor: d.bgColor === '#111827' ? '#1e293b' : '#fff',
            titleColor: d.textColor,
            bodyColor: d.textColor,
            borderColor: d.gridColor,
            borderWidth: 1,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)} USD/Ton`
            }
          }
        },
        scales
      }
    });
    return mainChart;
  }

  /* ---- Commodity single chart ---- */
  let singleChart = null;

  function buildSingleChart(canvasId, data, label, color, period) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (singleChart) singleChart.destroy();

    const d = chartDefaults();
    const labels = generateDateLabels(data.length, period);
    const grad = buildGradient(ctx, color.gradient_start, 'rgba(0,0,0,0)');

    singleChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label, data,
          borderColor: color.line,
          backgroundColor: grad,
          borderWidth: 2.5,
          pointRadius: data.length > 60 ? 0 : 3,
          pointHoverRadius: 6,
          fill: true, tension: 0.4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ` $${ctx.parsed.y.toFixed(2)} USD/Ton` }
          }
        },
        scales: {
          x: { grid: { color: d.gridColor }, ticks: { color: d.textColor, maxTicksLimit: 8 } },
          y: { grid: { color: d.gridColor }, ticks: { color: d.textColor, callback: v => '$'+v } }
        }
      }
    });
  }

  /* ---- Bar chart production ---- */
  function buildProductionBar(canvasId, data, labels, title) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (canvas._chartInstance) canvas._chartInstance.destroy();
    const d = chartDefaults();

    canvas._chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: title,
          data,
          backgroundColor: labels.map((_,i) => `hsl(${200 + i*22},70%,55%)`),
          borderRadius: 6, borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: d.textColor } },
          y: { grid: { color: d.gridColor }, ticks: { color: d.textColor } }
        }
      }
    });
    return canvas._chartInstance;
  }

  /* ---- Donut chart ---- */
  function buildDonut(canvasId, data, labels, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (canvas._chartInstance) canvas._chartInstance.destroy();
    const d = chartDefaults();

    canvas._chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: d.bgColor }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
          legend: { labels: { color: d.textColor, font: { size: 11 }, usePointStyle: true } }
        }
      }
    });
    return canvas._chartInstance;
  }

  /* ---- Projection Plotly chart ---- */
  function buildProjectionPlotly(divId, historical, proj30, proj90, commodityName) {
    const dark = isDark();
    const paperBg = dark ? '#111827' : '#ffffff';
    const plotBg  = dark ? '#111827' : '#ffffff';
    const fontColor = dark ? '#94a3b8' : '#475569';
    const gridColor = dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)';

    const hLen = historical.length;
    const histLabels = generateDateLabels(hLen, '90d');
    const projLabels30 = generateFutureDates(30);
    const projLabels90 = generateFutureDates(90);

    const lastVal = historical[historical.length - 1];
    const proj30Data = buildProjection(lastVal, proj30, 30);
    const proj90Data = buildProjection(lastVal, proj90, 90);

    const traces = [
      {
        x: histLabels, y: historical, mode: 'lines', name: 'Histórico',
        line: { color: '#60a5fa', width: 2.5 }
      },
      {
        x: [histLabels[histLabels.length-1], ...projLabels30],
        y: [lastVal, ...proj30Data],
        mode: 'lines', name: 'Pronóstico 30d',
        line: { color: '#f59e0b', width: 2, dash: 'dash' }
      },
      {
        x: [histLabels[histLabels.length-1], ...projLabels90],
        y: [lastVal, ...proj90Data],
        mode: 'lines', name: 'Pronóstico 90d',
        line: { color: '#a78bfa', width: 2, dash: 'dot' }
      }
    ];

    const layout = {
      paper_bgcolor: paperBg, plot_bgcolor: plotBg,
      font: { color: fontColor, size: 11 },
      margin: { t: 20, r: 20, b: 40, l: 55 },
      xaxis: { gridcolor: gridColor, showgrid: true },
      yaxis: { gridcolor: gridColor, showgrid: true, tickprefix: '$' },
      legend: { orientation: 'h', x: 0, y: 1.08 },
      hovermode: 'x unified',
      autosize: true
    };

    const config = { responsive: true, displayModeBar: true, displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d','select2d'] };

    Plotly.newPlot(divId, traces, layout, config);
  }

  /* ---- Gauge (ApexCharts) ---- */
  function buildGauge(divId, value, min, max, label, color) {
    const dark = isDark();
    const options = {
      chart: { type: 'radialBar', height: 180, background: 'transparent' },
      series: [Math.round(((value - min)/(max - min))*100)],
      colors: [color],
      plotOptions: {
        radialBar: {
          startAngle: -135, endAngle: 135,
          hollow: { size: '55%' },
          dataLabels: {
            name: { offsetY: -8, color: dark ? '#94a3b8' : '#64748b', fontSize: '11px', show: true },
            value: {
              offsetY: 4, fontSize: '1.2rem', fontWeight: '700',
              color: dark ? '#e2e8f0' : '#1e293b',
              formatter: () => '$' + value.toFixed(1)
            }
          }
        }
      },
      labels: [label],
      theme: { mode: dark ? 'dark' : 'light' }
    };
    const el = document.getElementById(divId);
    if (!el) return;
    if (el._apexChart) el._apexChart.destroy();
    el._apexChart = new ApexCharts(el, options);
    el._apexChart.render();
  }

  /* ---- Helpers ---- */
  function generateDateLabels(n, period) {
    const labels = [];
    const now = new Date();
    const step = period === '7d' ? 1 : period === '30d' ? 1 : period === '90d' ? 1 : period === '365d' ? 1 : 1;
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * step);
      if (n <= 31) {
        labels.push(d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }));
      } else if (n <= 100) {
        labels.push(d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }));
      } else {
        labels.push(d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }));
      }
    }
    return labels;
  }

  function generateFutureDates(days) {
    const labels = [];
    const now = new Date();
    for (let i = 1; i <= days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      labels.push(d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }));
    }
    return labels;
  }

  function buildProjection(baseVal, targetPct, nPoints) {
    const result = [];
    const targetVal = baseVal * (1 + targetPct / 100);
    for (let i = 0; i < nPoints; i++) {
      const pct = i / (nPoints - 1);
      const noise = (Math.random() - 0.5) * baseVal * 0.01;
      result.push(+(baseVal + (targetVal - baseVal) * pct + noise).toFixed(2));
    }
    return result;
  }

  /* ---- Public API ---- */
  return {
    createSparkline,
    buildMainChart,
    buildSingleChart,
    buildProductionBar,
    buildDonut,
    buildProjectionPlotly,
    buildGauge,
    COLORS,
    generateDateLabels
  };

})();
