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
export class ChatPersonalComponente implements OnInit, OnDestroy {
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
    private cdr: ChangeDetectorRef // <-- 1. Inyectarlo aquí
  ) {}

  ngOnInit() {
    // ... (tu código para obtener IDs y Token se queda igual)
    
    this.chatService.conectarWebSocket();

    this.chatSub = this.chatService.mensajesNuevos$.subscribe((msg) => {
      const mensajeFormateado = {
        ...msg,
        fecha_envio: new Date(msg.fecha_envio),
        remitente: { nombre: this.nombreContacto } 
      };
      
      this.mensajes.push(mensajeFormateado);
      
      // 2. FORZAR ACTUALIZACIÓN CUANDO LLEGA UN NUEVO MENSAJE
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
  cargarHistorial() {
    this.cargando = true;
    setTimeout(() => {
      this.cargando = false;
      this.nombreContacto = "Colaborador del Proyecto";
      
      // 3. FORZAR ACTUALIZACIÓN AL TERMINAR DE CARGAR (incluso en el setTimeout)
      this.cdr.detectChanges(); 
    }, 1000);
  }

  ngOnDestroy() {
    if (this.chatSub) {
      this.chatSub.unsubscribe();
    }
    this.chatService.desconectarWebSocket();
  }
}