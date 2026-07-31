from datetime import datetime
from enum import Enum
import mimetypes
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from auth import obtener_rol_en_proyecto, obtener_usuario_actual
from database import get_db
from models import (
    ComentarioTareaDB,
    EvidenciaTareaDB,
    TareaAsignadaDB,
    TareaDB,
    UsuarioDB,
)
from schemas import (
    ComentarioTareaCreate,
    ComentarioTareaResponse,
    ComentarioTareaUpdate,
    EstadoTarea,
    EvidenciaEnlaceCreate,
    EvidenciaTareaResponse,
    PermisosTareaResponse,
    TareaAsignarUpdate,
    TareaCreate,
    TareaDetalleResponse,
    TareaEstadoUpdate,
    TareaResponse,
    TareaUpdate,
    TomarTareaResponse,
)

router = APIRouter(prefix="/tareas", tags=["Tareas - Tablón Kanban"])


# ============================================================
# CONFIGURACIÓN DE ARCHIVOS
# ============================================================

BACKEND_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BACKEND_DIR / "uploads"
TAREAS_UPLOADS_DIR = UPLOADS_DIR / "tareas"
TAREAS_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

MAX_ARCHIVO_BYTES = 10 * 1024 * 1024  # 10 MB
TAMANO_BLOQUE = 1024 * 1024  # 1 MB

EXTENSIONES_PERMITIDAS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".txt",
    ".csv",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".zip",
}

TIPOS_MIME_PERMITIDOS = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "text/plain",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
}


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

def obtener_tarea_o_404(id_tarea: int, db: Session) -> TareaDB:
    tarea = (
        db.query(TareaDB)
        .filter(TareaDB.id_tarea == id_tarea)
        .first()
    )

    if not tarea:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarea no encontrada.",
        )

    return tarea


def exigir_miembro_proyecto(
    id_proyecto: int,
    id_usuario: int,
    db: Session,
) -> int:
    id_rol = obtener_rol_en_proyecto(
        id_proyecto,
        id_usuario,
        db,
    )

    if id_rol is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No perteneces a este proyecto.",
        )

    return id_rol


def obtener_asignacion(
    id_tarea: int,
    db: Session,
) -> Optional[TareaAsignadaDB]:
    return (
        db.query(TareaAsignadaDB)
        .filter(TareaAsignadaDB.id_tarea == id_tarea)
        .first()
    )


def obtener_usuario(
    id_usuario: int,
    db: Session,
) -> Optional[UsuarioDB]:
    return (
        db.query(UsuarioDB)
        .filter(UsuarioDB.id_usuario == id_usuario)
        .first()
    )


def usuario_a_dict(
    usuario: Optional[UsuarioDB],
) -> Optional[dict]:
    if usuario is None:
        return None

    return {
        "id_usuario": usuario.id_usuario,
        "nombre": usuario.nombre,
        "apellido": usuario.apellido,
        "correo": usuario.correo,
    }


def tarea_a_dict(
    tarea: TareaDB,
    db: Session,
) -> dict:
    asignacion = obtener_asignacion(tarea.id_tarea, db)
    usuario_asignado = None

    if asignacion:
        usuario_asignado = obtener_usuario(
            asignacion.id_usuario,
            db,
        )

    return {
        "id_tarea": tarea.id_tarea,
        "id_proyecto": tarea.id_proyecto,
        "titulo": tarea.titulo,
        "descripcion": tarea.descripcion,
        "prioridad": tarea.prioridad,
        "estado": tarea.estado,
        "fecha_inicio": tarea.fecha_inicio,
        "fecha_limite": tarea.fecha_limite,
        "usuario_asignado": usuario_a_dict(usuario_asignado),
    }


def construir_permisos(
    id_usuario_actual: int,
    id_rol: int,
    asignacion: Optional[TareaAsignadaDB],
) -> dict:
    es_administrador = id_rol == 1

    es_responsable = bool(
        asignacion
        and asignacion.id_usuario == id_usuario_actual
    )

    return {
        "es_responsable": es_responsable,
        "es_administrador": es_administrador,
        "puede_tomar": asignacion is None,
        "puede_comentar": True,
        "puede_agregar_evidencia": (
            es_responsable or es_administrador
        ),
        "puede_editar_tarea": es_administrador,
        "puede_cambiar_responsable": es_administrador,
        "puede_eliminar_tarea": es_administrador,
    }


