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
    private router: Router 
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
      const mensajeFormateado = {
        ...msg,
        fecha_envio: new Date(msg.fecha_envio),
        remitente: { nombre: this.nombreContacto } 
      };
      
      this.mensajes.push(mensajeFormateado);
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
      id_usuario_remitente: this.usuarioId,
      contenido: textoMensaje,
      fecha_envio: new Date(),
      remitente: { nombre: 'Yo' }
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

    this.chatService.obtenerConversaciones().subscribe({
      next: (chats) => {
        const chatActual = chats.find((c: any) => c.id === this.idConversacionActual);

        if (chatActual && chatActual.ultimoMensaje) {
          this.mensajes = [{
            id_usuario_remitente: this.usuarioId,
            contenido: chatActual.ultimoMensaje.contenido,
            fecha_envio: new Date(chatActual.ultimoMensaje.fecha),
            remitente: { nombre: this.nombreContacto || 'Usuario' }
          }];
        }

        this.cargando = false;
        setTimeout(() => this.hacerScrollHaciaAbajo(), 100);
      },
      error: (error) => {
        console.error('Error cargando mensajes:', error);
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

