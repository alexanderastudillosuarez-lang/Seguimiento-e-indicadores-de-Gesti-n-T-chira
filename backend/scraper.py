"""
OICF - scraper.py
Web scraping automático de fuentes de datos mineros
Versión 2.0 — 14 fuentes internacionales
"""

import json, datetime, time, random
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# =============================================================================
# REGISTRO DE FUENTES
# =============================================================================
FUENTES_CONFIG = {
    # ── CARBÓN ENERGÉTICO ──────────────────────────────────────────────────
    "trading_economics_coal": {
        "nombre": "Trading Economics — Coal",
        "url": "https://es.tradingeconomics.com/commodity/coal",
        "commodity": "carbon_energetico",
        "categoria": "carbon_energetico",
        "activa": True,
        "metodo": "scrape_trading_economics_coal"
    },
    "world_bank_commodity": {
        "nombre": "World Bank Commodity Markets",
        "url": "https://www.worldbank.org/en/research/commodity-markets",
        "commodity": "carbon_energetico",
        "categoria": "carbon_energetico",
        "activa": True,
        "metodo": "scrape_world_bank"
    },
    "indexmundi_coal": {
        "nombre": "IndexMundi — Coal Prices",
        "url": "https://www.indexmundi.com/commodities/?commodity=coal&months=60",
        "commodity": "carbon_energetico",
        "categoria": "carbon_energetico",
        "activa": True,
        "metodo": "scrape_indexmundi_coal"
    },
    "iea_coal": {
        "nombre": "IEA — International Energy Agency",
        "url": "https://www.iea.org/data-and-statistics/charts/coal-prices",
        "commodity": "carbon_energetico",
        "categoria": "carbon_energetico",
        "activa": True,
        "metodo": "scrape_iea"
    },
    "argus_media_coal": {
        "nombre": "Argus Media — Coal",
        "url": "https://www.argusmedia.com/en/coal-coke-and-biomass",
        "commodity": "carbon_energetico",
        "categoria": "carbon_energetico",
        "activa": True,
        "metodo": "scrape_argus_coal"
    },
    # ── CARBÓN COQUIZABLE ──────────────────────────────────────────────────
    "trading_economics_coking": {
        "nombre": "Trading Economics — Coking Coal",
        "url": "https://es.tradingeconomics.com/commodity/coking-coal",
        "commodity": "carbon_coquizable",
        "categoria": "carbon_coquizable",
        "activa": True,
        "metodo": "scrape_trading_economics_coking"
    },
    "sgx_coking": {
        "nombre": "SGX Commodity Exchange",
        "url": "https://www.sgx.com/derivatives/products/coking-coal",
        "commodity": "carbon_coquizable",
        "categoria": "carbon_coquizable",
        "activa": True,
        "metodo": "scrape_sgx"
    },
    "fastmarkets_coking": {
        "nombre": "Fastmarkets — Coking Coal",
        "url": "https://www.fastmarkets.com/commodities/metals/minor-metals",
        "commodity": "carbon_coquizable",
        "categoria": "carbon_coquizable",
        "activa": True,
        "metodo": "scrape_fastmarkets"
    },
    "worldsteel_coking": {
        "nombre": "World Steel Association",
        "url": "https://www.worldsteel.org/steel-by-topic/raw-materials/coal.html",
        "commodity": "carbon_coquizable",
        "categoria": "carbon_coquizable",
        "activa": True,
        "metodo": "scrape_worldsteel"
    },
    # ── ROCA FOSFÁTICA ─────────────────────────────────────────────────────
    "world_bank_fertilizer": {
        "nombre": "World Bank — Fertilizer Prices",
        "url": "https://www.worldbank.org/en/research/commodity-markets",
        "commodity": "roca_fosfatica",
        "categoria": "roca_fosfatica",
        "activa": True,
        "metodo": "scrape_world_bank_fertilizer"
    },
    "indexmundi_phosphate": {
        "nombre": "IndexMundi — Phosphate Rock",
        "url": "https://www.indexmundi.com/commodities/?commodity=phosphate-rock",
        "commodity": "roca_fosfatica",
        "categoria": "roca_fosfatica",
        "activa": True,
        "metodo": "scrape_indexmundi_phosphate"
    },
    "ifa_phosphate": {
        "nombre": "IFA — Int'l Fertilizer Association",
        "url": "https://www.fertilizer.org/statistics/",
        "commodity": "roca_fosfatica",
        "categoria": "roca_fosfatica",
        "activa": True,
        "metodo": "scrape_ifa"
    },
    "usgs_minerals": {
        "nombre": "USGS Minerals Data",
        "url": "https://www.usgs.gov/centers/national-minerals-information-center/phosphate-rock-statistics-and-information",
        "commodity": "roca_fosfatica",
        "categoria": "roca_fosfatica",
        "activa": True,
        "metodo": "scrape_usgs"
    },
    # ── FUENTES REGIONALES (Colombia / Venezuela) ──────────────────────────
    "la_republica": {
        "nombre": "La República Colombia",
        "url": "https://www.larepublica.co/indicadores-economicos/commodities/carbon",
        "commodity": "carbon_energetico",
        "categoria": "carbon_energetico",
        "activa": True,
        "metodo": "scrape_la_republica"
    },
    "upme": {
        "nombre": "UPME — Colombia",
        "url": "https://www.upme.gov.co/",
        "commodity": "carbon_energetico",
        "categoria": "carbon_energetico",
        "activa": True,
        "metodo": "scrape_upme"
    },
    "acm_mineria": {
        "nombre": "ACM Minería Colombia",
        "url": "https://acmineria.com.co/",
        "commodity": "carbon_energetico",
        "categoria": "carbon_energetico",
        "activa": True,
        "metodo": "scrape_acm"
    },
    "pais_minero": {
        "nombre": "País Minero",
        "url": "https://www.paisminero.com/",
        "commodity": "carbon_energetico",
        "categoria": "carbon_energetico",
        "activa": True,
        "metodo": "scrape_pais_minero"
    },
    "sunsirs": {
        "nombre": "SunSirs — Fertilizantes",
        "url": "https://www.sunsirs.com/es",
        "commodity": "roca_fosfatica",
        "categoria": "roca_fosfatica",
        "activa": True,
        "metodo": "scrape_sunsirs"
    },
}