def comentario_a_dict(
    comentario: ComentarioTareaDB,
    id_usuario_actual: int,
    es_administrador: bool,
) -> dict:
    es_autor = comentario.id_usuario == id_usuario_actual

    return {
        "id_comentario": comentario.id_comentario,
        "id_tarea": comentario.id_tarea,
        "id_usuario": comentario.id_usuario,
        "contenido": comentario.contenido,
        "fecha_creacion": comentario.fecha_creacion,
        "fecha_actualizacion": comentario.fecha_actualizacion,
        "usuario": usuario_a_dict(comentario.usuario),
        "puede_editar": es_autor,
        "puede_eliminar": es_autor or es_administrador,
    }


def evidencia_a_dict(
    evidencia: EvidenciaTareaDB,
    id_usuario_actual: int,
    es_administrador: bool,
) -> dict:
    es_autor = evidencia.id_usuario == id_usuario_actual

    return {
        "id_evidencia": evidencia.id_evidencia,
        "id_tarea": evidencia.id_tarea,
        "id_usuario": evidencia.id_usuario,
        "tipo": evidencia.tipo,
        "nombre": evidencia.nombre,
        "descripcion": evidencia.descripcion,
        "url": evidencia.url,
        "nombre_archivo_original": (
            evidencia.nombre_archivo_original
        ),
        "tipo_mime": evidencia.tipo_mime,
        "tamano_bytes": evidencia.tamano_bytes,
        "url_descarga": (
            f"/tareas/evidencias/"
            f"{evidencia.id_evidencia}/descargar"
            if evidencia.tipo == "archivo"
            else None
        ),
        "fecha_creacion": evidencia.fecha_creacion,
        "usuario": usuario_a_dict(evidencia.usuario),
        "puede_eliminar": es_autor or es_administrador,
    }


def exigir_permiso_evidencia(
    tarea: TareaDB,
    id_usuario_actual: int,
    id_rol: int,
    db: Session,
) -> None:
    asignacion = obtener_asignacion(tarea.id_tarea, db)
    es_administrador = id_rol == 1
    es_responsable = bool(
        asignacion
        and asignacion.id_usuario == id_usuario_actual
    )

    if not es_administrador and not es_responsable:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Solo el responsable de la tarea o un administrador "
                "puede agregar evidencias."
            ),
        )


def resolver_ruta_archivo(ruta_relativa: str) -> Path:
    raiz = UPLOADS_DIR.resolve()
    ruta = (raiz / ruta_relativa).resolve()

    try:
        ruta.relative_to(raiz)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La ruta del archivo no es válida.",
        ) from exc

    return ruta


def eliminar_archivo_silenciosamente(ruta: Optional[Path]) -> None:
    if ruta is None:
        return

    try:
        if ruta.exists() and ruta.is_file():
            ruta.unlink()
    except OSError:
        pass


# ============================================================
# 1. CREAR TAREA
# ============================================================

@router.post(
    "",
    response_model=TareaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_tarea(
    tarea_in: TareaCreate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    id_rol = exigir_miembro_proyecto(
        tarea_in.id_proyecto,
        id_usuario_actual,
        db,
    )

    if id_rol != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden crear tareas.",
        )

    estado_inicial = (
        EstadoTarea.ASIGNADA.value
        if tarea_in.id_usuario_asignado
        else EstadoTarea.PENDIENTE.value
    )

    nueva_tarea = TareaDB(
        id_proyecto=tarea_in.id_proyecto,
        titulo=tarea_in.titulo,
        descripcion=tarea_in.descripcion,
        prioridad=tarea_in.prioridad.value,
        estado=estado_inicial,
        fecha_inicio=tarea_in.fecha_inicio,
        fecha_limite=tarea_in.fecha_limite,
    )

    try:
        db.add(nueva_tarea)
        db.flush()

        if tarea_in.id_usuario_asignado is not None:
            exigir_miembro_proyecto(
                tarea_in.id_proyecto,
                tarea_in.id_usuario_asignado,
                db,
            )

            db.add(
                TareaAsignadaDB(
                    id_tarea=nueva_tarea.id_tarea,
                    id_usuario=tarea_in.id_usuario_asignado,
                )
            )

        db.commit()
        db.refresh(nueva_tarea)
        return tarea_a_dict(nueva_tarea, db)

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No fue posible crear la asignación de la tarea.",
        ) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear la tarea.",
        ) from exc


