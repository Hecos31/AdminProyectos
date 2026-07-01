import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-chat-actividad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatactividades.html',
  styleUrls: ['./chatactividades.css']
})
export class ChatActividadComponent implements OnInit, OnDestroy {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @Input() actividadId: number = 0;
  @Input() nombreActividad: string = 'Actividad';

  proyectoId: number = 0;
  usuarioId: number = 0;
  mensajes: any[] = [];
  nuevoMensaje: string = '';
  cargando: boolean = true;
  private ws!: WebSocket;

  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    this.usuarioId = Number(localStorage.getItem('usuarioId')) || 1;
    this.conectarWebSocket();
    this.cargarMensajes();
  }

  private conectarWebSocket(): void {
    const token = localStorage.getItem('token');
    this.ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({
        tipo: 'unirse_actividad',
        id_actividad: this.actividadId
      }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id_actividad === this.actividadId) {
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
          remitente: { nombre: 'Ana Torres' },
          contenido: 'Esta actividad está en progreso',
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
      tipo: 'mensaje_actividad',
      id_actividad: this.actividadId,
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