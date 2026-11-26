# Astro-Exoplanets

[Español](README.md) · [English](README.en.md)

**Priorización Astrofísica de Exoplanetas, Observabilidad Real desde Observatorios en Chile (`Astropy`) y Análisis de Curvas de Luz Satelitales TESS/Kepler (`Lightkurve` + FastAPI + React 19 / Apache ECharts 6).**

Parte de **Proyecto Tennessee** (*Portafolio de Computación Científica y Astroinformática*) por **Moisés Amundarain** (Laboratorio LIRIA / Universidad San Sebastián).

---

## Pregunta Científica Central

> **¿Qué exoplanetas confirmados maximizan simultáneamente la similitud física con la Tierra (ESI), la viabilidad de caracterización atmosférica por espectroscopía de transmisión (TSM) y la observabilidad astronómica real desde observatorios en Chile (`airmass <= 2.0` en Paranal, La Silla, Las Campanas, CTIO y ALMA), considerando los sesgos instrumentales de descubrimiento?**

---

## Capacidades Principales

1. **Ingesta en Vivo desde NASA Exoplanet Archive + Plan B Resiliente (TLS Estricto):**
   - Consulta la tabla `pscomppars` vía NASA TAP API (`ADQL`, sin API key) con **validación TLS estricta** mediante `certifi` (y soporte opcional de CA institucional vía `ASTRO_CA_BUNDLE` o `REQUESTS_CA_BUNDLE`, sin recurrir nunca a `verify=False`).
   - Ante errores `SSLError` o fallos de red, conmuta automáticamente al Plan B resiliente: copia local verificada (`backend/data/exoplanetas_nasa.csv`, **6.473 exoplanetas confirmados**) o modo determinístico sin conexión (`EXO_FORCE_OFFLINE=1`).
2. **Auditoría Física e Indicadores Astrofísicos:**
   - Audita nulos (`2.580` celdas) y registros físicamente imposibles (`46` registros con `pl_insol <= 0` de imagen directa/no calentados), obteniendo **5.767 exoplanetas analíticos limpios (`89,09 %`)** y **4.184** con **TSM** calculable (Kempton et al., 2018).
   - Calcula **ESI**, **TSM** por tramos radiales, **Zona Habitable** conservadora (`0,36–1,11 S⊕`) y optimista (`0,25–1,50 S⊕`), **Brecha de Fulton**, estadística muestral NumPy (`ddof=1`), correlaciones log-log y matrices de sensibilidad.
3. **Observabilidad Astronómica Real desde Chile (`astropy.coordinates`):**
   - Calcula altura máxima de culminación, masa de aire mínima y horas observables durante 12 meses en cielo oscuro (`altura solar < -18°`, `airmass <= 2.0`) para **Paranal (VLT/ELT)**, **La Silla**, **Las Campanas (Magellan)**, **CTIO** y **ALMA**.
4. **Curvas de Luz Satelitales y Tránsitos Plegados en Fase (`lightkurve` / NASA MAST):**
   - Consulta fotometría pública de **TESS, Kepler y K2** desde NASA MAST, limpia valores atípicos, normaliza el flujo, pliega en fase según el período orbital `pl_orbper` y mantiene caché real en disco para blancos de referencia (`TRAPPIST-1 e`, `LHS 1140 b`, `TOI-700 d`).
5. **Interfaz Dark Romer Bilingüe (`ES` por defecto + `EN`):**
   - Backend desacoplado en **FastAPI (`uv`)** + Frontend en **React 19 / TypeScript / Vite / Apache ECharts 6**, con conmutador instantáneo `ES | EN` sincronizado en parámetros de URL, inspector modal `<dialog>` y exportación CSV protegida contra inyección de fórmulas.

---

## Estructura del Repositorio

```text
Astro-Exoplanets/
├── backend/                     # Python 3.12 gestionado con uv + FastAPI + Astropy + Lightkurve
│   ├── data/
│   │   ├── exoplanetas_nasa.csv # Copia verificada NASA pscomppars (6.473 filas)
│   │   └── lightcurves_cache/   # Curvas de luz MAST reales en caché (JSON)
│   ├── src/astro_exoplanets/
│   │   ├── api_client/          # Clientes NASA TAP (TLS estricto) y MAST Lightkurve
│   │   ├── astrophysics/        # Física ESI/TSM/HZ y observabilidad chilena con Astropy
│   │   ├── statistics/          # Estadística descriptiva NumPy y matrices de sensibilidad
│   │   └── web/                 # API REST FastAPI (/api/v1/*) y esquemas Pydantic
│   └── tests/                   # Suite completa de pruebas pytest
├── frontend/                    # React 19 + TypeScript + Vite + Apache ECharts 6
│   ├── public/assets/           # Ilustraciones astrofísicas conceptuales
│   └── src/                     # Componentes Dark Romer, 5 pestañas, inspector <dialog>, i18n
├── vercel.json                  # Topología Vercel Services Beta (Vite frontend + FastAPI backend)
├── ARCHITECTURE.md              # Documentación de arquitectura de sistemas (ByteByteGo 101)
├── DESIGN.md                    # Constitución visual/UX Dark Romer de 9 secciones
├── AUTHORS.md                   # Autoría y agradecimientos
├── README.en.md                 # Documentación en inglés
└── .github/workflows/ci.yml     # CI automatizado: ruff, bandit, pytest, npm audit y Vite build
```

---

## Inicio Rápido

### 1. Backend (`uv`, Python >= 3.11 / 3.12)

```bash
cd backend
uv sync
EXO_FORCE_OFFLINE=1 uv run uvicorn astro_exoplanets.web.app:app --host 127.0.0.1 --port 8000
```
*(Omite `EXO_FORCE_OFFLINE=1` para consultar NASA TAP y NASA MAST en vivo. Si operas detrás de un proxy institucional con certificado raíz propio, define `ASTRO_CA_BUNDLE=/ruta/a/ca.pem` o `REQUESTS_CA_BUNDLE` en tu `.env`; nunca se desactiva la verificación TLS).*

### 2. Frontend (`Node >= 22`)

```bash
cd frontend
npm install
npm run dev
```
Abre `http://127.0.0.1:5173` en el navegador (Vite redirige `/api` hacia `http://127.0.0.1:8000`).

### 3. Pruebas, Seguridad y Verificación

```bash
cd backend
uv run ruff check src tests
uvx bandit -r src
EXO_FORCE_OFFLINE=1 uv run pytest -v

cd ../frontend
npm audit
npm run build
```

---

## Despliegue en Vercel (`Vercel Services`)

El archivo [`vercel.json`](vercel.json) define la topología unificada mediante **Vercel Services (Beta)** para desplegar ambos servicios bajo el mismo dominio:

- **`frontend`** (`root: "frontend"`, `framework: "vite"`): sirve el bundle estático de React 19 + Apache ECharts 6 con rewrite SPA a `/index.html`.
- **`backend`** (`root: "backend"`, `framework: "fastapi"`, `entrypoint: "main:app"`): expone las rutas `/api/(.*)` excluyendo cachés y pruebas del paquete de función serverless.

Consulta [`ARCHITECTURE.md`](ARCHITECTURE.md) para el diagrama de flujo completo y los trade-offs de seguridad y caché, o cambia a la versión en inglés en [`README.en.md`](README.en.md).

---

## Licencia

Distribuido bajo licencia [Apache 2.0](LICENSE).
