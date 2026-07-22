from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta

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