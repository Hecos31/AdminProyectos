from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import ProyectoDB, ProyectoUsuarioDB, TareaDB, UsuarioDB, TareaAsignadaDB
from schemas import (
    ProyectoCreate,
    ProyectoResponse,
    ProyectoUpdate,
    ProyectoDelete,
    ColaboradorCreate,
    ColaboradorDelete,
    ColaboradorUpdate,
    TareaResponse,
)
from auth import obtener_usuario_actual, obtener_rol_en_proyecto

router = APIRouter(prefix="/proyectos", tags=["Proyectos"])


@router.post("", response_model=ProyectoResponse, status_code=status.HTTP_201_CREATED)
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
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al registrar el proyecto."
        )

    return nuevo_proyecto


@router.get("", status_code=status.HTTP_200_OK)
def obtener_proyectos(
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    proyectos = db.query(ProyectoDB).join(
        ProyectoUsuarioDB,
        ProyectoDB.id_proyecto == ProyectoUsuarioDB.id_proyecto
    ).filter(
        ProyectoUsuarioDB.id_usuario == id_usuario_actual
    ).all()
    
    return proyectos


@router.get("/{id_proyecto}", status_code=status.HTTP_200_OK)
def obtener_proyecto(
    id_proyecto: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    rol = obtener_rol_en_proyecto(id_proyecto, id_usuario_actual, db)
    if rol is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este proyecto."
        )
    
    proyecto = db.query(ProyectoDB).filter(ProyectoDB.id_proyecto == id_proyecto).first()
    if not proyecto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El proyecto no existe."
        )
    
    return proyecto


@router.get("/{id_proyecto}/tareas", response_model=List[TareaResponse])
def obtener_tareas_proyecto(
    id_proyecto: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    rol = obtener_rol_en_proyecto(id_proyecto, id_usuario_actual, db)
    if rol is None:
        raise HTTPException(status_code=403, detail="No tienes acceso a este proyecto.")
    
    tareas_db = db.query(TareaDB).filter(TareaDB.id_proyecto == id_proyecto).all()
    resultado = []

    for tarea in tareas_db:
        asignacion = db.query(TareaAsignadaDB).filter(TareaAsignadaDB.id_tarea == tarea.id_tarea).first()
        usuario_data = None
        
        if asignacion:
            usuario = db.query(UsuarioDB).filter(UsuarioDB.id_usuario == asignacion.id_usuario).first()
            if usuario:
                usuario_data = {
                    "id_usuario": usuario.id_usuario,
                    "nombre": usuario.nombre,
                    "apellido": usuario.apellido,
                    "correo": usuario.correo
                }
        
        tarea_dict = tarea.__dict__.copy()
        tarea_dict["usuario_asignado"] = usuario_data
        resultado.append(tarea_dict)

    return resultado


@router.get("/{id_proyecto}/colaboradores", status_code=status.HTTP_200_OK)
def obtener_colaboradores(
    id_proyecto: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    rol = obtener_rol_en_proyecto(id_proyecto, id_usuario_actual, db)
    if rol is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este proyecto."
        )
    
    colaboradores = db.query(UsuarioDB).join(
        ProyectoUsuarioDB,
        UsuarioDB.id_usuario == ProyectoUsuarioDB.id_usuario
    ).filter(
        ProyectoUsuarioDB.id_proyecto == id_proyecto
    ).all()
    
    resultado = []
    for usuario in colaboradores:
        rol_usuario = obtener_rol_en_proyecto(id_proyecto, usuario.id_usuario, db)
        resultado.append({
            "id_usuario": usuario.id_usuario,
            "nombre": usuario.nombre,
            "apellido": usuario.apellido,
            "correo": usuario.correo,
            "id_rol": rol_usuario
        })
    
    return resultado


@router.post("/colaboradores", status_code=status.HTTP_201_CREATED)
def agregar_colaborador(
    colaborador_in: ColaboradorCreate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    id_rol_admin = obtener_rol_en_proyecto(colaborador_in.id_proyecto, id_usuario_actual, db)
    if id_rol_admin != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden agregar colaboradores a este proyecto."
        )

    usuario_nuevo = db.query(UsuarioDB).filter(UsuarioDB.correo == colaborador_in.correo_colaborador).first()
    if not usuario_nuevo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario con el correo especificado no existe en el sistema."
        )

    rol_existente = obtener_rol_en_proyecto(colaborador_in.id_proyecto, usuario_nuevo.id_usuario, db)
    if rol_existente is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario ya es un colaborador de este proyecto."
        )

    nuevo_colaborador = ProyectoUsuarioDB(
        id_proyecto=colaborador_in.id_proyecto,
        id_usuario=usuario_nuevo.id_usuario,
        id_rol=colaborador_in.id_rol
    )

    try:
        db.add(nuevo_colaborador)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al agregar el colaborador al proyecto."
        )

    return {"mensaje": f"Usuario {usuario_nuevo.correo} agregado exitosamente con el rol {colaborador_in.id_rol}."}


