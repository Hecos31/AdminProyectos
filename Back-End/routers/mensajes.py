from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status
)
from sqlalchemy.orm import Session

from database import get_db, db_mongo
from models import UsuarioDB
from schemas import (
    IniciarChatCorreoRequest,
    MensajeConversacionRequest
)
from auth import (
    obtener_usuario_actual,
    validar_token_ws
)
from websocket import manager

router = APIRouter(
    tags=["Mensajes y WebSockets"]
)


def fecha_iso_utc(
    valor: datetime | None
) -> str:
    if valor is None:
        valor = datetime.now(timezone.utc)

    # MongoDB guarda fechas en UTC, pero PyMongo puede
    # devolverlas sin tzinfo. Se vuelve a colocar UTC
    # antes de serializar.
    if valor.tzinfo is None:
        valor = valor.replace(
            tzinfo=timezone.utc
        )

    return (
        valor.astimezone(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )


def convertir_object_id(
    valor: str
) -> ObjectId:
    try:
        return ObjectId(valor)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de conversación inválido"
        )


async def obtener_conversacion_del_usuario(
    id_conversacion: ObjectId,
    id_usuario: int
) -> dict:
    conversacion = await db_mongo.conversations.find_one(
        {
            "_id": id_conversacion,
            "participantes.id_usuario": id_usuario
        }
    )

    if not conversacion:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "No perteneces a esta conversación "
                "o la conversación no existe"
            )
        )

    return conversacion


@router.post(
    "/mensajes/conversacion",
    status_code=status.HTTP_200_OK
)
async def enviar_mensaje_conversacion(
    req: MensajeConversacionRequest,
    db_sql: Session = Depends(get_db),
    id_usuario_actual: int = Depends(
        obtener_usuario_actual
    )
):
    contenido = req.contenido.strip()

    if not contenido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El mensaje no puede estar vacío"
        )

    conv_id = convertir_object_id(
        req.id_conversacion
    )

    chat = await obtener_conversacion_del_usuario(
        conv_id,
        id_usuario_actual
    )

    fecha_envio = datetime.now(
        timezone.utc
    )

    nuevo_mensaje = {
        "id_conversacion": conv_id,
        "id_usuario_remitente": id_usuario_actual,
        "contenido": contenido,
        "fecha_envio": fecha_envio
    }

    resultado = await db_mongo.messages.insert_one(
        nuevo_mensaje
    )

    usuario = (
        db_sql.query(UsuarioDB)
        .filter(
            UsuarioDB.id_usuario ==
            id_usuario_actual
        )
        .first()
    )

    nombre_remitente = (
        f"{usuario.nombre} {usuario.apellido}".strip()
        if usuario
        else "Usuario"
    )

    mensaje_respuesta = {
        "id": str(resultado.inserted_id),
        "id_conversacion": str(conv_id),
        "id_usuario_remitente": id_usuario_actual,
        "contenido": contenido,
        "fecha_envio": fecha_iso_utc(fecha_envio),
        "remitente": {
            "id_usuario": id_usuario_actual,
            "nombre": nombre_remitente
        }
    }

    for participante in chat.get(
        "participantes",
        []
    ):
        participante_id = participante.get(
            "id_usuario"
        )

        if participante_id is None:
            continue

        try:
            await manager.enviar_mensaje_en_vivo(
                mensaje_respuesta,
                participante_id
            )
        except Exception as error:
            # El mensaje ya fue guardado. Una conexión
            # WebSocket caída no debe convertir el envío
            # HTTP en un error.
            print(
                "[CHAT] No se pudo emitir a "
                f"{participante_id}: {error}"
            )

    return mensaje_respuesta


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    user_id = await validar_token_ws(token)

    if user_id is None:
        await websocket.close(code=1008)
        return

    await manager.connect(
        websocket,
        user_id
    )

    try:
        while True:
            # El cliente envía "ping" periódicamente.
            # Recibir cualquier texto mantiene viva la conexión.
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(user_id)

    except Exception:
        manager.disconnect(user_id)


