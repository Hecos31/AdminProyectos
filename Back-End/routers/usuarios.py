from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from routers.notificaciones import disparar_notificacion # Importación correcta
from database import get_db
from models import UsuarioDB
from schemas import UsuarioCreate, UsuarioResponse, LoginRequest
from auth import obtener_password_hash, verificar_password, crear_token_acceso, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(tags=["Usuarios"])

@router.post("/login", status_code=status.HTTP_200_OK)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioDB).filter(UsuarioDB.correo == login_data.correo).first()
    if not usuario or not verificar_password(login_data.password, usuario.password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    token = crear_token_acceso(
        {"sub": str(usuario.id_usuario), "email": usuario.correo}, 
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": token, "token_type": "bearer", "usuario": {"id_usuario": usuario.id_usuario}}

@router.post("/CrearUsuarios", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(usuario_in: UsuarioCreate, db: Session = Depends(get_db)):
    if db.query(UsuarioDB).filter(UsuarioDB.correo == usuario_in.correo).first():
        raise HTTPException(status_code=400, detail="Correo ya registrado")
    
    nuevo_usuario = UsuarioDB(**usuario_in.dict(exclude={'password'}), password=obtener_password_hash(usuario_in.password))
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario


# =======================================================
# NUEVO ENDPOINT: CAMBIO DE ROL (Con Notificación Dinámica)
# =======================================================
@router.put("/{usuario_id}/rol")
async def cambiar_rol(usuario_id: int, nuevo_rol_id: int, db: Session = Depends(get_db)):
    
    # 1. Tu lógica real: Buscamos al usuario en la BD y le cambiamos el rol
    usuario = db.query(UsuarioDB).filter(UsuarioDB.id_usuario == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Asumiendo que tu columna de rol se llama id_rol
    usuario.id_rol = nuevo_rol_id 
    db.commit()
    
    # 2. ¡EL DISPARADOR DINÁMICO!
    # Solo se ejecuta si el commit() anterior fue exitoso
    texto_rol = "Administrador" if nuevo_rol_id == 1 else "Colaborador"
    
    await disparar_notificacion(
        usuario_id=usuario_id,
        tipo="CAMBIO_ROL",
        mensaje=f"Tu rol en el sistema ha sido actualizado a {texto_rol}.",
        db=db
    )
    
    return {"mensaje": f"Rol de usuario actualizado a {texto_rol}"}