# ============================================================
# 2. OBTENER DETALLE COMPLETO
# ============================================================

@router.get(
    "/{id_tarea}/detalle",
    response_model=TareaDetalleResponse,
)
def obtener_detalle_tarea(
    id_tarea: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    tarea = obtener_tarea_o_404(id_tarea, db)
    id_rol = exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )
    asignacion = obtener_asignacion(id_tarea, db)
    es_administrador = id_rol == 1

    comentarios = (
        db.query(ComentarioTareaDB)
        .options(joinedload(ComentarioTareaDB.usuario))
        .filter(ComentarioTareaDB.id_tarea == id_tarea)
        .order_by(ComentarioTareaDB.fecha_creacion.asc())
        .all()
    )

    evidencias = (
        db.query(EvidenciaTareaDB)
        .options(joinedload(EvidenciaTareaDB.usuario))
        .filter(EvidenciaTareaDB.id_tarea == id_tarea)
        .order_by(EvidenciaTareaDB.fecha_creacion.desc())
        .all()
    )

    return {
        "tarea": tarea_a_dict(tarea, db),
        "comentarios": [
            comentario_a_dict(
                comentario,
                id_usuario_actual,
                es_administrador,
            )
            for comentario in comentarios
        ],
        "evidencias": [
            evidencia_a_dict(
                evidencia,
                id_usuario_actual,
                es_administrador,
            )
            for evidencia in evidencias
        ],
        "permisos": construir_permisos(
            id_usuario_actual,
            id_rol,
            asignacion,
        ),
    }


# ============================================================
# 3. TOMAR UNA TAREA LIBRE
# ============================================================

@router.patch(
    "/{id_tarea}/tomar",
    response_model=TomarTareaResponse,
)
def tomar_tarea(
    id_tarea: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    tarea = obtener_tarea_o_404(id_tarea, db)
    id_rol = exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )

    asignacion_actual = obtener_asignacion(id_tarea, db)

    if asignacion_actual:
        if asignacion_actual.id_usuario == id_usuario_actual:
            return {
                "mensaje": "Ya eres responsable de esta tarea.",
                "tarea": tarea_a_dict(tarea, db),
                "permisos": construir_permisos(
                    id_usuario_actual,
                    id_rol,
                    asignacion_actual,
                ),
            }

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La tarea ya fue tomada por otro integrante.",
        )

    try:
        nueva_asignacion = TareaAsignadaDB(
            id_tarea=id_tarea,
            id_usuario=id_usuario_actual,
        )
        db.add(nueva_asignacion)
        db.flush()

        if tarea.estado == EstadoTarea.PENDIENTE.value:
            tarea.estado = EstadoTarea.ASIGNADA.value

        tarea.fecha_actualizacion = datetime.utcnow()

        db.commit()
        db.refresh(tarea)

        asignacion_confirmada = obtener_asignacion(id_tarea, db)

        return {
            "mensaje": "Actividad tomada correctamente.",
            "tarea": tarea_a_dict(tarea, db),
            "permisos": construir_permisos(
                id_usuario_actual,
                id_rol,
                asignacion_confirmada,
            ),
        }

    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La tarea ya fue tomada por otro integrante.",
        ) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible tomar la tarea.",
        ) from exc


# ============================================================
# 4. CAMBIAR ESTADO
# ============================================================

