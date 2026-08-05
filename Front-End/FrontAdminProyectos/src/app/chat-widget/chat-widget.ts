import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import {
  ChatConversacion,
  ChatMensaje,
  ChatService
} from '../Servicios/chats';

/** Interfaz para la agrupación visual de mensajes por fecha */
export interface GrupoMensajes {
  fechaEtiqueta: string;
  mensajes: ChatMensaje[];
}

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-widget.html',
  styleUrls: ['./chat-widget.css']
})
export class ChatWidget implements OnInit, OnDestroy {
  // Inyección de servicios necesarios
  private chatService = inject(ChatService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private subscriptions = new Subscription();

  // Estados de apertura del Widget
  isOpen = false;
  isMinimized = false;

  // Estado de navegación dentro del widget
  vistaActual: 'lista' | 'conversacion' | 'nuevo' = 'lista';

  // Datos de usuario y chats
  miUsuario: any = null;
  conversaciones: ChatConversacion[] = [];
  chatActivo: ChatConversacion | null = null;
  mensajes: ChatMensaje[] = [];
  gruposMensajes: GrupoMensajes[] = [];

  // Modelos para formularios de entrada
  nuevoMensaje = '';
  correoDestino = '';

  // Indicadores de estado de red
  totalNoLeidos = 0;
  conexionActiva = false;

  ngOnInit(): void {
    // Verificar si existe usuario activo en el almacenamiento local
    if (!this.cargarUsuarioActual()) {
      return;
    }

    // Subscripción a la lista global de conversaciones
    this.subscriptions.add(
      this.chatService.conversaciones$.subscribe((conversaciones) => {
        this.ngZone.run(() => {
          this.conversaciones = conversaciones;
          this.actualizarChatActivo();
          this.cdr.detectChanges();
        });
      })
    );

    // Subscripción al contador general de mensajes no leídos
    this.subscriptions.add(
      this.chatService.totalNoLeidos$.subscribe((total) => {
        this.totalNoLeidos = total;
        this.cdr.detectChanges();
      })
    );

    // Subscripción a nuevos mensajes entrantes por WebSocket
    this.subscriptions.add(
      this.chatService.mensajesNuevos$.subscribe({
        next: (mensaje) => {
          this.ngZone.run(() => {
            this.procesarMensajeEnVivo(mensaje);
          });
        },
        error: (error) => {
          console.error('[CHAT] Error en WebSocket:', error);
        }
      })
    );

    // Subscripción a evento global para desplegar el widget
    this.subscriptions.add(
      this.chatService.abrirWidget$.subscribe(() => {
        this.ngZone.run(() => {
          this.abrirChat();
        });
      })
    );

    // Subscripción al evento de expiración de token de autenticación
    this.subscriptions.add(
      this.chatService.sesionExpirada$.subscribe(() => {
        this.ngZone.run(() => {
          this.cerrarChat();
          console.warn(
            '[CHAT] La sesión expiró. Es necesario iniciar sesión nuevamente.'
          );
        });
      })
    );

    // Control de estado de reconexión WebSocket
    let conexionAnterior = false;
    let conexionEstablecidaAlgunaVez = false;

    this.subscriptions.add(
      this.chatService.conexion$.subscribe((conectado) => {
        const seReconecto =
          conectado &&
          !conexionAnterior &&
          conexionEstablecidaAlgunaVez;

        if (conectado) {
          conexionEstablecidaAlgunaVez = true;
        }

        conexionAnterior = conectado;
        this.conexionActiva = conectado;

        if (seReconecto && this.chatActivo) {
          this.recargarHistorialActivo();
        }

        this.cdr.detectChanges();
      })
    );

    // Inicializar el servicio de comunicación por WebSocket
    this.chatService.iniciar();
  }

  ngOnDestroy(): void {
    // Desuscribir todas las subscripciones para prevenir fugas de memoria
    this.subscriptions.unsubscribe();
  }

  /** Despliega y maximiza la ventana del chat */
  abrirChat(): void {
    if (!this.cargarUsuarioActual()) {
      this.cerrarChat();
      return;
    }

    this.isOpen = true;
    this.isMinimized = false;

    this.cargarConversaciones();

    if (this.vistaActual === 'conversacion' && this.chatActivo) {
      this.marcarActivaComoLeida();
      this.scrollAlFinal();
    }
  }

  /** Alterna la minimización de la ventana sin borrar el historial actual */
  minimizarChat(): void {
    this.isMinimized = !this.isMinimized;

    if (!this.isMinimized) {
      this.marcarActivaComoLeida();
      this.scrollAlFinal();
    }
  }

  /** Cierra la ventana del chat y reinicia la navegación a la vista de lista */
  cerrarChat(): void {
    this.isOpen = false;
    this.isMinimized = false;
    this.vistaActual = 'lista';
    this.chatActivo = null;
    this.mensajes = [];
    this.gruposMensajes = [];
  }

  /** Regresa a la lista general de conversaciones */
  volverALista(): void {
    this.vistaActual = 'lista';
    this.chatActivo = null;
    this.mensajes = [];
    this.gruposMensajes = [];
  }

  /** Cambia la vista del widget para iniciar un nuevo chat */
  irANuevoChat(): void {
    this.vistaActual = 'nuevo';
    this.correoDestino = '';
  }

  /** Pide al backend actualizar la lista de conversaciones activas */
  cargarConversaciones(): void {
    this.chatService.sincronizarConversaciones().subscribe({
      error: (error) => {
        if (error?.status !== 401) {
          console.error('[CHAT] Error cargando conversaciones:', error);
        }
      }
    });
  }

  /** Formatea de manera inteligente las fechas en la lista general de chats */
  formatearFechaLista(fechaStr: string | null | undefined): string {
    if (!fechaStr) return '';

    const fechaMsg = new Date(fechaStr);
    if (isNaN(fechaMsg.getTime())) return '';

    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    const fMsg = new Date(fechaMsg.getFullYear(), fechaMsg.getMonth(), fechaMsg.getDate());
    const fHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const fAyer = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate());

    if (fMsg.getTime() === fHoy.getTime()) {
      return fechaMsg.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (fMsg.getTime() === fAyer.getTime()) {
      return 'Ayer';
    } else {
      return fechaMsg.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  }

  /** Abre la conversación seleccionada y descarga su historial */
  abrirConversacion(chat: ChatConversacion): void {
    const idSolicitado = String(chat.id);

    this.chatActivo = chat;
    this.vistaActual = 'conversacion';
    this.mensajes = [];
    this.gruposMensajes = [];

    this.chatService.marcarConversacionLeidaLocal(chat.id);

    this.chatService.marcarConversacionLeida(chat.id).subscribe({
      error: (error) => {
        if (error?.status !== 401) {
          console.warn('[CHAT] No se pudo marcar como leída:', error);
        }
      }
    });

    this.chatService.obtenerHistorial(chat.id).subscribe({
      next: (mensajes) => {
        if (!this.chatActivo || String(this.chatActivo.id) !== idSolicitado) {
          return;
        }

        const historial = (mensajes ?? []).map((mensaje) =>
          this.chatService.normalizarMensaje(mensaje)
        );

        this.mensajes = this.combinarMensajes(historial, this.mensajes);
        this.gruposMensajes = this.agruparMensajesPorFecha(this.mensajes);

        this.scrollAlFinal();
        this.cdr.detectChanges();
      },
      error: (error) => {
        if (error?.status !== 401) {
          console.error('[CHAT] Error cargando historial:', error);
        }
      }
    });
  }

  /** Realiza el envío del mensaje escrito hacia el backend HTTP */
  enviarMensaje(): void {
    const contenido = this.nuevoMensaje.trim();

    if (!contenido || !this.chatActivo) {
      return;
    }

    const idConversacion = this.chatActivo.id;
    this.nuevoMensaje = '';

    this.chatService
      .enviarMensajeHTTP(idConversacion, contenido)
      .subscribe({
        next: (mensaje) => {
          this.procesarMensajeEnVivo(mensaje);
        },
        error: (error) => {
          this.nuevoMensaje = contenido;

          if (error?.status !== 401) {
            console.error('[CHAT] Error enviando mensaje:', error);
            alert('No fue posible enviar el mensaje');
          }
        }
      });
  }

  /** Procesa y agrega un mensaje entrante (vía WebSocket o respuesta HTTP) */
  procesarMensajeEnVivo(mensajeOriginal: any): void {
    const mensaje = this.chatService.normalizarMensaje(mensajeOriginal);

    if (!mensaje.id_conversacion) {
      console.error('[CHAT] Mensaje sin ID de conversación:', mensajeOriginal);
      return;
    }

    const perteneceAlChatActivo =
      this.chatActivo !== null &&
      String(this.chatActivo.id) === String(mensaje.id_conversacion);

    if (!perteneceAlChatActivo) {
      return;
    }

    const indiceExistente = this.mensajes.findIndex(
      (item) =>
        mensaje.id !== null &&
        item.id !== null &&
        String(item.id) === String(mensaje.id)
    );

    if (indiceExistente === -1) {
      this.mensajes = [...this.mensajes, mensaje];
    } else {
      const mensajesActualizados = [...this.mensajes];
      const mensajeExistente = mensajesActualizados[indiceExistente];

      if (!mensajeExistente) {
        this.mensajes = [...this.mensajes, mensaje];
      } else {
        mensajesActualizados[indiceExistente] = this.combinarMensajeDuplicado(
          mensajeExistente,
          mensaje
        );
        this.mensajes = mensajesActualizados;
      }
    }

    // Agrupar por fecha y actualizar la vista inmediatamente
    this.gruposMensajes = this.agruparMensajesPorFecha(this.mensajes);
    this.scrollAlFinal();
    this.marcarActivaComoLeida();
    this.cdr.detectChanges();
  }

  /** Inicia un chat nuevo buscando el usuario por su correo electrónico */
  iniciarChatPorCorreo(): void {
    const correo = this.correoDestino.trim();

    if (!correo) {
      return;
    }

    this.chatService.iniciarChatPorCorreo(correo).subscribe({
      next: (respuesta) => {
        this.chatService
          .sincronizarConversaciones()
          .subscribe({
            next: (conversaciones) => {
              const conversacion = conversaciones.find(
                (chat) =>
                  String(chat.id) === String(respuesta.id_conversacion)
              );

              if (conversacion) {
                this.abrirConversacion(conversacion);
              } else {
                this.volverALista();
              }
            },
            error: () => {
              this.volverALista();
            }
          });
      },
      error: (error) => {
        if (error?.status !== 401) {
          alert(
            error?.error?.detail || 'No se pudo iniciar el chat'
          );
        }
      }
    });
  }

  /** Determina de manera precisa si el mensaje fue enviado por el usuario actual */
  esMiMensaje(mensaje: ChatMensaje): boolean {
    if (!this.miUsuario || !mensaje) {
      return false;
    }

    // Probar las propiedades comunes donde se almacena el ID del usuario en sesión
    const miId =
      this.miUsuario.id_usuario ??
      this.miUsuario.id ??
      this.miUsuario.sub ??
      this.miUsuario.user_id;

    // Probar las propiedades donde el backend devuelve el ID del remitente
    const remitenteId =
      mensaje.remitente?.id_usuario ??
      mensaje.id_usuario_remitente ??
      (mensaje as any).id_usuario;

    if (miId == null || remitenteId == null) {
      return false;
    }

    return String(miId).trim().toLowerCase() === String(remitenteId).trim().toLowerCase();
  }

  /** Función trackBy para optimizar el renderizado del ngFor */
  trackMensaje(index: number, mensaje: ChatMensaje): string {
    return mensaje.id ?? `${mensaje.fecha_envio}-${index}`;
  }

  /** Devuelve el contador de mensajes no leídos formateado */
  cantidadNoLeidos(chat: ChatConversacion): string {
    const cantidad = Number(chat.noLeidos ?? 0);
    return cantidad > 99 ? '99+' : String(cantidad);
  }

  /** Agrupa un listado de mensajes por sus etiquetas de fecha */
  private agruparMensajesPorFecha(mensajes: ChatMensaje[]): GrupoMensajes[] {
    const gruposMapa = new Map<string, ChatMensaje[]>();

    for (const msg of mensajes) {
      const etiqueta = this.obtenerEtiquetaFecha(msg.fecha_envio);
      if (!gruposMapa.has(etiqueta)) {
        gruposMapa.set(etiqueta, []);
      }
      gruposMapa.get(etiqueta)!.push(msg);
    }

    return Array.from(gruposMapa.entries()).map(([fechaEtiqueta, listaMensajes]) => ({
      fechaEtiqueta,
      mensajes: listaMensajes
    }));
  }

  /** Asigna la etiqueta del divisor (HOY, AYER, DD/MM/AAAA) según la fecha del mensaje */
  private obtenerEtiquetaFecha(fechaStr: string | null | undefined): string {
    if (!fechaStr) {
      return 'HOY';
    }

    const fechaMensaje = new Date(fechaStr);
    if (isNaN(fechaMensaje.getTime())) {
      return 'HOY';
    }

    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    const fMensaje = new Date(fechaMensaje.getFullYear(), fechaMensaje.getMonth(), fechaMensaje.getDate());
    const fHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const fAyer = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate());

    if (fMensaje.getTime() === fHoy.getTime()) {
      return 'HOY';
    } else if (fMensaje.getTime() === fAyer.getTime()) {
      return 'AYER';
    } else {
      return fechaMensaje.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  }

  /** Carga los datos del usuario en sesión desde localStorage */
  private cargarUsuarioActual(): boolean {
    const usuarioStr = localStorage.getItem('usuario');

    if (!usuarioStr) {
      this.miUsuario = null;
      return false;
    }

    try {
      this.miUsuario = JSON.parse(usuarioStr);
      return true;
    } catch {
      this.miUsuario = null;
      return false;
    }
  }

  /** Actualiza la referencia de la conversación activa si cambia la lista general */
  private actualizarChatActivo(): void {
    if (!this.chatActivo) {
      return;
    }

    const actualizado = this.conversaciones.find(
      (chat) => String(chat.id) === String(this.chatActivo?.id)
    );

    if (actualizado) {
      this.chatActivo = actualizado;
    }
  }

  /** Vuelve a descargar el historial cuando la conexión WebSocket se restablece */
  private recargarHistorialActivo(): void {
    if (!this.chatActivo) {
      return;
    }

    const idActivo = String(this.chatActivo.id);

    this.chatService.obtenerHistorial(idActivo).subscribe({
      next: (mensajes) => {
        if (!this.chatActivo || String(this.chatActivo.id) !== idActivo) {
          return;
        }

        const historial = (mensajes ?? []).map((mensaje) =>
          this.chatService.normalizarMensaje(mensaje)
        );

        this.mensajes = this.combinarMensajes(historial, this.mensajes);
        this.gruposMensajes = this.agruparMensajesPorFecha(this.mensajes);

        this.marcarActivaComoLeida();
        this.scrollAlFinal();
        this.cdr.detectChanges();
      },
      error: (error) => {
        if (error?.status !== 401) {
          console.warn(
            '[CHAT] No fue posible recuperar el historial después de reconectar:',
            error
          );
        }
      }
    });
  }

  /** Notifica al backend que la conversación activa ha sido leída */
  private marcarActivaComoLeida(): void {
    if (
      !this.chatActivo ||
      !this.isOpen ||
      this.isMinimized ||
      this.vistaActual !== 'conversacion'
    ) {
      return;
    }

    this.chatService.marcarConversacionLeidaLocal(this.chatActivo.id);

    this.chatService
      .marcarConversacionLeida(this.chatActivo.id)
      .subscribe({
        error: () => {}
      });
  }

  /** Fusiona mensajes sin duplicar registros al recibir notificaciones o cargar historial */
  private combinarMensajes(
    historial: ChatMensaje[],
    mensajesLocales: ChatMensaje[]
  ): ChatMensaje[] {
    const mapa = new Map<string, ChatMensaje>();
    const mensajesSinId: ChatMensaje[] = [];

    const agregar = (mensaje: ChatMensaje): void => {
      if (!mensaje.id) {
        mensajesSinId.push(mensaje);
        return;
      }

      const clave = String(mensaje.id);
      const existente = mapa.get(clave);

      if (!existente) {
        mapa.set(clave, mensaje);
        return;
      }

      mapa.set(clave, this.combinarMensajeDuplicado(existente, mensaje));
    };

    historial.forEach(agregar);
    mensajesLocales.forEach(agregar);

    return this.ordenarMensajes([...mapa.values(), ...mensajesSinId]);
  }

  /** Resuelve inconsistencias o faltantes entre dos objetos de un mismo mensaje */
  private combinarMensajeDuplicado(
    existente: ChatMensaje,
    entrante: ChatMensaje
  ): ChatMensaje {
    const idRemitente =
      entrante.remitente?.id_usuario ??
      existente.remitente?.id_usuario ??
      entrante.id_usuario_remitente ??
      existente.id_usuario_remitente ??
      null;

    const nombreRemitente =
      entrante.remitente?.nombre ?? existente.remitente?.nombre;

    const remitente: NonNullable<ChatMensaje['remitente']> = nombreRemitente
      ? { id_usuario: idRemitente, nombre: nombreRemitente }
      : { id_usuario: idRemitente };

    return {
      ...existente,
      ...entrante,
      id_usuario_remitente:
        entrante.id_usuario_remitente ??
        existente.id_usuario_remitente ??
        idRemitente,
      remitente
    };
  }

  /** Ordena cronológicamente una colección de mensajes */
  private ordenarMensajes(mensajes: ChatMensaje[]): ChatMensaje[] {
    return [...mensajes].sort((mensajeA, mensajeB) => {
      const tiempoA = this.obtenerTiempoMensaje(mensajeA.fecha_envio);
      const tiempoB = this.obtenerTiempoMensaje(mensajeB.fecha_envio);

      if (tiempoA !== tiempoB) {
        return tiempoA - tiempoB;
      }

      const idA = mensajeA.id ?? '';
      const idB = mensajeB.id ?? '';

      return idA.localeCompare(idB);
    });
  }

  /** Devuelve el timestamp numérico correspondiente a una cadena de fecha */
  private obtenerTiempoMensaje(fecha: string | null | undefined): number {
    if (!fecha) {
      return 0;
    }

    const tiempo = Date.parse(fecha);
    return Number.isFinite(tiempo) ? tiempo : 0;
  }

  /** Fuerza el desplazamiento del scroll hacia el mensaje más reciente al final */
  private scrollAlFinal(): void {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const elemento = document.getElementById('chat-scroll-area');

        if (!elemento) {
          return;
        }

        elemento.scrollTop = elemento.scrollHeight;
      });
    });
  }
}