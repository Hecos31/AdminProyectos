from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.orm import Session

from database import get_db, db_mongo
from models import UsuarioDB
from schemas import MensajeConversacionRequest
from auth import obtener_usuario_actual, validar_token_ws
from websocket import manager

router = APIRouter(tags=["Mensajes y WebSockets"])


@router.post("/mensajes/conversacion", status_code=status.HTTP_200_OK)
async def enviar_mensaje_conversacion(
    req: MensajeConversacionRequest,
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    try:
        try:
            conv_id = ObjectId(req.id_conversacion)
        except InvalidId:
            raise HTTPException(status_code=400, detail="ID de conversación inválido")

        nuevo_mensaje = {
            "id_conversacion": conv_id,
            "id_usuario_remitente": id_usuario_actual,
            "contenido": req.contenido,
            "fecha_envio": datetime.now(timezone.utc)
        }
        await db_mongo.messages.insert_one(nuevo_mensaje)

        chat = await db_mongo.conversations.find_one({"_id": conv_id})
        
        if chat:
            nuevo_mensaje_dict = {
                "id_conversacion": req.id_conversacion,
                "id_usuario_remitente": id_usuario_actual,
                "contenido": req.contenido,
                "fecha_envio": nuevo_mensaje["fecha_envio"].isoformat()
            }
            
            for participante in chat.get("participantes", []):
                p_id = participante["id_usuario"]
                await manager.enviar_mensaje_en_vivo(nuevo_mensaje_dict, p_id)

        return {"status": "success"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR FATAL: {str(e)}") 
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = await validar_token_ws(token)
    
    if user_id is None:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id)


@router.get("/mensajes/conversaciones", status_code=status.HTTP_200_OK)
async def obtener_lista_conversaciones(
    db_sql: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    try:
        cursor = db_mongo.conversations.find({
            "participantes.id_usuario": id_usuario_actual
        })
        conversaciones = await cursor.to_list(length=100)

        resultado = []

        for conv in conversaciones:
            ultimo_mensaje = await db_mongo.messages.find_one(
                {"id_conversacion": conv["_id"]},
                sort=[("fecha_envio", -1)]
            )

            nombre_chat = conv.get("nombre")
            
            if conv.get("tipo") == "privado":
                otro_id = next((p["id_usuario"] for p in conv.get("participantes", []) if p["id_usuario"] != id_usuario_actual), None)
                
                if otro_id:
                    otro_usuario = db_sql.query(UsuarioDB).filter(UsuarioDB.id_usuario == otro_id).first()
                    if otro_usuario:
                        nombre_chat = f"{otro_usuario.nombre} {otro_usuario.apellido}"
                    else:
                        nombre_chat = "Usuario Desconocido"

            chat_preview = {
                "id": str(conv["_id"]),
                "nombre": nombre_chat or "Chat sin nombre",
                "enLinea": False,
                "tipo": conv.get("tipo"),
                "participantes": len(conv.get("participantes", [])),
                "noLeidos": 0,
                "ultimoMensaje": {
                    "contenido": ultimo_mensaje["contenido"] if ultimo_mensaje else "Sin mensajes",
                    "fecha": ultimo_mensaje["fecha_envio"].isoformat() if ultimo_mensaje else conv.get("creado_en", datetime.now(timezone.utc)).isoformat()
                }
            }
            resultado.append(chat_preview)

        resultado.sort(key=lambda x: x["ultimoMensaje"]["fecha"], reverse=True)

        return resultado

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mensajes/historial/conversaciones/{id_conversacion}", status_code=status.HTTP_200_OK)
async def obtener_historial_conversacion(
    id_conversacion: str,
    db_sql: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    try:
        try:
            query_id = ObjectId(id_conversacion)
        except InvalidId:
            query_id = id_conversacion
            
        cursor = db_mongo.messages.find({"id_conversacion": query_id})
        messages = await cursor.to_list(length=100)
        
        print(f"Buscando ID: {query_id}. Mensajes encontrados: {len(messages)}")
        
        if not messages:
            return []
            
        ids_usuarios = list(set(msg["id_usuario_remitente"] for msg in messages))
        usuarios_db = db_sql.query(UsuarioDB).filter(UsuarioDB.id_usuario.in_(ids_usuarios)).all()
        mapa_usuarios = {u.id_usuario: f"{u.nombre} {u.apellido}" for u in usuarios_db}
        
        resultado = [
            {
                "id": str(msg["_id"]),
                "contenido": msg["contenido"],
                "fecha_envio": msg["fecha_envio"].isoformat(),
                "remitente": {
                    "id_usuario": msg["id_usuario_remitente"],
                    "nombre": mapa_usuarios.get(msg["id_usuario_remitente"], "Usuario Desconocido")
                }
            }
            for msg in messages
        ]
        
        return resultado
    
    except Exception as e:
        print(f"Error en endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))