@router.patch(
    "/{id_tarea}/estado",
    status_code=status.HTTP_200_OK,
)
def cambiar_estado_tarea(
    id_tarea: int,
    estado_update: TareaEstadoUpdate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    tarea = obtener_tarea_o_404(id_tarea, db)
    exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )

    tarea.estado = estado_update.estado.value
    tarea.fecha_actualizacion = datetime.utcnow()

    try:
        db.commit()
        return {
            "mensaje": "Estado actualizado.",
            "nuevo_estado": tarea.estado,
        }
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible actualizar el estado.",
        ) from exc


# ============================================================
# 5. ASIGNAR O DESASIGNAR
# ============================================================

@router.patch(
    "/{id_tarea}/asignar",
    status_code=status.HTTP_200_OK,
)
def asignar_reclamar_tarea(
    id_tarea: int,
    asignacion_update: TareaAsignarUpdate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    tarea = obtener_tarea_o_404(id_tarea, db)
    id_rol_actual = exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )

    es_administrador = id_rol_actual == 1
    id_objetivo = asignacion_update.id_usuario_asignado
    asignacion_actual = obtener_asignacion(id_tarea, db)

    if not es_administrador:
        if id_objetivo != id_usuario_actual:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Solo un administrador puede asignar tareas "
                    "a otros usuarios o desasignarlas."
                ),
            )

        if asignacion_actual:
            if asignacion_actual.id_usuario == id_usuario_actual:
                return {
                    "mensaje": "Ya eres responsable de esta tarea."
                }

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La tarea ya está asignada a otro integrante.",
            )

    if id_objetivo is not None:
        exigir_miembro_proyecto(
            tarea.id_proyecto,
            id_objetivo,
            db,
        )

    try:
        if es_administrador:
            (
                db.query(TareaAsignadaDB)
                .filter(TareaAsignadaDB.id_tarea == id_tarea)
                .delete(synchronize_session=False)
            )
            db.flush()

        if id_objetivo is None:
            tarea.estado = EstadoTarea.PENDIENTE.value
        elif not asignacion_actual or es_administrador:
            db.add(
                TareaAsignadaDB(
                    id_tarea=id_tarea,
                    id_usuario=id_objetivo,
                )
            )

            if tarea.estado == EstadoTarea.PENDIENTE.value:
                tarea.estado = EstadoTarea.ASIGNADA.value

        tarea.fecha_actualizacion = datetime.utcnow()
        db.commit()

        return {
            "mensaje": "Asignación actualizada correctamente."
        }

    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La tarea ya fue asignada por otro usuario.",
        ) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible actualizar la asignación.",
        ) from exc


# ============================================================
# 6. EDITAR DETALLES
# ============================================================

@router.put(
    "/{id_tarea}",
    response_model=TareaResponse,
    status_code=status.HTTP_200_OK,
)
def editar_detalles_tarea(
    id_tarea: int,
    tarea_in: TareaUpdate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    tarea = obtener_tarea_o_404(id_tarea, db)

    id_rol = exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )

    if id_rol != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden editar la tarea.",
        )

    update_data = tarea_in.model_dump(
        exclude_unset=True
    )

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron datos para actualizar.",
        )

    # Tomar las fechas nuevas si fueron enviadas.
    # En caso contrario, conservar las actuales.
    fecha_inicio_final = update_data.get(
        "fecha_inicio",
        tarea.fecha_inicio,
    )

    fecha_limite_final = update_data.get(
        "fecha_limite",
        tarea.fecha_limite,
    )

    if (
        fecha_inicio_final is not None
        and fecha_limite_final is not None
        and fecha_limite_final < fecha_inicio_final
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "La fecha límite no puede ser anterior "
                "a la fecha de inicio."
            ),
        )

    for campo, valor in update_data.items():
        if isinstance(valor, Enum):
            valor = valor.value

        setattr(tarea, campo, valor)

    tarea.fecha_actualizacion = datetime.utcnow()

    try:
        db.commit()
        db.refresh(tarea)

        return tarea_a_dict(
            tarea,
            db,
        )

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible editar la tarea.",
        ) from exc


