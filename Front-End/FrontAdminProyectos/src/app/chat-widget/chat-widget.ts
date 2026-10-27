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
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  ChatConversacion,
  ChatMensaje,
  ChatService
} from '../Servicios/chats';
import { ApiServicio } from '../Servicios/api.servicio';
import { environment } from '../../environments/environment';


interface GrupoMensajes {
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
  private chatService = inject(ChatService);
  private apiService = inject(ApiServicio);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private router = inject(Router);
  private http = inject(HttpClient);
  private subscriptions = new Subscription();

  isOpen = false;
  isMinimized = false;

  vistaActual: 'lista' | 'conversacion' | 'nuevo' = 'lista';

  miUsuario: any = null;
  conversaciones: ChatConversacion[] = [];
  chatActivo: ChatConversacion | null = null;
  mensajes: ChatMensaje[] = [];
  gruposMensajes: GrupoMensajes[] = [];

  cargandoResumenIA: boolean = false;
  mostrarModalResumen: boolean = false;
  resumenChatIA: {
    resumen_general: string;
    puntos_clave: string[];
    acuerdos_o_tareas: string[];
  } | null = null;

  nuevoMensaje = '';
  correoDestino = '';

  totalNoLeidos = 0;
  conexionActiva = false;

  ngOnInit(): void {
    this.subscriptions.add(
      this.apiService.usuarioActual$.subscribe((usuario) => {
        this.miUsuario = usuario;
        if (usuario) {
          this.chatService.iniciar();
          this.cargarConversaciones();
        } else {
          this.cerrarChat();
        }
      })
    );

    this.cargarUsuarioActual();

    this.subscriptions.add(
      this.chatService.conversaciones$.subscribe((conversaciones) => {
        this.ngZone.run(() => {
          this.conversaciones = conversaciones;
          this.actualizarChatActivo();
          this.cdr.detectChanges();
        });
      })
    );

    this.subscriptions.add(
      this.chatService.totalNoLeidos$.subscribe((total) => {
        this.totalNoLeidos = total;
        this.cdr.detectChanges();
      })
    );

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

    this.subscriptions.add(
      this.chatService.abrirWidget$.subscribe(() => {
        this.ngZone.run(() => {
          this.abrirChat();
        });
      })
    );

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

    this.chatService.iniciar();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  abrirChat(): void {
    if (!this.cargarUsuarioActual()) {
      this.cerrarChat();
      return;
    }

    this.isOpen = true;
    this.isMinimized = false;

    this.cargarConversaciones();

    if (
      this.vistaActual === 'conversacion' &&
      this.chatActivo
    ) {
      this.marcarActivaComoLeida();
      this.scrollAlFinal();
    }
  }

  minimizarChat(): void {
    this.isMinimized = !this.isMinimized;

    if (!this.isMinimized) {
      this.marcarActivaComoLeida();
      this.scrollAlFinal();
    }
  }

  cerrarChat(): void {
    this.isOpen = false;
    this.isMinimized = false;
    this.vistaActual = 'lista';
    this.chatActivo = null;
    this.mensajes = [];
    this.gruposMensajes = [];
    this.cerrarResumenChat();
  }

  volverALista(): void {
    this.vistaActual = 'lista';
    this.chatActivo = null;
    this.mensajes = [];
    this.gruposMensajes = [];
    this.cerrarResumenChat();
  }

  irANuevoChat(): void {
    this.vistaActual = 'nuevo';
    this.correoDestino = '';
  }

  cargarConversaciones(): void {
    this.chatService.sincronizarConversaciones().subscribe({
      error: (error: any) => {
        if (error?.status !== 401) {
          console.error(
            '[CHAT] Error cargando conversaciones:',
            error
          );
        }
      }
    });
  }

  formatearFechaLista(
    fechaStr: string | null | undefined
  ): string {
    if (!fechaStr) {
      return '';
    }

    const fechaMensaje = new Date(fechaStr);

    if (!Number.isFinite(fechaMensaje.getTime())) {
      return '';
    }

    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    if (this.esMismoDia(fechaMensaje, hoy)) {
      return fechaMensaje.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    if (this.esMismoDia(fechaMensaje, ayer)) {
      return 'Ayer';
    }

    return fechaMensaje.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  abrirConversacion(chat: ChatConversacion): void {
    const idSolicitado = String(chat.id);

    this.chatActivo = chat;
    this.vistaActual = 'conversacion';
    this.mensajes = [];
    this.gruposMensajes = [];
    this.cerrarResumenChat();

    this.chatService.marcarConversacionLeidaLocal(chat.id);

    this.chatService.marcarConversacionLeida(chat.id).subscribe({
      error: (error: any) => {
        if (error?.status !== 401) {
          console.warn(
            '[CHAT] No se pudo marcar como leída:',
            error
          );
        }
      }
    });

    this.chatService.obtenerHistorial(chat.id).subscribe({
      next: (mensajes: any[]) => {
        if (
          !this.chatActivo ||
          String(this.chatActivo.id) !== idSolicitado
        ) {
          return;
        }

        const historial = (mensajes ?? []).map((mensaje: any) =>
          this.chatService.normalizarMensaje(mensaje)
        );

        this.mensajes = this.combinarMensajes(
          historial,
          this.mensajes
        );

        this.actualizarGruposMensajes();
        this.scrollAlFinal();
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        if (error?.status !== 401) {
          console.error(
            '[CHAT] Error cargando historial:',
            error
          );
        }
      }
    });
  }

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
        next: (mensaje: any) => {
          this.procesarMensajeEnVivo(mensaje);
        },
        error: (error: any) => {
          this.nuevoMensaje = contenido;

          if (error?.status !== 401) {
            console.error(
              '[CHAT] Error enviando mensaje:',
              error
            );
            alert('No fue posible enviar el mensaje');
          }
        }
      });
  }

