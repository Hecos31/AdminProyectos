from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    HttpUrl,
    field_validator,
)


# ============================================================
# CONFIGURACIÓN BASE
# ============================================================

class ORMResponseModel(BaseModel):
    """
    Clase base para los esquemas que reciben información
    desde modelos de SQLAlchemy.
    """

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# ENUMERACIONES
# ============================================================

class EstadoTarea(str, Enum):
    PENDIENTE = "Pendiente por asignar"
    ASIGNADA = "Asignada"
    EN_PROGRESO = "En progreso"
    CONCLUIDA = "Concluida"


class PrioridadTarea(str, Enum):
    BAJA = "Baja"
    MEDIA = "Media"
    ALTA = "Alta"


class TipoEvidencia(str, Enum):
    ARCHIVO = "archivo"
    ENLACE = "enlace"


# ============================================================
# USUARIOS
# ============================================================

class UsuarioCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    correo: EmailStr
    password: str = Field(min_length=6, max_length=255)


class UsuarioAsignado(ORMResponseModel):
    id_usuario: int
    nombre: str
    apellido: Optional[str] = None 
    correo: str


class UsuarioResponse(ORMResponseModel):
    id_usuario: int
    nombre: str
    apellido: Optional[str] = None  
    correo: EmailStr


class UsuarioResumenResponse(ORMResponseModel):
    """
    Representación reducida del usuario para comentarios,
    evidencias y responsables.
    """
    id_usuario: int
    nombre: str
    apellido: Optional[str] = None 
    correo: EmailStr


# ============================================================
# AUTENTICACIÓN
# ============================================================

class LoginRequest(BaseModel):
    correo: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


# ============================================================
# TAREAS
# ============================================================

class TareaEstadoUpdate(BaseModel):
    estado: EstadoTarea


class TareaAsignarUpdate(BaseModel):
    id_usuario_asignado: Optional[int] = None


class TareaCreate(BaseModel):
    id_proyecto: int
    titulo: str = Field(min_length=1, max_length=200)
    descripcion: Optional[str] = None
    prioridad: PrioridadTarea = PrioridadTarea.MEDIA
    fecha_inicio: Optional[datetime] = None
    fecha_limite: Optional[datetime] = None
    id_usuario_asignado: Optional[int] = None

    @field_validator("titulo")
    @classmethod
    def limpiar_titulo(cls, valor: str) -> str:
        valor_limpio = valor.strip()

        if not valor_limpio:
            raise ValueError("El título de la tarea es obligatorio")

        return valor_limpio


class TareaResponse(ORMResponseModel):
    id_tarea: int
    id_proyecto: int
    titulo: str
    descripcion: Optional[str] = None
    prioridad: Optional[str] = None
    estado: str
    fecha_inicio: Optional[datetime] = None
    fecha_limite: Optional[datetime] = None
    usuario_asignado: Optional[UsuarioAsignado] = None


class TareaCalendarioResponse(TareaResponse):
    """Tarea preparada para mostrarse en el calendario global o de proyecto."""

    nombre_proyecto: str


class TareaUpdate(BaseModel):
    titulo: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=200
    )
    descripcion: Optional[str] = None
    prioridad: Optional[PrioridadTarea] = None
    fecha_inicio: Optional[datetime] = None
    fecha_limite: Optional[datetime] = None

    @field_validator("titulo")
    @classmethod
    def limpiar_titulo_opcional(
        cls,
        valor: Optional[str]
    ) -> Optional[str]:
        if valor is None:
            return None

        valor_limpio = valor.strip()

        if not valor_limpio:
            raise ValueError("El título de la tarea no puede estar vacío")

        return valor_limpio


class TareaDelete(BaseModel):
    id_tarea: int


# ============================================================
# PROYECTOS
# ============================================================

class ProyectoCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    descripcion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    estado: Optional[str] = "Activo"

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre_proyecto(cls, valor: str) -> str:
        valor_limpio = valor.strip()

        if not valor_limpio:
            raise ValueError("El nombre del proyecto es obligatorio")

        return valor_limpio


class ProyectoResponse(ORMResponseModel):
    id_proyecto: int
    nombre: str
    descripcion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    estado: str
    fecha_creacion: datetime


