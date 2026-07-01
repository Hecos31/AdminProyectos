import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket!: WebSocket;
  public mensajesNuevos$ = new Subject<any>();
  
  private apiUrl = 'http://localhost:8000'; 

  constructor(private http: HttpClient) {}

  conectarWebSocket() {
    const token = localStorage.getItem('access_token'); 
    if (!token) {
      console.error('No hay token disponible');
      return;
    }

    this.socket = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

    this.socket.onmessage = (event) => {
      const mensaje = JSON.parse(event.data);
      this.mensajesNuevos$.next(mensaje);
    };

    this.socket.onerror = (error) => {
      console.error('Error en WebSocket:', error);
    };
  }

  desconectarWebSocket() {
    if (this.socket) {
      this.socket.close();
    }
  }

  enviarMensaje(destinatarioId: number, contenido: string) {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.post(`${this.apiUrl}/mensajes/privado`, {
      destinatario_id: destinatarioId,
      contenido: contenido
    }, { headers });
  }
}