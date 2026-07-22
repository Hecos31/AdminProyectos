from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

class EstadoTarea(str, Enum):
    ASIGNADA = "Asignada"
    PENDIENTE = "Pendiente por asignar"
    CONCLUIDA = "Concluida"

class PrioridadTarea(str, Enum):
    BAJA = "Baja"
    MEDIA = "Media"
    ALTA = "Alta"

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
        from_attributes = True

class LoginRequest(BaseModel):
    correo: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    
class TareaCreate(BaseModel):
    id_proyecto: int
    titulo: str
    descripcion: Optional[str] = None
    prioridad: PrioridadTarea = PrioridadTarea.MEDIA
    estado: EstadoTarea = EstadoTarea.PENDIENTE 
    fecha_inicio: Optional[datetime] = None
    fecha_limite: Optional[datetime] = None
    id_usuario_asignado: Optional[int] = None  

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
        from_attributes = True  

class TareaUpdate(BaseModel):
    id_tarea: int 
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    prioridad: Optional[PrioridadTarea] = None
    estado: Optional[EstadoTarea] = None
    fecha_inicio: Optional[datetime] = None
    fecha_limite: Optional[datetime] = None

class TareaDelete(BaseModel):
    id_tarea: int 

class ProyectoCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    estado: Optional[str] = "Activo"

class ProyectoResponse(BaseModel):
    id_proyecto: int
    nombre: str
    descripcion: Optional[str]
    fecha_inicio: Optional[datetime]
    fecha_fin: Optional[datetime]
    estado: str
    fecha_creacion: datetime
    class Config:
        from_attributes = True
        
class ProyectoUpdate(BaseModel):
    id_proyecto: int  
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    estado: Optional[str] = None

class ProyectoDelete(BaseModel):
    id_proyecto: int 

class ColaboradorCreate(BaseModel):
    id_proyecto: int
    correo_colaborador: EmailStr
    id_rol: int 

class ColaboradorDelete(BaseModel):
    id_proyecto: int
    id_usuario: int

class ColaboradorUpdate(BaseModel):
    id_proyecto: int
    id_usuario: int
    id_rol_nuevo: int  

class MensajeConversacionRequest(BaseModel):
    id_conversacion: str
    contenido: str