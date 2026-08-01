import asyncio
from dataclasses import dataclass, field
from typing import Dict, List

from fastapi import WebSocket


@dataclass
class ConexionActiva:
    websocket: WebSocket
    lock_envio: asyncio.Lock = field(
        default_factory=asyncio.Lock
    )


class ConnectionManager:
    def __init__(self) -> None:
        # Un usuario puede tener varias pestañas,
        # dispositivos o conexiones simultáneas.
        self.active_connections: Dict[
            int,
            List[ConexionActiva]
        ] = {}

        # Protege el acceso al diccionario.
        self._lock = asyncio.Lock()


    async def connect(
        self,
        websocket: WebSocket,
        user_id: int
    ) -> None:
        user_id = int(user_id)

        await websocket.accept()

        conexion = ConexionActiva(
            websocket=websocket
        )

        async with self._lock:
            conexiones_usuario = (
                self.active_connections.setdefault(
                    user_id,
                    []
                )
            )

            ya_registrada = any(
                actual.websocket is websocket
                for actual in conexiones_usuario
            )

            if not ya_registrada:
                conexiones_usuario.append(
                    conexion
                )

        print(
            f"[WS] Usuario {user_id} conectado. "
            f"Conexiones activas: "
            f"{await self.contar_conexiones(user_id)}"
        )


    async def disconnect(
        self,
        user_id: int,
        websocket: WebSocket
    ) -> None:
        user_id = int(user_id)

        async with self._lock:
            conexiones_usuario = (
                self.active_connections.get(
                    user_id,
                    []
                )
            )

            conexiones_restantes = [
                conexion
                for conexion in conexiones_usuario
                if conexion.websocket is not websocket
            ]

            if conexiones_restantes:
                self.active_connections[
                    user_id
                ] = conexiones_restantes
            else:
                self.active_connections.pop(
                    user_id,
                    None
                )

        print(
            f"[WS] Usuario {user_id} desconectado. "
            f"Conexiones restantes: "
            f"{await self.contar_conexiones(user_id)}"
        )


    async def enviar_mensaje_en_vivo(
        self,
        mensaje: dict,
        destinatario_id: int
    ) -> int:
        destinatario_id = int(
            destinatario_id
        )

        async with self._lock:
            conexiones = list(
                self.active_connections.get(
                    destinatario_id,
                    []
                )
            )

        if not conexiones:
            print(
                f"[WS] Usuario {destinatario_id} "
                "sin conexiones activas."
            )

            return 0

        conexiones_fallidas: List[
            ConexionActiva
        ] = []

        enviados = 0

        for conexion in conexiones:
            try:
                async with conexion.lock_envio:
                    await conexion.websocket.send_json(
                        mensaje
                    )

                enviados += 1

            except Exception as error:
                print(
                    f"[WS] Error enviando al usuario "
                    f"{destinatario_id}: {error}"
                )

                conexiones_fallidas.append(
                    conexion
                )

        for conexion in conexiones_fallidas:
            await self.disconnect(
                destinatario_id,
                conexion.websocket
            )

        return enviados


    async def contar_conexiones(
        self,
        user_id: int
    ) -> int:
        user_id = int(user_id)

        async with self._lock:
            return len(
                self.active_connections.get(
                    user_id,
                    []
                )
            )


    async def esta_conectado(
        self,
        user_id: int
    ) -> bool:
        return (
            await self.contar_conexiones(
                user_id
            )
        ) > 0


manager = ConnectionManager()