from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Boolean, DateTime, func
from datetime import datetime
from database import Base


class UsuarioDB(Base):
    __tablename__ = "usuarios"
    id_usuario = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100))
    apellido = Column(String(100))
    correo = Column(String(150), unique=True, index=True)
    password = Column(String(255))
    fecha_registro = Column(TIMESTAMP, default=datetime.utcnow)

class TareaDB(Base):
    __tablename__ = "tareas"
    id_tarea = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_proyecto = Column(Integer, ForeignKey("proyectos.id_proyecto"), nullable=False)
    titulo = Column(String(200), nullable=False)
    descripcion = Column(String) 
    prioridad = Column(String(20))
    estado = Column(String(30), default="Pendiente por asignar")
    fecha_inicio = Column(TIMESTAMP, nullable=True)
    fecha_limite = Column(TIMESTAMP, nullable=True)

class TareaAsignadaDB(Base):
    __tablename__ = "tarea_asignada"
    id_tarea = Column(Integer, ForeignKey("tareas.id_tarea"), primary_key=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), primary_key=True)

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

#Para notificaciones
class Notificacion(Base):
    __tablename__ = "notificaciones"

    id_notificacion = Column(Integer, primary_key=True, index=True)
    
    # Asumiendo que tu tabla principal se llama 'usuarios' y su PK es 'id_usuario'
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario")) 
    
    tipo = Column(String(50))
    mensaje = Column(String(255))
    leida = Column(Boolean, default=False)
    
    # func.now() le dice a Postgres que ponga la fecha actual automáticamente
    fecha_creacion = Column(DateTime, server_default=func.now())