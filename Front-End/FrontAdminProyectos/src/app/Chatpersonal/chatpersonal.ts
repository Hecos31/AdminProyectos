import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jwtDecode } from 'jwt-decode';
import { Subscription } from 'rxjs';
import { ChatService } from '../Servicios/chats';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-chat-personal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatpersonal.html',
  styleUrls: ['./chatpersonal.css']
})
export class ChatPersonalComponente implements OnInit, OnDestroy {
  // === REFERENCIAS DOM ===
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // === ENTRADAS Y SALIDAS ===
  @Input() idConversacion: string = '';
  @Input() nombreContacto: string = 'Contacto';
  @Output() cerrarChat = new EventEmitter<void>();

  // === ESTADO ===
  mensajes: any[] = [];
  nuevoMensaje: string = '';
  usuarioId!: number;
  contactoEnLinea: boolean = false; 
  cargando: boolean = false;
  idConversacionActual: string = '';
  private chatSub!: Subscription;

  // === INYECCIÓN DE DEPENDENCIAS ===
  constructor(
    private chatService: ChatService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  // === CICLO DE VIDA ===
  ngOnInit() {
    this.configurarIdentificadores();
    this.obtenerUsuarioLocal();
    this.inicializarWebSocket();
    this.cargarHistorial();
  }

  ngAfterViewChecked() {
    this.hacerScrollHaciaAbajo();
  }

  ngOnDestroy() {
    if (this.chatSub) {
      this.chatSub.unsubscribe();
    }
    this.chatService.desconectarWebSocket();
  }

  // === CONFIGURACIÓN INICIAL ===
  private configurarIdentificadores() {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.idConversacionActual = idParam || this.idConversacion;

    const nombreParam = this.route.snapshot.queryParamMap.get('nombre');
    if (nombreParam) {
      this.nombreContacto = nombreParam;
    }
  }

  private obtenerUsuarioLocal() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decodificado: any = jwtDecode(token);
        this.usuarioId = Number(decodificado.sub); 
      } catch (e) {}
    }
  }

  // === WEBSOCKETS ===
  private inicializarWebSocket() {
    this.chatService.conectarWebSocket();
    this.chatSub = this.chatService.mensajesNuevos$.subscribe((msg) => {
      if (msg.id_usuario_remitente === this.usuarioId) return;

      const mensajeFormateado = {
        ...msg,
        fecha_envio: new Date(msg.fecha_envio),
        remitente: {
          id_usuario: msg.id_usuario_remitente,
          nombre: this.nombreContacto
        }
      };

      this.mensajes.push(mensajeFormateado);
      this.cdr.detectChanges();
    });
  }

  // === PETICIONES HTTP ===
  cargarHistorial() {
    if (!this.idConversacionActual) return;

    this.cargando = true;
    this.chatService.obtenerHistorialCompleto(this.idConversacionActual).subscribe({
      next: (mensajesDesdeBackend) => {
        this.mensajes = mensajesDesdeBackend;
        this.cargando = false;
        this.cdr.detectChanges();
        setTimeout(() => this.hacerScrollHaciaAbajo(), 100);
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  enviarMensaje() {
    if (!this.nuevoMensaje.trim()) return;

    const textoMensaje = this.nuevoMensaje;
    this.nuevoMensaje = ''; 

    const miNuevoMensaje = {
      contenido: textoMensaje,
      fecha_envio: new Date(),
      id_usuario_remitente: this.usuarioId,
      remitente: { id_usuario: this.usuarioId, nombre: 'Yo' }
    };
    
    this.mensajes.push(miNuevoMensaje);
    this.hacerScrollHaciaAbajo();

    this.chatService.enviarMensajeEnSala(this.idConversacionActual, textoMensaje).subscribe({
      error: () => {}
    });
  }

  // === EVENTOS UI ===
  emitirCierre() {
    this.cerrarChat.emit();
  }

  private hacerScrollHaciaAbajo(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }
}