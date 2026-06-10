/* ============================================================
   OICF - maps.js
   Mapas interactivos con Leaflet.js
   ============================================================ */

const OICF_Maps = (() => {

  let worldMap = null;
  let colombiaMap = null;
  let markers = [];

  /* ---- Datos de países ---- */
  const COAL_COUNTRIES = [
    { name: 'China',         lat: 35.86, lng: 104.19, produccion: 4560, tipo: 'energetico', color: '#ef4444' },
    { name: 'India',         lat: 20.59, lng: 78.96,  produccion: 850,  tipo: 'energetico', color: '#f97316' },
    { name: 'Indonesia',     lat: -0.78, lng: 113.92, produccion: 720,  tipo: 'energetico', color: '#eab308' },
    { name: 'Rusia',         lat: 61.52, lng: 105.31, produccion: 440,  tipo: 'energetico', color: '#06b6d4' },
    { name: 'Estados Unidos',lat: 37.09, lng: -95.71, produccion: 510,  tipo: 'energetico', color: '#3b82f6' },
    { name: 'Colombia',      lat: 4.57,  lng: -74.29, produccion: 57,   tipo: 'energetico', color: '#a855f7' },
    { name: 'Venezuela',     lat: 6.42,  lng: -66.59, produccion: 0.8,  tipo: 'energetico', color: '#ec4899' }
  ];

  const COKING_COUNTRIES = [
    { name: 'China',         lat: 35.86, lng: 104.19, produccion: 620,  tipo: 'coquizable', color: '#ef4444' },
    { name: 'Australia',     lat: -25.27, lng: 133.77,produccion: 510,  tipo: 'coquizable', color: '#22c55e' },
    { name: 'Rusia',         lat: 61.52, lng: 105.31, produccion: 95,   tipo: 'coquizable', color: '#06b6d4' },
    { name: 'Estados Unidos',lat: 37.09, lng: -95.71, produccion: 65,   tipo: 'coquizable', color: '#3b82f6' },
    { name: 'Mongolia',      lat: 46.86, lng: 103.85, produccion: 45,   tipo: 'coquizable', color: '#f59e0b' },
    { name: 'Canadá',        lat: 56.13, lng: -106.35,produccion: 32,   tipo: 'coquizable', color: '#a855f7' },
    { name: 'Colombia',      lat: 4.57,  lng: -74.29, produccion: 4.5,  tipo: 'coquizable', color: '#ec4899' }
  ];

  const PHOSPHATE_COUNTRIES = [
    { name: 'Marruecos',     lat: 31.79, lng: -7.09,  produccion: 40,   reservas: 50000, color: '#f59e0b' },
    { name: 'China',         lat: 35.86, lng: 104.19, produccion: 95,   reservas: 3200,  color: '#ef4444' },
    { name: 'Estados Unidos',lat: 37.09, lng: -95.71, produccion: 24,   reservas: 1000,  color: '#3b82f6' },
    { name: 'Rusia',         lat: 61.52, lng: 105.31, produccion: 14,   reservas: 600,   color: '#06b6d4' },
    { name: 'Jordania',      lat: 30.58, lng: 36.24,  produccion: 10,   reservas: 1000,  color: '#22c55e' },
    { name: 'Venezuela',     lat: 6.42,  lng: -66.59, produccion: 0.3,  reservas: 150,   color: '#ec4899' }
  ];

  const COLOMBIA_REGIONS = [
    { name: 'Cesar',              lat: 9.33,  lng: -73.50, pct: 47, minas: 'Drummond, Prodeco', color: '#3b82f6' },
    { name: 'La Guajira',         lat: 11.35, lng: -72.52, pct: 37, minas: 'Cerrejón',          color: '#06b6d4' },
    { name: 'Boyacá',             lat: 5.45,  lng: -73.36, pct: 8,  minas: 'Paz del Río',       color: '#22c55e' },
    { name: 'Cundinamarca',       lat: 4.65,  lng: -74.08, pct: 4,  minas: 'Varios',            color: '#f59e0b' },
    { name: 'Norte de Santander', lat: 7.88,  lng: -72.50, pct: 4,  minas: 'Varios',            color: '#a855f7' }
  ];

  const TACHIRA_SITES = [
    { name: 'Yacimiento Lobatera',        lat: 7.92,  lng: -72.23, tipo: 'carbon',   municipio: 'Lobatera',  desc: 'Reservas: 65 Mt · Carbón bituminoso', color: '#60a5fa' },
    { name: 'Yacimiento Las Adjuntas',    lat: 7.68,  lng: -72.15, tipo: 'carbon',   municipio: 'Bolívar',   desc: 'Reservas: 64 Mt · Carbón bituminoso', color: '#60a5fa' },
    { name: 'Yac. Monte Fresco',          lat: 7.73,  lng: -71.80, tipo: 'fosfatos', municipio: 'Ayacucho',  desc: 'Reservas: 150 Mt · 18% P₂O₅', color: '#34d399' }
  ];

  /* ---- Inicializar Mapa Mundial ---- */
  function initWorldMap(divId) {
    if (worldMap) { worldMap.remove(); worldMap = null; }
    const dark = document.body.classList.contains('dark-mode');

    const tileUrl = dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    worldMap = L.map(divId, { center: [20, 10], zoom: 2, zoomControl: true });

    L.tileLayer(tileUrl, {
      attribution: '© OpenStreetMap, © CARTO',
      subdomains: 'abcd', maxZoom: 19
    }).addTo(worldMap);

    renderWorldMarkers('coal');
    return worldMap;
  }

  const LAYER_CONFIG = {
    coal:      { data: COAL_COUNTRIES,      unit: 'Mt carbón energético', titulo: 'Carbón Energético (térmico)' },
    coking:    { data: COKING_COUNTRIES,    unit: 'Mt carbón coquizable', titulo: 'Carbón Coquizable (metalúrgico)' },
    phosphate: { data: PHOSPHATE_COUNTRIES, unit: 'Mt fosfatos',          titulo: 'Roca Fosfática' }
  };

  function renderWorldMarkers(layer) {
    clearMarkers(worldMap);
    const cfg = LAYER_CONFIG[layer] || LAYER_CONFIG.coal;
    const data = cfg.data;
    data.forEach(c => {
      const r = Math.max(10, Math.min(55, Math.sqrt(c.produccion) * 1.8));
      const circle = L.circleMarker([c.lat, c.lng], {
        radius: r, color: c.color, fillColor: c.color,
        fillOpacity: 0.55, weight: 2
      }).addTo(worldMap);

      circle.bindPopup(`
        <div style="min-width:160px">
          <strong style="font-size:1rem">${c.name}</strong><br>
          <span style="font-size:.8rem;opacity:.7">Producción anual — ${cfg.titulo}</span><br>
          <span style="font-size:1.1rem;font-weight:700;color:${c.color}">${c.produccion} ${cfg.unit}</span>
          ${c.reservas ? `<br><span style="font-size:.75rem;opacity:.6">Reservas: ${c.reservas.toLocaleString()} Mt</span>` : ''}
        </div>
      `);
      markers.push(circle);
    });

    updateLegend(layer);
  }

  function updateLegend(layer) {
    const el = document.getElementById('map-legend-content');
    if (!el) return;
    const cfg = LAYER_CONFIG[layer] || LAYER_CONFIG.coal;
    const top = [...cfg.data].sort((a,b) => b.produccion - a.produccion).slice(0, 4);
    el.innerHTML = `
      <div class="fw-600 mb-2" style="font-size:.8rem">Tamaño = Producción anual · ${cfg.titulo}</div>
      ${top.map((c,i) => `<div class="map-legend-item"><div class="map-dot" style="background:${c.color}"></div><span>${c.name}${i===0?' (mayor productor)':''}</span></div>`).join('')}
    `;
  }

  /* ---- Mapa Colombia ---- */
  function initColombiaMap(divId) {
    if (colombiaMap) { colombiaMap.remove(); colombiaMap = null; }
    const dark = document.body.classList.contains('dark-mode');
    const tileUrl = dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    colombiaMap = L.map(divId, { center: [4.5, -74.0], zoom: 5 });
    L.tileLayer(tileUrl, { attribution: '© CARTO', subdomains: 'abcd' }).addTo(colombiaMap);

    COLOMBIA_REGIONS.forEach(r => {
      const m = L.circleMarker([r.lat, r.lng], {
        radius: Math.max(12, r.pct * 0.9),
        color: r.color, fillColor: r.color, fillOpacity: 0.6, weight: 2
      }).addTo(colombiaMap);
      m.bindPopup(`
        <strong>${r.name}</strong><br>
        <span style="font-size:.8rem">Producción: <b>${r.pct}%</b> nacional</span><br>
        <span style="font-size:.75rem;opacity:.7">Minas: ${r.minas}</span>
      `);
    });

    /* Puertos */
    const puertos = [
      { name: 'Puerto Bolívar', lat: 12.20, lng: -71.95, mt: 4.2 },
      { name: 'Santa Marta',    lat: 11.24, lng: -74.20, mt: 1.8 },
      { name: 'Barranquilla',   lat: 10.96, lng: -74.81, mt: 1.2 },
      { name: 'Buenaventura',   lat: 3.88,  lng: -77.02, mt: 0.8 }
    ];
    puertos.forEach(p => {
      const m = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          html: `<div style="background:#f59e0b;color:#000;font-size:.65rem;font-weight:700;padding:3px 6px;border-radius:4px;white-space:nowrap">⚓ ${p.name}</div>`,
          className: '', iconAnchor: [40, 10]
        })
      }).addTo(colombiaMap);
      m.bindPopup(`<strong>${p.name}</strong><br>Exportaciones: <b>${p.mt} Mt/año</b>`);
    });

    return colombiaMap;
  }

  /* ---- Mapa Táchira ---- */
  function initTachiraMap(divId) {
    const dark = document.body.classList.contains('dark-mode');
    const tileUrl = dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    const map = L.map(divId, { center: [8.0, -72.0], zoom: 8 });
    L.tileLayer(tileUrl, { attribution: '© CARTO', subdomains: 'abcd' }).addTo(map);

    TACHIRA_SITES.forEach(s => {
      const m = L.circleMarker([s.lat, s.lng], {
        radius: 14, color: s.color, fillColor: s.color, fillOpacity: 0.65, weight: 2
      }).addTo(map);
      m.bindPopup(`
        <strong>${s.name}</strong><br>
        <span style="font-size:.75rem;opacity:.6">Mpio. ${s.municipio} · Estado Táchira</span><br>
        <span style="color:${s.color};font-weight:600">${s.tipo.toUpperCase()}</span><br>
        <span style="font-size:.8rem">${s.desc}</span>
      `).openPopup();
    });
    return map;
  }

  /* ---- Helpers ---- */
  function clearMarkers(map) {
    if (!map) return;
    markers.forEach(m => map.removeLayer(m));
    markers = [];
  }

  function refreshTheme() {
    const dark = document.body.classList.contains('dark-mode');
    const url = dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    [worldMap, colombiaMap].forEach(m => {
      if (!m) return;
      m.eachLayer(l => { if (l instanceof L.TileLayer) { l.setUrl(url); } });
    });
  }

  return { initWorldMap, renderWorldMarkers, updateLegend, initColombiaMap, initTachiraMap, refreshTheme };

})();