# ============================================================
# 7. CREAR COMENTARIO
# ============================================================

@router.post(
    "/{id_tarea}/comentarios",
    response_model=ComentarioTareaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_comentario(
    id_tarea: int,
    comentario_in: ComentarioTareaCreate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    tarea = obtener_tarea_o_404(id_tarea, db)
    id_rol = exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )

    comentario = ComentarioTareaDB(
        id_tarea=id_tarea,
        id_usuario=id_usuario_actual,
        contenido=comentario_in.contenido,
    )

    try:
        db.add(comentario)
        db.commit()
        db.refresh(comentario)

        comentario = (
            db.query(ComentarioTareaDB)
            .options(joinedload(ComentarioTareaDB.usuario))
            .filter(
                ComentarioTareaDB.id_comentario
                == comentario.id_comentario
            )
            .first()
        )

        return comentario_a_dict(
            comentario,
            id_usuario_actual,
            id_rol == 1,
        )

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible publicar el comentario.",
        ) from exc


# ============================================================
# 8. EDITAR COMENTARIO PROPIO
# ============================================================

@router.put(
    "/comentarios/{id_comentario}",
    response_model=ComentarioTareaResponse,
)
def editar_comentario(
    id_comentario: int,
    comentario_in: ComentarioTareaUpdate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    comentario = (
        db.query(ComentarioTareaDB)
        .filter(
            ComentarioTareaDB.id_comentario == id_comentario
        )
        .first()
    )

    if not comentario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comentario no encontrado.",
        )

    tarea = obtener_tarea_o_404(comentario.id_tarea, db)
    id_rol = exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )

    if comentario.id_usuario != id_usuario_actual:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes editar tus propios comentarios.",
        )

    comentario.contenido = comentario_in.contenido
    comentario.fecha_actualizacion = datetime.utcnow()

    try:
        db.commit()
        db.refresh(comentario)

        comentario = (
            db.query(ComentarioTareaDB)
            .options(joinedload(ComentarioTareaDB.usuario))
            .filter(
                ComentarioTareaDB.id_comentario == id_comentario
            )
            .first()
        )

        return comentario_a_dict(
            comentario,
            id_usuario_actual,
            id_rol == 1,
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible editar el comentario.",
        ) from exc


# ============================================================
# 9. ELIMINAR COMENTARIO
# ============================================================

@router.delete(
    "/comentarios/{id_comentario}",
    status_code=status.HTTP_200_OK,
)
def eliminar_comentario(
    id_comentario: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    comentario = (
        db.query(ComentarioTareaDB)
        .filter(
            ComentarioTareaDB.id_comentario == id_comentario
        )
        .first()
    )

    if not comentario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comentario no encontrado.",
        )

    tarea = obtener_tarea_o_404(comentario.id_tarea, db)
    id_rol = exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )

    es_autor = comentario.id_usuario == id_usuario_actual
    es_administrador = id_rol == 1

    if not es_autor and not es_administrador:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para eliminar este comentario.",
        )

    try:
        db.delete(comentario)
        db.commit()
        return {"mensaje": "Comentario eliminado correctamente."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible eliminar el comentario.",
        ) from exc


# ============================================================
# 10. AGREGAR EVIDENCIA MEDIANTE ENLACE
# ============================================================

@router.post(
    "/{id_tarea}/evidencias/enlace",
    response_model=EvidenciaTareaResponse,
    status_code=status.HTTP_201_CREATED,
)
def agregar_evidencia_enlace(
    id_tarea: int,
    evidencia_in: EvidenciaEnlaceCreate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    tarea = obtener_tarea_o_404(id_tarea, db)
    id_rol = exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )
    exigir_permiso_evidencia(
        tarea,
        id_usuario_actual,
        id_rol,
        db,
    )

    evidencia = EvidenciaTareaDB(
        id_tarea=id_tarea,
        id_usuario=id_usuario_actual,
        tipo="enlace",
        nombre=evidencia_in.nombre,
        descripcion=evidencia_in.descripcion,
        url=str(evidencia_in.url),
    )

    try:
        db.add(evidencia)
        db.commit()
        db.refresh(evidencia)

        evidencia = (
            db.query(EvidenciaTareaDB)
            .options(joinedload(EvidenciaTareaDB.usuario))
            .filter(
                EvidenciaTareaDB.id_evidencia
                == evidencia.id_evidencia
            )
            .first()
        )

        return evidencia_a_dict(
            evidencia,
            id_usuario_actual,
            id_rol == 1,
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible agregar el enlace.",
        ) from exc


