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
    const token = localStorage.getItem('token'); 
    
    if (!token) {
      console.error('No hay token disponible para el WebSocket');
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

  enviarMensajeEnSala(idConversacion: string, contenido: string) {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    return this.http.post(`${this.apiUrl}/mensajes/conversacion`, {
      id_conversacion: idConversacion,
      contenido: contenido
    }, { headers });
  }

  obtenerContactos(idProyecto: number) {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    
    return this.http.get<any[]>(`${this.apiUrl}/proyectos/${idProyecto}/colaboradores`, { headers });
  }


  obtenerConversaciones() {
    const token = localStorage.getItem('token'); 
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    return this.http.get<any[]>(`${this.apiUrl}/mensajes/conversaciones`, { headers: headers });
  }


  obtenerMensajes() {
    const token = localStorage.getItem('token'); 
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    return this.http.get<any[]>(`${this.apiUrl}/mensajes/conversaciones`, { headers: headers });
  }

  // En tu ChatService.ts
  obtenerHistorialCompleto(idConversacion: string) {
  const token = localStorage.getItem('token');
  
  // Es vital agregar el encabezado Authorization
  const headers = {
    'Authorization': `Bearer ${token}`
  };

  return this.http.get<any[]>(`${this.apiUrl}/mensajes/historial/conversaciones/${idConversacion}`, { headers });
  }
}