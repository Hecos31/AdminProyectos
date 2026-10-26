import os
import urllib.parse
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from motor.motor_asyncio import AsyncIOMotorClient

# Carga las variables de entorno desde el archivo .env
load_dotenv()

# --- POSTGRESQL ---
# Reemplaza 'TU_PASSWORD' por la clave con la que entras a pgAdmin
URL_BASE_DATOS = "postgresql://postgres:123465@localhost:5432/ProdAdmin"

if not URL_BASE_DATOS:
    raise ValueError(
        "Error: La variable 'DATABASE_URL' no está definida en el archivo .env."
    )

# Creación de motor y sesión de PostgreSQL
engine = create_engine(URL_BASE_DATOS)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- MONGODB ---

MONGO = "mongodb+srv://usuario:usuario@cluster0.qdu0tg4.mongodb.net/?retryWrites=true&w=majority"
client = AsyncIOMotorClient(MONGO)
db_mongo = client.chat_db