  convertirMensajeATarea(mensaje: ChatMensaje): void {
    if (!mensaje?.contenido) {
      return;
    }

    this.isMinimized = true;

    const chat = this.chatActivo as any;
    const idProyecto =
      chat?.id_proyecto ??
      chat?.proyecto_id ??
      chat?.proyecto?.id_proyecto ??
      localStorage.getItem('ultimo_proyecto_id') ??
      localStorage.getItem('id_proyecto') ??
      1;

    this.router.navigate(['/proyecto', idProyecto, 'crearactividades'], {
      queryParams: {
        tareaTexto: mensaje.contenido
      }
    });
  }

  // =========================================================
  // MÉTODOS PARA EL RESUMEN INTELIGENTE CON IA
  // =========================================================
  generarResumenChat(): void {
    const todosLosMensajes = (this.gruposMensajes || []).flatMap(
      (g: GrupoMensajes) => g.mensajes || []
    );

    if (todosLosMensajes.length === 0) {
      return;
    }

    this.cargandoResumenIA = true;
    this.mostrarModalResumen = true;
    this.resumenChatIA = null;

    const payload = {
      mensajes: todosLosMensajes.map((m: ChatMensaje) => ({
        autor: m.remitente?.nombre || (this.esMiMensaje(m) ? 'Yo' : 'Usuario'),
        contenido: m.contenido || '',
        fecha: m.fecha_envio || ''
      }))
    };

    this.http.post<any>(`${environment.apiUrl}/ai/resumir-chat`, payload).subscribe({
      next: (res: any) => {
        this.resumenChatIA = res;
        this.cargandoResumenIA = false;
      },
      error: (err: any) => {
        console.error('Error al resumir chat con IA:', err);
        this.resumenChatIA = {
          resumen_general: 'No se pudo generar el resumen en este momento.',
          puntos_clave: [],
          acuerdos_o_tareas: []
        };
        this.cargandoResumenIA = false;
      }
    });
  }

  cerrarResumenChat(): void {
    this.mostrarModalResumen = false;
  }

