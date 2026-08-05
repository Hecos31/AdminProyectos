from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db, db_mongo
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

# Para notificaciones en bd
from routers.notificaciones import disparar_notificacion

router = APIRouter(
    prefix="/proyectos",
    tags=["Proyectos"]
)


@router.post("", response_model=ProyectoResponse, status_code=status.HTTP_201_CREATED)
async def crear_proyecto(
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

        # --- CREAR CHAT GRUPAL EN MONGODB PARA EL PROYECTO ---
        ahora = datetime.now(timezone.utc)
        nueva_conversacion = {
            "nombre": f"Proyecto: {nuevo_proyecto.nombre}",
            "tipo": "grupal",
            "id_proyecto": nuevo_proyecto.id_proyecto,
            "creado_en": ahora,
            "participantes": [
                {
                    "id_usuario": id_usuario_actual,
                    "ultima_lectura": ahora
                }
            ]
        }
        await db_mongo.conversations.insert_one(nueva_conversacion)

        # --- DISPARADOR DE NOTIFICACIÓN (Para el creador) ---
        await disparar_notificacion(
            usuario_id=id_usuario_actual,
            tipo="PROYECTO_CREADO",
            mensaje=f"Has creado el proyecto '{nuevo_proyecto.nombre}' exitosamente.",
            db=db
        )

    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno al registrar el proyecto: {str(error)}"
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
async def agregar_colaborador(
    colaborador_in: ColaboradorCreate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    id_rol_admin = obtener_rol_en_proyecto(colaborador_in.id_proyecto, id_usuario_actual, db)

    if id_rol_admin != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden agregar colaboradores."
        )

    usuario_nuevo = db.query(UsuarioDB).filter(
        UsuarioDB.correo == colaborador_in.correo_colaborador
    ).first()

    if not usuario_nuevo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario no existe."
        )

    rol_existente = obtener_rol_en_proyecto(
        colaborador_in.id_proyecto,
        usuario_nuevo.id_usuario,
        db
    )

    if rol_existente is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario ya es colaborador."
        )

    nuevo_colaborador = ProyectoUsuarioDB(
        id_proyecto=colaborador_in.id_proyecto,
        id_usuario=usuario_nuevo.id_usuario,
        id_rol=colaborador_in.id_rol
    )

    try:
        db.add(nuevo_colaborador)
        db.commit()

        # --- AGREGAR EL COLABORADOR AL CHAT GRUPAL EN MONGODB ---
        ahora = datetime.now(timezone.utc)
        await db_mongo.conversations.update_one(
            {"id_proyecto": colaborador_in.id_proyecto, "tipo": "grupal"},
            {
                "$addToSet": {
                    "participantes": {
                        "id_usuario": usuario_nuevo.id_usuario,
                        "ultima_lectura": ahora
                    }
                }
            }
        )

        # --- DISPARADOR DE NOTIFICACIÓN ---
        await disparar_notificacion(
            usuario_id=usuario_nuevo.id_usuario,
            tipo="NUEVO_PROYECTO",
            mensaje="Te han agregado como colaborador a un nuevo proyecto.",
            db=db
        )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al agregar el colaborador."
        )

    return {"mensaje": f"Usuario {usuario_nuevo.correo} agregado exitosamente."}


