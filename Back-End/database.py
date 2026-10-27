import os
import urllib.parse
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from motor.motor_asyncio import AsyncIOMotorClient

# Carga las variables de entorno desde el archivo .env
load_dotenv()

# --- POSTGRESQL (Supabase / Render / Local) ---
URL_BASE_DATOS = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.tqhnvyelbsuprzwjbgnt:H3cos31!3131@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
)

# Creación de motor y sesión de PostgreSQL
engine = create_engine(
    URL_BASE_DATOS,
    pool_pre_ping=True,
    pool_recycle=300
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- MONGODB (Atlas / Render / Local) ---
MONGO = os.getenv(
    "MONGO_URL",
    "mongodb+srv://hectordz515_db_user:xRGQZTbCJjZDEAGp@adminproyects.gchwlbi.mongodb.net/?retryWrites=true&w=majority&tls=true&tlsAllowInvalidCertificates=true"
)
client = AsyncIOMotorClient(MONGO)
db_mongo = client.chat_db
