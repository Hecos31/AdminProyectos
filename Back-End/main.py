from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 1. Importar todos los enrutadores desde la carpeta routers
from routers import usuarios, proyectos, tareas, mensajes, ai, notificaciones

# 2. Inicializar la aplicación
app = FastAPI(title="API AdminProyectos - Órbita")

# 3. Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Registrar las rutas (Endpoints)
app.include_router(usuarios.router)
app.include_router(proyectos.router)
app.include_router(tareas.router)
app.include_router(mensajes.router)
app.include_router(ai.router)
app.include_router(notificaciones.router)

# 5. Ruta de comprobación
@app.get("/")
def home():
    return {"estado": "En línea", "mensaje": "Servidor modular funcionando correctamente."}