@router.get(
    "/mensajes/conversaciones",
    status_code=status.HTTP_200_OK
)
async def obtener_lista_conversaciones(
    db_sql: Session = Depends(get_db),
    id_usuario_actual: int = Depends(
        obtener_usuario_actual
    )
):
    try:
        cursor = db_mongo.conversations.find(
            {
                "participantes.id_usuario":
                    id_usuario_actual
            }
        )

        conversaciones = await cursor.to_list(
            length=100
        )

        resultado = []

        for conversacion in conversaciones:
            id_conversacion = conversacion["_id"]

            ultimo_mensaje = (
                await db_mongo.messages.find_one(
                    {
                        "id_conversacion":
                            id_conversacion
                    },
                    sort=[
                        ("fecha_envio", -1)
                    ]
                )
            )

            participante_actual = next(
                (
                    participante
                    for participante
                    in conversacion.get(
                        "participantes",
                        []
                    )
                    if participante.get(
                        "id_usuario"
                    ) == id_usuario_actual
                ),
                None
            )

            ultima_lectura = (
                participante_actual or {}
            ).get("ultima_lectura")

            consulta_no_leidos = {
                "id_conversacion":
                    id_conversacion,

                "id_usuario_remitente": {
                    "$ne":
                        id_usuario_actual
                }
            }

            if ultima_lectura:
                consulta_no_leidos[
                    "fecha_envio"
                ] = {
                    "$gt": ultima_lectura
                }

            no_leidos = (
                await db_mongo.messages
                .count_documents(
                    consulta_no_leidos
                )
            )

            nombre_chat = conversacion.get(
                "nombre"
            )

            if (
                conversacion.get("tipo") ==
                "privado"
            ):
                otro_id = next(
                    (
                        participante.get(
                            "id_usuario"
                        )
                        for participante
                        in conversacion.get(
                            "participantes",
                            []
                        )
                        if participante.get(
                            "id_usuario"
                        ) != id_usuario_actual
                    ),
                    None
                )

                if otro_id is not None:
                    otro_usuario = (
                        db_sql.query(UsuarioDB)
                        .filter(
                            UsuarioDB.id_usuario ==
                            otro_id
                        )
                        .first()
                    )

                    if otro_usuario:
                        nombre_chat = (
                            f"{otro_usuario.nombre} "
                            f"{otro_usuario.apellido}"
                        ).strip()
                    else:
                        nombre_chat = (
                            "Usuario desconocido"
                        )

            fecha_referencia = (
                ultimo_mensaje.get(
                    "fecha_envio"
                )
                if ultimo_mensaje
                else conversacion.get(
                    "creado_en",
                    datetime.now(timezone.utc)
                )
            )

            chat_preview = {
                "id": str(id_conversacion),

                "nombre":
                    nombre_chat or
                    "Chat sin nombre",

                "enLinea": False,

                "tipo":
                    conversacion.get("tipo"),

                "participantes":
                    len(
                        conversacion.get(
                            "participantes",
                            []
                        )
                    ),

                "noLeidos":
                    no_leidos,

                "ultimoMensaje": {
                    "contenido":
                        ultimo_mensaje.get(
                            "contenido",
                            "Sin mensajes"
                        )
                        if ultimo_mensaje
                        else "Sin mensajes",

                    "fecha":
                        fecha_iso_utc(fecha_referencia)
                }
            }

            resultado.append(
                chat_preview
            )

        resultado.sort(
            key=lambda chat:
                chat["ultimoMensaje"]["fecha"],
            reverse=True
        )

        return resultado

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(error)
        )


@router.patch(
    "/mensajes/conversaciones/{id_conversacion}/leer",
    status_code=status.HTTP_200_OK
)
async def marcar_conversacion_leida(
    id_conversacion: str,
    id_usuario_actual: int = Depends(
        obtener_usuario_actual
    )
):
    conv_id = convertir_object_id(
        id_conversacion
    )

    await obtener_conversacion_del_usuario(
        conv_id,
        id_usuario_actual
    )

    resultado = (
        await db_mongo.conversations
        .update_one(
            {
                "_id": conv_id,
                "participantes.id_usuario":
                    id_usuario_actual
            },
            {
                "$set": {
                    "participantes.$.ultima_lectura":
                        datetime.now(
                            timezone.utc
                        )
                }
            }
        )
    )

    if resultado.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada"
        )

    return {
        "status": "success",
        "noLeidos": 0
    }


