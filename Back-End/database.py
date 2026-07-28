import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from motor.motor_asyncio import AsyncIOMotorClient

# --- POSTGRESQL ---
password = urllib.parse.quote_plus("1234")
DATABASE_URL = f"postgresql://postgres:{password}@localhost:5432/AdminProyectosBD"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- MONGODB ---
MONGO_URL = "mongodb://bran:bran123456@localhost:27017/?authSource=admin"
client = AsyncIOMotorClient(MONGO_URL)
db_mongo = client.chat_db