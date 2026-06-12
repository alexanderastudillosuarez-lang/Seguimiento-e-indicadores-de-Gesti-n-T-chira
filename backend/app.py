"""
OTM - Observatorio Tachirense de Minería
app.py - Servidor Flask principal
"""

import os, sys, json, datetime
from pathlib import Path
from flask import Flask, jsonify, send_from_directory, render_template_string, request, send_file
from flask_cors import CORS

# Forzar UTF-8 en la salida estándar (Windows cp1252 no soporta emojis)
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
REPORTS_DIR = BASE_DIR / "reports"
REPORTS_DIR.mkdir(exist_ok=True)

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
CORS(app)

# ── Intentar iniciar scheduler en background ──────────────────────────────────
try:
    from scheduler import iniciar_scheduler
    iniciar_scheduler()
    print("✅ Scheduler iniciado")
except Exception as e:
    print(f"⚠️  Scheduler no disponible: {e}")

# =============================================================================
# RUTAS DE ARCHIVOS ESTÁTICOS
# =============================================================================

@app.route("/")
def index():
    return send_from_directory(str(BASE_DIR), "index.html")

@app.route("/dashboard")
@app.route("/dashboard.html")
def dashboard():
    return send_from_directory(str(BASE_DIR), "dashboard.html")

@app.route("/login")
@app.route("/login.html")
def login():
    return send_from_directory(str(BASE_DIR), "login.html")

@app.route("/reportes")
@app.route("/reportes.html")
def reportes():
    return send_from_directory(str(BASE_DIR), "reportes.html")

@app.route("/alertas")
@app.route("/alertas.html")
def alertas():
    return send_from_directory(str(BASE_DIR), "alertas.html")

# =============================================================================
# API - PRECIOS
# =============================================================================

def _precios_desactualizados(data, horas=24):
    try:
        ultima = datetime.datetime.fromisoformat(data.get("ultima_actualizacion"))
        return (datetime.datetime.now() - ultima) > datetime.timedelta(hours=horas)
    except (TypeError, ValueError):
        return True

def _disparar_actualizacion_async():
    import threading
    def _run():
        try:
            from scraper import ScraperOICF
            ScraperOICF().run_all()
        except Exception as e:
            print(f"[ERR] Actualizacion automatica: {e}")
    threading.Thread(target=_run, daemon=True).start()

@app.route("/api/precios")
def api_precios():
    try:
        with open(DATA_DIR / "precios.json", encoding="utf-8") as f:
            data = json.load(f)
        if _precios_desactualizados(data):
            _disparar_actualizacion_async()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/precios/<commodity>")