# ============================================================
# 11. SUBIR EVIDENCIA DE ARCHIVO
# ============================================================

@router.post(
    "/{id_tarea}/evidencias/archivo",
    response_model=EvidenciaTareaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def agregar_evidencia_archivo(
    id_tarea: int,
    archivo: UploadFile = File(...),
    nombre: Optional[str] = Form(None),
    descripcion: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    tarea = obtener_tarea_o_404(id_tarea, db)
    id_rol = exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )
    exigir_permiso_evidencia(
        tarea,
        id_usuario_actual,
        id_rol,
        db,
    )

    if not archivo.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes seleccionar un archivo.",
        )

    nombre_original = Path(archivo.filename).name

    if len(nombre_original) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre del archivo es demasiado largo.",
        )

    extension = Path(nombre_original).suffix.lower()

    if extension not in EXTENSIONES_PERMITIDAS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="El tipo de archivo no está permitido.",
        )

    tipo_mime = (
        archivo.content_type
        or mimetypes.guess_type(nombre_original)[0]
        or "application/octet-stream"
    )

    if tipo_mime not in TIPOS_MIME_PERMITIDOS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="El contenido del archivo no está permitido.",
        )

    nombre_evidencia = (nombre or nombre_original).strip()
    descripcion_limpia = (
        descripcion.strip()
        if descripcion and descripcion.strip()
        else None
    )

    if not nombre_evidencia:
        nombre_evidencia = nombre_original

    if len(nombre_evidencia) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de la evidencia es demasiado largo.",
        )

    if descripcion_limpia and len(descripcion_limpia) > 2000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La descripción no puede superar 2000 caracteres.",
        )

    carpeta_tarea = TAREAS_UPLOADS_DIR / str(id_tarea)
    carpeta_tarea.mkdir(parents=True, exist_ok=True)

    nombre_guardado = f"{uuid4().hex}{extension}"
    ruta_destino = carpeta_tarea / nombre_guardado
    tamano_total = 0

    try:
        with ruta_destino.open("wb") as destino:
            while True:
                bloque = await archivo.read(TAMANO_BLOQUE)

                if not bloque:
                    break

                tamano_total += len(bloque)

                if tamano_total > MAX_ARCHIVO_BYTES:
                    raise HTTPException(
                        status_code=(
                            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
                        ),
                        detail="El archivo supera el límite de 10 MB.",
                    )

                destino.write(bloque)

    except HTTPException:
        eliminar_archivo_silenciosamente(ruta_destino)
        raise
    except OSError as exc:
        eliminar_archivo_silenciosamente(ruta_destino)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible guardar el archivo.",
        ) from exc
    finally:
        await archivo.close()

    ruta_relativa = (
        Path("tareas")
        / str(id_tarea)
        / nombre_guardado
    ).as_posix()

    evidencia = EvidenciaTareaDB(
        id_tarea=id_tarea,
        id_usuario=id_usuario_actual,
        tipo="archivo",
        nombre=nombre_evidencia,
        descripcion=descripcion_limpia,
        url=None,
        nombre_archivo_original=nombre_original,
        nombre_archivo_guardado=nombre_guardado,
        ruta_archivo=ruta_relativa,
        tipo_mime=tipo_mime,
        tamano_bytes=tamano_total,
    )

    try:
        db.add(evidencia)
        db.commit()
        db.refresh(evidencia)

        evidencia = (
            db.query(EvidenciaTareaDB)
            .options(joinedload(EvidenciaTareaDB.usuario))
            .filter(
                EvidenciaTareaDB.id_evidencia
                == evidencia.id_evidencia
            )
            .first()
        )

        return evidencia_a_dict(
            evidencia,
            id_usuario_actual,
            id_rol == 1,
        )

    except Exception as exc:
        db.rollback()
        eliminar_archivo_silenciosamente(ruta_destino)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible registrar la evidencia.",
        ) from exc


