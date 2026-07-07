import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jwtDecode } from 'jwt-decode';
import { Subscription } from 'rxjs';
import { ChatService } from '../Servicios/chats';
import { ActivatedRoute, Router } from '@angular/router'

@Component({
  selector: 'app-chat-personal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatpersonal.html',
  styleUrls: ['./chatpersonal.css']
})
export class ChatPersonalComponente {
 @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
 @Input() idConversacion: string = '';
@Input() nombreContacto: string = 'Contacto';

  mensajes: any[] = [];
  nuevoMensaje: string = '';
  usuarioId!: number;
  contactoEnLinea: boolean = false; 
  cargando: boolean = false;
  destinatarioId!: number;
  //nombreContacto: string = ''; //Modificado
  idConversacionActual: string = '';
  private chatSub!: Subscription;

  constructor(
    private chatService: ChatService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    
    /*const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.idConversacionActual = idParam;
    }

    this.nombreContacto = this.route.snapshot.queryParamMap.get('nombre') || 'Contacto';*/

    // ESTA ES LA ÚNICA PARTE QUE CAMBIA
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.idConversacionActual = idParam;
    } else if (this.idConversacion) {
      this.idConversacionActual = this.idConversacion;
    }

    if (this.route.snapshot.queryParamMap.get('nombre')) {
      this.nombreContacto = this.route.snapshot.queryParamMap.get('nombre') || 'Contacto';
    }
    // FIN DEL CAMBIO

    const token = localStorage.getItem('token');
    if (token) {
      const decodificado: any = jwtDecode(token);
      this.usuarioId = Number(decodificado.sub); 
    }
    
    this.chatService.conectarWebSocket();

    this.chatSub = this.chatService.mensajesNuevos$.subscribe((msg) => {
      // Si el mensaje es mío, ya lo agregué de forma optimista al enviarlo. Ignóralo.
      if (msg.id_usuario_remitente === this.usuarioId) {
        return;
      }

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

    this.cargarHistorial();
  }

  ngAfterViewChecked() {
    this.hacerScrollHaciaAbajo();
  }

  hacerScrollHaciaAbajo(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  enviarMensaje() {
    if (!this.nuevoMensaje.trim()) return;

    const textoMensaje = this.nuevoMensaje;
    this.nuevoMensaje = ''; 

    const miNuevoMensaje = {
      contenido: textoMensaje,
      fecha_envio: new Date(),
      remitente: { id_usuario: this.usuarioId, nombre: 'Yo' }
    };
    this.mensajes.push(miNuevoMensaje);

    this.chatService.enviarMensajeEnSala(this.idConversacionActual, textoMensaje)
      .subscribe({
        error: (err) => console.error('Error al enviar el mensaje:', err)
      });
  }

  /*cargarHistorial() {
    this.cargando = true;
    setTimeout(() => {
      this.cargando = false;
      this.nombreContacto = "Colaborador del Proyecto";
    }, 1000);
  }*/

 //SOLO ESTE MÉTODO FUE MODIFICADO
  cargarHistorial() {
  if (!this.idConversacionActual) {
    this.cargando = false;
    return;
  }

  this.cargando = true;
  this.chatService.obtenerHistorialCompleto(this.idConversacionActual).subscribe({
    next: (mensajesDesdeBackend) => {
      this.mensajes = mensajesDesdeBackend; // Aquí ya tienes tus datos
      
      this.cargando = false;
      this.cdr.detectChanges(); // 3. FORZAR LA ACTUALIZACIÓN DE LA VISTA
      
      setTimeout(() => this.hacerScrollHaciaAbajo(), 100);
    },
    error: (error) => {
      console.error('Error:', error);
      this.cargando = false;
    }
  });
}

  ngOnDestroy() {
    if (this.chatSub) {
      this.chatSub.unsubscribe();
    }
    this.chatService.desconectarWebSocket();
  }
}

