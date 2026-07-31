from enum import Enum
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# Base de datos y Modelos
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

# Autenticación y Notificaciones
from auth import obtener_usuario_actual, obtener_rol_en_proyecto
from routers.notificaciones import disparar_notificacion

router = APIRouter(prefix="/tareas", tags=["Tareas - Tablón Kanban"])

# --- 1. CREAR TAREA (Solo Admin) ---
@router.post("", response_model=TareaResponse, status_code=status.HTTP_201_CREATED)
async def crear_tarea(
    tarea_in: TareaCreate, 
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    id_rol = obtener_rol_en_proyecto(tarea_in.id_proyecto, id_usuario_actual, db)
    if id_rol != 1:
        raise HTTPException(status_code=403, detail="Solo Administradores pueden crear tareas.")

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
        
        if tarea_in.id_usuario_asignado:
            await disparar_notificacion(
                usuario_id=tarea_in.id_usuario_asignado,
                tipo="NUEVA_TAREA",
                mensaje=f"Se te ha asignado la nueva tarea '{nueva_tarea.titulo}'.",
                db=db
            )

        resultado = {
            "id_tarea": nueva_tarea.id_tarea,
            "id_proyecto": nueva_tarea.id_proyecto,
            "titulo": nueva_tarea.titulo,
            "descripcion": nueva_tarea.descripcion,
            "prioridad": nueva_tarea.prioridad,
            "estado": nueva_tarea.estado,
            "fecha_inicio": nueva_tarea.fecha_inicio,
            "fecha_limite": nueva_tarea.fecha_limite,
            "usuario_asignado": usuario_asignado_data
        }
        return resultado
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Error al crear tarea: {e}")
        raise HTTPException(status_code=500, detail="Error al crear tarea.")


# --- 2. MOVER TARJETA EN EL TABLÓN ---
@router.patch("/{id_tarea}/estado", status_code=status.HTTP_200_OK)
async def cambiar_estado_tarea(
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
    
    try:
        db.commit()
        
        asignacion = db.query(TareaAsignadaDB).filter(TareaAsignadaDB.id_tarea == id_tarea).first()
        if asignacion:
            await disparar_notificacion(
                usuario_id=asignacion.id_usuario,
                tipo="ESTADO_TAREA",
                mensaje=f"El estado de tu tarea '{tarea.titulo}' cambió a '{tarea.estado}'.",
                db=db
            )
            
    except Exception as e:
        db.rollback()
        print(f"Error al actualizar estado: {e}")
        raise HTTPException(status_code=500, detail="Error al actualizar estado.")
        
    return {"mensaje": "Estado actualizado", "nuevo_estado": tarea.estado}


# --- 3. RECLAMAR / ASIGNAR TAREA ---
@router.patch("/{id_tarea}/asignar", status_code=status.HTTP_200_OK)
async def asignar_reclamar_tarea(
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

    id_objetivo = asignacion_update.id_usuario_asignado
    
    # REGLA BLINDADA: Permitimos si es auto-asignación o si el usuario actual es Admin (rol 1)
    if id_objetivo != id_usuario_actual and rol_actual != 1:
        raise HTTPException(status_code=403, detail="Solo un Admin puede asignar tareas a otros usuarios.")

    asignacion_previa = db.query(TareaAsignadaDB).filter(TareaAsignadaDB.id_tarea == id_tarea).first()
    id_usuario_anterior = asignacion_previa.id_usuario if asignacion_previa else None

    db.query(TareaAsignadaDB).filter(TareaAsignadaDB.id_tarea == id_tarea).delete()

    if id_objetivo is None:
        tarea.estado = EstadoTarea.PENDIENTE.value
    else:
        rol_objetivo = obtener_rol_en_proyecto(tarea.id_proyecto, id_objetivo, db)
        if not rol_objetivo:
            raise HTTPException(status_code=400, detail="El usuario destino no pertenece al proyecto.")
        
        nueva_asignacion = TareaAsignadaDB(id_tarea=id_tarea, id_usuario=id_objetivo)
        db.add(nueva_asignacion)
        
        if tarea.estado == EstadoTarea.PENDIENTE.value:
            tarea.estado = EstadoTarea.ASIGNADA.value

    try:
        db.commit()
        
        if id_usuario_anterior and id_usuario_anterior != id_objetivo:
            await disparar_notificacion(
                usuario_id=id_usuario_anterior,
                tipo="TAREA_REASIGNADA",
                mensaje=f"La tarea '{tarea.titulo}' te ha sido retirada y asignada a otro colaborador.",
                db=db
            )

        if id_objetivo and id_objetivo != id_usuario_anterior:
            await disparar_notificacion(
                usuario_id=id_objetivo,
                tipo="TAREA_DELEGADA",
                mensaje=f"Se te ha asignado la tarea '{tarea.titulo}'.",
                db=db
            )
        
    except Exception as e:
        db.rollback()
        print(f"ERROR EXACTO AL ASIGNAR TAREA: {str(e)}") 
        raise HTTPException(status_code=500, detail=f"Error interno al asignar: {str(e)}")
        
    return {"mensaje": "Asignación actualizada correctamente."}


# --- 4. EDITAR DETALLES DE TAREA ---
@router.put("/{id_tarea}", response_model=TareaResponse, status_code=status.HTTP_200_OK)
async def editar_detalles_tarea(
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

    try:
        db.commit()
        
        asignacion = db.query(TareaAsignadaDB).filter(TareaAsignadaDB.id_tarea == id_tarea).first()
        usuario_data = None
        
        if asignacion:
            u = db.query(UsuarioDB).filter(UsuarioDB.id_usuario == asignacion.id_usuario).first()
            if u:
                usuario_data = {"id_usuario": u.id_usuario, "nombre": u.nombre, "apellido": u.apellido, "correo": u.correo}
            
            await disparar_notificacion(
                usuario_id=asignacion.id_usuario,
                tipo="TAREA_MODIFICADA",
                mensaje=f"Los detalles o fechas de tu tarea '{tarea.titulo}' han sido modificados.",
                db=db
            )
            
    except Exception as e:
        db.rollback()
        print(f"Error al editar tarea: {e}")
        raise HTTPException(status_code=500, detail="Error al editar detalles.")

    resultado = {
        "id_tarea": tarea.id_tarea,
        "id_proyecto": tarea.id_proyecto,
        "titulo": tarea.titulo,
        "descripcion": tarea.descripcion,
        "prioridad": tarea.prioridad,
        "estado": tarea.estado,
        "fecha_inicio": tarea.fecha_inicio,
        "fecha_limite": tarea.fecha_limite,
        "usuario_asignado": usuario_data
    }
    return resultado


# --- 5. ELIMINAR TAREA ---
@router.delete("/{id_tarea}", status_code=status.HTTP_200_OK)
async def eliminar_tarea(
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

    titulo_tarea = tarea.titulo
    asignacion = db.query(TareaAsignadaDB).filter(TareaAsignadaDB.id_tarea == id_tarea).first()
    id_usuario_asignado = asignacion.id_usuario if asignacion else None

    try:
        db.query(TareaAsignadaDB).filter(TareaAsignadaDB.id_tarea == id_tarea).delete()
        db.delete(tarea)
        db.commit()
        
        if id_usuario_asignado:
            await disparar_notificacion(
                usuario_id=id_usuario_asignado,
                tipo="TAREA_ELIMINADA",
                mensaje=f"La tarea '{titulo_tarea}' que tenías asignada fue eliminada del proyecto.",
                db=db
            )
            
    except Exception as e:
        db.rollback()
        print(f"Error al eliminar tarea: {e}")
        raise HTTPException(status_code=500, detail="Error interno al eliminar la tarea.")

    return {"mensaje": f"La tarea con ID {id_tarea} fue eliminada correctamente."}


@router.get("/rescate/soy-admin/{id_proyecto}")
def forzar_rol_administrador(
    id_proyecto: int, 
    db: Session = Depends(get_db), 
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    from models import ProyectoUsuarioDB
    
    relacion = db.query(ProyectoUsuarioDB).filter(
        ProyectoUsuarioDB.id_proyecto == id_proyecto,
        ProyectoUsuarioDB.id_usuario == id_usuario_actual
    ).first()
    
    if not relacion:
        return {"error": "Tu usuario no pertenece a este proyecto. No se puede actualizar el rol."}
    
    relacion.id_rol = 1
    db.commit()
    
    return {"mensaje": f"¡Éxito! Tu usuario {id_usuario_actual} ahora es ADMINISTRADOR (Rol 1) en el proyecto {id_proyecto}."}