def api_precio_commodity(commodity):
    try:
        with open(DATA_DIR / "precios.json", encoding="utf-8") as f:
            data = json.load(f)
        key_map = {
            "carbon-energetico": "carbon_energetico",
            "carbon-coquizable":  "carbon_coquizable",
            "fosfatos":           "roca_fosfatica",
        }
        key = key_map.get(commodity)
        if key and key in data:
            return jsonify(data[key])
        return jsonify({"error": "Commodity no encontrado"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =============================================================================
# API - NOTICIAS
# =============================================================================

@app.route("/api/noticias")
def api_noticias():
    categoria = request.args.get("categoria", "todos")
    try:
        with open(DATA_DIR / "noticias.json", encoding="utf-8") as f:
            data = json.load(f)
        noticias = data.get("noticias", [])
        if categoria != "todos":
            noticias = [n for n in noticias if n.get("categoria") == categoria]
        return jsonify({"noticias": noticias, "total": len(noticias)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =============================================================================
# API - PRODUCCIÓN
# =============================================================================

@app.route("/api/produccion")
def api_produccion():
    try:
        with open(DATA_DIR / "produccion.json", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/produccion/colombia")
def api_colombia():
    try:
        with open(DATA_DIR / "produccion.json", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data.get("colombia", {}))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/produccion/venezuela")
def api_venezuela():
    try:
        with open(DATA_DIR / "produccion.json", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data.get("venezuela", {}))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/produccion/tachira")
def api_tachira():
    try:
        with open(DATA_DIR / "produccion.json", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data.get("tachira_estrategico", {}))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =============================================================================
# API - ALERTAS
# =============================================================================

@app.route("/api/alertas")
def api_alertas():
    try:
        with open(DATA_DIR / "precios.json", encoding="utf-8") as f:
            precios = json.load(f)

        alertas = []
        for key in ["carbon_energetico", "carbon_coquizable", "roca_fosfatica"]:
            c = precios.get(key, {})
            var_pct = abs(c.get("variacion_diaria_pct", 0))
            nombre  = c.get("nombre", key)
            precio  = c.get("precio_actual", 0)
            max_h   = c.get("max_historico", 9999)
            min_h   = c.get("min_historico", 0)

            if var_pct >= 10:
                alertas.append({"nivel":"critico","commodity":nombre,"mensaje":f"Variación extrema: {c['variacion_diaria_pct']:.1f}% en 24h","ts":datetime.datetime.now().isoformat()})
            elif var_pct >= 5:
                alertas.append({"nivel":"advertencia","commodity":nombre,"mensaje":f"Variación significativa: {c['variacion_diaria_pct']:.1f}% en 24h","ts":datetime.datetime.now().isoformat()})
            if precio >= max_h * 0.98:
                alertas.append({"nivel":"critico","commodity":nombre,"mensaje":f"Precio cerca del máximo histórico (${max_h})","ts":datetime.datetime.now().isoformat()})
            if precio <= min_h * 1.02:
                alertas.append({"nivel":"critico","commodity":nombre,"mensaje":f"Precio cerca del mínimo histórico (${min_h})","ts":datetime.datetime.now().isoformat()})

        if not alertas:
            alertas.append({"nivel":"info","commodity":"General","mensaje":"Mercados estables. Sin alertas activas.","ts":datetime.datetime.now().isoformat()})

        return jsonify({"alertas": alertas, "total": len(alertas)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =============================================================================
# API - SCRAPER MANUAL
# =============================================================================

@app.route("/api/scrape", methods=["POST"])
def api_scrape():
    try:
        from scraper import ScraperOICF
        scraper = ScraperOICF()
        resultado = scraper.run_all()
        return jsonify({"ok": True, "resultado": resultado})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# =============================================================================
# API - REPORTES PDF / EXCEL
# =============================================================================

@app.route("/api/report/<tipo>")
def api_report(tipo):
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.units import cm

        with open(DATA_DIR / "precios.json", encoding="utf-8") as f:
            precios = json.load(f)
        with open(DATA_DIR / "produccion.json", encoding="utf-8") as f:
            produccion = json.load(f)

        filename = f"OICF_Informe_{tipo}_{datetime.date.today().isoformat()}.pdf"
        filepath = REPORTS_DIR / filename

        doc = SimpleDocTemplate(str(filepath), pagesize=A4,
              leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)

        styles = getSampleStyleSheet()
        story  = []

        # Título
        title_style = ParagraphStyle('Title', parent=styles['Title'],
            fontSize=20, textColor=colors.HexColor('#0d6efd'), spaceAfter=6)
        subtitle_style = ParagraphStyle('Sub', parent=styles['Normal'],
            fontSize=10, textColor=colors.grey, spaceAfter=20)
        h2_style = ParagraphStyle('H2', parent=styles['Heading2'],
            textColor=colors.HexColor('#1e3a5f'), fontSize=13, spaceAfter=8, spaceBefore=16)
        body_style = ParagraphStyle('Body', parent=styles['Normal'],
            fontSize=9.5, leading=14, spaceAfter=8)

        tipo_label = {"diario":"Diario","semanal":"Semanal","mensual":"Mensual","ejecutivo":"Ejecutivo Completo"}.get(tipo, tipo.title())
        story.append(Paragraph("⛏️ OTM — Observatorio Tachirense de Minería", title_style))
        story.append(Paragraph(f"Informe {tipo_label} · {datetime.date.today().strftime('%d de %B de %Y')}", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#0d6efd')))
        story.append(Spacer(1, 14))

        # Precios
        story.append(Paragraph("1. Precios de Mercado Internacional", h2_style))
        tabla_data = [["Commodity", "Precio USD/Ton", "Var. Diaria", "Var. Mensual", "Var. Anual"]]
        for key in ["carbon_energetico","carbon_coquizable","roca_fosfatica"]:
            c = precios.get(key, {})
            tabla_data.append([
                c.get("nombre", key),
                f"${c.get('precio_actual',0):.2f}",
                f"{c.get('variacion_diaria_pct',0):+.2f}%",
                f"{c.get('variacion_mensual_pct',0):+.1f}%",
                f"{c.get('variacion_anual_pct',0):+.1f}%"
            ])
        t = Table(tabla_data, colWidths=[6*cm,3*cm,3*cm,3*cm,3*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#0d6efd')),
            ('TEXTCOLOR',(0,0),(-1,0),colors.white),
            ('FONTSIZE',(0,0),(-1,-1),9),
            ('GRID',(0,0),(-1,-1),0.5,colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f8fafc')]),
            ('ALIGN',(1,0),(-1,-1),'CENTER'),
        ]))
        story.append(t)
        story.append(Spacer(1, 12))

        # Colombia
        col = produccion.get("colombia", {})
        story.append(Paragraph("2. Monitor Colombia", h2_style))
        prod_t = col.get("produccion_trimestral_mt",[0,0,0,0])
        exp_t  = col.get("exportaciones_mt",[0,0,0,0])
        story.append(Paragraph(
            f"Producción anual: {sum(prod_t):.1f} Mt | Exportaciones: {sum(exp_t):.1f} Mt | "
            f"Regalías: COP {sum(col.get('regalias_cop_billones',[])):.2f} Billones | "
            f"Valor FOB: USD ${sum(col.get('valor_fob_usd_millones',[])):.0f}M", body_style))

        # Venezuela / Táchira
        story.append(Paragraph("3. Panel Estratégico Táchira", h2_style))
        tach = produccion.get("tachira_estrategico", {})
        cp   = tach.get("potencial_carbonifero", {})
        fp   = tach.get("potencial_fosfatico", {})
        story.append(Paragraph(
            f"<b>Carbón:</b> {cp.get('reservas_probadas_mt',0)} Mt probadas + {cp.get('reservas_probables_mt',0)} Mt probables. "
            f"Ingreso potencial: USD ${cp.get('ingreso_potencial_anual_musd',0)}M/año.<br/>"
            f"<b>Fosfatos Monte Fresco (Mpio. Ayacucho):</b> {fp.get('reservas_monte_fresco_mt',0)} Mt con {fp.get('ley_promedio_pct_p2o5',0)}% P₂O₅. "
            f"Ingreso potencial: USD ${fp.get('ingreso_potencial_anual_musd',0)}M/año.", body_style))

        story.append(Spacer(1,12))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Spacer(1,6))
        story.append(Paragraph(
            f"Generado automáticamente por OTM Engine · {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')} · Datos de referencia internacional",
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=7.5, textColor=colors.grey)))

        doc.build(story)
        return send_file(str(filepath), as_attachment=True, download_name=filename, mimetype="application/pdf")

    except ImportError:
        return jsonify({"error": "ReportLab no instalado. Ejecute: pip install reportlab"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =============================================================================
# API - FUENTES DE DATOS
# =============================================================================

@app.route("/api/fuentes")
def api_fuentes():
    try:
        with open(DATA_DIR / "precios.json", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify({
            "fuentes_registro": data.get("fuentes_registro", {}),
            "fuentes_sync":     data.get("fuentes", {}),
            "ultima_actualizacion": data.get("ultima_actualizacion")
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =============================================================================
# API - STATUS
# =============================================================================

@app.route("/api/status")
def api_status():
    return jsonify({
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.datetime.now().isoformat(),
        "data_files": {
            "precios":    (DATA_DIR / "precios.json").exists(),
            "noticias":   (DATA_DIR / "noticias.json").exists(),
            "produccion": (DATA_DIR / "produccion.json").exists()
        }
    })

# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") != "production"
    print(f"OICF Server — puerto {port} — debug={debug}")
    app.run(host="0.0.0.0", port=port, debug=debug)
