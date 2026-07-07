import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../Servicios/chats';
import { Router } from '@angular/router';

export interface ChatPreview {
  id: string;
  nombre: string;
  enLinea: boolean;
  tipo: 'proyecto' | 'privado' | 'actividades';
  participantes: number;
  noLeidos: number;
  ultimoMensaje?: {
    contenido: string;
    fecha: string;
  };
}

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listachat.html',
  styleUrls: ['./listachat.css']
})
export class ListaChatComponente implements OnInit {
  @Output() abrirChat = new EventEmitter<ChatPreview>();
  terminoBusqueda: string = '';
  tabActivo: string = 'todos';
  cargando: boolean = false;
  chatSeleccionado: ChatPreview | null = null;
  chatsOriginales: ChatPreview[] = [];
  chatsFiltrados: ChatPreview[] = [];

  constructor(
    private chatService: ChatService,
    private router: Router ,
    private cdr: ChangeDetectorRef //Agregue esto dado que es necesario puesto que no se actualiza la informacion 

  ) {}

  ngOnInit() {
    this.cargarConversaciones();
  }

  cargarConversaciones() {
    this.cargando = true;
    this.chatService.obtenerConversaciones().subscribe({
      next: (chatsDelBackend) => {
        this.chatsOriginales = chatsDelBackend;
        this.filtrarChats(); 
        this.cargando = false; // Cambias la variable
        this.cdr.detectChanges();  // Le dices a Angular que actualice la pantalla
      },
      error: (error) => {
        console.error('Error al cargar la lista de chats', error);
        this.cargando = false;
        this.cdr.detectChanges(); 

      }
    });

  }



  cambiarTab(tab: string) {
    this.tabActivo = tab;
    this.filtrarChats();
  }

  filtrarChats() {
    this.chatsFiltrados = this.chatsOriginales.filter(chat => {
      const coincideTab = this.tabActivo === 'todos' || chat.tipo === this.tabActivo;
      const busqueda = this.terminoBusqueda.toLowerCase().trim();
      const coincideTexto = chat.nombre.toLowerCase().includes(busqueda) || 
                            (chat.ultimoMensaje?.contenido.toLowerCase().includes(busqueda) ?? false);
      return coincideTab && coincideTexto;
    });
  }

  seleccionarChat(chat: ChatPreview) {
    this.chatSeleccionado = chat;
      this.abrirChat.emit(chat);  // AGREGE ESTA LÍNEA
  }

  verChat(chat: any) {
    this.router.navigate(['/chatpersonal', chat.id], {
      queryParams: { nombre: chat.nombre }
    });
  }

  // cargarMas() {
  //   console.log("Funcionalidad de paginación pendiente");
  // }
}

