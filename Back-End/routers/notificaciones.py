from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

# Importaciones de tu proyecto
import models
from database import get_db
# from auth import obtener_usuario_actual  # <-- Descomenta si ya tienes tu sistema de login listo

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
        # 1. Guardar el registro real en la base de datos de PostgreSQL
        nueva_noti = models.Notificacion(
            id_usuario=usuario_id,
            tipo=tipo,
            mensaje=mensaje
            # 'leida' y 'fecha_creacion' se llenan solos por la configuración en models.py
        )
        
        db.add(nueva_noti)
        db.commit()
        db.refresh(nueva_noti)

        # 2. Emitir en tiempo real (WebSockets) - Dejado listo para conectar
        # from websocket import manager
        # await manager.enviar_mensaje_personal(
        #     mensaje={"id_notificacion": nueva_noti.id_notificacion, "tipo": tipo, "texto": mensaje}, 
        #     usuario_id=usuario_id
        # )
        
        print(f"[ALERTA CREADA] Usuario {usuario_id} | {tipo}: {mensaje}")
        return True

    except Exception as e:
        print(f"[ERROR AL CREAR NOTIFICACIÓN] {e}")
        return False


# ==========================================
# 2. ENDPOINTS (Para que el Front-End las consuma)
# ==========================================
@router.get("/", response_model=List[NotificacionResponse])
def obtener_mis_notificaciones(
    usuario_id: int, # Temporal: Pedimos el ID directamente. Si tienes auth, usa Depends(obtener_usuario_actual)
    db: Session = Depends(get_db)
):
    """
    Angular usará esta ruta para cargar el historial de notificaciones.
    """
    notificaciones = db.query(models.Notificacion).filter(
        models.Notificacion.id_usuario == usuario_id
    ).order_by(models.Notificacion.fecha_creacion.desc()).all()
    
    return notificaciones

@router.put("/{notificacion_id}/leer")
def marcar_como_leida(
    notificacion_id: int, 
    db: Session = Depends(get_db)
):
    """
    Angular llamará a esto cuando el usuario abra la campana de notificaciones.
    """
    notificacion = db.query(models.Notificacion).filter(
        models.Notificacion.id_notificacion == notificacion_id
    ).first()
    
    if not notificacion:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    
    notificacion.leida = True
    db.commit()
    
    return {"mensaje": "Notificación marcada como leída", "id_notificacion": notificacion_id}

# ==========================================
# ENDPOINT DE PRUEBA (SOLO PARA DESARROLLO)
# ==========================================
@router.post("/test/{usuario_id}")
async def probar_motor_notificaciones(usuario_id: int, db: Session = Depends(get_db)):
    """
    Ruta para probar manualmente que las notificaciones se guardan y se leen.
    """
    exito = await disparar_notificacion(
        usuario_id=usuario_id,
        tipo="PRUEBA_EXITOSA",
        mensaje="¡Tu motor de notificaciones funciona a la perfección!",
        db=db
    )
    
    if exito:
        return {"mensaje": f"Notificación inyectada al usuario {usuario_id}"}
    else:
        raise HTTPException(status_code=500, detail="Fallo interno. Revisa la terminal negra.")