  procesarMensajeEnVivo(mensajeOriginal: any): void {
    const mensaje = this.chatService.normalizarMensaje(
      mensajeOriginal
    );

    if (!mensaje.id_conversacion) {
      console.error(
        '[CHAT] Mensaje sin ID de conversación:',
        mensajeOriginal
      );
      return;
    }

    const perteneceAlChatActivo =
      this.chatActivo !== null &&
      String(this.chatActivo.id) ===
        String(mensaje.id_conversacion);

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
      this.mensajes = [
        ...this.mensajes,
        mensaje
      ];
    } else {
      const mensajesActualizados = [...this.mensajes];
      const mensajeExistente =
        mensajesActualizados[indiceExistente];

      if (!mensajeExistente) {
        this.mensajes = [
          ...this.mensajes,
          mensaje
        ];
      } else {
        mensajesActualizados[indiceExistente] =
          this.combinarMensajeDuplicado(
            mensajeExistente,
            mensaje
          );

        this.mensajes = mensajesActualizados;
      }
    }

    this.actualizarGruposMensajes();
    this.scrollAlFinal();

    if (
      this.conversacionEsVisible(
        mensaje.id_conversacion
      )
    ) {
      this.marcarActivaComoLeida();
    }

    this.cdr.detectChanges();
  }

  iniciarChatPorCorreo(): void {
    const correo = this.correoDestino.trim();

    if (!correo) {
      return;
    }

    this.chatService.iniciarChatPorCorreo(correo).subscribe({
      next: (respuesta: any) => {
        this.chatService
          .sincronizarConversaciones()
          .subscribe({
            next: (conversaciones: ChatConversacion[]) => {
              const conversacion = conversaciones.find(
                (chat) =>
                  String(chat.id) ===
                  String(respuesta.id_conversacion)
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
      error: (error: any) => {
        if (error?.status !== 401) {
          alert(
            error?.error?.detail ||
            'No se pudo iniciar el chat'
          );
        }
      }
    });
  }

  esMiMensaje(mensaje: ChatMensaje): boolean {
    if (!this.miUsuario || !mensaje) {
      return false;
    }

    const miId =
      this.miUsuario.id_usuario ??
      this.miUsuario.id;

    const remitenteId =
      mensaje.remitente?.id_usuario ??
      mensaje.id_usuario_remitente;

    return (
      miId != null &&
      remitenteId != null &&
      String(miId) === String(remitenteId)
    );
  }

  trackMensaje(
    index: number,
    mensaje: ChatMensaje
  ): string {
    return (
      mensaje.id ??
      `${mensaje.fecha_envio}-${index}`
    );
  }

  cantidadNoLeidos(chat: ChatConversacion): string {
    const cantidad = Number(chat.noLeidos ?? 0);

    return cantidad > 99
      ? '99+'
      : String(cantidad);
  }


  private actualizarGruposMensajes(): void {
    this.gruposMensajes =
      this.agruparMensajesPorFecha(
        this.mensajes
      );
  }

  private agruparMensajesPorFecha(
    mensajes: ChatMensaje[]
  ): GrupoMensajes[] {
    const grupos =
      new Map<string, ChatMensaje[]>();

    for (const mensaje of mensajes) {
      const etiqueta =
        this.obtenerEtiquetaFecha(
          mensaje.fecha_envio
        );

      const mensajesGrupo =
        grupos.get(etiqueta) ?? [];

      mensajesGrupo.push(mensaje);
      grupos.set(
        etiqueta,
        mensajesGrupo
      );
    }

    return Array.from(
      grupos.entries()
    ).map(
      ([fechaEtiqueta, mensajesGrupo]) => ({
        fechaEtiqueta,
        mensajes: mensajesGrupo
      })
    );
  }

  private obtenerEtiquetaFecha(
    fechaStr: string | null | undefined
  ): string {
    if (!fechaStr) {
      return 'HOY';
    }

    const fechaMensaje = new Date(fechaStr);

    if (
      !Number.isFinite(
        fechaMensaje.getTime()
      )
    ) {
      return 'HOY';
    }

    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(
      hoy.getDate() - 1
    );

    if (
      this.esMismoDia(
        fechaMensaje,
        hoy
      )
    ) {
      return 'HOY';
    }

    if (
      this.esMismoDia(
        fechaMensaje,
        ayer
      )
    ) {
      return 'AYER';
    }

    return fechaMensaje
      .toLocaleDateString(
        'es-MX',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }
      );
  }

  private esMismoDia(
    fechaA: Date,
    fechaB: Date
  ): boolean {
    return (
      fechaA.getFullYear() ===
        fechaB.getFullYear() &&
      fechaA.getMonth() ===
        fechaB.getMonth() &&
      fechaA.getDate() ===
        fechaB.getDate()
    );
  }

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

  private actualizarChatActivo(): void {
    if (!this.chatActivo) {
      return;
    }

    const actualizado = this.conversaciones.find(
      (chat) =>
        String(chat.id) ===
        String(this.chatActivo?.id)
    );

    if (actualizado) {
      this.chatActivo = actualizado;
    }
  }

  private recargarHistorialActivo(): void {
    if (!this.chatActivo) {
      return;
    }

    const idActivo = String(this.chatActivo.id);

    this.chatService.obtenerHistorial(idActivo).subscribe({
      next: (mensajes: any[]) => {
        if (
          !this.chatActivo ||
          String(this.chatActivo.id) !== idActivo
        ) {
          return;
        }

        const historial = (mensajes ?? []).map((mensaje: any) =>
          this.chatService.normalizarMensaje(mensaje)
        );

        this.mensajes = this.combinarMensajes(
          historial,
          this.mensajes
        );

        this.actualizarGruposMensajes();

        if (this.conversacionEsVisible(idActivo)) {
          this.marcarActivaComoLeida();
        }

        this.scrollAlFinal();
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        if (error?.status !== 401) {
          console.warn(
            '[CHAT] No fue posible recuperar el historial después de reconectar:',
            error
          );
        }
      }
    });
  }

  private marcarActivaComoLeida(): void {
    if (
      !this.chatActivo ||
      !this.conversacionEsVisible(this.chatActivo.id)
    ) {
      return;
    }

    this.chatService.marcarConversacionLeidaLocal(
      this.chatActivo.id
    );

    this.chatService
      .marcarConversacionLeida(this.chatActivo.id)
      .subscribe({
        error: () => {}
      });
  }

  private conversacionEsVisible(
    idConversacion: string
  ): boolean {
    return Boolean(
      this.isOpen &&
      !this.isMinimized &&
      this.vistaActual === 'conversacion' &&
      this.chatActivo &&
      String(this.chatActivo.id) ===
        String(idConversacion) &&
      document.visibilityState === 'visible'
    );
  }

  private combinarMensajes(
    historial: ChatMensaje[],
    mensajesLocales: ChatMensaje[]
  ): ChatMensaje[] {
    const mapa = new Map<string, ChatMensaje>();
    const mensajesSinId: ChatMensaje[] = [];

    const agregar = (
      mensaje: ChatMensaje
    ): void => {
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

      mapa.set(
        clave,
        this.combinarMensajeDuplicado(
          existente,
          mensaje
        )
      );
    };

    historial.forEach(agregar);
    mensajesLocales.forEach(agregar);

    return this.ordenarMensajes([
      ...mapa.values(),
      ...mensajesSinId
    ]);
  }

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
      entrante.remitente?.nombre ??
      existente.remitente?.nombre;

    const remitente: NonNullable<
      ChatMensaje['remitente']
    > = nombreRemitente
      ? {
          id_usuario: idRemitente,
          nombre: nombreRemitente
        }
      : {
          id_usuario: idRemitente
        };

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

  private ordenarMensajes(
    mensajes: ChatMensaje[]
  ): ChatMensaje[] {
    return [...mensajes].sort(
      (mensajeA, mensajeB) => {
        const tiempoA = this.obtenerTiempoMensaje(
          mensajeA.fecha_envio
        );

        const tiempoB = this.obtenerTiempoMensaje(
          mensajeB.fecha_envio
        );

        if (tiempoA !== tiempoB) {
          return tiempoA - tiempoB;
        }

        const idA = mensajeA.id ?? '';
        const idB = mensajeB.id ?? '';

        return idA.localeCompare(idB);
      }
    );
  }

  private obtenerTiempoMensaje(
    fecha: string | null | undefined
  ): number {
    if (!fecha) {
      return 0;
    }

    const tiempo = Date.parse(fecha);

    return Number.isFinite(tiempo)
      ? tiempo
      : 0;
  }

  private scrollAlFinal(): void {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const elemento = document.getElementById(
          'chat-scroll-area'
        );

        if (!elemento) {
          return;
        }

        elemento.scrollTop = elemento.scrollHeight;
      });
    });
  }
}