from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

# Importaciones de tu proyecto
import models
from database import get_db
from auth import obtener_usuario_actual  # Ya integrado para máxima seguridad

router = APIRouter(
    prefix="/notificaciones",
    tags=["Notificaciones"]
)

# ==========================================
# ESQUEMAS PYDANTIC (Para enviar datos a Angular)
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
    Esta función NO es una ruta web. Se importa y se llama desde otros módulos
    (ej. tareas.py, proyectos.py) justo después de guardar un cambio en la base de datos.
    """
    try:
        # 1. Guardar el registro real en la base de datos
        nueva_noti = models.Notificacion(
            id_usuario=usuario_id,
            tipo=tipo,
            mensaje=mensaje
            # 'leida' y 'fecha_creacion' se llenan solos por la configuración en models.py
        )
        
        db.add(nueva_noti)
        db.commit()
        db.refresh(nueva_noti)

        print(f"[ALERTA CREADA] Usuario {usuario_id} | {tipo}: {mensaje}")
        return True

    except Exception as e:
        print(f"[ERROR AL CREAR NOTIFICACIÓN] {e}")
        return False


# ==========================================
# 2. ENDPOINTS (Para que Angular las consuma)
# ==========================================
@router.get("/", response_model=List[NotificacionResponse])
def obtener_mis_notificaciones(
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    """
    Angular usará esta ruta para cargar el historial de notificaciones.
    Trae todas las del usuario ordenadas por las más recientes.
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
    Angular llamará a esto cuando el usuario haga clic en una notificación.
    """
    # Buscamos la notificación asegurándonos de que le pertenezca al usuario actual
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