@router.delete("/colaboradores", status_code=status.HTTP_200_OK)
async def eliminar_colaborador(
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

    rol_colaborador = obtener_rol_en_proyecto(
        colaborador_del.id_proyecto,
        colaborador_del.id_usuario,
        db
    )

    if rol_colaborador is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario especificado no pertenece a este proyecto."
        )

    proyecto = db.query(ProyectoDB).filter(
        ProyectoDB.id_proyecto == colaborador_del.id_proyecto
    ).first()
    nombre_proyecto = proyecto.nombre if proyecto else "un proyecto"

    try:
        tareas_del_proyecto = db.query(TareaDB.id_tarea).filter(
            TareaDB.id_proyecto == colaborador_del.id_proyecto
        ).subquery()

        db.query(TareaAsignadaDB).filter(
            TareaAsignadaDB.id_usuario == colaborador_del.id_usuario,
            TareaAsignadaDB.id_tarea.in_(tareas_del_proyecto)
        ).delete(synchronize_session=False)

        db.query(ProyectoUsuarioDB).filter(
            ProyectoUsuarioDB.id_proyecto == colaborador_del.id_proyecto,
            ProyectoUsuarioDB.id_usuario == colaborador_del.id_usuario
        ).delete()

        db.commit()

        # --- REMOVER DEL CHAT GRUPAL EN MONGODB ---
        await db_mongo.conversations.update_one(
            {"id_proyecto": colaborador_del.id_proyecto, "tipo": "grupal"},
            {
                "$pull": {
                    "participantes": {
                        "id_usuario": colaborador_del.id_usuario
                    }
                }
            }
        )

        # --- DISPARADOR DE NOTIFICACIÓN ---
        await disparar_notificacion(
            usuario_id=colaborador_del.id_usuario,
            tipo="COLABORADOR_REMOVIDO",
            mensaje=f"Has sido removido del proyecto '{nombre_proyecto}'.",
            db=db
        )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al eliminar al colaborador del proyecto."
        )

    return {"mensaje": f"El usuario {colaborador_del.id_usuario} fue removido exitosamente."}


@router.put("/colaboradores", status_code=status.HTTP_200_OK)
async def cambiar_rol_colaborador(
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

    proyecto = db.query(ProyectoDB).filter(
        ProyectoDB.id_proyecto == colaborador_update.id_proyecto
    ).first()
    nombre_proyecto = proyecto.nombre if proyecto else "un proyecto"
    nombre_nuevo_rol = "Administrador" if colaborador_update.id_rol_nuevo == 1 else "Colaborador"

    vinculo_proyecto.id_rol = colaborador_update.id_rol_nuevo

    try:
        db.commit()

        # --- DISPARADOR DE NOTIFICACIÓN ---
        await disparar_notificacion(
            usuario_id=colaborador_update.id_usuario,
            tipo="CAMBIO_ROL",
            mensaje=f"Tu rol en el proyecto '{nombre_proyecto}' ha cambiado a {nombre_nuevo_rol}.",
            db=db
        )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al actualizar el rol del colaborador."
        )

    return {"mensaje": "El rol ha sido actualizado exitosamente."}


@router.put("", response_model=ProyectoResponse, status_code=status.HTTP_200_OK)
async def editar_proyecto(
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

    colaboradores = db.query(ProyectoUsuarioDB).filter(
        ProyectoUsuarioDB.id_proyecto == proyecto.id_proyecto
    ).all()

    try:
        db.commit()
        db.refresh(proyecto)

        # --- ACTUALIZAR NOMBRE DEL CHAT SI SE EDITÓ EL PROYECTO ---
        if "nombre" in update_data:
            await db_mongo.conversations.update_one(
                {"id_proyecto": proyecto.id_proyecto, "tipo": "grupal"},
                {"$set": {"nombre": f"Proyecto: {proyecto.nombre}"}}
            )

        # --- DISPARADOR DE NOTIFICACIÓN ---
        for colab in colaboradores:
            if colab.id_usuario != id_usuario_actual:
                await disparar_notificacion(
                    usuario_id=colab.id_usuario,
                    tipo="PROYECTO_ACTUALIZADO",
                    mensaje=f"El proyecto '{proyecto.nombre}' ha sido modificado.",
                    db=db
                )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al actualizar el proyecto."
        )

    return proyecto


