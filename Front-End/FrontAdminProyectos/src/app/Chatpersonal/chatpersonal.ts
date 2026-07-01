import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-personal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatpersonal.html',
  styleUrls: ['./chatpersonal.css']
})
export class ChatPersonalComponent implements OnInit, OnDestroy {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @Input() destinatarioId: number = 0;
  @Input() nombreContacto: string = '';

  usuarioId: number = 0;
  mensajes: any[] = [];
  nuevoMensaje: string = '';
  cargando: boolean = true;
  contactoEnLinea: boolean = false;
  private ws!: WebSocket;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.usuarioId = Number(localStorage.getItem('usuarioId')) || 1;
    this.contactoEnLinea = true;
    this.conectarWebSocket();
    this.cargarMensajes();
  }

  private conectarWebSocket(): void {
    const token = localStorage.getItem('token');
    this.ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

    this.ws.onopen = () => {
      console.log('WebSocket personal conectado');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id_usuario_remitente === this.destinatarioId || 
          data.id_usuario_remitente === this.usuarioId) {
        this.mensajes.push(data);
        this.cdr.detectChanges();
        this.scrollToBottom();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private cargarMensajes(): void {
    setTimeout(() => {
      this.mensajes = [
        {
          id_usuario_remitente: 2,
          remitente: { nombre: 'Carlos López' },
          contenido: 'Hola, ¿cómo estás?',
          fecha_envio: new Date()
        },
        {
          id_usuario_remitente: 1,
          remitente: { nombre: 'Usuario Actual' },
          contenido: 'Bien, ¿y tú?',
          fecha_envio: new Date()
        }
      ];
      this.cargando = false;
      this.cdr.detectChanges();
      this.scrollToBottom();
    }, 500);
  }

  enviarMensaje(): void {
    if (!this.nuevoMensaje.trim()) {
      return;
    }

    const mensaje = {
      tipo: 'mensaje_privado',
      destinatario_id: this.destinatarioId,
      contenido: this.nuevoMensaje
    };

    this.ws.send(JSON.stringify(mensaje));
    this.nuevoMensaje = '';
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}