@router.get(
    "/mensajes/historial/conversaciones/{id_conversacion}",
    status_code=status.HTTP_200_OK
)
async def obtener_historial_conversacion(
    id_conversacion: str,
    db_sql: Session = Depends(get_db),
    id_usuario_actual: int = Depends(
        obtener_usuario_actual
    )
):
    conv_id = convertir_object_id(
        id_conversacion
    )

    await obtener_conversacion_del_usuario(
        conv_id,
        id_usuario_actual
    )

    cursor = (
        db_mongo.messages
        .find(
            {
                "id_conversacion":
                    conv_id
            }
        )
        .sort(
            "fecha_envio",
            1
        )
    )

    mensajes = await cursor.to_list(
        length=500
    )

    if not mensajes:
        return []

    ids_usuarios = list(
        {
            mensaje[
                "id_usuario_remitente"
            ]
            for mensaje in mensajes
        }
    )

    usuarios = (
        db_sql.query(UsuarioDB)
        .filter(
            UsuarioDB.id_usuario.in_(
                ids_usuarios
            )
        )
        .all()
    )

    mapa_usuarios = {
        usuario.id_usuario:
            f"{usuario.nombre} "
            f"{usuario.apellido}".strip()
        for usuario in usuarios
    }

    return [
        {
            "id":
                str(mensaje["_id"]),

            "id_conversacion":
                str(conv_id),

            "id_usuario_remitente":
                mensaje[
                    "id_usuario_remitente"
                ],

            "contenido":
                mensaje["contenido"],

            "fecha_envio":
                fecha_iso_utc(
                    mensaje["fecha_envio"]
                ),

            "remitente": {
                "id_usuario":
                    mensaje[
                        "id_usuario_remitente"
                    ],

                "nombre":
                    mapa_usuarios.get(
                        mensaje[
                            "id_usuario_remitente"
                        ],
                        "Usuario desconocido"
                    )
            }
        }
        for mensaje in mensajes
    ]


@router.post(
    "/mensajes/iniciar-correo",
    status_code=status.HTTP_200_OK
)
async def iniciar_chat_por_correo(
    req: IniciarChatCorreoRequest,
    db_sql: Session = Depends(get_db),
    id_usuario_actual: int = Depends(
        obtener_usuario_actual
    )
):
    correo = req.correo_destino.strip()

    usuario_destino = (
        db_sql.query(UsuarioDB)
        .filter(
            UsuarioDB.correo == correo
        )
        .first()
    )

    if not usuario_destino:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    if (
        usuario_destino.id_usuario ==
        id_usuario_actual
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No puedes iniciar un chat "
                "contigo mismo"
            )
        )

    chat_existente = (
        await db_mongo.conversations
        .find_one(
            {
                "tipo": "privado",

                "participantes": {
                    "$all": [
                        {
                            "$elemMatch": {
                                "id_usuario":
                                    id_usuario_actual
                            }
                        },
                        {
                            "$elemMatch": {
                                "id_usuario":
                                    usuario_destino.id_usuario
                            }
                        }
                    ]
                }
            }
        )
    )

    if chat_existente:
        return {
            "id_conversacion":
                str(chat_existente["_id"])
        }

    ahora = datetime.now(timezone.utc)

    nueva_conversacion = {
        "tipo": "privado",
        "creado_en": ahora,

        "participantes": [
            {
                "id_usuario":
                    id_usuario_actual,

                "ultima_lectura":
                    ahora
            },
            {
                "id_usuario":
                    usuario_destino.id_usuario,

                "ultima_lectura":
                    ahora
            }
        ]
    }

    resultado = (
        await db_mongo.conversations
        .insert_one(
            nueva_conversacion
        )
    )

    return {
        "id_conversacion":
            str(resultado.inserted_id)
    }