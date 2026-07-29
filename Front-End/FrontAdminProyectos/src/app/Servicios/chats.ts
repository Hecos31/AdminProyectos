import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private http = inject(HttpClient);

  private apiUrl = 'http://192.168.50.134:8000';
  private wsUrl = 'ws://192.168.50.134:8000';
  private socket!: WebSocket;

  public mensajesNuevos$ = new Subject<any>();

  // Usamos el token que ya tienes guardado en localStorage
  private getHeaders() {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  conectarWebSocket() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    // Tu backend espera el token como Query Parameter: ?token=...
    this.socket = new WebSocket(`${this.wsUrl}/ws?token=${token}`);

    this.socket.onmessage = (event) => {
      const mensaje = JSON.parse(event.data);
      this.mensajesNuevos$.next(mensaje);
    };

    this.socket.onclose = () => {
      setTimeout(() => this.conectarWebSocket(), 3000); // Reconexión automática
    };
  }

  obtenerConversaciones() {
    return this.http.get<any[]>(`${this.apiUrl}/mensajes/conversaciones`, {
      headers: this.getHeaders(),
    });
  }

  obtenerHistorial(idConversacion: string) {
    return this.http.get<any[]>(
      `${this.apiUrl}/mensajes/historial/conversaciones/${idConversacion}`,
      { headers: this.getHeaders() }
    );
  }

  enviarMensajeHTTP(idConversacion: string, contenido: string) {
    // Apunta al endpoint de envío de tu mensajes.py
    return this.http.post(
      `${this.apiUrl}/mensajes/conversacion`,
      {
        id_conversacion: idConversacion,
        contenido: contenido,
      },
      { headers: this.getHeaders() }
    );
  }

  iniciarChatPorCorreo(correo: string) {
    return this.http.post<any>(
      `${this.apiUrl}/mensajes/iniciar-correo`,
      { correo_destino: correo },
      { headers: this.getHeaders() }
    );
  }

  public abrirWidget$ = new Subject<void>();

  solicitarAperturaWidget() {
    this.abrirWidget$.next();
  }
}
