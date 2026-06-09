"""
OICF - Punto de entrada WSGI para produccion (Render, Railway, etc.)
"""
import sys
from pathlib import Path

# Agregar backend/ al path para que los imports funcionen
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app import app   # noqa: E402

if __name__ == "__main__":
    app.run()
