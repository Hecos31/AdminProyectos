from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Importaciones de tu proyecto
from auth import obtener_usuario_actual  # Seguridad integrada
from database import get_db
import models

router = APIRouter(
    prefix="/notificaciones",
    tags=["Notificaciones"]
)

# ==========================================
# ESQUEMAS PYDANTIC (Para respuestas a Angular)
# ==========================================
class NotificacionResponse(BaseModel):
    id_notificacion: int
    id_usuario: int
    tipo: Optional[str] = None
    mensaje: str
    leida: bool
    fecha_creacion: datetime

    class Config:
        from_attributes = True  # Permite a Pydantic leer los objetos de SQLAlchemy


# ==========================================
# 1. FUNCIÓN INTERNA (El motor dinámico)
# ==========================================
async def disparar_notificacion(usuario_id: int, tipo: str, mensaje: str, db: Session):
    """
    Esta función NO es un endpoint web. Se importa y se llama desde otros módulos
    (ej. mensajes.py, tareas.py) justo después de guardar un cambio o evento.
    
    Acepta ejecución 'async' para integrarse sin problemas con endpoints asíncronos (como el de mensajes).
    """
    try:
        # 1. Guardar el registro real en la base de datos
        nueva_noti = models.Notificacion(
            id_usuario=usuario_id,
            tipo=tipo,
            mensaje=mensaje
            # 'leida' y 'fecha_creacion' se asignan con sus valores por defecto en la BD
        )
        
        db.add(nueva_noti)
        db.commit()
        db.refresh(nueva_noti)

        print(f"[NOTIFICACIÓN ENVIADA] Usuario {usuario_id} | Tipo: {tipo} | Mensaje: {mensaje}")
        return True

    except Exception as e:
        db.rollback()
        print(f"[ERROR AL CREAR NOTIFICACIÓN] Para usuario {usuario_id}: {e}")
        return False


# ==========================================
# 2. ENDPOINTS (Consumidos por Angular)
# ==========================================
@router.get("/", response_model=List[NotificacionResponse])
def obtener_mis_notificaciones(
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    """
    Angular usa esta ruta para cargar el historial de notificaciones del usuario.
    Retorna las notificaciones ordenadas de más reciente a más antigua.
    """
    notificaciones = db.query(models.Notificacion).filter(
        models.Notificacion.id_usuario == id_usuario_actual
    ).order_by(models.Notificacion.fecha_creacion.desc()).all()
    
    return notificaciones


@router.put("/{notificacion_id}/leer")
def marcar_como_leida(
    notificacion_id: int, 
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    """
    Angular llama a este endpoint cuando el usuario hace clic o marca como leída una alerta.
    """
    # Verificamos que la notificación exista y pertenezca al usuario actual
    notificacion = db.query(models.Notificacion).filter(
        models.Notificacion.id_notificacion == notificacion_id,
        models.Notificacion.id_usuario == id_usuario_actual
    ).first()
    
    if not notificacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Notificación no encontrada o no tienes permiso para modificarla."
        )
    
    notificacion.leida = True
    
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Error al actualizar la base de datos."
        )
    
    return {"mensaje": "Notificación marcada como leída", "id_notificacion": notificacion_id}