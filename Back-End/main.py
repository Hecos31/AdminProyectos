from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 1. Importar todos los enrutadores desde la carpeta routers
from routers import usuarios, proyectos, tareas, mensajes, ai, notificaciones

# 2. Inicializar la aplicación
app = FastAPI(title="API AdminProyectos - Órbita")

# 3. Configuración de CORS
origins = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://orbitapwa.netlify.app",
    "https://orbitaprogresiva.netlify.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*(\.netlify\.app|\.onrender\.com)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Endpoint raíz
@app.get("/", tags=["Root"])
def root():
    return {
        "status": "ok",
        "app": "Órbita API",
        "service": "online",
        "docs": "/docs"
    }

# Endpoint de salud para Render / Monitoreo
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "app": "Órbita API", "service": "online"}

# 4. Registrar las rutas (Endpoints)
app.include_router(usuarios.router)
app.include_router(proyectos.router)
app.include_router(tareas.router)
app.include_router(mensajes.router)
app.include_router(ai.router)
app.include_router(notificaciones.router)
