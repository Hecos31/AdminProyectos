from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String, Boolean, TIMESTAMP
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from fastapi.middleware.cors import CORSMiddleware
from enum import Enum
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship
import jwt
import urllib.parse
import bcrypt  
import sqlalchemy

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



app = FastAPI(title="API")

# Configuración de CORS para permitir solicitudes desde el frontend Angular 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    
    
    
# Enum para restringir los estados permitidos de la tarea
class EstadoTarea(str, Enum):
    ASIGNADA = "Asignada"
    PENDIENTE = "Pendiente por asignar"
    CONCLUIDA = "Concluida"

# Enum para restringir las prioridades permitidas de la tarea
class PrioridadTarea(str, Enum):
    BAJA = "Baja"
    MEDIA = "Media"
    ALTA = "Alta"


# --- MODELO DE SQLALCHEMY DE TAREAS ---
class TareaDB(Base):
    __tablename__ = "tareas"

    id_tarea = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_proyecto = Column(Integer, ForeignKey("proyectos.id_proyecto"), nullable=False)
    titulo = Column(String(200), nullable=False)
    descripcion = Column(String)  # Mapea tu tipo 'text'
    prioridad = Column(String(20))
    estado = Column(String(30), default=EstadoTarea.PENDIENTE.value)
    fecha_inicio = Column(TIMESTAMP, nullable=True)
    fecha_limite = Column(TIMESTAMP, nullable=True)

# --- ESQUEMAS PARA CREACIÓN DE TAREAS ---
class TareaCreate(BaseModel):
    id_proyecto: int
    titulo: str
    descripcion: Optional[str] = None
    prioridad: PrioridadTarea = PrioridadTarea.MEDIA
    estado: EstadoTarea = EstadoTarea.PENDIENTE 
    fecha_inicio: Optional[datetime] = None
    fecha_limite: Optional[datetime] = None

class TareaResponse(BaseModel):
    id_tarea: int
    id_proyecto: int
    titulo: str
    descripcion: Optional[str]
    prioridad: Optional[str]
    estado: str
    fecha_inicio: Optional[datetime]
    fecha_limite: Optional[datetime]

    class Config:
        orm_mode = True  

# --- MODELO DE SQLALCHEMY DE PROYECTOS ---
class ProyectoDB(Base):
    __tablename__ = "proyectos"

    id_proyecto = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(150), nullable=False)
    descripcion = Column(String)
    fecha_inicio = Column(TIMESTAMP, nullable=True)
    fecha_fin = Column(TIMESTAMP, nullable=True)
    estado = Column(String(50), default="Activo")
    fecha_creacion = Column(TIMESTAMP, default=datetime.utcnow)

class ProyectoUsuarioDB(Base):
    __tablename__ = "proyecto_usuarios"

    id_proyecto = Column(Integer, ForeignKey("proyectos.id_proyecto"), primary_key=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), primary_key=True)
    id_rol = Column(Integer, primary_key=True)

class ProyectoResponse(BaseModel):
    id_proyecto: int
    nombre: str
    descripcion: Optional[str]
    fecha_inicio: Optional[datetime]
    fecha_fin: Optional[datetime]
    estado: str
    fecha_creacion: datetime

    class Config:
        orm_mode = True
        
        
# --- ESQUEMAS PARA CREACIÓN DE PROYECTOS ---
class ProyectoCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    estado: Optional[str] = "Activo"


# --- ESQUEMAS PARA AGREGAR COLABORADORES ---
class ColaboradorCreate(BaseModel):
    id_proyecto: int
    correo_colaborador: EmailStr
    id_rol: int  # Por ejemplo: 1 (Admin), 2 (Colaborador regular), etc.


# --- ESQUEMAS PARA EDITAR Y ELIMINAR PROYECTOS ---
class ProyectoUpdate(BaseModel):
    id_proyecto: int  
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    estado: Optional[str] = None

class ProyectoDelete(BaseModel):
    id_proyecto: int 


# --- Seguridad y Autenticación ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

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

# --- Función para obtener el rol de un usuario en un proyecto ---
def obtener_rol_en_proyecto(id_proyecto: int, id_usuario: int, db: Session) -> Optional[int]:
    query = sqlalchemy.text("""
        SELECT id_rol FROM proyecto_usuarios 
        WHERE id_proyecto = :id_proyecto 
          AND id_usuario = :id_usuario
    """)
    resultado = db.execute(query, {"id_proyecto": id_proyecto, "id_usuario": id_usuario}).first()
    
    return resultado[0] if resultado else None

# Función para obtener el usuario actual a partir del token JWT
def obtener_usuario_actual(token: str = Depends(oauth2_scheme)) -> int:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales o el token ha expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        id_usuario: str = payload.get("sub")
        if id_usuario is None:
            raise credentials_exception
        return int(id_usuario)
    except jwt.PyJWTError:
        raise credentials_exception

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



# --- ENDPOINT DE CREACIÓN DE PROYECTOS ---

@app.post("/proyectos", response_model=ProyectoResponse, status_code=status.HTTP_201_CREATED)
def crear_proyecto(
    proyecto_in: ProyectoCreate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    nuevo_proyecto = ProyectoDB(
        nombre=proyecto_in.nombre,
        descripcion=proyecto_in.descripcion,
        fecha_inicio=proyecto_in.fecha_inicio,
        fecha_fin=proyecto_in.fecha_fin,
        estado=proyecto_in.estado
    )

    try:
        db.add(nuevo_proyecto)
        db.flush()  

        nuevo_proyecto_usuario = ProyectoUsuarioDB(
            id_proyecto=nuevo_proyecto.id_proyecto,
            id_usuario=id_usuario_actual,
            id_rol=1  
        )
        db.add(nuevo_proyecto_usuario)

        db.commit()
        db.refresh(nuevo_proyecto)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al registrar el proyecto."
        )

    return nuevo_proyecto



