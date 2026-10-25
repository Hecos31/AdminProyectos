import urllib.parse
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")
load_dotenv()

# --- POSTGRESQL ---
_default_password = urllib.parse.quote_plus("H3cos31!")
_default_db_url = f"postgresql://postgres:{_default_password}@localhost:5432/ProdAdmin"
URL_BASE_DATOS = (os.getenv("DATABASE_URL") or _default_db_url).strip()

engine = create_engine(URL_BASE_DATOS)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

_default_mongo_url = "mongodb+srv://usuario:orbita123@cluster0.qdu0tg4.mongodb.net/?appName=Cluster0"
MONGO = (os.getenv("MONGO_URL") or _default_mongo_url).strip()
client = AsyncIOMotorClient(MONGO)
db_mongo = client.chat_db
