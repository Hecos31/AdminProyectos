from typing import Dict
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def enviar_mensaje_en_vivo(self, mensaje: dict, destinatario_id: int):
        if destinatario_id in self.active_connections:
            websocket = self.active_connections[destinatario_id]
            await websocket.send_json(mensaje)

manager = ConnectionManager()