class CalendarioProyectoResponse(BaseModel):
    """Contexto y actividades visibles para el usuario dentro de un proyecto."""

    proyecto: ProyectoResponse
    id_rol: int
    es_administrador: bool
    tareas: List[TareaCalendarioResponse] = Field(default_factory=list)


class ProyectoUpdate(BaseModel):
    id_proyecto: int
    nombre: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=150
    )
    descripcion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    estado: Optional[str] = None


class ProyectoDelete(BaseModel):
    id_proyecto: int


# ============================================================
# COLABORADORES
# ============================================================

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


# ============================================================
# MENSAJES Y CONVERSACIONES
# ============================================================

class MensajeConversacionRequest(BaseModel):
    id_conversacion: str
    contenido: str = Field(min_length=1)

    @field_validator("contenido")
    @classmethod
    def limpiar_mensaje(cls, valor: str) -> str:
        valor_limpio = valor.strip()

        if not valor_limpio:
            raise ValueError("El mensaje no puede estar vacío")

        return valor_limpio


class IniciarChatCorreoRequest(BaseModel):
    correo_destino: EmailStr


# ============================================================
# INTELIGENCIA ARTIFICIAL
# ============================================================

class AITareaRequest(BaseModel):
    id_proyecto: int
    texto_libre: str = Field(min_length=1)

    @field_validator("texto_libre")
    @classmethod
    def limpiar_texto_ia(cls, valor: str) -> str:
        valor_limpio = valor.strip()

        if not valor_limpio:
            raise ValueError(
                "La instrucción para la IA no puede estar vacía"
            )

        return valor_limpio


class AITareaResponse(BaseModel):
    titulo: str
    descripcion: str
    prioridad: str
    id_usuario_asignado: Optional[int] = None
    fecha_limite: Optional[str] = None


class AIVoiceBatchResponse(BaseModel):
    resumen_reunion: str
    tareas: List[AITareaResponse] = Field(default_factory=list)


class TareaLoteItemCreate(BaseModel):
    titulo: str = Field(min_length=1, max_length=200)
    descripcion: Optional[str] = None
    prioridad: PrioridadTarea = PrioridadTarea.MEDIA
    fecha_inicio: Optional[datetime] = None
    fecha_limite: Optional[datetime] = None
    id_usuario_asignado: Optional[int] = None

    @field_validator("titulo")
    @classmethod
    def limpiar_titulo_lote(cls, valor: str) -> str:
        valor_limpio = valor.strip()
        if not valor_limpio:
            raise ValueError("El título de la tarea es obligatorio")
        return valor_limpio


class TareaLoteCreateRequest(BaseModel):
    id_proyecto: int
    publicar_minuta_chat: bool = True
    resumen_reunion: Optional[str] = None
    tareas: List[TareaLoteItemCreate] = Field(min_length=1)


class TareaLoteCreateResponse(BaseModel):
    mensaje: str
    total_creadas: int
    minuta_publicada: bool = False
    tareas: List[TareaResponse] = Field(default_factory=list)


# ============================================================
# COMENTARIOS DE TAREAS
# ============================================================

class ComentarioTareaCreate(BaseModel):
    contenido: str = Field(
        min_length=1,
        max_length=5000
    )

    @field_validator("contenido")
    @classmethod
    def validar_contenido(cls, valor: str) -> str:
        contenido_limpio = valor.strip()

        if not contenido_limpio:
            raise ValueError("El comentario no puede estar vacío")

        return contenido_limpio


class ComentarioTareaUpdate(BaseModel):
    contenido: str = Field(
        min_length=1,
        max_length=5000
    )

    @field_validator("contenido")
    @classmethod
    def validar_contenido(cls, valor: str) -> str:
        contenido_limpio = valor.strip()

        if not contenido_limpio:
            raise ValueError("El comentario no puede estar vacío")

        return contenido_limpio


class ComentarioTareaResponse(ORMResponseModel):
    id_comentario: int
    id_tarea: int
    id_usuario: int

    contenido: str

    fecha_creacion: datetime
    fecha_actualizacion: Optional[datetime] = None

    usuario: UsuarioResumenResponse

    puede_editar: bool = False
    puede_eliminar: bool = False


# ============================================================
# EVIDENCIAS DE TAREAS
# ============================================================

