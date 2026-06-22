from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String, Boolean, TIMESTAMP
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import jwt
import urllib.parse
import bcrypt  # Cambiado passlib por la librería moderna nativa


# --- CONFIGURACIÓN DE LAS VARIABLES DE ENTORNO  (NO OLVIDAR CONFIGURAR EN SU ENTORNO) ---
password = urllib.parse.quote_plus("H3cos31!") # Cambia esto por tu contraseña de PostgreSQL
DATABASE_URL = f"postgresql://postgres:{password}@localhost:5432/ProdAdmin"  # Cambia esto por tu URL de conexión a PostgreSQL
SECRET_KEY = "tu_clave_secreta_para_los_tokens_2026Pruebas"  # Clave para evitar firmas inválidas en JWT
ALGORITHM = "HS256" # Algoritmo de encriptación para JWT y db
ACCESS_TOKEN_EXPIRE_MINUTES = 60 # Tiempo de expiración del token en minutos

# --- CONFIGURACIÓN DE LA BASE DE DATOS ---
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="STR Authentication API")

# Dependencia para obtener la sesión de la base de datos
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class UsuarioDB(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100))
    apellido = Column(String(100))
    correo = Column(String(150), unique=True, index=True)
    password = Column(String(255))
    fecha_registro = Column(TIMESTAMP, default=datetime.utcnow)


# --- ESQUEMAS PARA CREACIÓN DE USUARIOS ---
class UsuarioCreate(BaseModel):
    nombre: str
    apellido: str
    correo: EmailStr
    password: str  

class UsuarioResponse(BaseModel):
    id_usuario: int
    nombre: str
    apellido: str
    correo: EmailStr

    class Config:
        orm_mode = True



# --- Validación de Datos ---
class LoginRequest(BaseModel):
    correo: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

# --- Seguridad y Autenticación ---
def verificar_password(plain_password: str, hashed_password: str) -> bool:
    # Convertimos los strings a bytes para la validación nativa de bcrypt
    plain_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_bytes, hashed_bytes)

def obtener_password_hash(password: str) -> str:
    # Generamos el salt y encriptamos usando los bytes del texto plano
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def crear_token_acceso(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- ENDPOINT DE LOGIN ---
@app.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    # 1. Buscar al usuario por correo electrónico
    usuario = db.query(UsuarioDB).filter(UsuarioDB.correo == login_data.correo).first()
    
    # 2. Validar si el usuario existe
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    

    # 3. Verificar la contraseña
    if not verificar_password(login_data.password, usuario.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 5. Generar el JWT Token
    tiempo_expiracion = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_acceso = crear_token_acceso(
        data={"sub": str(usuario.id_usuario), "email": usuario.correo}, 
        expires_delta=tiempo_expiracion
    )
    
    # 6. Responder con el Token
    return {"access_token": token_acceso, "token_type": "bearer"}



# --- ENDPOINT DE CREACIÓN DE USUARIOS ---

@app.post("/CrearUsuarios", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(usuario_in: UsuarioCreate, db: Session = Depends(get_db)):
    # 1. Verificar si el correo ya está registrado en la base de datos
    usuario_existente = db.query(UsuarioDB).filter(UsuarioDB.correo == usuario_in.correo).first()
    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico ya está registrado."
        )
    
    # 2. Encriptar la contraseña de forma segura con bcrypt
    password_encriptada = obtener_password_hash(usuario_in.password)
    
    # 3. Crear la instancia del modelo de SQLAlchemy mapeando los campos de tu BD
    nuevo_usuario = UsuarioDB(
        nombre=usuario_in.nombre,
        apellido=usuario_in.apellido,
        correo=usuario_in.correo,
        password=password_encriptada,  # Guardamos la contraseña ya encriptada 
        # fecha_registro se llena automáticamente por el 'default=datetime.utcnow' en el modelo
    )
    
    # 4. Guardar en la base de datos y confirmar 
    try:
        db.add(nuevo_usuario)
        db.commit()
        db.refresh(nuevo_usuario)  # Refresca para obtener el id_usuario generado por el SERIAL de Postgres
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al registrar el usuario en la base de datos."
        )
    
    # 5. Retornar el usuario creado (Pydantic lo filtrará usando 'UsuarioResponse' para no mostrar el password)
    return nuevo_usuario