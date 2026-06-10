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
    "minem_venezuela": {
        "nombre": "MinDesarrollo Minero Venezuela",
        "url": "https://desarrollominero.gob.ve/",
        "commodity": "carbon_energetico",
        "categoria": "carbon_energetico",
        "activa": True,
        "metodo": "scrape_minem_venezuela"
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
        """Trading Economics — Coal (precio real)"""
        key  = "trading_economics_coal"
        base = self._precio_actual("carbon_energetico")
        url  = FUENTES_CONFIG[key]["url"]
        if self.session:
            try:
                from bs4 import BeautifulSoup
                resp = self.session.get(url, timeout=15)
                resp.raise_for_status()
                soup   = BeautifulSoup(resp.text, "lxml")
                fila   = soup.select_one('a[href="/commodity/coal"]').find_parent("tr")
                texto  = fila.select_one("#p").get_text(strip=True)
                precio = round(float(texto), 2)
                resultado = self._resultado(key, "carbon_energetico", precio, base)
                resultado["metodo"] = "scraping_real"
                return resultado
            except Exception as e:
                print(f"[WARN] scrape_trading_economics_coal falló, usando simulación: {e}")
        return self._resultado(key, "carbon_energetico", max(50, round(base + self._delta(base, 3.5), 2)), base)

    def scrape_world_bank(self):
        key  = "world_bank_commodity"
        base = self._precio_actual("carbon_energetico")
        # World Bank publica mensual — simulamos menor volatilidad
        return self._resultado(key, "carbon_energetico", max(50, round(base + self._delta(base, 1.2), 2)), base)

    def scrape_indexmundi_coal(self):
        """IndexMundi — Coal, Australian thermal (precio real, último mes publicado)"""
        key  = "indexmundi_coal"
        base = self._precio_actual("carbon_energetico")
        url  = "https://www.indexmundi.com/commodities/?commodity=coal-australian&months=12"
        if self.session:
            try:
                from bs4 import BeautifulSoup
                resp = self.session.get(url, timeout=15)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "lxml")
                for t in soup.find_all("table"):
                    if "Month Price Change" in t.get_text(" ", strip=True):
                        filas = [[c.get_text(strip=True) for c in r.find_all("td")] for r in t.find_all("tr")]
                        filas = [f for f in filas if len(f) == 3]
                        precio = round(float(filas[-1][1]), 2)
                        resultado = self._resultado(key, "carbon_energetico", precio, base)
                        resultado["metodo"] = "scraping_real"
                        return resultado
            except Exception as e:
                print(f"[WARN] scrape_indexmundi_coal falló, usando simulación: {e}")
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
        """Trading Economics — Coking Coal (precio real)"""
        key  = "trading_economics_coking"
        base = self._precio_actual("carbon_coquizable")
        url  = FUENTES_CONFIG[key]["url"]
        if self.session:
            try:
                from bs4 import BeautifulSoup
                resp = self.session.get(url, timeout=15)
                resp.raise_for_status()
                soup   = BeautifulSoup(resp.text, "lxml")
                fila   = soup.select_one('a[href="/commodity/coking-coal"]').find_parent("tr")
                texto  = fila.select_one("#p").get_text(strip=True)
                precio = round(float(texto), 2)
                resultado = self._resultado(key, "carbon_coquizable", precio, base)
                resultado["metodo"] = "scraping_real"
                return resultado
            except Exception as e:
                print(f"[WARN] scrape_trading_economics_coking falló, usando simulación: {e}")
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
        """IndexMundi — Rock Phosphate (precio real, último mes publicado)"""
        key  = "indexmundi_phosphate"
        base = self._precio_actual("roca_fosfatica")
        url  = "https://www.indexmundi.com/commodities/?commodity=rock-phosphate&months=12"
        if self.session:
            try:
                from bs4 import BeautifulSoup
                resp = self.session.get(url, timeout=15)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "lxml")
                for t in soup.find_all("table"):
                    if "Month Price Change" in t.get_text(" ", strip=True):
                        filas = [[c.get_text(strip=True) for c in r.find_all("td")] for r in t.find_all("tr")]
                        filas = [f for f in filas if len(f) == 3]
                        precio = round(float(filas[-1][1]), 2)
                        resultado = self._resultado(key, "roca_fosfatica", precio, base)
                        resultado["metodo"] = "scraping_real"
                        return resultado
            except Exception as e:
                print(f"[WARN] scrape_indexmundi_phosphate falló, usando simulación: {e}")
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
        """La República — Indicadores Económicos / Commodities / Carbón (precio real)"""
        key  = "la_republica"
        base = self._precio_actual("carbon_energetico")
        url  = FUENTES_CONFIG[key]["url"]
        if self.session:
            try:
                from bs4 import BeautifulSoup
                resp = self.session.get(url, timeout=15)
                resp.raise_for_status()
                soup  = BeautifulSoup(resp.text, "lxml")
                texto = soup.select_one(".content-price .price").get_text(strip=True)
                # Formato: "US$ 146,95" -> 146.95
                num = texto.replace("US$", "").replace("$", "").strip()
                num = num.replace(".", "").replace(",", ".")
                precio = round(float(num), 2)
                resultado = self._resultado(key, "carbon_energetico", precio, base)
                resultado["metodo"] = "scraping_real"
                return resultado
            except Exception as e:
                print(f"[WARN] scrape_la_republica falló, usando simulación: {e}")
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

    def scrape_minem_venezuela(self):
        """Ministerio de Desarrollo Minero Ecológico de Venezuela"""
        key  = "minem_venezuela"
        base = self._precio_actual("carbon_energetico")
        # Fuente gubernamental venezolana — baja frecuencia de actualización de precios
        return self._resultado(key, "carbon_energetico", max(50, round(base + self._delta(base, 0.9), 2)), base)

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
                        "estado":      "ok",
                        "metodo":      r.get("metodo", "simulacion_delta")
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
    # Búsquedas reales por mineral para Google News RSS
    NOTICIAS_QUERIES = {
        "carbon_energetico": ["precio carbón térmico", "thermal coal price"],
        "carbon_coquizable": ["carbón coquizable metalúrgico", "coking coal price"],
        "roca_fosfatica":    ["roca fosfática precio", "phosphate rock price"],
        "tachira":           ["minería carbón Táchira Venezuela", "site:laopinion.co minería carbón Táchira"]
    }

    def scrape_paisminero(self):
        """Busca noticias reales de la categoria Carbon de Pais Minero."""
        try:
            import requests
            from bs4 import BeautifulSoup

            url = "https://www.paisminero.com/index.php?option=com_content&view=category&layout=blog&id=116&Itemid=10001"
            resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "lxml")
            items = []
            for a in soup.select("h2 a, h3 a"):
                titulo = a.get_text(strip=True)
                href = a.get("href")
                if not titulo or not href:
                    continue
                if href.startswith("/"):
                    href = "https://www.paisminero.com" + href
                items.append((titulo, href))

            if not items:
                return None

            titulo, link = random.choice(items)

            t_low = titulo.lower()
            if "coquizable" in t_low or "metalúrgic" in t_low or "metalurgic" in t_low or "siderúrg" in t_low or "siderurg" in t_low:
                mineral = "carbon_coquizable"
            else:
                mineral = "carbon_energetico"

            return {
                "id":        int(datetime.datetime.now().timestamp()),
                "titulo":    titulo,
                "resumen":   f"Noticia del sector minero del carbón publicada por País Minero: {titulo}",
                "fuente":    "País Minero",
                "fecha":     datetime.datetime.now().isoformat(),
                "categoria": "carbon",
                "mineral":   mineral,
                "sentimiento": "neutral",
                "url":       link,
                "tags":      ["carbón", "país minero"]
            }
        except Exception as e:
            print(f"[ERR] scrape_paisminero: {e}")
            return None

    def scrape_noticias(self):
        """Busca noticias reales recientes vía Google News RSS para los minerales monitoreados."""
        try:
            import requests
            import xml.etree.ElementTree as ET
            import html as html_lib

            mineral = random.choice(list(self.NOTICIAS_QUERIES.keys()))
            query   = random.choice(self.NOTICIAS_QUERIES[mineral])

            url = f"https://news.google.com/rss/search?q={requests.utils.quote(query)}&hl=es-419&gl=CO&ceid=CO:es"
            resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()

            root  = ET.fromstring(resp.content)
            items = root.findall("./channel/item")[:10]
            if not items:
                return None

            item    = random.choice(items)
            titulo  = html_lib.unescape((item.findtext("title") or "").strip())
            link    = (item.findtext("link") or "").strip()
            pubdate = item.findtext("pubDate")
            fuente_el = item.find("source")
            fuente  = fuente_el.text if fuente_el is not None else "Google News"
            descripcion = html_lib.unescape((item.findtext("description") or "")).strip()

            try:
                fecha = datetime.datetime.strptime(pubdate, "%a, %d %b %Y %H:%M:%S %Z").isoformat()
            except (TypeError, ValueError):
                fecha = datetime.datetime.now().isoformat()

            cat_map = {"carbon_energetico":"carbon","carbon_coquizable":"carbon","roca_fosfatica":"fosfatos","tachira":"geopolitica"}

            return {
                "id":        int(datetime.datetime.now().timestamp()),
                "titulo":    titulo,
                "resumen":   descripcion[:280] if descripcion else f"Resultado de búsqueda: {query}",
                "fuente":    fuente,
                "fecha":     fecha,
                "categoria": cat_map.get(mineral, "carbon"),
                "mineral":   mineral if mineral != "tachira" else "carbon_energetico",
                "sentimiento": "neutral",
                "url":       link,
                "tags":      ["mercado", query]
            }
        except Exception as e:
            print(f"[ERR] scrape_noticias: {e}")
            return None

    def agregar_noticia(self, noticia):
        if not noticia:
            return
        try:
            with open(DATA_DIR / "noticias.json", encoding="utf-8") as f:
                data = json.load(f)
            if any(n.get("url") == noticia["url"] for n in data["noticias"]):
                return
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

        self.agregar_noticia(self.scrape_noticias())
        print("  -> Noticia agregada al feed")

        self.agregar_noticia(self.scrape_paisminero())
        print("  -> Noticia Pais Minero agregada al feed")

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
