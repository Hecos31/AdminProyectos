from enum import Enum
import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import TareaDB, TareaAsignadaDB
from schemas import (
    TareaCreate,
    TareaResponse,
    TareaUpdate,
    TareaDelete,
    EstadoTarea
)
from auth import obtener_usuario_actual, obtener_rol_en_proyecto

router = APIRouter(prefix="/tareas", tags=["Tareas"])


@router.post("", response_model=TareaResponse, status_code=status.HTTP_201_CREATED)
def crear_tarea(
    tarea_in: TareaCreate, 
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    id_rol = obtener_rol_en_proyecto(tarea_in.id_proyecto, id_usuario_actual, db)
    if id_rol != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos de Administrador en este proyecto para crear tareas."
        )

    proyecto_existe = db.execute(
        sqlalchemy.text("SELECT 1 FROM proyectos WHERE id_proyecto = :id"), {"id": tarea_in.id_proyecto}
    ).first()
    if not proyecto_existe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El proyecto con id {tarea_in.id_proyecto} no existe."
        )

    if tarea_in.id_usuario_asignado:
        rol_asignado = obtener_rol_en_proyecto(tarea_in.id_proyecto, tarea_in.id_usuario_asignado, db)
        if rol_asignado is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El usuario al que intentas asignar la tarea no es colaborador de este proyecto."
            )
        tarea_in.estado = EstadoTarea.ASIGNADA
    else:
        tarea_in.estado = EstadoTarea.PENDIENTE

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
        db.flush()

        if tarea_in.id_usuario_asignado:
            nueva_asignacion = TareaAsignadaDB(
                id_tarea=nueva_tarea.id_tarea,
                id_usuario=tarea_in.id_usuario_asignado
            )
            db.add(nueva_asignacion)

        db.commit()
        db.refresh(nueva_tarea)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al registrar la tarea."
        )

    return nueva_tarea


@router.put("", response_model=TareaResponse, status_code=status.HTTP_200_OK)
def editar_tarea(
    tarea_in: TareaUpdate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    tarea = db.query(TareaDB).filter(TareaDB.id_tarea == tarea_in.id_tarea).first()
    if not tarea:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La tarea no existe."
        )

    id_rol = obtener_rol_en_proyecto(tarea.id_proyecto, id_usuario_actual, db)
    if id_rol != 1: 
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden editar tareas en este proyecto."
        )

    update_data = tarea_in.model_dump(exclude_unset=True)
    update_data.pop("id_tarea", None)

    for key, value in update_data.items():
        if isinstance(value, Enum):
            setattr(tarea, key, value.value)
        else:
            setattr(tarea, key, value)

    try:
        db.commit()
        db.refresh(tarea)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al actualizar la tarea."
        )

    return tarea


@router.delete("", status_code=status.HTTP_200_OK)
def eliminar_tarea(
    tarea_del: TareaDelete,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    tarea = db.query(TareaDB).filter(TareaDB.id_tarea == tarea_del.id_tarea).first()
    if not tarea:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La tarea no existe."
        )

    id_rol = obtener_rol_en_proyecto(tarea.id_proyecto, id_usuario_actual, db)
    if id_rol != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden eliminar tareas."
        )

    try:
        db.delete(tarea)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al eliminar la tarea."
        )

    return {"mensaje": f"La tarea con ID {tarea_del.id_tarea} fue eliminada correctamente."}