# ============================================================
# 12. DESCARGAR EVIDENCIA
# ============================================================

@router.get(
    "/evidencias/{id_evidencia}/descargar",
    response_class=FileResponse,
)
def descargar_evidencia(
    id_evidencia: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    evidencia = (
        db.query(EvidenciaTareaDB)
        .filter(EvidenciaTareaDB.id_evidencia == id_evidencia)
        .first()
    )

    if not evidencia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidencia no encontrada.",
        )

    tarea = obtener_tarea_o_404(evidencia.id_tarea, db)
    exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )

    if evidencia.tipo != "archivo" or not evidencia.ruta_archivo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta evidencia no contiene un archivo descargable.",
        )

    ruta_archivo = resolver_ruta_archivo(evidencia.ruta_archivo)

    if not ruta_archivo.exists() or not ruta_archivo.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El archivo ya no existe en el servidor.",
        )

    return FileResponse(
        path=ruta_archivo,
        media_type=(
            evidencia.tipo_mime
            or "application/octet-stream"
        ),
        filename=(
            evidencia.nombre_archivo_original
            or evidencia.nombre
        ),
    )


# ============================================================
# 13. ELIMINAR EVIDENCIA
# ============================================================

@router.delete(
    "/evidencias/{id_evidencia}",
    status_code=status.HTTP_200_OK,
)
def eliminar_evidencia(
    id_evidencia: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    evidencia = (
        db.query(EvidenciaTareaDB)
        .filter(EvidenciaTareaDB.id_evidencia == id_evidencia)
        .first()
    )

    if not evidencia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidencia no encontrada.",
        )

    tarea = obtener_tarea_o_404(evidencia.id_tarea, db)
    id_rol = exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )

    es_autor = evidencia.id_usuario == id_usuario_actual
    es_administrador = id_rol == 1

    if not es_autor and not es_administrador:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para eliminar esta evidencia.",
        )

    ruta_archivo = None

    if evidencia.ruta_archivo:
        ruta_archivo = resolver_ruta_archivo(
            evidencia.ruta_archivo
        )

    try:
        db.delete(evidencia)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible eliminar la evidencia.",
        ) from exc

    eliminar_archivo_silenciosamente(ruta_archivo)

    return {"mensaje": "Evidencia eliminada correctamente."}


# ============================================================
# 14. ELIMINAR TAREA
# ============================================================

@router.delete(
    "/{id_tarea}",
    status_code=status.HTTP_200_OK,
)
def eliminar_tarea(
    id_tarea: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    tarea = obtener_tarea_o_404(id_tarea, db)
    id_rol = exigir_miembro_proyecto(
        tarea.id_proyecto,
        id_usuario_actual,
        db,
    )

    if id_rol != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden eliminar tareas.",
        )

    rutas_archivos = (
        db.query(EvidenciaTareaDB.ruta_archivo)
        .filter(
            EvidenciaTareaDB.id_tarea == id_tarea,
            EvidenciaTareaDB.ruta_archivo.isnot(None),
        )
        .all()
    )

    try:
        (
            db.query(TareaAsignadaDB)
            .filter(TareaAsignadaDB.id_tarea == id_tarea)
            .delete(synchronize_session=False)
        )
        db.delete(tarea)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al eliminar la tarea.",
        ) from exc

    for (ruta_relativa,) in rutas_archivos:
        if ruta_relativa:
            eliminar_archivo_silenciosamente(
                resolver_ruta_archivo(ruta_relativa)
            )

    carpeta_tarea = TAREAS_UPLOADS_DIR / str(id_tarea)

    try:
        carpeta_tarea.rmdir()
    except OSError:
        pass

    return {
        "mensaje": (
            f"La tarea con ID {id_tarea} "
            "fue eliminada correctamente."
        )
    }