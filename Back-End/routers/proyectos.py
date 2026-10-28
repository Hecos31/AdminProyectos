from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db, db_mongo
from models import ProyectoDB, ProyectoUsuarioDB, TareaDB, UsuarioDB, TareaAsignadaDB, ComentarioTareaDB, EvidenciaTareaDB, RolDB
from schemas import (
    ProyectoCreate,
    ProyectoResponse,
    ProyectoUpdate,
    ProyectoDelete,
    ColaboradorCreate,
    ColaboradorDelete,
    ColaboradorUpdate,
    TareaResponse,
    TareaCalendarioResponse,
    CalendarioProyectoResponse,
    MedallaPulseResponse,
    IntegrantePulseResponse,
    ReconocimientoItemResponse,
    TeamPulseResponse,
    EnviarReconocimientoRequest,
    CronicaPulseRequest,
    CronicaPulseResponse,
)
from auth import obtener_usuario_actual, obtener_rol_en_proyecto

# Para notificaciones en bd
from routers.notificaciones import disparar_notificacion

router = APIRouter(
    prefix="/proyectos",
    tags=["Proyectos"]
)


def _usuario_asignado_tarea(tarea: TareaDB, db: Session):
    """Obtiene el responsable actual de una tarea en formato de respuesta."""

    asignacion = (
        db.query(TareaAsignadaDB)
        .filter(TareaAsignadaDB.id_tarea == tarea.id_tarea)
        .first()
    )

    if not asignacion:
        return None

    usuario = (
        db.query(UsuarioDB)
        .filter(UsuarioDB.id_usuario == asignacion.id_usuario)
        .first()
    )

    if not usuario:
        return None

    return {
        "id_usuario": usuario.id_usuario,
        "nombre": usuario.nombre,
        "apellido": usuario.apellido,
        "correo": usuario.correo,
    }


def _tarea_calendario_dict(
    tarea: TareaDB,
    nombre_proyecto: str,
    db: Session,
) -> dict:
    """Normaliza una tarea para cualquiera de las vistas del calendario."""

    tarea_dict = {
        columna.name: getattr(tarea, columna.name)
        for columna in tarea.__table__.columns
    }

    tarea_dict["usuario_asignado"] = _usuario_asignado_tarea(tarea, db)
    tarea_dict["nombre_proyecto"] = nombre_proyecto or "Proyecto"

    return tarea_dict


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


# =================================================================
# CALENDARIO GLOBAL
# IMPORTANTE: esta ruta está antes de /{id_proyecto} para evitar
# que FastAPI intente interpretar "calendario" como un ID numérico.
# =================================================================
@router.get(
    "/calendario/todas-mis-tareas",
    response_model=List[TareaCalendarioResponse],
    status_code=status.HTTP_200_OK,
)
def obtener_todas_mis_tareas_calendario(
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    """Devuelve las tareas asignadas al usuario en todos sus proyectos."""

    filas = (
        db.query(TareaDB, ProyectoDB)
        .join(
            TareaAsignadaDB,
            TareaAsignadaDB.id_tarea == TareaDB.id_tarea,
        )
        .join(
            ProyectoDB,
            ProyectoDB.id_proyecto == TareaDB.id_proyecto,
        )
        .join(
            ProyectoUsuarioDB,
            ProyectoUsuarioDB.id_proyecto == ProyectoDB.id_proyecto,
        )
        .filter(
            TareaAsignadaDB.id_usuario == id_usuario_actual,
            ProyectoUsuarioDB.id_usuario == id_usuario_actual,
        )
        .distinct()
        .all()
    )

    return [
        _tarea_calendario_dict(
            tarea=tarea,
            nombre_proyecto=proyecto.nombre,
            db=db,
        )
        for tarea, proyecto in filas
    ]


# =================================================================
# CALENDARIO DE UN PROYECTO
# Admin: todas las tareas. Otros roles: únicamente sus asignadas.
# =================================================================
@router.get(
    "/{id_proyecto}/calendario",
    response_model=CalendarioProyectoResponse,
    status_code=status.HTTP_200_OK,
)
def obtener_calendario_proyecto(
    id_proyecto: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    id_rol = obtener_rol_en_proyecto(
        id_proyecto,
        id_usuario_actual,
        db,
    )

    if id_rol is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este proyecto.",
        )

    proyecto = (
        db.query(ProyectoDB)
        .filter(ProyectoDB.id_proyecto == id_proyecto)
        .first()
    )

    if not proyecto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El proyecto no existe.",
        )

    es_administrador = id_rol == 1

    consulta = db.query(TareaDB).filter(
        TareaDB.id_proyecto == id_proyecto
    )

    if not es_administrador:
        consulta = consulta.join(
            TareaAsignadaDB,
            TareaAsignadaDB.id_tarea == TareaDB.id_tarea,
        ).filter(
            TareaAsignadaDB.id_usuario == id_usuario_actual
        )

    tareas_db = consulta.distinct().all()

    tareas = [
        _tarea_calendario_dict(
            tarea=tarea,
            nombre_proyecto=proyecto.nombre,
            db=db,
        )
        for tarea in tareas_db
    ]

    return {
        "proyecto": proyecto,
        "id_rol": id_rol,
        "es_administrador": es_administrador,
        "tareas": tareas,
    }


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
# ÓRBITA GAMIFIED TEAM PULSE & PUNTOS DE MÉRITO (IMPACTO XP, MEDALLAS Y PUNTOS DE MÉRITO)
# =================================================================

