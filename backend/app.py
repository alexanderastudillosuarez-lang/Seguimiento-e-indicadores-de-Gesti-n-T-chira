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

@app.route("/api/deploy", methods=["POST"])
def api_deploy():
    """Dispara un Manual Deploy en Render via Deploy Hook (URL en variable de entorno RENDER_DEPLOY_HOOK_URL)."""
    hook_url = os.environ.get("RENDER_DEPLOY_HOOK_URL")
    if not hook_url:
        return jsonify({"ok": False, "error": "RENDER_DEPLOY_HOOK_URL no configurada en el servidor"}), 501
    try:
        import requests
        resp = requests.post(hook_url, timeout=10)
        return jsonify({"ok": resp.ok, "status": resp.status_code})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

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

MINERAL_INFO = {
    "carbon_energetico": {
        "nombre": "Carbón Energético (Newcastle)",
        "mercado_mundial": "Demandado principalmente para generación eléctrica. China, India e Indonesia concentran la mayor producción y consumo; Australia, Rusia y EE.UU. son grandes exportadores. Colombia exporta a Europa y América.",
        "drivers": "Demanda eléctrica de China e India, política energética europea (transición vs. seguridad de suministro) y costos de flete marítimo.",
    },
    "carbon_coquizable": {
        "nombre": "Carbón Coquizable (Premium HCC)",
        "mercado_mundial": "Insumo clave para la producción de acero en altos hornos. La demanda está ligada al ciclo siderúrgico mundial, liderado por China, India y la Unión Europea. Australia es el principal exportador.",
        "drivers": "Producción mundial de acero crudo, exportaciones australianas y sustitución gradual por procesos de reducción directa (DRI).",
    },
    "roca_fosfatica": {
        "nombre": "Roca Fosfática",
        "mercado_mundial": "Materia prima esencial para fertilizantes fosfatados. La demanda es estacional, ligada a los ciclos de siembra en América Latina, Brasil y EE.UU. Marruecos (OCP) domina la oferta mundial.",
        "drivers": "Ciclos de siembra y demanda de fertilizantes, política de exportación de China y capacidad de Marruecos y Rusia.",
    },
}

# Proyecciones ilustrativas de precio a distintos horizontes (variación % vs. precio actual)
PROYECCIONES_PCT = {
    "carbon_energetico": {"30d": -8.5,  "90d": -15.2, "180d": -22.0, "365d": -28.0},
    "carbon_coquizable": {"30d": -6.0,  "90d": -10.5, "180d": -16.0, "365d": -21.0},
    "roca_fosfatica":    {"30d":  3.5,  "90d":   6.8, "180d":  11.0, "365d":  15.0},
}

BREAK_EVEN_TACHIRA_USD = 60


