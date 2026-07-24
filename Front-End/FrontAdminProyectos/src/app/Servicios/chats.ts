import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatService {
  
  // === DEPENDENCIAS Y VARIABLES ===
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  
  private socket!: WebSocket;
  public mensajesNuevos$ = new Subject<any>();

  // ==========================================
  //            CONEXIÓN WEBSOCKET
  // ==========================================
  conectarWebSocket() {
    const token = localStorage.getItem('token'); 
    
    if (!token) {
      console.error('CONEXIÓN RECHAZADA: No hay token disponible para el WebSocket.');
      return;
    }

    this.socket = new WebSocket(`${environment.wsUrl}/ws?token=${token}`);

    this.socket.onmessage = (event) => {
      try {
        const mensaje = JSON.parse(event.data);
        this.mensajesNuevos$.next(mensaje);
      } catch (e) {
        console.error('Error parseando mensaje WS:', e);
      }
    };

    this.socket.onerror = (error) => console.error('Error de red en WebSocket:', error);
  }

  desconectarWebSocket() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
  }

  // ==========================================
  //            PETICIONES REST API
  // ==========================================
  // Nota: Igual que en ApiServicio, el token ahora lo pondrá el AuthInterceptor.

  enviarMensajeEnSala(idConversacion: string, contenido: string) {
    return this.http.post(`${this.apiUrl}/mensajes/conversacion`, {
      id_conversacion: idConversacion,
      contenido: contenido
    });
  }

  obtenerContactos(idProyecto: number) {
    return this.http.get<any[]>(`${this.apiUrl}/proyectos/${idProyecto}/colaboradores`);
  }

  obtenerConversaciones() {
    return this.http.get<any[]>(`${this.apiUrl}/mensajes/conversaciones`);
  }

  obtenerHistorialCompleto(idConversacion: string) {
    return this.http.get<any[]>(`${this.apiUrl}/mensajes/historial/conversaciones/${idConversacion}`);
  }
}