@router.delete("/colaboradores", status_code=status.HTTP_200_OK)
def eliminar_colaborador(
    colaborador_del: ColaboradorDelete,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    id_rol_admin = obtener_rol_en_proyecto(colaborador_del.id_proyecto, id_usuario_actual, db)
    if id_rol_admin != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden eliminar colaboradores de este proyecto."
        )

    if id_usuario_actual == colaborador_del.id_usuario:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminarte a ti mismo del proyecto."
        )

    rol_colaborador = obtener_rol_en_proyecto(colaborador_del.id_proyecto, colaborador_del.id_usuario, db)
    if rol_colaborador is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario especificado no pertenece a este proyecto."
        )

    try:
        from models import TareaAsignadaDB
        tareas_del_proyecto = db.query(TareaDB.id_tarea).filter(TareaDB.id_proyecto == colaborador_del.id_proyecto).subquery()
        
        db.query(TareaAsignadaDB).filter(
            TareaAsignadaDB.id_usuario == colaborador_del.id_usuario,
            TareaAsignadaDB.id_tarea.in_(tareas_del_proyecto)
        ).delete(synchronize_session=False)

        db.query(ProyectoUsuarioDB).filter(
            ProyectoUsuarioDB.id_proyecto == colaborador_del.id_proyecto,
            ProyectoUsuarioDB.id_usuario == colaborador_del.id_usuario
        ).delete()

        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al eliminar al colaborador del proyecto."
        )

    return {"mensaje": f"El usuario {colaborador_del.id_usuario} fue removido del proyecto {colaborador_del.id_proyecto} exitosamente."}


@router.put("/colaboradores", status_code=status.HTTP_200_OK)
def cambiar_rol_colaborador(
    colaborador_update: ColaboradorUpdate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    id_rol_admin = obtener_rol_en_proyecto(colaborador_update.id_proyecto, id_usuario_actual, db)
    if id_rol_admin != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden cambiar los roles en este proyecto."
        )

    if id_usuario_actual == colaborador_update.id_usuario:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes cambiar tu propio rol. Pídele a otro administrador que lo haga si es necesario."
        )

    vinculo_proyecto = db.query(ProyectoUsuarioDB).filter(
        ProyectoUsuarioDB.id_proyecto == colaborador_update.id_proyecto,
        ProyectoUsuarioDB.id_usuario == colaborador_update.id_usuario
    ).first()

    if not vinculo_proyecto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario especificado no pertenece a este proyecto."
        )

    vinculo_proyecto.id_rol = colaborador_update.id_rol_nuevo

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al actualizar el rol del colaborador."
        )

    return {"mensaje": f"El rol del usuario {colaborador_update.id_usuario} ha sido actualizado al rol {colaborador_update.id_rol_nuevo} exitosamente."}


@router.put("", response_model=ProyectoResponse, status_code=status.HTTP_200_OK)
def editar_proyecto(
    proyecto_in: ProyectoUpdate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    id_rol = obtener_rol_en_proyecto(proyecto_in.id_proyecto, id_usuario_actual, db)
    if id_rol != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden editar este proyecto."
        )

    proyecto = db.query(ProyectoDB).filter(ProyectoDB.id_proyecto == proyecto_in.id_proyecto).first()
    if not proyecto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El proyecto no existe."
        )

    update_data = proyecto_in.model_dump(exclude_unset=True)
    update_data.pop("id_proyecto", None)

    for key, value in update_data.items():
        setattr(proyecto, key, value)

    try:
        db.commit()
        db.refresh(proyecto)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al actualizar el proyecto."
        )

    return proyecto


@router.delete("", status_code=status.HTTP_200_OK)
def eliminar_proyecto(
    proyecto_del: ProyectoDelete,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    id_rol = obtener_rol_en_proyecto(proyecto_del.id_proyecto, id_usuario_actual, db)
    if id_rol != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden eliminar este proyecto."
        )

    proyecto = db.query(ProyectoDB).filter(ProyectoDB.id_proyecto == proyecto_del.id_proyecto).first()
    if not proyecto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El proyecto no existe."
        )

    try:
        db.query(TareaDB).filter(TareaDB.id_proyecto == proyecto_del.id_proyecto).delete()
        db.query(ProyectoUsuarioDB).filter(ProyectoUsuarioDB.id_proyecto == proyecto_del.id_proyecto).delete()
        db.delete(proyecto)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al eliminar el proyecto y sus dependencias."
        )

    return {"mensaje": f"El proyecto {proyecto_del.id_proyecto} y todos sus datos relacionados fueron eliminados correctamente."}

