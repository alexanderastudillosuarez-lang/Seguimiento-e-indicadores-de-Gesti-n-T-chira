"""
OICF - scheduler.py
Actualización automática de datos con APScheduler
"""

import threading, datetime

def iniciar_scheduler():
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from scraper import ScraperOICF

        scraper = ScraperOICF()
        scheduler = BackgroundScheduler(timezone="America/Bogota")

        # Actualizar precios cada 30 minutos en horario de mercado (6am-6pm)
        scheduler.add_job(
            scraper.run_all,
            trigger="cron",
            hour="6-18",
            minute="0,30",
            id="scrape_precios",
            name="Actualizar precios de mercado"
        )

        # Scraping ligero cada hora fuera de horario
        scheduler.add_job(
            scraper.run_all,
            trigger="cron",
            hour="0-5,19-23",
            minute="0",
            id="scrape_offhour",
            name="Actualización fuera de horario"
        )

        scheduler.start()
        print(f"⏰ Scheduler iniciado. Próxima actualización: {_next_run()}")
        return scheduler

    except ImportError:
        print("⚠️  APScheduler no instalado. Ejecute: pip install apscheduler")
        _fallback_scheduler()

def _next_run():
    now = datetime.datetime.now()
    mins = now.minute
    next_30 = 30 if mins < 30 else 60
    delta = next_30 - mins
    return (now + datetime.timedelta(minutes=delta)).strftime("%H:%M")

def _fallback_scheduler():
    """Timer simple sin APScheduler"""
    def _loop():
        import time
        while True:
            time.sleep(30 * 60)   # 30 minutos
            try:
                from scraper import ScraperOICF
                ScraperOICF().run_all()
            except Exception as e:
                print(f"Scheduler error: {e}")

    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    print("⏰ Scheduler fallback iniciado (threading, cada 30 min)")
