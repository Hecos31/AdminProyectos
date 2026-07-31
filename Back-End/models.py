from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    TIMESTAMP,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from database import Base



# ============================================================
# USUARIOS
# ============================================================

class UsuarioDB(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    nombre = Column(
        String(100)
    )

    apellido = Column(
        String(100)
    )

    correo = Column(
        String(150),
        unique=True,
        index=True
    )

    password = Column(
        String(255)
    )

    fecha_registro = Column(
        TIMESTAMP(timezone=False),
        default=datetime.utcnow
    )

    comentarios_tarea = relationship(
        "ComentarioTareaDB",
        back_populates="usuario",
        passive_deletes=True
    )

    evidencias_tarea = relationship(
        "EvidenciaTareaDB",
        back_populates="usuario",
        passive_deletes=True
    )


# ============================================================
# ROLES
# ============================================================

class RolDB(Base):
    __tablename__ = "roles"

    id_rol = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    nombre = Column(
        String(50),
        nullable=False
    )

    descripcion = Column(
        Text,
        nullable=True
    )


# ============================================================
# PROYECTOS
# ============================================================

class ProyectoDB(Base):
    __tablename__ = "proyectos"

    id_proyecto = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    nombre = Column(
        String(150),
        nullable=False
    )

    descripcion = Column(
        Text,
        nullable=True
    )

    fecha_inicio = Column(
        TIMESTAMP(timezone=False),
        nullable=True
    )

    fecha_fin = Column(
        TIMESTAMP(timezone=False),
        nullable=True
    )

    estado = Column(
        String(50),
        default="Activo"
    )

    fecha_creacion = Column(
        TIMESTAMP(timezone=False),
        default=datetime.utcnow
    )


# ============================================================
# USUARIOS DEL PROYECTO
# ============================================================

class ProyectoUsuarioDB(Base):
    __tablename__ = "proyecto_usuarios"

    id_proyecto = Column(
        Integer,
        ForeignKey(
            "proyectos.id_proyecto",
            ondelete="CASCADE"
        ),
        primary_key=True
    )

    id_usuario = Column(
        Integer,
        ForeignKey(
            "usuarios.id_usuario",
            ondelete="CASCADE"
        ),
        primary_key=True
    )

    id_rol = Column(
        Integer,
        ForeignKey("roles.id_rol"),
        primary_key=True
    )


# ============================================================
# NOTIFICACIONES
# ============================================================

class Notificacion(Base):
    __tablename__ = "notificaciones"

    id_notificacion = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    id_usuario = Column(
        Integer,
        ForeignKey(
            "usuarios.id_usuario",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    tipo = Column(
        String(50),
        nullable=False
    )

    mensaje = Column(
        String(255),
        nullable=False
    )

    leida = Column(
        Boolean,
        default=False,
        nullable=False
    )

    fecha_creacion = Column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )


# ============================================================
# TAREAS
# ============================================================

class TareaDB(Base):
    __tablename__ = "tareas"

    id_tarea = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    id_proyecto = Column(
        Integer,
        ForeignKey(
            "proyectos.id_proyecto",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    titulo = Column(
        String(200),
        nullable=False
    )

    descripcion = Column(
        Text,
        nullable=True
    )

    prioridad = Column(
        String(20),
        nullable=True
    )

    estado = Column(
        String(30),
        default="Pendiente por asignar"
    )

    fecha_inicio = Column(
        TIMESTAMP(timezone=False),
        nullable=True
    )

    fecha_limite = Column(
        TIMESTAMP(timezone=False),
        nullable=True
    )

    fecha_creacion = Column(
        TIMESTAMP(timezone=False),
        default=datetime.utcnow,
        nullable=False
    )

    fecha_actualizacion = Column(
        TIMESTAMP(timezone=False),
        nullable=True
    )

    comentarios = relationship(
        "ComentarioTareaDB",
        back_populates="tarea",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    evidencias = relationship(
        "EvidenciaTareaDB",
        back_populates="tarea",
        cascade="all, delete-orphan",
        passive_deletes=True
    )


# ============================================================
# RESPONSABLE DE LA TAREA
# ============================================================

class TareaAsignadaDB(Base):
    __tablename__ = "tarea_asignada"

    __table_args__ = (
        UniqueConstraint(
            "id_tarea",
            name="uq_tarea_asignada_id_tarea"
        ),
    )

    id_tarea = Column(
        Integer,
        ForeignKey(
            "tareas.id_tarea",
            ondelete="CASCADE"
        ),
        primary_key=True
    )

    id_usuario = Column(
        Integer,
        ForeignKey(
            "usuarios.id_usuario",
            ondelete="CASCADE"
        ),
        primary_key=True
    )


# ============================================================
# COMENTARIOS DE TAREAS
# ============================================================

class ComentarioTareaDB(Base):
    __tablename__ = "comentarios_tarea"

    __table_args__ = (
        CheckConstraint(
            "LENGTH(TRIM(contenido)) > 0",
            name="chk_comentario_no_vacio"
        ),
    )

    id_comentario = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    id_tarea = Column(
        Integer,
        ForeignKey(
            "tareas.id_tarea",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    id_usuario = Column(
        Integer,
        ForeignKey(
            "usuarios.id_usuario",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    contenido = Column(
        Text,
        nullable=False
    )

    fecha_creacion = Column(
        TIMESTAMP(timezone=False),
        default=datetime.utcnow,
        nullable=False
    )

    fecha_actualizacion = Column(
        TIMESTAMP(timezone=False),
        nullable=True
    )

    tarea = relationship(
        "TareaDB",
        back_populates="comentarios"
    )

    usuario = relationship(
        "UsuarioDB",
        back_populates="comentarios_tarea"
    )


# ============================================================
# EVIDENCIAS DE TAREAS
# ============================================================

class EvidenciaTareaDB(Base):
    __tablename__ = "evidencias_tarea"

    __table_args__ = (
        CheckConstraint(
            "tipo IN ('archivo', 'enlace')",
            name="chk_evidencia_tipo"
        ),
        CheckConstraint(
            """
            (
                tipo = 'enlace'
                AND url IS NOT NULL
                AND LENGTH(TRIM(url)) > 0
                AND ruta_archivo IS NULL
            )
            OR
            (
                tipo = 'archivo'
                AND ruta_archivo IS NOT NULL
                AND LENGTH(TRIM(ruta_archivo)) > 0
                AND url IS NULL
            )
            """,
            name="chk_evidencia_contenido"
        ),
        CheckConstraint(
            "tamano_bytes IS NULL OR tamano_bytes >= 0",
            name="chk_evidencia_tamano"
        ),
    )

    id_evidencia = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    id_tarea = Column(
        Integer,
        ForeignKey(
            "tareas.id_tarea",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    id_usuario = Column(
        Integer,
        ForeignKey(
            "usuarios.id_usuario",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    tipo = Column(
        String(20),
        nullable=False
    )

    nombre = Column(
        String(255),
        nullable=False
    )

    descripcion = Column(
        Text,
        nullable=True
    )

    # Evidencia mediante enlace
    url = Column(
        Text,
        nullable=True
    )

    # Evidencia mediante archivo
    nombre_archivo_original = Column(
        String(255),
        nullable=True
    )

    nombre_archivo_guardado = Column(
        String(255),
        nullable=True
    )

    ruta_archivo = Column(
        Text,
        nullable=True
    )

    tipo_mime = Column(
        String(150),
        nullable=True
    )

    tamano_bytes = Column(
        BigInteger,
        nullable=True
    )

    fecha_creacion = Column(
        TIMESTAMP(timezone=False),
        default=datetime.utcnow,
        nullable=False
    )

    tarea = relationship(
        "TareaDB",
        back_populates="evidencias"
    )

    usuario = relationship(
        "UsuarioDB",
        back_populates="evidencias_tarea"
    )