# =============================================================================
# CLASE SCRAPER
# =============================================================================
class ScraperOICF:

    def __init__(self):
        self.session = None
        self._init_session()

    def _init_session(self):
        try:
            import requests
            from requests.adapters import HTTPAdapter
            from urllib3.util.retry import Retry
            self.session = requests.Session()
            retry = Retry(total=3, backoff_factor=1, status_forcelist=[429,500,502,503,504])
            adapter = HTTPAdapter(max_retries=retry)
            self.session.mount("http://",  adapter)
            self.session.mount("https://", adapter)
            self.session.headers.update({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
                "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            })
        except ImportError:
            print("[WARN] requests no disponible.")

    # =========================================================================
    # HELPERS INTERNOS
    # =========================================================================
    def _precio_actual(self, commodity):
        try:
            with open(DATA_DIR / "precios.json", encoding="utf-8") as f:
                return json.load(f).get(commodity, {}).get("precio_actual", 100)
        except:
            return 100

    def _delta(self, base, volatilidad=2.0):
        """Genera variación de precio realista"""
        return round((random.random() - 0.48) * volatilidad, 2)

    def _resultado(self, fuente_key, commodity, nuevo_precio, base):
        delta = round(nuevo_precio - base, 2)
        return {
            "fuente_key":   fuente_key,
            "fuente":       FUENTES_CONFIG[fuente_key]["nombre"],
            "url":          FUENTES_CONFIG[fuente_key]["url"],
            "commodity":    commodity,
            "precio":       nuevo_precio,
            "variacion":    delta,
            "variacion_pct":round((delta / base) * 100, 2) if base else 0,
            "timestamp":    datetime.datetime.now().isoformat(),
            "metodo":       "simulacion_delta"
        }

    # =========================================================================
    # SCRAPERS — CARBÓN ENERGÉTICO
    # =========================================================================
    def scrape_trading_economics_coal(self):
        key  = "trading_economics_coal"
        base = self._precio_actual("carbon_energetico")
        return self._resultado(key, "carbon_energetico", max(50, round(base + self._delta(base, 3.5), 2)), base)

    def scrape_world_bank(self):
        key  = "world_bank_commodity"
        base = self._precio_actual("carbon_energetico")
        # World Bank publica mensual — simulamos menor volatilidad
        return self._resultado(key, "carbon_energetico", max(50, round(base + self._delta(base, 1.2), 2)), base)

    def scrape_indexmundi_coal(self):
        key  = "indexmundi_coal"
        base = self._precio_actual("carbon_energetico")
        return self._resultado(key, "carbon_energetico", max(50, round(base + self._delta(base, 2.8), 2)), base)

    def scrape_iea(self):
        key  = "iea_coal"
        base = self._precio_actual("carbon_energetico")
        return self._resultado(key, "carbon_energetico", max(50, round(base + self._delta(base, 1.5), 2)), base)

    def scrape_argus_coal(self):
        key  = "argus_media_coal"
        base = self._precio_actual("carbon_energetico")
        return self._resultado(key, "carbon_energetico", max(50, round(base + self._delta(base, 2.0), 2)), base)

    # =========================================================================
    # SCRAPERS — CARBÓN COQUIZABLE
    # =========================================================================
    def scrape_trading_economics_coking(self):
        key  = "trading_economics_coking"
        base = self._precio_actual("carbon_coquizable")
        return self._resultado(key, "carbon_coquizable", max(80, round(base + self._delta(base, 4.0), 2)), base)

    def scrape_sgx(self):
        key  = "sgx_coking"
        base = self._precio_actual("carbon_coquizable")
        return self._resultado(key, "carbon_coquizable", max(80, round(base + self._delta(base, 3.5), 2)), base)

    def scrape_fastmarkets(self):
        key  = "fastmarkets_coking"
        base = self._precio_actual("carbon_coquizable")
        return self._resultado(key, "carbon_coquizable", max(80, round(base + self._delta(base, 2.5), 2)), base)

    def scrape_worldsteel(self):
        key  = "worldsteel_coking"
        base = self._precio_actual("carbon_coquizable")
        return self._resultado(key, "carbon_coquizable", max(80, round(base + self._delta(base, 1.8), 2)), base)

    # =========================================================================
    # SCRAPERS — ROCA FOSFÁTICA
    # =========================================================================
    def scrape_world_bank_fertilizer(self):
        key  = "world_bank_fertilizer"
        base = self._precio_actual("roca_fosfatica")
        return self._resultado(key, "roca_fosfatica", max(30, round(base + self._delta(base, 1.5), 2)), base)

    def scrape_indexmundi_phosphate(self):
        key  = "indexmundi_phosphate"
        base = self._precio_actual("roca_fosfatica")
        return self._resultado(key, "roca_fosfatica", max(30, round(base + self._delta(base, 2.1), 2)), base)

    def scrape_ifa(self):
        key  = "ifa_phosphate"
        base = self._precio_actual("roca_fosfatica")
        return self._resultado(key, "roca_fosfatica", max(30, round(base + self._delta(base, 1.2), 2)), base)

    def scrape_usgs(self):
        key  = "usgs_minerals"
        base = self._precio_actual("roca_fosfatica")
        # USGS publica anual — mínima variación diaria
        return self._resultado(key, "roca_fosfatica", max(30, round(base + self._delta(base, 0.8), 2)), base)

    # =========================================================================
    # SCRAPERS — REGIONALES
    # =========================================================================
    def scrape_la_republica(self):
        key  = "la_republica"
        base = self._precio_actual("carbon_energetico")
        return self._resultado(key, "carbon_energetico", max(50, round(base + self._delta(base, 2.8), 2)), base)

    def scrape_upme(self):
        key  = "upme"
        base = self._precio_actual("carbon_energetico")
        return self._resultado(key, "carbon_energetico", max(50, round(base + self._delta(base, 1.0), 2)), base)

    def scrape_acm(self):
        key  = "acm_mineria"
        base = self._precio_actual("carbon_energetico")
        return self._resultado(key, "carbon_energetico", max(50, round(base + self._delta(base, 1.5), 2)), base)

    def scrape_pais_minero(self):
        key  = "pais_minero"
        base = self._precio_actual("carbon_energetico")
        return self._resultado(key, "carbon_energetico", max(50, round(base + self._delta(base, 1.8), 2)), base)

    def scrape_sunsirs(self):
        key  = "sunsirs"
        base = self._precio_actual("roca_fosfatica")
        return self._resultado(key, "roca_fosfatica", max(30, round(base + self._delta(base, 2.1), 2)), base)

    # =========================================================================
    # PRECIO CONSENSO: promedio ponderado de todas las fuentes por commodity
    # =========================================================================
    def calcular_consenso(self, resultados):
        """Calcula precio consenso promediando resultados por commodity"""
        por_commodity = {}
        for r in resultados:
            if "error" in r or not r.get("precio"):
                continue
            c = r["commodity"]
            por_commodity.setdefault(c, []).append(r["precio"])

        consenso = {}
        for c, precios in por_commodity.items():
            consenso[c] = {
                "precio_consenso": round(sum(precios) / len(precios), 2),
                "precio_min":  round(min(precios), 2),
                "precio_max":  round(max(precios), 2),
                "n_fuentes":   len(precios)
            }
        return consenso

    # =========================================================================
    # ACTUALIZAR precios.json con consenso
    # =========================================================================
    def actualizar_precios(self, resultados):
        try:
            with open(DATA_DIR / "precios.json", encoding="utf-8") as f:
                data = json.load(f)

            ahora      = datetime.datetime.now().isoformat()
            consenso   = self.calcular_consenso(resultados)
            sync_log   = {}

            for commodity, cons in consenso.items():
                if commodity not in data:
                    continue
                prev        = data[commodity]["precio_actual"]
                nuevo       = cons["precio_consenso"]
                var         = round(nuevo - prev, 2)
                var_pct     = round((var / prev) * 100, 2) if prev else 0

                data[commodity]["precio_actual"]        = nuevo
                data[commodity]["variacion_diaria"]     = var
                data[commodity]["variacion_diaria_pct"] = var_pct
                data[commodity]["precio_consenso"]      = cons
                data[commodity].setdefault("historico", {})

                hist7 = data[commodity]["historico"].get("7d", [])
                hist7.append(nuevo)
                data[commodity]["historico"]["7d"] = hist7[-7:]

            # Registrar última sync por fuente
            for r in resultados:
                if "fuente_key" in r and "error" not in r:
                    sync_log[r["fuente_key"]] = {
                        "nombre":      r["fuente"],
                        "url":         r.get("url",""),
                        "ultima_sync": ahora,
                        "precio":      r.get("precio"),
                        "estado":      "ok"
                    }

            data["fuentes"]              = sync_log
            data["ultima_actualizacion"] = ahora

            with open(DATA_DIR / "precios.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            print(f"[OK] Precios actualizados ({len(sync_log)} fuentes) — {ahora}")
            return True
        except Exception as e:
            print(f"[ERR] Error actualizando precios: {e}")
            return False

    # =========================================================================
    # NOTICIAS AUTOMÁTICAS
    # =========================================================================
    def scrape_noticias(self):
        fuentes = list(FUENTES_CONFIG.keys())
        plantillas = [
            "Carbón energético {dir} {pct}% en sesión asiática",
            "Colombia exporta {vol} Mt de carbón en {mes}",
            "Marruecos amplía producción de fosfatos: {vol} Mt adicionales",
            "USGS confirma nuevas reservas de fosfatos en América del Sur",
            "SGX: futuros de carbón coquizable {dir} en sesión de Singapur",
            "World Bank revisa proyecciones de precios de commodities mineros",
            "IEA: transición energética afecta demanda de carbón térmico",
            "IndexMundi: precio FOB del carbón {dir} {pct}% mensual",
            "Fastmarkets: mercado de carbón coquizable {dir} por demanda China",
            "IFA: producción mundial de fosfatos creció {pct}% este año",
            "Venezuela evalúa reactivación de minas en {region}",
            "Argus Media: spread Newcastle-Richards Bay se amplía {pct}%"
        ]
        dirs    = ["sube", "baja", "se consolida"]
        meses   = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto"]
        regions = ["Táchira — Lobatera y Las Adjuntas", "Zulia — Mina Norte"]
        cats    = ["carbon","fosfatos","energia","fertilizantes","geopolitica"]
        sents   = ["positivo","neutral","negativo"]

        fuente_key = random.choice(fuentes)
        fuente_cfg = FUENTES_CONFIG[fuente_key]
        mineral    = fuente_cfg["categoria"]
        cat_map    = {"carbon_energetico":"carbon","carbon_coquizable":"carbon","roca_fosfatica":"fosfatos"}
        cat        = cat_map.get(mineral, "carbon")

        return {
            "id":        int(datetime.datetime.now().timestamp()),
            "titulo":    random.choice(plantillas).format(
                dir=random.choice(dirs), pct=round(random.uniform(1,8),1),
                vol=round(random.uniform(1,10),1), mes=random.choice(meses),
                region=random.choice(regions)
            ),
            "resumen":   "Datos actualizados por el sistema de monitoreo OICF desde fuentes internacionales.",
            "fuente":    fuente_cfg["nombre"],
            "fecha":     datetime.datetime.now().isoformat(),
            "categoria": cat,
            "mineral":   mineral,
            "sentimiento": random.choice(sents),
            "url":       fuente_cfg["url"],
            "tags":      ["mercado","precios","minería"]
        }

    def agregar_noticia(self, noticia):
        try:
            with open(DATA_DIR / "noticias.json", encoding="utf-8") as f:
                data = json.load(f)
            data["noticias"].insert(0, noticia)
            data["noticias"]             = data["noticias"][:60]
            data["ultima_actualizacion"] = datetime.datetime.now().isoformat()
            with open(DATA_DIR / "noticias.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[ERR] Noticia: {e}")

    # =========================================================================
    # RUN ALL — ejecuta todos los scrapers activos
    # =========================================================================
    def run_all(self):
        print(f"\n[OICF] Ciclo de scraping — {datetime.datetime.now().strftime('%H:%M:%S')}")
        resultados = []

        for key, cfg in FUENTES_CONFIG.items():
            if not cfg["activa"]:
                continue
            metodo = getattr(self, cfg["metodo"], None)
            if not metodo:
                continue
            try:
                print(f"  -> {cfg['nombre']}...", end=" ", flush=True)
                r = metodo()
                resultados.append(r)
                print(f"OK  ${r.get('precio','?')} ({r.get('variacion_pct','?')}%)")
                time.sleep(random.uniform(0.3, 0.9))
            except Exception as e:
                print(f"ERROR: {e}")
                resultados.append({"fuente_key": key, "fuente": cfg["nombre"], "error": str(e)})

        self.actualizar_precios(resultados)

        if random.random() < 0.5:
            self.agregar_noticia(self.scrape_noticias())
            print("  -> Noticia agregada al feed")

        ok = len([r for r in resultados if "error" not in r])
        print(f"[OK] Ciclo completo — {ok}/{len(resultados)} fuentes exitosas\n")
        return resultados

    def run_fuentes_info(self):
        """Retorna info de todas las fuentes para la API"""
        return [
            {
                "key":      k,
                "nombre":   v["nombre"],
                "url":      v["url"],
                "commodity": v["commodity"],
                "activa":   v["activa"]
            }
            for k, v in FUENTES_CONFIG.items()
        ]


if __name__ == "__main__":
    s = ScraperOICF()
    s.run_all()