# --- ENDPOINT DE CREACIÓN DE TAREAS ---

@app.post("/tareas", response_model=TareaResponse, status_code=status.HTTP_201_CREATED)
def crear_tarea(
    tarea_in: TareaCreate, 
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    # 1. VALIDACIÓN DE ROL 
    id_rol = obtener_rol_en_proyecto(tarea_in.id_proyecto, id_usuario_actual, db)
    
    # Asumiendo que id_rol = 1 es el Administrador
    if id_rol != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos de Administrador en este proyecto para crear tareas."
        )

    # 2. Validar que el proyecto exista en la BD antes de intentar crear la tarea
    proyecto_existe = db.execute(
        sqlalchemy.text("SELECT 1 FROM proyectos WHERE id_proyecto = :id"), {"id": tarea_in.id_proyecto}
    ).first()
    if not proyecto_existe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El proyecto con id {tarea_in.id_proyecto} no existe."
        )

    # 3. Registrar la tarea
    nueva_tarea = TareaDB(
        id_proyecto=tarea_in.id_proyecto,
        titulo=tarea_in.titulo,
        descripcion=tarea_in.descripcion,
        prioridad=tarea_in.prioridad.value,  
        estado=tarea_in.estado.value,
        fecha_inicio=tarea_in.fecha_inicio,
        fecha_limite=tarea_in.fecha_limite
    )

    try:
        db.add(nueva_tarea)
        db.commit()
        db.refresh(nueva_tarea)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al registrar la tarea."
        )

    return nueva_tarea


# --- ENDPOINT PARA AGREGAR COLABORADORES AL PROYECTO ---

@app.post("/proyectos/colaboradores", status_code=status.HTTP_201_CREATED)
def agregar_colaborador(
    colaborador_in: ColaboradorCreate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    # 1. Verificar que quien hace la petición es Administrador del proyecto
    id_rol_admin = obtener_rol_en_proyecto(colaborador_in.id_proyecto, id_usuario_actual, db)
    if id_rol_admin != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden agregar colaboradores a este proyecto."
        )

    # 2. Buscar al usuario que se desea agregar utilizando su correo
    usuario_nuevo = db.query(UsuarioDB).filter(UsuarioDB.correo == colaborador_in.correo_colaborador).first()
    if not usuario_nuevo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario con el correo especificado no existe en el sistema."
        )

    # 3. Verificar si el usuario ya pertenece a este proyecto para evitar duplicados
    rol_existente = obtener_rol_en_proyecto(colaborador_in.id_proyecto, usuario_nuevo.id_usuario, db)
    if rol_existente is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario ya es un colaborador de este proyecto."
        )

    # 4. Insertar el nuevo colaborador en la tabla intermedia
    nuevo_colaborador = ProyectoUsuarioDB(
        id_proyecto=colaborador_in.id_proyecto,
        id_usuario=usuario_nuevo.id_usuario,
        id_rol=colaborador_in.id_rol
    )

    try:
        db.add(nuevo_colaborador)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al agregar el colaborador al proyecto."
        )

    return {"mensaje": f"Usuario {usuario_nuevo.correo} agregado exitosamente con el rol {colaborador_in.id_rol}."}

# --- ENDPOINT PARA EDITAR UN PROYECTO (ID en JSON) ---

@app.put("/proyectos", response_model=ProyectoResponse, status_code=status.HTTP_200_OK)
def editar_proyecto(
    proyecto_in: ProyectoUpdate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    # 1. 🔒 VALIDACIÓN: Solo el admin puede editar
    id_rol = obtener_rol_en_proyecto(proyecto_in.id_proyecto, id_usuario_actual, db)
    if id_rol != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden editar este proyecto."
        )

    # 2. Buscar el proyecto
    proyecto = db.query(ProyectoDB).filter(ProyectoDB.id_proyecto == proyecto_in.id_proyecto).first()
    if not proyecto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El proyecto no existe."
        )

    # 3. Actualizar solo los campos enviados en el JSON (ignorando el id_proyecto y los nulos)
    update_data = proyecto_in.dict(exclude_unset=True)
    update_data.pop("id_proyecto", None)  # Evitamos intentar actualizar la llave primaria

    for key, value in update_data.items():
        setattr(proyecto, key, value)

    try:
        db.commit()
        db.refresh(proyecto)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al actualizar el proyecto."
        )

    return proyecto


# --- ENDPOINT PARA ELIMINAR UN PROYECTO (ID en JSON) ---

@app.delete("/proyectos", status_code=status.HTTP_200_OK)
def eliminar_proyecto(
    proyecto_del: ProyectoDelete,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    # 1. 🔒 VALIDACIÓN: Solo el admin puede eliminar
    id_rol = obtener_rol_en_proyecto(proyecto_del.id_proyecto, id_usuario_actual, db)
    if id_rol != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden eliminar este proyecto."
        )

    # 2. Buscar el proyecto
    proyecto = db.query(ProyectoDB).filter(ProyectoDB.id_proyecto == proyecto_del.id_proyecto).first()
    if not proyecto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El proyecto no existe."
        )

    # 3. Eliminar registros en cascada
    try:
        db.query(TareaDB).filter(TareaDB.id_proyecto == proyecto_del.id_proyecto).delete()
        db.query(ProyectoUsuarioDB).filter(ProyectoUsuarioDB.id_proyecto == proyecto_del.id_proyecto).delete()
        db.delete(proyecto)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al eliminar el proyecto y sus dependencias."
        )

    return {"mensaje": f"El proyecto {proyecto_del.id_proyecto} y todos sus datos relacionados fueron eliminados correctamente."}