def _obtener_titulo_nivel(nivel: int) -> str:
    titulos = {
        1: "Explorador Orbital",
        2: "Constructor Ágil",
        3: "Especialista de Sprint",
        4: "Arquitecto de Impacto",
        5: "Comandante de Misión",
        6: "Leyenda de Órbita",
    }
    return titulos.get(min(max(nivel, 1), 6), "Leyenda de Órbita")


async def _construir_team_pulse(id_proyecto: int, db: Session) -> dict:
    proyecto = (
        db.query(ProyectoDB)
        .filter(ProyectoDB.id_proyecto == id_proyecto)
        .first()
    )
    if not proyecto:
        raise HTTPException(status_code=404, detail="El proyecto no existe.")

    relaciones = (
        db.query(ProyectoUsuarioDB, UsuarioDB)
        .join(UsuarioDB, UsuarioDB.id_usuario == ProyectoUsuarioDB.id_usuario)
        .filter(ProyectoUsuarioDB.id_proyecto == id_proyecto)
        .all()
    )

    tareas_proyecto = (
        db.query(TareaDB)
        .filter(TareaDB.id_proyecto == id_proyecto)
        .all()
    )
    ids_tareas = [t.id_tarea for t in tareas_proyecto]
    mapa_tareas = {t.id_tarea: t for t in tareas_proyecto}

    asignaciones = (
        db.query(TareaAsignadaDB)
        .filter(TareaAsignadaDB.id_tarea.in_(ids_tareas))
        .all()
        if ids_tareas
        else []
    )
    mapa_responsable_tarea = {a.id_tarea: a.id_usuario for a in asignaciones}

    evidencias = (
        db.query(EvidenciaTareaDB)
        .filter(EvidenciaTareaDB.id_tarea.in_(ids_tareas))
        .all()
        if ids_tareas
        else []
    )
    comentarios = (
        db.query(ComentarioTareaDB)
        .filter(ComentarioTareaDB.id_tarea.in_(ids_tareas))
        .all()
        if ids_tareas
        else []
    )

    # Consultar Méritos en MongoDB (con manejo seguro si Mongo no responde)
    meritos_docs = []
    try:
        cursor_meritos = db_mongo.team_meritos.find({"id_proyecto": id_proyecto}).sort("fecha_envio", -1)
        meritos_docs = await cursor_meritos.to_list(length=100)
    except Exception:
        meritos_docs = []

    mapa_usuarios_nombre = {
        u.id_usuario: f"{u.nombre or ''} {u.apellido or ''}".strip() or u.correo
        for _, u in relaciones
    }

    conteo_meritos_recibidos = {}
    meritos_recientes = []
    for k in meritos_docs:
        dest_id = int(k.get("id_destinatario", 0))
        rem_id = int(k.get("id_remitente", 0))
        conteo_meritos_recibidos[dest_id] = conteo_meritos_recibidos.get(dest_id, 0) + 1
        if len(meritos_recientes) < 12:
            fecha_val = k.get("fecha_envio")
            fecha_str = (
                fecha_val.isoformat()
                if isinstance(fecha_val, datetime)
                else str(fecha_val or datetime.now(timezone.utc).isoformat())
            )
            meritos_recientes.append(
                ReconocimientoItemResponse(
                    id_reconocimiento=str(k.get("_id", "")),
                    id_proyecto=id_proyecto,
                    id_remitente=rem_id,
                    nombre_remitente=k.get("nombre_remitente") or mapa_usuarios_nombre.get(rem_id, "Integrante"),
                    id_destinatario=dest_id,
                    nombre_destinatario=k.get("nombre_destinatario") or mapa_usuarios_nombre.get(dest_id, "Integrante"),
                    insignia=k.get("insignia", "Compañerismo Excepcional"),
                    mensaje=k.get("mensaje", ""),
                    xp_otorgado=int(k.get("xp_otorgado", 25)),
                    fecha_envio=fecha_str,
                )
            )

    ahora_naive = datetime.utcnow()
    total_concluidas_equipo = 0
    total_concluidas_a_tiempo_equipo = 0
    total_medallas = 0
    ranking_items = []

    for rel, usuario in relaciones:
        uid = usuario.id_usuario
        rol_str = "Administrador" if rel.id_rol == 1 else "Colaborador"

        tareas_usuario = [
            mapa_tareas[tid]
            for tid, resp_uid in mapa_responsable_tarea.items()
            if resp_uid == uid and tid in mapa_tareas
        ]

        concluidas = [t for t in tareas_usuario if (t.estado or "").lower() == "concluida"]
        en_progreso = [t for t in tareas_usuario if (t.estado or "").lower() == "en progreso"]
        alta_prio = [t for t in concluidas if (t.prioridad or "").lower() == "alta"]

        entregas_a_tiempo = 0
        tiene_vencidas = False
        xp_tareas = 0

        for t in tareas_usuario:
            est = (t.estado or "").lower()
            prio = (t.prioridad or "media").lower()
            if est == "concluida":
                total_concluidas_equipo += 1
                base_xp = 100 if prio == "alta" else (70 if prio == "media" else 45)
                xp_tareas += base_xp

                # Verificar si se entregó a tiempo
                if t.fecha_limite:
                    ref_fin = t.fecha_actualizacion or ahora_naive
                    if ref_fin.date() <= t.fecha_limite.date():
                        entregas_a_tiempo += 1
                        total_concluidas_a_tiempo_equipo += 1
                        xp_tareas += 30
                else:
                    entregas_a_tiempo += 1
                    total_concluidas_a_tiempo_equipo += 1
                    xp_tareas += 20
            elif est == "en progreso":
                xp_tareas += 25
                if t.fecha_limite and t.fecha_limite.date() < ahora_naive.date():
                    tiene_vencidas = True
            else:
                if t.fecha_limite and t.fecha_limite.date() < ahora_naive.date():
                    tiene_vencidas = True

        evidencias_u = sum(1 for ev in evidencias if ev.id_usuario == uid)
        comentarios_u = sum(1 for cm in comentarios if cm.id_usuario == uid)
        meritos_u = conteo_meritos_recibidos.get(uid, 0)

        xp_total = (
            xp_tareas
            + (evidencias_u * 20)
            + (comentarios_u * 10)
            + (meritos_u * 25)
        )

        # Base de bienvenida para integrantes activos del proyecto
        if xp_total == 0:
            xp_total = 30

        nivel = min(6, (xp_total // 200) + 1)
        progreso_nivel_pct = min(100, int(((xp_total % 200) / 200.0) * 100)) if nivel < 6 else 100

        medallas = []
        if entregas_a_tiempo >= 1 and not tiene_vencidas:
            medallas.append(
                MedallaPulseResponse(
                    codigo="entrega_impecable",
                    nombre="Entrega Impecable",
                    descripcion="Cumple sus actividades en tiempo y sin retrasos vencidos.",
                    color="amber",
                )
            )
        if len(alta_prio) >= 1:
            medallas.append(
                MedallaPulseResponse(
                    codigo="alto_impacto",
                    nombre="Alto Impacto",
                    descripcion="Resuelve actividades críticas de prioridad Alta.",
                    color="rose",
                )
            )
        if evidencias_u >= 1:
            medallas.append(
                MedallaPulseResponse(
                    codigo="documentador_qa",
                    nombre="Documentador QA",
                    descripcion="Respalda sus entregas con archivos o enlaces verificables.",
                    color="blue",
                )
            )
        if comentarios_u >= 1:
            medallas.append(
                MedallaPulseResponse(
                    codigo="mentor_activo",
                    nombre="Comunicación Activa",
                    descripcion="Aporta seguimiento y retroalimentación en las actividades.",
                    color="purple",
                )
            )
        if meritos_u >= 1:
            medallas.append(
                MedallaPulseResponse(
                    codigo="favorito_equipo",
                    nombre="Reconocido por el Equipo",
                    descripcion="Ha recibido Puntos de Mérito de sus compañeros de proyecto.",
                    color="emerald",
                )
            )
        if not medallas:
            medallas.append(
                MedallaPulseResponse(
                    codigo="impulso_inicial",
                    nombre="En Órbita",
                    descripcion="Integrante activo listo para sumar impacto en el sprint.",
                    color="blue",
                )
            )

        total_medallas += len(medallas)

        ranking_items.append(
            IntegrantePulseResponse(
                posicion=0,
                id_usuario=uid,
                nombre=usuario.nombre or "",
                apellido=usuario.apellido or "",
                correo=usuario.correo or "",
                rol=rol_str,
                xp_total=xp_total,
                nivel=nivel,
                titulo_nivel=_obtener_titulo_nivel(nivel),
                progreso_nivel_pct=progreso_nivel_pct,
                racha_entregas_tiempo=entregas_a_tiempo,
                tareas_concluidas=len(concluidas),
                tareas_alta_prioridad=len(alta_prio),
                tareas_en_progreso=len(en_progreso),
                evidencias_subidas=evidencias_u,
                comentarios_realizados=comentarios_u,
                meritos_recibidos=meritos_u,
                medallas=medallas,
            )
        )

    ranking_items.sort(
        key=lambda x: (x.xp_total, x.tareas_concluidas, x.meritos_recibidos),
        reverse=True,
    )
    for idx, item in enumerate(ranking_items, start=1):
        item.posicion = idx

    xp_total_equipo = sum(i.xp_total for i in ranking_items)
    pct_tiempo = (
        int(round((total_concluidas_a_tiempo_equipo / total_concluidas_equipo) * 100))
        if total_concluidas_equipo > 0
        else 100
    )

    if ranking_items:
        lider = ranking_items[0]
        nombre_lider = f"{lider.nombre} {lider.apellido}".strip()
        cronica_default = (
            f"¡Pulso del equipo activo en '{proyecto.nombre}'! El equipo acumula {xp_total_equipo} XP "
            f"con un {pct_tiempo}% de puntualidad en entregas. {nombre_lider} lidera actualmente el "
            f"ranking de impacto con {lider.xp_total} XP ({lider.titulo_nivel}) y { len(lider.medallas) } medallas desbloqueadas."
        )
    else:
        cronica_default = f"El proyecto '{proyecto.nombre}' está listo para registrar sus primeras actividades y Puntos de Mérito."

    return {
        "id_proyecto": id_proyecto,
        "nombre_proyecto": proyecto.nombre,
        "xp_total_equipo": xp_total_equipo,
        "porcentaje_entregas_tiempo": pct_tiempo,
        "total_meritos_proyecto": len(meritos_docs),
        "total_medallas_desbloqueadas": total_medallas,
        "cronica_ia": cronica_default,
        "ranking": ranking_items,
        "meritos_recientes": meritos_recientes,
    }


@router.get(
    "/{id_proyecto}/pulse",
    response_model=TeamPulseResponse,
    status_code=status.HTTP_200_OK,
)
async def obtener_team_pulse_proyecto(
    id_proyecto: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    rol = obtener_rol_en_proyecto(id_proyecto, id_usuario_actual, db)
    if rol is None:
        raise HTTPException(status_code=403, detail="No tienes acceso a este proyecto.")

    datos_pulse = await _construir_team_pulse(id_proyecto, db)
    return datos_pulse


@router.post(
    "/{id_proyecto}/meritos",
    response_model=ReconocimientoItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def enviar_reconocimiento_integrante(
    id_proyecto: int,
    req: EnviarReconocimientoRequest,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    rol = obtener_rol_en_proyecto(id_proyecto, id_usuario_actual, db)
    if rol is None:
        raise HTTPException(status_code=403, detail="No tienes acceso a este proyecto.")

    rol_dest = obtener_rol_en_proyecto(id_proyecto, req.id_destinatario, db)
    if rol_dest is None:
        raise HTTPException(
            status_code=400,
            detail="El colaborador destinatario no pertenece a este proyecto.",
        )

    remitente = db.query(UsuarioDB).filter(UsuarioDB.id_usuario == id_usuario_actual).first()
    destinatario = db.query(UsuarioDB).filter(UsuarioDB.id_usuario == req.id_destinatario).first()
    proyecto = db.query(ProyectoDB).filter(ProyectoDB.id_proyecto == id_proyecto).first()

    nombre_rem = f"{remitente.nombre or ''} {remitente.apellido or ''}".strip() if remitente else "Compañero"
    nombre_dest = f"{destinatario.nombre or ''} {destinatario.apellido or ''}".strip() if destinatario else "Integrante"

    ahora = datetime.now(timezone.utc)
    nuevo_reconocimiento = {
        "id_proyecto": id_proyecto,
        "id_remitente": id_usuario_actual,
        "nombre_remitente": nombre_rem,
        "id_destinatario": req.id_destinatario,
        "nombre_destinatario": nombre_dest,
        "insignia": req.insignia.strip(),
        "mensaje": req.mensaje.strip(),
        "xp_otorgado": 25,
        "fecha_envio": ahora,
    }

    inserted_id = "local-merito"
    try:
        res = await db_mongo.team_meritos.insert_one(nuevo_reconocimiento)
        inserted_id = str(res.inserted_id)

        # Publicar el reconocimiento en el canal grupal de MongoDB si está activo
        if req.publicar_en_chat:
            conversacion = await db_mongo.conversations.find_one(
                {"id_proyecto": id_proyecto, "tipo": "grupal"}
            )
            if conversacion:
                texto_chat = (
                    f"🏆 [Puntos de Mérito +25 XP] {nombre_rem} otorgó la insignia "
                    f"«{req.insignia.strip()}» a {nombre_dest}: “{req.mensaje.strip()}”"
                )
                await db_mongo.messages.insert_one(
                    {
                        "id_conversacion": conversacion["_id"],
                        "id_usuario_remitente": id_usuario_actual,
                        "contenido": texto_chat,
                        "fecha_envio": ahora,
                    }
                )
    except Exception:
        pass

    if req.id_destinatario:
        try:
            await disparar_notificacion(
                usuario_id=req.id_destinatario,
                tipo="RECONOCIMIENTO_RECIBIDO",
                mensaje=(
                    f"¡{nombre_rem} te otorgó Puntos de Mérito (+25 XP) en "
                    f"'{proyecto.nombre if proyecto else 'el proyecto'}' por {req.insignia.strip()}!"
                ),
                db=db,
            )
        except Exception:
            pass

    return ReconocimientoItemResponse(
        id_reconocimiento=inserted_id,
        id_proyecto=id_proyecto,
        id_remitente=id_usuario_actual,
        nombre_remitente=nombre_rem,
        id_destinatario=req.id_destinatario,
        nombre_destinatario=nombre_dest,
        insignia=req.insignia.strip(),
        mensaje=req.mensaje.strip(),
        xp_otorgado=25,
        fecha_envio=ahora.isoformat(),
    )


@router.post(
    "/{id_proyecto}/pulse/cronica-ia",
    response_model=CronicaPulseResponse,
    status_code=status.HTTP_200_OK,
)
async def generar_cronica_motivacional_ia(
    id_proyecto: int,
    req: CronicaPulseRequest,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    rol = obtener_rol_en_proyecto(id_proyecto, id_usuario_actual, db)
    if rol is None:
        raise HTTPException(status_code=403, detail="No tienes acceso a este proyecto.")

    pulse = await _construir_team_pulse(id_proyecto, db)
    ranking = pulse["ranking"]

    # Intentar enriquecer con Gemini si el cliente está disponible
    cronica_generada = pulse["cronica_ia"]
    try:
        from routers.ai import client as gemini_client, MODELOS_IA

        if gemini_client and ranking:
            resumen_miembros = [
                {
                    "posicion": m.posicion,
                    "nombre": f"{m.nombre} {m.apellido}".strip(),
                    "xp": m.xp_total,
                    "nivel": m.titulo_nivel,
                    "concluidas": m.tareas_concluidas,
                    "alta_prio": m.tareas_alta_prioridad,
                    "evidencias": m.evidencias_subidas,
                    "meritos": m.meritos_recibidos,
                    "medallas": [med.nombre for med in m.medallas],
                }
                for m in ranking[:5]
            ]
            prompt = (
                f"Eres el Coach Ágil de la plataforma Órbita. Redacta una crónica de reconocimiento "
                f"motivacional breve (máximo 350 caracteres, en español profesional y entusiasta) para el proyecto "
                f"'{pulse['nombre_proyecto']}'. Destaca al líder #1 del ranking, el XP total del equipo "
                f"({pulse['xp_total_equipo']} XP) y las medallas logradas. Datos reales: {resumen_miembros}"
            )
            for mod in MODELOS_IA:
                try:
                    resp = gemini_client.models.generate_content(model=mod, contents=prompt)
                    if resp and resp.text and resp.text.strip():
                        cronica_generada = resp.text.strip().replace('"', '')
                        break
                except Exception:
                    continue
    except Exception:
        pass

    publicada = False
    if req.publicar_en_chat:
        try:
            conversacion = await db_mongo.conversations.find_one(
                {"id_proyecto": id_proyecto, "tipo": "grupal"}
            )
            if conversacion:
                await db_mongo.messages.insert_one(
                    {
                        "id_conversacion": conversacion["_id"],
                        "id_usuario_remitente": id_usuario_actual,
                        "contenido": f"✨ [Crónica Team Pulse IA] {cronica_generada}",
                        "fecha_envio": datetime.now(timezone.utc),
                    }
                )
                publicada = True
        except Exception:
            publicada = False

    # Disparar notificación a todos los integrantes del proyecto cuando se genera una crónica con IA
    try:
        integrantes_proy = (
            db.query(ProyectoUsuarioDB)
            .filter(ProyectoUsuarioDB.id_proyecto == id_proyecto)
            .all()
        )
        for integ in integrantes_proy:
            await disparar_notificacion(
                usuario_id=integ.id_usuario,
                tipo="CRONICA_IA_GENERADA",
                mensaje=(
                    f"✨ Nueva Crónica de Reconocimientos con IA en '{pulse['nombre_proyecto']}': "
                    f"{cronica_generada[:160]}{'...' if len(cronica_generada) > 160 else ''}"
                ),
                db=db,
            )
    except Exception:
        pass

    return CronicaPulseResponse(
        cronica_ia=cronica_generada,
        publicada_en_chat=publicada,
    )