class EvidenciaEnlaceCreate(BaseModel):
    nombre: str = Field(
        min_length=1,
        max_length=255
    )
    descripcion: Optional[str] = Field(
        default=None,
        max_length=2000
    )
    url: HttpUrl

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str) -> str:
        nombre_limpio = valor.strip()

        if not nombre_limpio:
            raise ValueError(
                "El nombre de la evidencia es obligatorio"
            )

        return nombre_limpio


class EvidenciaTareaResponse(ORMResponseModel):
    id_evidencia: int
    id_tarea: int
    id_usuario: int

    tipo: TipoEvidencia
    nombre: str
    descripcion: Optional[str] = None

    # Evidencia de tipo enlace
    url: Optional[str] = None

    # Evidencia de tipo archivo
    nombre_archivo_original: Optional[str] = None
    tipo_mime: Optional[str] = None
    tamano_bytes: Optional[int] = Field(
        default=None,
        ge=0
    )

    url_descarga: Optional[str] = None

    fecha_creacion: datetime

    usuario: UsuarioResumenResponse

    puede_eliminar: bool = False


# ============================================================
# PERMISOS DE LA ACTIVIDAD
# ============================================================

class PermisosTareaResponse(BaseModel):
    es_responsable: bool = False
    es_administrador: bool = False

    puede_tomar: bool = False
    puede_comentar: bool = False
    puede_agregar_evidencia: bool = False
    puede_editar_tarea: bool = False
    puede_cambiar_responsable: bool = False
    puede_eliminar_tarea: bool = False

# ============================================================
# DETALLE COMPLETO DE LA ACTIVIDAD
# ============================================================

class TareaDetalleResponse(BaseModel):
    tarea: TareaResponse

    comentarios: List[ComentarioTareaResponse] = Field(
        default_factory=list
    )

    evidencias: List[EvidenciaTareaResponse] = Field(
        default_factory=list
    )

    permisos: PermisosTareaResponse


# ============================================================
# RESPUESTA AL TOMAR UNA ACTIVIDAD
# ============================================================

class TomarTareaResponse(BaseModel):
    mensaje: str
    tarea: TareaResponse
    permisos: Optional[PermisosTareaResponse] = None


# ============================================================
# ÓRBITA GAMIFIED TEAM PULSE & PUNTOS DE MÉRITO
# ============================================================

class MedallaPulseResponse(BaseModel):
    codigo: str
    nombre: str
    descripcion: str
    color: str


class IntegrantePulseResponse(BaseModel):
    posicion: int
    id_usuario: int
    nombre: str
    apellido: str
    correo: str
    rol: str
    xp_total: int
    nivel: int
    titulo_nivel: str
    progreso_nivel_pct: int
    racha_entregas_tiempo: int
    tareas_concluidas: int
    tareas_alta_prioridad: int
    tareas_en_progreso: int
    evidencias_subidas: int
    comentarios_realizados: int
    meritos_recibidos: int
    medallas: List[MedallaPulseResponse] = Field(default_factory=list)


class ReconocimientoItemResponse(BaseModel):
    id_reconocimiento: str
    id_proyecto: int
    id_remitente: int
    nombre_remitente: str
    id_destinatario: int
    nombre_destinatario: str
    insignia: str
    mensaje: str
    xp_otorgado: int = 25
    fecha_envio: str


class TeamPulseResponse(BaseModel):
    id_proyecto: int
    nombre_proyecto: str
    xp_total_equipo: int
    porcentaje_entregas_tiempo: int
    total_meritos_proyecto: int
    total_medallas_desbloqueadas: int
    cronica_ia: str
    ranking: List[IntegrantePulseResponse] = Field(default_factory=list)
    meritos_recientes: List[ReconocimientoItemResponse] = Field(default_factory=list)


class EnviarReconocimientoRequest(BaseModel):
    id_destinatario: int
    insignia: str = Field(default="Compañerismo Excepcional", min_length=2, max_length=80)
    mensaje: str = Field(min_length=2, max_length=280)
    publicar_en_chat: bool = True


class CronicaPulseRequest(BaseModel):
    publicar_en_chat: bool = True


class CronicaPulseResponse(BaseModel):
    cronica_ia: str
    publicada_en_chat: bool = False
