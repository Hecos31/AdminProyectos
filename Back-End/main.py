from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from fastapi.staticfiles import StaticFiles # Descomentar si usas archivos estáticos

# Importar los enrutadores desde la carpeta routers
from routers import usuarios, proyectos, tareas, mensajes, ai

app = FastAPI(title="API AdminProyectos")

# Configuración de CORS para permitir solicitudes desde el frontend Angular 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# # Configuración de CORS para permitir solicitudes desde el frontend Angular a través del túnel ngrok
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["https://paying-anagram-bauble.ngrok-free.dev"],  # tu túnel del frontend
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# Registrar las rutas (Endpoints) de cada módulo
app.include_router(usuarios.router)
app.include_router(proyectos.router)
app.include_router(tareas.router)
app.include_router(mensajes.router)
app.include_router(ai.router)

# Si necesitas montar los estáticos de Angular (descomentar si es necesario)
# app.mount("/", StaticFiles(directory="../Front-End/FrontAdminProyectos/dist/front-admin-proyectos/browser", html=True), name="static")

