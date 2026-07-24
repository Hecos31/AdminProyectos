import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../Servicios/chats';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-widget.html',
  styleUrls: ['./chat-widget.css'],
})
export class ChatWidget implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private subscriptions = new Subscription();

  isOpen = false;
  isMinimized = false;
  vistaActual: 'lista' | 'conversacion' | 'nuevo' = 'lista';

  miUsuario: any = null;
  conversaciones: any[] = [];
  chatActivo: any = null;
  mensajes: any[] = [];

  nuevoMensaje = '';
  correoDestino = '';

  ngOnInit() {
    const usuarioStr = localStorage.getItem('usuario');

    if (!usuarioStr) {
      return;
    }

    this.miUsuario = JSON.parse(usuarioStr);

    // Primero conectar el WebSocket
    this.chatService.conectarWebSocket();

    // Escuchar mensajes nuevos
    this.subscriptions.add(
      this.chatService.mensajesNuevos$.subscribe({
        next: (msg) => {

          this.ngZone.run(() => {
            this.procesarMensajeEnVivo(msg);
          });
        },
        error: (error) => {
          console.error('[CHAT] Error en WebSocket:', error);
        },
      })
    );

    // Escuchar la apertura del widget
    this.subscriptions.add(
      this.chatService.abrirWidget$.subscribe(() => {
        this.ngZone.run(() => {
          this.abrirChat();
        });
      })
    );

    this.cargarConversaciones();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  abrirChat() {
    // 1. Recargar el usuario desde el disco duro (por si cambió de sesión)
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      this.miUsuario = JSON.parse(usuarioStr);
    } else {
      // Si por alguna razón no hay usuario, abortamos y cerramos
      this.cerrarChat();
      return;
    }

    // 2. Limpiamos la memoria del chat anterior por seguridad
    this.conversaciones = [];
    this.chatActivo = null;

    // 3. Abrimos la interfaz
    this.isOpen = true;
    this.isMinimized = false;

    // 4. Cargamos los chats EXCLUSIVOS del usuario que acaba de iniciar sesión
    this.cargarConversaciones();
  }

  minimizarChat() {
    this.isMinimized = !this.isMinimized;
  }
  cerrarChat() {
    this.isOpen = false;
    this.vistaActual = 'lista';
  }
  volverALista() {
    this.vistaActual = 'lista';
    this.chatActivo = null;
  }
  irANuevoChat() {
    this.vistaActual = 'nuevo';
    this.correoDestino = '';
  }

  cargarConversaciones() {
    this.chatService.obtenerConversaciones().subscribe((data) => {
      this.conversaciones = data;
      this.cdr.detectChanges();
    });
  }

  abrirConversacion(chat: any) {
    this.chatActivo = chat;
    this.vistaActual = 'conversacion';
    this.chatService.obtenerHistorial(chat.id).subscribe((msgs) => {
      this.mensajes = msgs;
      this.scrollAlFinal();
    });
  }

  enviarMensaje() {
    if (!this.nuevoMensaje.trim() || !this.chatActivo) return;
    const contenido = this.nuevoMensaje;
    this.nuevoMensaje = ''; // Limpiar input rápido

    this.chatService.enviarMensajeHTTP(this.chatActivo.id, contenido).subscribe({
      error: () => alert('Error al enviar el mensaje'),
    });
  }

  procesarMensajeEnVivo(msg: any) {

    const idConversacion =
      msg.id_conversacion ?? msg.conversacion_id ?? msg.idConversacion ?? msg.conversacion?.id;

    const idRemitente =
      msg.id_usuario_remitente ??
      msg.id_remitente ??
      msg.remitente_id ??
      msg.remitente?.id_usuario ??
      msg.remitente?.id;

    if (idConversacion === null || idConversacion === undefined) {
      console.error('[CHAT] El mensaje no contiene el ID de la conversación:', msg);
      return;
    }

    const mensajeNormalizado = {
      id: msg.id ?? msg.id_mensaje,
      contenido: msg.contenido ?? msg.mensaje ?? '',
      fecha_envio: msg.fecha_envio ?? msg.fecha ?? new Date().toISOString(),
      remitente: {
        id_usuario: idRemitente,
      },
    };

    /*
     * String() evita el problema:
     * 5 !== "5"
     */
    const perteneceAlChatActivo =
      this.chatActivo && String(this.chatActivo.id) === String(idConversacion);

    if (perteneceAlChatActivo) {
      const mensajeDuplicado = this.mensajes.some(
        (mensaje) =>
          mensajeNormalizado.id != null && String(mensaje.id) === String(mensajeNormalizado.id)
      );

      if (!mensajeDuplicado) {
        // Crear un arreglo nuevo ayuda a que Angular detecte el cambio
        this.mensajes = [...this.mensajes, mensajeNormalizado];
        this.scrollAlFinal();
      }
    }

    const chatIndex = this.conversaciones.findIndex(
      (chat) => String(chat.id) === String(idConversacion)
    );

    if (chatIndex !== -1) {
      const chatEncontrado = this.conversaciones[chatIndex];

      const chatActualizado = {
        ...chatEncontrado,
        ultimoMensaje: {
          ...(chatEncontrado.ultimoMensaje ?? {}),
          contenido: mensajeNormalizado.contenido,
          fecha: mensajeNormalizado.fecha_envio,
          fecha_envio: mensajeNormalizado.fecha_envio,
        },
      };

      // Colocar la conversación actualizada al principio
      this.conversaciones = [
        chatActualizado,
        ...this.conversaciones.filter((_, index) => index !== chatIndex),
      ];
    } else {
      // Es una conversación nueva que todavía no aparece en la lista
      this.cargarConversaciones();
    }

    // Forzar actualización inmediata de esta vista
    this.cdr.detectChanges();
  }

  iniciarChatPorCorreo() {
    if (!this.correoDestino.trim()) return;
    this.chatService.iniciarChatPorCorreo(this.correoDestino).subscribe({
      next: (res) => {
        this.cargarConversaciones();
        this.volverALista();
      },
      error: (err) => alert(err.error?.detail || 'No se pudo iniciar el chat'),
    });
  }

  private scrollAlFinal() {
    setTimeout(() => {
      const el = document.getElementById('chat-scroll-area');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  esMiMensaje(msg: any): boolean {
    if (!this.miUsuario || !msg) {
      return false;
    }

    const miId = this.miUsuario.id_usuario ?? this.miUsuario.id;

    const remitenteId =
      msg.remitente?.id_usuario ??
      msg.remitente?.id ??
      msg.id_usuario_remitente ??
      msg.id_remitente ??
      msg.remitente_id;

    if (miId === null || miId === undefined) {
      return false;
    }

    if (remitenteId === null || remitenteId === undefined) {
      return false;
    }

    return String(remitenteId) === String(miId);
  }
}
