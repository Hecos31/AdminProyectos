// === IMPORTACIONES ===
import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../Servicios/chats';

// === INTERFACES ===
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
  // === EVENTOS Y SALIDAS ===
  @Output() abrirChat = new EventEmitter<ChatPreview>();

  // === ESTADO DEL COMPONENTE ===
  terminoBusqueda: string = '';
  tabActivo: string = 'todos';
  cargando: boolean = false;
  chatSeleccionado: ChatPreview | null = null;
  
  chatsOriginales: ChatPreview[] = [];
  chatsFiltrados: ChatPreview[] = [];

  // === INYECCIÓN DE DEPENDENCIAS ===
  constructor(
    private chatService: ChatService,
    private router: Router,
    private cdr: ChangeDetectorRef 
  ) {}

  // === CICLO DE VIDA ===
  ngOnInit() {
    this.cargarConversaciones();
  }

  // === PETICIONES HTTP ===
  cargarConversaciones() {
    this.cargando = true;
    this.chatService.obtenerConversaciones().subscribe({
      next: (chatsDelBackend) => {
        this.chatsOriginales = chatsDelBackend;
        this.filtrarChats(); 
        this.cargando = false;
        this.cdr.detectChanges(); 
      },
      error: (error) => {
        console.error('Error al cargar la lista de chats', error);
        this.cargando = false;
        this.cdr.detectChanges(); 
      }
    });
  }

  // === LÓGICA DE FILTRADO Y TABS ===
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

  // === SELECCIÓN Y NAVEGACIÓN ===
  seleccionarChat(chat: ChatPreview) {
    this.chatSeleccionado = chat;
    this.abrirChat.emit(chat);
  }

  verChat(chat: any) {
    this.router.navigate(['/chatpersonal', chat.id], {
      queryParams: { nombre: chat.nombre }
    });
  }
}