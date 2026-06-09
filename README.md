# ⛏️ Observatorio Internacional del Carbón y Fosfatos (OICF)

Plataforma web profesional de monitoreo diario del mercado mundial de **carbón energético**, **carbón coquizable** y **roca fosfática**, con seguimiento específico para Colombia, Venezuela y el **Estado Táchira**.

## 🚀 Inicio Rápido

```bash
pip install -r requirements.txt
python backend/app.py
# Abrir http://localhost:5000
```

**Credenciales demo:** `admin@oicf.com` / `oicf2026`

## 📁 Estructura

```
ObservatorioMinero/
├── index.html          # Landing page
├── dashboard.html      # Dashboard principal (11 secciones)
├── login.html          # Autenticación
├── alertas.html        # Panel de alertas
├── reportes.html       # Centro de reportes PDF/Excel
├── css/
│   ├── style.css       # Estilos globales (Dark/Light mode)
│   └── dashboard.css   # Estilos del dashboard
├── js/
│   ├── dashboard.js    # Lógica principal + auto-refresh
│   ├── charts.js       # Chart.js + Plotly + ApexCharts
│   ├── maps.js         # Leaflet (mapas mundiales)
│   └── noticias.js     # Centro de noticias + sentimiento
├── data/
│   ├── precios.json    # Precios con históricos
│   ├── noticias.json   # Feed de noticias
│   └── produccion.json # Producción mundial
└── backend/
    ├── app.py          # Flask API (12 endpoints)
    ├── scraper.py      # Web scraping automático
    └── scheduler.py    # Actualización cada 30 minutos
```

## 📊 Secciones del Dashboard

| # | Sección | Descripción |
|---|---------|-------------|
| 1 | Resumen Ejecutivo | KPIs en tiempo real (precios, variaciones) |
| 2 | Gráficos Históricos | Chart.js + Plotly, 7D a 1A, descarga PNG/PDF |
| 3 | Mapa Mundial | Leaflet — carbón y fosfatos por país |
| 4 | Monitor Colombia | Producción, exportaciones, regalías, puertos |
| 5 | Monitor Venezuela | Zulia, Táchira, Navay, Riecito |
| 6 | Centro de Noticias | Feed con análisis de sentimiento 🟢🟡🔴 |
| 7 | Observatorio Fosfato | Mercado mundial, líderes, tendencias |
| 8 | Proyecciones IA | ARIMA + Prophet, 30/90/180 días |
| 9 | Alertas | Alertas automáticas por umbral |
| 10 | Reportes | PDF diario/semanal/mensual + Excel |
| 11 | Panel Táchira | Potencial minero + oportunidades exportación |

## 🛠️ Tecnología

**Frontend:** HTML5 · Bootstrap 5 · Chart.js · Plotly.js · ApexCharts · Leaflet.js · DataTables · Font Awesome

**Backend:** Python 3 · Flask · Flask-CORS · APScheduler · ReportLab · BeautifulSoup4

## 🌐 API Endpoints

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/status` | Estado del servidor |
| `GET /api/precios` | Precios de los 3 commodities |
| `GET /api/noticias?categoria=carbon` | Noticias filtradas |
| `GET /api/alertas` | Alertas activas |
| `GET /api/produccion/colombia` | Datos Colombia |
| `GET /api/produccion/venezuela` | Datos Venezuela |
| `GET /api/produccion/tachira` | Panel estratégico Táchira |
| `GET /api/report/ejecutivo` | Informe PDF ejecutivo |
| `POST /api/scrape` | Forzar ciclo de scraping |

## 📈 Fuentes de Datos

- [Trading Economics](https://es.tradingeconomics.com/commodity/coal) — Carbón energético
- [La República](https://www.larepublica.co/indicadores-economicos/commodities/carbon) — Precios Colombia
- [SunSirs](https://www.sunsirs.com/es) — Fosfatos y fertilizantes
- [UPME](https://www.upme.gov.co/) — Producción colombiana
- [ACM Minería](https://acmineria.com.co/) — Noticias sectoriales
- [País Minero](https://www.paisminero.com/) — Proyectos e inversión

## 🏔️ Estado Táchira

Análisis de potencial minero:
- **Carbón:** 129 Mt probadas + 250 Mt probables → **USD $85.6M/año** potencial
- **Fosfatos Navay:** 150 Mt con 18% P₂O₅ → **USD $42M/año** potencial
- Mercados objetivo: Colombia, Caribe, Centroamérica

---
*OICF v1.0 — Desarrollado para el seguimiento e indicadores de gestión del Estado Táchira*