def _grafico_historico_buffer(precios, key, periodo, color):
    """Genera un gráfico de línea con la evolución histórica de un mineral y lo retorna como buffer PNG."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from io import BytesIO

    hist = precios.get(key, {}).get("historico", {})
    data = hist.get(periodo) or hist.get("30d") or hist.get("7d") or []
    if not data:
        return None

    fig, ax = plt.subplots(figsize=(6.4, 2.4), dpi=130)
    ax.plot(range(len(data)), data, color=color, linewidth=2)
    ax.fill_between(range(len(data)), data, min(data), color=color, alpha=0.12)
    ax.set_title(MINERAL_INFO[key]["nombre"], fontsize=10, loc="left", color="#1e3a5f")
    ax.set_ylabel("USD/Ton", fontsize=8)
    ax.tick_params(labelsize=7)
    ax.grid(True, color="#e2e8f0", linewidth=0.6)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    fig.tight_layout()

    buf = BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    return buf


@app.route("/api/report/<tipo>")
def api_report(tipo):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image, PageBreak
        from reportlab.lib.units import cm

        with open(DATA_DIR / "precios.json", encoding="utf-8") as f:
            precios = json.load(f)
        with open(DATA_DIR / "produccion.json", encoding="utf-8") as f:
            produccion = json.load(f)

        filename = f"OTM_Informe_{tipo}_{datetime.date.today().isoformat()}.pdf"
        filepath = REPORTS_DIR / filename

        doc = SimpleDocTemplate(str(filepath), pagesize=A4,
              leftMargin=1.8*cm, rightMargin=1.8*cm, topMargin=1.8*cm, bottomMargin=1.8*cm)

        styles = getSampleStyleSheet()
        story  = []

        # Estilos
        title_style = ParagraphStyle('Title', parent=styles['Title'],
            fontSize=20, textColor=colors.HexColor('#0d6efd'), spaceAfter=6)
        subtitle_style = ParagraphStyle('Sub', parent=styles['Normal'],
            fontSize=10, textColor=colors.grey, spaceAfter=14)
        h2_style = ParagraphStyle('H2', parent=styles['Heading2'],
            textColor=colors.HexColor('#1e3a5f'), fontSize=13, spaceAfter=8, spaceBefore=16)
        h3_style = ParagraphStyle('H3', parent=styles['Heading3'],
            textColor=colors.HexColor('#0d6efd'), fontSize=11, spaceAfter=4, spaceBefore=10)
        body_style = ParagraphStyle('Body', parent=styles['Normal'],
            fontSize=9.5, leading=14, spaceAfter=8)
        small_style = ParagraphStyle('Small', parent=styles['Normal'],
            fontSize=8.5, leading=12, textColor=colors.HexColor('#475569'), spaceAfter=6)

        tipo_label = {"diario":"Diario","semanal":"Semanal","mensual":"Mensual","ejecutivo":"Ejecutivo Completo"}.get(tipo, tipo.title())
        periodo_chart = {"diario":"30d","semanal":"90d","mensual":"365d","ejecutivo":"365d"}.get(tipo, "30d")

        # ---------------------------------------------------------------
        # PORTADA
        # ---------------------------------------------------------------
        story.append(Paragraph("OTM — Observatorio Tachirense de Minería", title_style))
        story.append(Paragraph(
            f"Informe {tipo_label} · {datetime.date.today().strftime('%d de %B de %Y')}<br/>"
            f"Carbón Energético · Carbón Coquizable · Roca Fosfática &nbsp;|&nbsp; "
            f"Colombia · Venezuela · Estado Táchira", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#0d6efd')))
        story.append(Spacer(1, 10))

        # ---------------------------------------------------------------
        # 1. PRECIOS DE MERCADO INTERNACIONAL
        # ---------------------------------------------------------------
        story.append(Paragraph("1. Precios de Mercado Internacional", h2_style))
        tabla_data = [["Commodity", "Precio actual\n(USD/Ton)", "Var. Diaria", "Var. Semanal", "Var. Mensual", "Var. Anual", "Mín / Máx histórico"]]
        for key in ["carbon_energetico","carbon_coquizable","roca_fosfatica"]:
            c = precios.get(key, {})
            tabla_data.append([
                c.get("nombre", MINERAL_INFO[key]["nombre"]),
                f"${c.get('precio_actual',0):.2f}",
                f"{c.get('variacion_diaria_pct',0):+.2f}%",
                f"{c.get('variacion_semanal_pct',0):+.2f}%",
                f"{c.get('variacion_mensual_pct',0):+.1f}%",
                f"{c.get('variacion_anual_pct',0):+.1f}%",
                f"${c.get('min_historico',0):.2f} / ${c.get('max_historico',0):.2f}"
            ])
        t = Table(tabla_data, colWidths=[4.6*cm,2.1*cm,1.9*cm,1.9*cm,1.9*cm,1.9*cm,3.2*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#0d6efd')),
            ('TEXTCOLOR',(0,0),(-1,0),colors.white),
            ('FONTSIZE',(0,0),(-1,-1),8),
            ('GRID',(0,0),(-1,-1),0.5,colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f8fafc')]),
            ('ALIGN',(1,0),(-1,-1),'CENTER'),
            ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ]))
        story.append(t)
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            "Precios de referencia internacional (Newcastle para carbón, CFR/BPL para fosfatos). "
            "El rango histórico permite ubicar el precio actual respecto a sus extremos de los últimos años.",
            small_style))

        # ---------------------------------------------------------------
        # 2. GRÁFICAS DE EVOLUCIÓN HISTÓRICA
        # ---------------------------------------------------------------
        story.append(Paragraph("2. Evolución Histórica de Precios", h2_style))
        colores_chart = {"carbon_energetico": "#3b82f6", "carbon_coquizable": "#8b5cf6", "roca_fosfatica": "#22c55e"}
        for key in ["carbon_energetico","carbon_coquizable","roca_fosfatica"]:
            buf = _grafico_historico_buffer(precios, key, periodo_chart, colores_chart[key])
            if buf:
                story.append(Image(buf, width=16.5*cm, height=6.2*cm))
                story.append(Spacer(1, 2))

        story.append(PageBreak())

        # ---------------------------------------------------------------
        # 3. ANÁLISIS DE MERCADO MUNDIAL POR MINERAL
        # ---------------------------------------------------------------
        story.append(Paragraph("3. Análisis de Mercado Mundial por Mineral", h2_style))
        for key in ["carbon_energetico","carbon_coquizable","roca_fosfatica"]:
            c = precios.get(key, {})
            info = MINERAL_INFO[key]
            rango_pos = ""
            mn, mx = c.get("min_historico"), c.get("max_historico")
            if mn and mx and mx > mn:
                pos = round((c.get("precio_actual",0) - mn) / (mx - mn) * 100)
                interp = "cerca de máximos históricos (riesgo de corrección)" if pos >= 80 else \
                         "cerca de mínimos históricos (posible oportunidad de entrada)" if pos <= 20 else "en zona media del rango histórico"
                rango_pos = f" El precio actual se ubica en el percentil {pos}% de su rango histórico, {interp}."
            story.append(Paragraph(info["nombre"], h3_style))
            story.append(Paragraph(
                f"<b>Precio actual:</b> ${c.get('precio_actual',0):.2f} USD/Ton "
                f"(variación diaria {c.get('variacion_diaria_pct',0):+.2f}%, anual {c.get('variacion_anual_pct',0):+.1f}%).{rango_pos}<br/>"
                f"<b>Mercado:</b> {info['mercado_mundial']}<br/>"
                f"<b>Factores a vigilar:</b> {info['drivers']}", body_style))

        # ---------------------------------------------------------------
        # 4. MERCADO LATINOAMERICANO — COLOMBIA
        # ---------------------------------------------------------------
        story.append(Paragraph("4. Mercado Latinoamericano: Colombia", h2_style))
        col = produccion.get("colombia", {})
        prod_t = col.get("produccion_trimestral_mt",[0,0,0,0])
        exp_t  = col.get("exportaciones_mt",[0,0,0,0])
        story.append(Paragraph(
            f"Producción anual estimada: <b>{sum(prod_t):.1f} Mt</b> · Exportaciones: <b>{sum(exp_t):.1f} Mt</b> · "
            f"Regalías: <b>COP {sum(col.get('regalias_cop_billones',[])):.2f} Billones</b> · "
            f"Valor FOB: <b>USD ${sum(col.get('valor_fob_usd_millones',[])):.0f}M</b>", body_style))

        por_mineral = col.get("por_mineral", {})
        if por_mineral:
            tabla_col = [["Mineral", "Producción anual (Mt)", "Exportaciones (Mt)", "Valor FOB (USD M)", "Principal depto. productor"]]
            for mkey, m in por_mineral.items():
                deptos = m.get("departamentos_productores", {})
                top_depto = max(deptos.items(), key=lambda kv: kv[1].get("produccion_pct",0))[0] if deptos else "—"
                tabla_col.append([
                    m.get("nombre", mkey),
                    f"{sum(m.get('produccion_trimestral_mt',[])):.2f}",
                    f"{sum(m.get('exportaciones_mt',[])):.2f}",
                    f"{sum(m.get('valor_fob_usd_millones',[])):.0f}",
                    top_depto
                ])
            tc = Table(tabla_col, colWidths=[4.5*cm,3.3*cm,3.3*cm,3.3*cm,3.4*cm])
            tc.setStyle(TableStyle([
                ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#0d6efd')),
                ('TEXTCOLOR',(0,0),(-1,0),colors.white),
                ('FONTSIZE',(0,0),(-1,-1),8),
                ('GRID',(0,0),(-1,-1),0.5,colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f8fafc')]),
                ('ALIGN',(1,0),(-1,-1),'CENTER'),
            ]))
            story.append(Spacer(1,4))
            story.append(tc)

        # ---------------------------------------------------------------
        # 5. MERCADO VENEZOLANO (incluye Táchira)
        # ---------------------------------------------------------------
        story.append(Paragraph("5. Mercado Venezolano", h2_style))
        ven = produccion.get("venezuela", {})
        zulia = ven.get("carbon", {}).get("zulia", {})
        story.append(Paragraph(
            f"<b>Carbón Zulia:</b> producción estimada {zulia.get('produccion_estimada_mt',0)} Mt/año, "
            f"reservas {zulia.get('reservas_mt',0)} Mt. Proyectos: {', '.join(zulia.get('proyectos',[]))}. "
            f"Estado: {zulia.get('estado','—')}.", body_style))

        story.append(Paragraph("5.1 Estado Táchira — Yacimientos Carboníferos", h3_style))
        tach_carbon = ven.get("carbon", {}).get("tachira", {})
        yac = tach_carbon.get("yacimientos", [])
        if yac:
            tabla_yac = [["Yacimiento", "Municipio", "Tipo", "Reservas (Mt)", "Recursos (Mt)", "Total (Mt)"]]
            for y in yac:
                tabla_yac.append([
                    y.get("nombre",""), y.get("municipio",""), y.get("tipo","").title(),
                    f"{y.get('reservas_mt',0):.2f}", f"{y.get('recursos_mt',0):.2f}", f"{y.get('total_mt',0):.2f}"
                ])
            ty = Table(tabla_yac, colWidths=[5.5*cm,2.8*cm,2.3*cm,2.3*cm,2.3*cm,2.1*cm])
            ty.setStyle(TableStyle([
                ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#1e3a5f')),
                ('TEXTCOLOR',(0,0),(-1,0),colors.white),
                ('FONTSIZE',(0,0),(-1,-1),7.5),
                ('GRID',(0,0),(-1,-1),0.5,colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f8fafc')]),
                ('ALIGN',(3,0),(-1,-1),'CENTER'),
            ]))
            story.append(ty)
            story.append(Spacer(1,2))
            story.append(Paragraph(
                f"Fuente: {tach_carbon.get('fuente','Gabinete de Minería - Gobernación del Táchira, 2023')}. "
                f"Total certificado: {sum(y.get('total_mt',0) for y in yac):.2f} Mt.", small_style))

        story.append(Paragraph("5.2 Estado Táchira — Yacimientos de Roca Fosfática", h3_style))
        fosf = ven.get("fosfatos", {})
        if fosf:
            tabla_f = [["Yacimiento", "Municipio", "Reservas (Mt)", "Recursos (Mt)", "Total (Mt)", "Ley P₂O₅"]]
            for fkey, f in fosf.items():
                tabla_f.append([
                    f.get("nombre",""), f.get("municipio",""),
                    f"{f.get('reservas_mt',0):.2f}", f"{f.get('recursos_mt',0):.2f}", f"{f.get('total_mt',0):.2f}",
                    f"{f.get('ley_p2o5_pct','—')}%" if f.get('ley_p2o5_pct') else "—"
                ])
            tf = Table(tabla_f, colWidths=[5.5*cm,2.8*cm,2.3*cm,2.3*cm,2.3*cm,2.1*cm])
            tf.setStyle(TableStyle([
                ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#1e3a5f')),
                ('TEXTCOLOR',(0,0),(-1,0),colors.white),
                ('FONTSIZE',(0,0),(-1,-1),7.5),
                ('GRID',(0,0),(-1,-1),0.5,colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f8fafc')]),
                ('ALIGN',(2,0),(-1,-1),'CENTER'),
            ]))
            story.append(tf)

        story.append(PageBreak())

        # ---------------------------------------------------------------
        # 6. PANEL ESTRATÉGICO TÁCHIRA — POTENCIAL DE INVERSIÓN
        # ---------------------------------------------------------------
        story.append(Paragraph("6. Panel Estratégico Táchira — Potencial de Inversión", h2_style))
        tach = produccion.get("tachira_estrategico", {})
        cp   = tach.get("potencial_carbonifero", {})
        fp   = tach.get("potencial_fosfatico", {})
        story.append(Paragraph(
            f"<b>Carbón:</b> {cp.get('reservas_probadas_mt',0)} Mt probadas + {cp.get('reservas_probables_mt',0)} Mt probables "
            f"= {cp.get('reservas_totales_mt',0)} Mt totales. Tipo: {cp.get('tipo_carbon','—')}. "
            f"Poder calorífico: {cp.get('poder_calorifico_kcal_kg','—')} kcal/kg. "
            f"Mercados objetivo: {', '.join(cp.get('mercados_objetivo',[]))}. "
            f"Precio de referencia: ${cp.get('precio_referencia_actual',0)}/Ton. "
            f"<b>Ingreso potencial anual: USD ${cp.get('ingreso_potencial_anual_musd',0)}M.</b><br/><br/>"
            f"<b>Fosfatos (Monte Fresco / Los Monos-Navay):</b> {fp.get('reservas_totales_mt',0)} Mt totales "
            f"con ley promedio {fp.get('ley_promedio_pct_p2o5',0)}% P₂O₅. "
            f"Mercados objetivo: {', '.join(fp.get('mercados_objetivo',[]))}. "
            f"Precio de referencia: ${fp.get('precio_referencia_actual',0)}/Ton. "
            f"<b>Ingreso potencial anual: USD ${fp.get('ingreso_potencial_anual_musd',0)}M.</b>", body_style))

        compet = tach.get("competidores_regionales", {})
        if compet:
            story.append(Paragraph("6.1 Comparación Regional de Competidores", h3_style))
            tabla_cmp = [["País", "Prod. carbón (Mt)", "Prod. fosfato (Mt)", "Fortalezas / Debilidades"]]
            for pais, d in compet.items():
                obs = ", ".join(d.get("fortalezas", d.get("debilidades", [])))
                tabla_cmp.append([pais, f"{d.get('produccion_mt',0)}", f"{d.get('produccion_fosfato_mt',0)}", obs])
            tcmp = Table(tabla_cmp, colWidths=[3.5*cm,3*cm,3*cm,7.8*cm])
            tcmp.setStyle(TableStyle([
                ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#1e3a5f')),
                ('TEXTCOLOR',(0,0),(-1,0),colors.white),
                ('FONTSIZE',(0,0),(-1,-1),8),
                ('GRID',(0,0),(-1,-1),0.5,colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f8fafc')]),
                ('VALIGN',(0,0),(-1,-1),'TOP'),
            ]))
            story.append(tcmp)

        # ---------------------------------------------------------------
        # 7. PROSPECTIVA / PROYECCIONES DE PRECIO
        # ---------------------------------------------------------------
        story.append(Paragraph("7. Prospectiva de Precios", h2_style))
        tabla_proy = [["Mineral", "Precio actual", "Proy. 30 días", "Proy. 90 días", "Proy. 180 días", "Proy. 365 días"]]
        for key in ["carbon_energetico","carbon_coquizable","roca_fosfatica"]:
            c = precios.get(key, {})
            base = c.get("precio_actual", 0)
            proy = PROYECCIONES_PCT[key]
            tabla_proy.append([
                MINERAL_INFO[key]["nombre"],
                f"${base:.2f}",
                f"${base*(1+proy['30d']/100):.2f} ({proy['30d']:+.1f}%)",
                f"${base*(1+proy['90d']/100):.2f} ({proy['90d']:+.1f}%)",
                f"${base*(1+proy['180d']/100):.2f} ({proy['180d']:+.1f}%)",
                f"${base*(1+proy['365d']/100):.2f} ({proy['365d']:+.1f}%)",
            ])
        tp = Table(tabla_proy, colWidths=[4.5*cm,2.3*cm,2.7*cm,2.7*cm,2.7*cm,2.7*cm])
        tp.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#0d6efd')),
            ('TEXTCOLOR',(0,0),(-1,0),colors.white),
            ('FONTSIZE',(0,0),(-1,-1),7.8),
            ('GRID',(0,0),(-1,-1),0.5,colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f8fafc')]),
            ('ALIGN',(1,0),(-1,-1),'CENTER'),
        ]))
        story.append(tp)
        story.append(Spacer(1,4))
        story.append(Paragraph(
            "Proyecciones ilustrativas basadas en tendencias de ciclo de mercado y factores estructurales descritos en la "
            "sección 3. No constituyen asesoría financiera.", small_style))

        # ---------------------------------------------------------------
        # 8. OPORTUNIDADES Y RIESGOS PARA EL INVERSIONISTA
        # ---------------------------------------------------------------
        story.append(Paragraph("8. Oportunidades y Riesgos para el Inversionista", h2_style))
        ce = precios.get("carbon_energetico", {})
        cc = precios.get("carbon_coquizable", {})
        rf = precios.get("roca_fosfatica", {})

        bullets = []
        margen = ce.get("precio_actual",0) - BREAK_EVEN_TACHIRA_USD
        margen_pct = round((margen / BREAK_EVEN_TACHIRA_USD) * 100) if BREAK_EVEN_TACHIRA_USD else 0
        bullets.append(
            f"<b>Táchira → Caribe (carbón):</b> precio break-even estimado ${BREAK_EVEN_TACHIRA_USD}/Ton vs. precio actual "
            f"${ce.get('precio_actual',0):.2f}/Ton "
            + (f"(margen de +{margen_pct}% sobre el break-even, escenario favorable para inversión)."
               if margen > 0 else f"(margen de {margen_pct}%, por debajo del break-even)."))
        bullets.append(
            f"<b>Fosfatos Monte Fresco → Colombia:</b> Colombia importa roca fosfática; con precio internacional de "
            f"${rf.get('precio_actual',0):.2f}/Ton ({rf.get('variacion_diaria_pct',0):+.2f}% hoy), el yacimiento Monte Fresco "
            f"(Mpio. Ayacucho, Táchira) podría abastecer parte de esa demanda regional.")
        if cc.get("variacion_semanal_pct",0) >= 0:
            bullets.append(
                f"<b>Carbón coquizable:</b> precio ${cc.get('precio_actual',0):.2f}/Ton con variación semanal "
                f"{cc.get('variacion_semanal_pct',0):+.2f}%. Demanda siderúrgica al alza favorece posiciones exportadoras.")
        else:
            bullets.append(
                f"<b>Riesgo carbón coquizable:</b> precio ${cc.get('precio_actual',0):.2f}/Ton con caída semanal "
                f"{cc.get('variacion_semanal_pct',0):+.2f}%. Posible corrección por menor demanda siderúrgica.")
        for key, label in (("carbon_energetico","Carbón Energético"),("carbon_coquizable","Carbón Coquizable"),("roca_fosfatica","Roca Fosfática")):
            c = precios.get(key, {})
            mx = c.get("max_historico")
            if mx and c.get("precio_actual",0) >= mx*0.95:
                bullets.append(f"<b>Riesgo de corrección — {label}:</b> precio (${c.get('precio_actual',0):.2f}/Ton) cerca de su máximo histórico (${mx:.2f}/Ton).")
        bullets.append("<b>Geopolítica favorable:</b> las sanciones a Rusia crean un vacío que Colombia y Venezuela pueden ocupar en mercados asiáticos.")
        bullets.append(
            "<b>Marco regulatorio (Venezuela):</b> las alianzas estratégicas de pequeña, mediana y gran minería habilitadas en Táchira "
            "ofrecen vías de asociación para inversionistas interesados en los yacimientos de carbón y fosfatos descritos en la sección 5.")

        for b in bullets:
            story.append(Paragraph(f"• {b}", body_style))

        story.append(Spacer(1,12))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Spacer(1,6))
        story.append(Paragraph(
            f"Generado automáticamente por OTM Engine · {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')} · "
            f"Datos de referencia internacional y fuentes oficiales (Gabinete de Minería - Gobernación del Táchira, 2023). "
            f"Este informe es de carácter informativo y no constituye asesoría financiera o de inversión.",
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=7.5, textColor=colors.grey)))

        doc.build(story)
        return send_file(str(filepath), as_attachment=True, download_name=filename, mimetype="application/pdf")

    except ImportError as e:
        return jsonify({"error": f"Dependencia no instalada: {e}"}), 500
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
