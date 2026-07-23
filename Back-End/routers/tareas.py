from enum import Enum
import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from routers.notificaciones import disparar_notificacion
#Para notificaciones
from database import get_db
import models # Para acceder a las tablas de tu base de datos
from routers.notificaciones import disparar_notificacion
router = APIRouter(
    prefix="/proyectos",
    tags=["Proyectos"]
)
from database import get_db
from models import TareaDB, TareaAsignadaDB, UsuarioDB
from schemas import (
    TareaCreate,
    TareaResponse,
    TareaUpdate,
    EstadoTarea,
    TareaEstadoUpdate,
    TareaAsignarUpdate
)
from auth import obtener_usuario_actual, obtener_rol_en_proyecto

router = APIRouter(prefix="/tareas", tags=["Tareas - Tablón Kanban"])

# --- 1. CREAR TAREA (Solo Admin) ---
@router.post("", response_model=TareaResponse, status_code=status.HTTP_201_CREATED)
def crear_tarea(
    tarea_in: TareaCreate, 
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    id_rol = obtener_rol_en_proyecto(tarea_in.id_proyecto, id_usuario_actual, db)
    if id_rol != 1:
        raise HTTPException(status_code=403, detail="Solo Administradores pueden crear tareas.")

    # Definir estado inicial automáticamente
    estado_inicial = EstadoTarea.ASIGNADA.value if tarea_in.id_usuario_asignado else EstadoTarea.PENDIENTE.value

    nueva_tarea = TareaDB(
        id_proyecto=tarea_in.id_proyecto,
        titulo=tarea_in.titulo,
        descripcion=tarea_in.descripcion,
        prioridad=tarea_in.prioridad.value, 
        estado=estado_inicial,
        fecha_inicio=tarea_in.fecha_inicio,
        fecha_limite=tarea_in.fecha_limite
    )

    try:
        db.add(nueva_tarea)
        db.flush()

        usuario_asignado_data = None
        if tarea_in.id_usuario_asignado:
            # Validar que el asignado sea del proyecto
            rol_asignado = obtener_rol_en_proyecto(tarea_in.id_proyecto, tarea_in.id_usuario_asignado, db)
            if rol_asignado is None:
                raise HTTPException(status_code=400, detail="El usuario no pertenece al proyecto.")
            
            nueva_asignacion = TareaAsignadaDB(id_tarea=nueva_tarea.id_tarea, id_usuario=tarea_in.id_usuario_asignado)
            db.add(nueva_asignacion)
            
            usuario = db.query(UsuarioDB).filter(UsuarioDB.id_usuario == tarea_in.id_usuario_asignado).first()
            if usuario:
                usuario_asignado_data = {"id_usuario": usuario.id_usuario, "nombre": usuario.nombre, "apellido": usuario.apellido, "correo": usuario.correo}

        db.commit()
        
        db.refresh(nueva_tarea)
        
        resultado = nueva_tarea.__dict__.copy()
        resultado["usuario_asignado"] = usuario_asignado_data
        return resultado
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al crear tarea.")

# --- 2. MOVER TARJETA EN EL TABLÓN (Cualquier colaborador) ---
@router.patch("/{id_tarea}/estado", status_code=status.HTTP_200_OK)
def cambiar_estado_tarea(
    id_tarea: int,
    estado_update: TareaEstadoUpdate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    tarea = db.query(TareaDB).filter(TareaDB.id_tarea == id_tarea).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    rol = obtener_rol_en_proyecto(tarea.id_proyecto, id_usuario_actual, db)
    if not rol:
        raise HTTPException(status_code=403, detail="No perteneces a este proyecto.")

    tarea.estado = estado_update.estado.value
    db.commit()
    return {"mensaje": "Estado actualizado", "nuevo_estado": tarea.estado}

# --- 3. RECLAMAR / ASIGNAR TAREA ---
@router.patch("/{id_tarea}/asignar", status_code=status.HTTP_200_OK)
def asignar_reclamar_tarea(
    id_tarea: int,
    asignacion_update: TareaAsignarUpdate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    tarea = db.query(TareaDB).filter(TareaDB.id_tarea == id_tarea).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    rol_actual = obtener_rol_en_proyecto(tarea.id_proyecto, id_usuario_actual, db)
    if not rol_actual:
        raise HTTPException(status_code=403, detail="No perteneces a este proyecto.")

    # Regla: Un usuario normal solo puede asignarse la tarea a sí mismo (reclamarla)
    # Un admin puede asignarla a quien sea o desasignarla.
    id_objetivo = asignacion_update.id_usuario_asignado
    if id_objetivo != id_usuario_actual and rol_actual != 1:
        raise HTTPException(status_code=403, detail="Solo un Admin puede asignar tareas a otros usuarios.")

    # Borramos asignación previa (si existía)
    db.query(TareaAsignadaDB).filter(TareaAsignadaDB.id_tarea == id_tarea).delete()

    if id_objetivo is None:
        tarea.estado = EstadoTarea.PENDIENTE.value
    else:
        rol_objetivo = obtener_rol_en_proyecto(tarea.id_proyecto, id_objetivo, db)
        if not rol_objetivo:
            raise HTTPException(status_code=400, detail="El usuario destino no pertenece al proyecto.")
        
        nueva_asignacion = TareaAsignadaDB(id_tarea=id_tarea, id_usuario=id_objetivo)
        db.add(nueva_asignacion)
        # Si estaba pendiente, pasa a asignada automáticamente
        if tarea.estado == EstadoTarea.PENDIENTE.value:
            tarea.estado = EstadoTarea.ASIGNADA.value

    db.commit()
    return {"mensaje": "Asignación actualizada correctamente."}

# --- 4. EDITAR DETALLES DE TAREA (Solo Admin) ---
@router.put("/{id_tarea}", response_model=TareaResponse, status_code=status.HTTP_200_OK)
def editar_detalles_tarea(
    id_tarea: int,
    tarea_in: TareaUpdate,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    tarea = db.query(TareaDB).filter(TareaDB.id_tarea == id_tarea).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no existe.")

    id_rol = obtener_rol_en_proyecto(tarea.id_proyecto, id_usuario_actual, db)
    if id_rol != 1: 
        raise HTTPException(status_code=403, detail="Solo Admins pueden editar detalles.")

    update_data = tarea_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if isinstance(value, Enum):
            setattr(tarea, key, value.value)
        else:
            setattr(tarea, key, value)

    db.commit()
    
    # Para la respuesta, recuperamos al usuario
    asignacion = db.query(TareaAsignadaDB).filter(TareaAsignadaDB.id_tarea == id_tarea).first()
    usuario_data = None
    if asignacion:
        u = db.query(UsuarioDB).filter(UsuarioDB.id_usuario == asignacion.id_usuario).first()
        usuario_data = {"id_usuario": u.id_usuario, "nombre": u.nombre, "apellido": u.apellido, "correo": u.correo}

    resultado = tarea.__dict__.copy()
    resultado["usuario_asignado"] = usuario_data
    return resultado

# --- 5. ELIMINAR TAREA (Corrección de Integridad) ---
@router.delete("/{id_tarea}", status_code=status.HTTP_200_OK)
def eliminar_tarea(
    id_tarea: int,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    tarea = db.query(TareaDB).filter(TareaDB.id_tarea == id_tarea).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no existe.")

    id_rol = obtener_rol_en_proyecto(tarea.id_proyecto, id_usuario_actual, db)
    if id_rol != 1:
        raise HTTPException(status_code=403, detail="Solo Admins pueden eliminar tareas.")

    try:
        # ¡Clave! Borrar dependencias primero para evitar error de PostgreSQL
        db.query(TareaAsignadaDB).filter(TareaAsignadaDB.id_tarea == id_tarea).delete()
        db.delete(tarea)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al eliminar la tarea.")

    return {"mensaje": f"La tarea con ID {id_tarea} fue eliminada correctamente."}


# Notificacion de tarea asignada
@router.post("/asignar")
async def asignar_tarea_a_usuario(tarea_id: int, usuario_asignado_id: int, db: Session = Depends(get_db)):
    
    # ... Tu código normal donde guardas la asignación en la base de datos ...
    # asignacion = models.Asignacion(tarea_id=tarea_id, usuario_id=usuario_asignado_id)
    # db.add(asignacion)
    # db.commit()

    # 2. ¡EL DISPARADOR DINÁMICO!
    # Justo después de guardar en la BD, llamas a la función para alertar al usuario:
    await disparar_notificacion(
        usuario_id=usuario_asignado_id,
        tipo="ASIGNACION_TAREA",
        mensaje=f"Se te ha asignado una nueva tarea en tu proyecto.",
        db=db
    )

    return {"mensaje": "Tarea asignada correctamente"}

# =======================================================
# ENDPOINT: ASIGNAR TAREA A UN USUARIO
# =======================================================
@router.post("/asignar", status_code=status.HTTP_200_OK)
async def asignar_tarea_a_usuario(tarea_id: int, usuario_asignado_id: int, db: Session = Depends(get_db)):
    
    # 1. (Opcional pero recomendado) Validar si el usuario y la tarea existen
    # tarea = db.query(models.Tarea).filter(models.Tarea.id_tarea == tarea_id).first()
    # usuario = db.query(models.UsuarioDB).filter(models.UsuarioDB.id_usuario == usuario_asignado_id).first()
    # if not tarea or not usuario:
    #     raise HTTPException(status_code=404, detail="Tarea o usuario no encontrados")

    try:
        # 2. Tu código real donde guardas la asignación en la base de datos
        # IMPORTANTE: Revisa que "Asignacion", "tarea_id" e "id_usuario" 
        # coincidan exactamente con cómo llamaste a tus columnas en models.py
        nueva_asignacion = models.Asignacion(
            tarea_id=tarea_id, 
            id_usuario=usuario_asignado_id
        )
        
        db.add(nueva_asignacion)
        db.commit()
        # db.refresh(nueva_asignacion) # Descomentar si necesitas devolver el ID de la asignación

        # 3. ¡EL DISPARADOR DINÁMICO!
        # Como está debajo del commit, solo se enviará si la base de datos guardó todo sin errores
        await disparar_notificacion(
            usuario_id=usuario_asignado_id,
            tipo="ASIGNACION_TAREA",
            mensaje="Se te ha asignado una nueva tarea en tu proyecto.",
            db=db
        )

        return {"mensaje": "Tarea asignada correctamente y usuario notificado"}

    except Exception as e:
        # Si algo falla en la base de datos (ej. un registro duplicado), evitamos que el servidor se caiga
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al asignar la tarea: {str(e)}")