@router.delete("", status_code=status.HTTP_200_OK)
async def eliminar_proyecto(
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

    nombre_proyecto = proyecto.nombre
    colaboradores = db.query(ProyectoUsuarioDB).filter(
        ProyectoUsuarioDB.id_proyecto == proyecto.id_proyecto
    ).all()

    try:
        db.query(TareaDB).filter(TareaDB.id_proyecto == proyecto_del.id_proyecto).delete()
        db.query(ProyectoUsuarioDB).filter(ProyectoUsuarioDB.id_proyecto == proyecto_del.id_proyecto).delete()
        db.delete(proyecto)
        db.commit()

        # --- ELIMINAR EL CHAT GRUPAL Y SUS MENSAJES DE MONGODB ---
        chat_proyecto = await db_mongo.conversations.find_one(
            {"id_proyecto": proyecto_del.id_proyecto, "tipo": "grupal"}
        )
        if chat_proyecto:
            await db_mongo.messages.delete_many({"id_conversacion": chat_proyecto["_id"]})
            await db_mongo.conversations.delete_one({"_id": chat_proyecto["_id"]})

        # --- DISPARADOR DE NOTIFICACIÓN ---
        for colab in colaboradores:
            if colab.id_usuario != id_usuario_actual:
                await disparar_notificacion(
                    usuario_id=colab.id_usuario,
                    tipo="PROYECTO_ELIMINADO",
                    mensaje=f"El proyecto '{nombre_proyecto}' ha sido eliminado por un administrador.",
                    db=db
                )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al eliminar el proyecto y sus dependencias."
        )

    return {"mensaje": f"El proyecto {proyecto_del.id_proyecto} y todos sus datos relacionados fueron eliminados correctamente."}


@router.get("/{id_proyecto}/mis-tareas", response_model=List[TareaResponse])
def obtener_mis_tareas_proyecto(
    id_proyecto: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    # 1. Verificar acceso y obtener el rol del usuario en el proyecto
    rol = obtener_rol_en_proyecto(id_proyecto, id_usuario_actual, db)

    if rol is None:
        raise HTTPException(status_code=403, detail="No tienes acceso a este proyecto.")

    # 2. Filtrar actividades:
    # Si es Administrador (rol == 1), obtiene TODAS las tareas.
    # Si es Colaborador, obtiene SOLO las tareas asignadas a su id_usuario.
    if rol == 1:
        tareas_db = db.query(TareaDB).filter(TareaDB.id_proyecto == id_proyecto).all()
    else:
        tareas_db = (
            db.query(TareaDB)
            .join(TareaAsignadaDB, TareaAsignadaDB.id_tarea == TareaDB.id_tarea)
            .filter(
                TareaDB.id_proyecto == id_proyecto,
                TareaAsignadaDB.id_usuario == id_usuario_actual
            )
            .distinct()
            .all()
        )

    resultado = []

    # 3. Mapear cada tarea y adjuntar información del responsable
    for tarea in tareas_db:
        tarea_dict = {
            columna.name: getattr(tarea, columna.name)
            for columna in tarea.__table__.columns
        }

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

        tarea_dict["usuario_asignado"] = usuario_data
        resultado.append(tarea_dict)

    return resultado
# =================================================================
# NUEVO ENDPOINT PARA EL CALENDARIO GLOBAL DE ACTIVIDADES
# =================================================================
@router.get("/calendario/todas-mis-tareas", response_model=List[TareaResponse], status_code=status.HTTP_200_OK)
def obtener_todas_mis_tareas_calendario(
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    """
    Obtiene TODAS las tareas asignadas al usuario actual a través
    de todos los proyectos en los que participa para mostrarlas en el calendario.
    """
    tareas_db = (
        db.query(TareaDB)
        .join(TareaAsignadaDB, TareaAsignadaDB.id_tarea == TareaDB.id_tarea)
        .join(ProyectoDB, ProyectoDB.id_proyecto == TareaDB.id_proyecto)
        .join(ProyectoUsuarioDB, ProyectoUsuarioDB.id_proyecto == ProyectoDB.id_proyecto)
        .filter(
            TareaAsignadaDB.id_usuario == id_usuario_actual,
            ProyectoUsuarioDB.id_usuario == id_usuario_actual
        )
        .distinct()
        .all()
    )

    resultado = []
    for tarea in tareas_db:
        tarea_dict = {
            columna.name: getattr(tarea, columna.name)
            for columna in tarea.__table__.columns
        }
        
        # Adjuntar nombre del proyecto para mostrarlo en el calendario
        proyecto = db.query(ProyectoDB).filter(ProyectoDB.id_proyecto == tarea.id_proyecto).first()
        tarea_dict["nombre_proyecto"] = proyecto.nombre if proyecto else "Proyecto"
        
        resultado.append(tarea_dict)

    return resultado