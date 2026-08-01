import { Injectable, NgZone, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  of,
  switchMap,
  tap,
  throwError,
  timer
} from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatUltimoMensaje {
  contenido?: string | null;
  fecha?: string | null;
  fecha_envio?: string | null;
}

export interface ChatConversacion {
  id: string;
  nombre?: string | null;
  enLinea?: boolean;
  tipo?: string | null;
  participantes?: number;
  noLeidos: number;
  ultimoMensaje?: ChatUltimoMensaje | null;
}

export interface ChatMensaje {
  id: string | null;
  id_conversacion: string;
  id_usuario_remitente: number | string | null;
  contenido: string;
  fecha_envio: string;
  remitente?: {
    id_usuario: number | string | null;
    nombre?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private ngZone = inject(NgZone);

  private readonly apiUrl = environment.apiUrl.replace(/\/+$/, '');
  private readonly wsUrl = this.construirWsUrl();

  private socket: WebSocket | null = null;
  private reconexionTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private pollingSubscription: Subscription | null = null;

  private iniciado = false;
  private cierreManual = false;
  private intentoReconexion = 0;
  private tokenSesion: string | null = null;

  private readonly idsMensajesRecientes = new Set<string>();
  private readonly ordenIdsMensajes: string[] = [];

  private readonly mensajesNuevosSubject = new Subject<ChatMensaje>();
  readonly mensajesNuevos$ = this.mensajesNuevosSubject.asObservable();

  private readonly abrirWidgetSubject = new Subject<void>();
  readonly abrirWidget$ = this.abrirWidgetSubject.asObservable();

  private readonly conversacionesSubject =
    new BehaviorSubject<ChatConversacion[]>([]);
  readonly conversaciones$ = this.conversacionesSubject.asObservable();

  private readonly totalNoLeidosSubject = new BehaviorSubject<number>(0);
  readonly totalNoLeidos$ = this.totalNoLeidosSubject.asObservable();

  private readonly conexionSubject = new BehaviorSubject<boolean>(false);
  readonly conexion$ = this.conexionSubject.asObservable();

  private readonly sesionExpiradaSubject = new Subject<void>();
  readonly sesionExpirada$ = this.sesionExpiradaSubject.asObservable();

  private readonly manejarOnline = () => {
    if (!this.iniciado) {
      return;
    }

    this.conectarWebSocket();
    this.sincronizarConversaciones().subscribe({
      error: () => {
        // El polling volverá a intentarlo.
      }
    });
  };

  private readonly manejarOffline = () => {
    this.ngZone.run(() => {
      this.conexionSubject.next(false);
    });
  };

  iniciar(): void {
    const token = this.obtenerTokenNoExpirado();

    if (!token) {
      this.manejarSesionExpirada();
      return;
    }

    /*
     * ChatService es singleton. Al cambiar de usuario se debe cerrar
     * el socket anterior y comenzar con el token nuevo.
     */
    if (this.iniciado && this.tokenSesion !== token) {
      this.detener();
    }

    if (this.iniciado) {
      this.conectarWebSocket();
      return;
    }

    this.tokenSesion = token;
    this.iniciado = true;
    this.cierreManual = false;

    window.addEventListener('online', this.manejarOnline);
    window.addEventListener('offline', this.manejarOffline);

    this.conectarWebSocket();
    this.iniciarPolling();
  }

  detener(): void {
    this.iniciado = false;
    this.cierreManual = true;
    this.intentoReconexion = 0;
    this.tokenSesion = null;

    window.removeEventListener('online', this.manejarOnline);
    window.removeEventListener('offline', this.manejarOffline);

    this.limpiarReconexion();
    this.detenerHeartbeat();

    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = null;

    if (this.socket) {
      const socketActual = this.socket;
      this.socket = null;

      if (
        socketActual.readyState === WebSocket.OPEN ||
        socketActual.readyState === WebSocket.CONNECTING
      ) {
        socketActual.close(1000, 'Sesión cerrada');
      }
    }

    this.conexionSubject.next(false);
    this.establecerConversaciones([]);
    this.idsMensajesRecientes.clear();
    this.ordenIdsMensajes.length = 0;
  }

  conectarWebSocket(): void {
    if (!this.iniciado) {
      this.iniciar();
      return;
    }

    if (
      this.socket &&
      (
        this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING
      )
    ) {
      return;
    }

    const token = this.obtenerTokenNoExpirado();

    if (!token) {
      this.manejarSesionExpirada();
      return;
    }

    if (!navigator.onLine) {
      return;
    }

    this.cierreManual = false;

    const socket = new WebSocket(
      `${this.wsUrl}/ws?token=${encodeURIComponent(token)}`
    );

    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) {
        return;
      }

      this.intentoReconexion = 0;
      this.limpiarReconexion();
      this.iniciarHeartbeat();

      this.ngZone.run(() => {
        this.conexionSubject.next(true);
      });

    };

    socket.onmessage = (event: MessageEvent<string>) => {
      let mensajeOriginal: any;

      try {
        mensajeOriginal = JSON.parse(event.data);
      } catch {
        return;
      }

      if (
        mensajeOriginal?.tipo === 'pong' ||
        mensajeOriginal?.tipo === 'heartbeat'
      ) {
        return;
      }

      const mensaje = this.normalizarMensaje(mensajeOriginal);

      if (!mensaje.id_conversacion) {
        return;
      }

      if (!this.registrarIdMensaje(mensaje.id)) {
        return;
      }

      this.ngZone.run(() => {
        this.actualizarResumenDesdeMensaje(mensaje);
        this.mensajesNuevosSubject.next(mensaje);
      });
    };

    socket.onerror = () => {
      /*
       * El evento close se encarga de programar la reconexión.
       * Cerrar aquí evita sockets en un estado inconsistente.
       */
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    };

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
      }

      this.detenerHeartbeat();

      this.ngZone.run(() => {
        this.conexionSubject.next(false);
      });

      if (!this.cierreManual && this.iniciado) {
        this.programarReconexion();
      }
    };
  }

  obtenerConversaciones(): Observable<ChatConversacion[]> {
    return this.sincronizarConversaciones();
  }

  sincronizarConversaciones(): Observable<ChatConversacion[]> {
    if (!this.obtenerTokenNoExpirado()) {
      this.manejarSesionExpirada();
      return of([]);
    }

    return this.http
      .get<ChatConversacion[]>(
        `${this.apiUrl}/mensajes/conversaciones`,
        {
          headers: this.getHeaders()
        }
      )
      .pipe(
        tap((data) => {
          this.establecerConversaciones(
            Array.isArray(data) ? data : []
          );
        }),
        catchError((error: HttpErrorResponse) =>
          this.manejarErrorHttp<ChatConversacion[]>(error)
        )
      );
  }

  obtenerHistorial(
    idConversacion: string
  ): Observable<ChatMensaje[]> {
    return this.http
      .get<ChatMensaje[]>(
        `${this.apiUrl}/mensajes/historial/conversaciones/${idConversacion}`,
        {
          headers: this.getHeaders()
        }
      )
      .pipe(
        catchError((error: HttpErrorResponse) =>
          this.manejarErrorHttp<ChatMensaje[]>(error)
        )
      );
  }

  enviarMensajeHTTP(
    idConversacion: string,
    contenido: string
  ): Observable<ChatMensaje> {
    return this.http
      .post<ChatMensaje>(
        `${this.apiUrl}/mensajes/conversacion`,
        {
          id_conversacion: idConversacion,
          contenido
        },
        {
          headers: this.getHeaders()
        }
      )
      .pipe(
        tap((mensajeOriginal) => {
          const mensaje = this.normalizarMensaje(
            mensajeOriginal
          );

          this.registrarIdMensaje(mensaje.id);
          this.actualizarResumenDesdeMensaje(mensaje);
        }),
        catchError((error: HttpErrorResponse) =>
          this.manejarErrorHttp<ChatMensaje>(error)
        )
      );
  }

  iniciarChatPorCorreo(
    correo: string
  ): Observable<{ id_conversacion: string }> {
    return this.http
      .post<{ id_conversacion: string }>(
        `${this.apiUrl}/mensajes/iniciar-correo`,
        {
          correo_destino: correo
        },
        {
          headers: this.getHeaders()
        }
      )
      .pipe(
        catchError((error: HttpErrorResponse) =>
          this.manejarErrorHttp<{ id_conversacion: string }>(error)
        )
      );
  }

  marcarConversacionLeida(
    idConversacion: string
  ): Observable<{ status: string; noLeidos: number }> {
    return this.http
      .patch<{ status: string; noLeidos: number }>(
        `${this.apiUrl}/mensajes/conversaciones/${idConversacion}/leer`,
        {},
        {
          headers: this.getHeaders()
        }
      )
      .pipe(
        tap(() => {
          this.marcarConversacionLeidaLocal(
            idConversacion
          );
        }),
        catchError((error: HttpErrorResponse) =>
          this.manejarErrorHttp<{ status: string; noLeidos: number }>(error)
        )
      );
  }

  marcarConversacionLeidaLocal(
    idConversacion: string
  ): void {
    const conversaciones =
      this.conversacionesSubject.value;

    const actualizadas = conversaciones.map(
      (chat) =>
        String(chat.id) === String(idConversacion)
          ? {
              ...chat,
              noLeidos: 0
            }
          : chat
    );

    this.establecerConversaciones(actualizadas);
  }

  solicitarAperturaWidget(): void {
    this.abrirWidgetSubject.next();
  }

  normalizarMensaje(
    msg: any
  ): ChatMensaje {
    const idConversacion =
      msg?.id_conversacion ??
      msg?.conversacion_id ??
      msg?.idConversacion ??
      msg?.conversacion?.id ??
      '';

    const idRemitente =
      msg?.id_usuario_remitente ??
      msg?.id_remitente ??
      msg?.remitente_id ??
      msg?.remitente?.id_usuario ??
      msg?.remitente?.id ??
      null;

    return {
      id:
        msg?.id != null
          ? String(msg.id)
          : msg?.id_mensaje != null
            ? String(msg.id_mensaje)
            : null,

      id_conversacion: String(idConversacion),

      id_usuario_remitente: idRemitente,

      contenido:
        String(
          msg?.contenido ??
          msg?.mensaje ??
          ''
        ),

      fecha_envio:
        this.normalizarFechaUtc(
          msg?.fecha_envio ??
          msg?.fecha
        ),

      remitente: {
        id_usuario: idRemitente,
        nombre:
          msg?.remitente?.nombre ??
          msg?.nombre_remitente
      }
    };
  }

  private iniciarPolling(): void {
    this.pollingSubscription?.unsubscribe();

    this.pollingSubscription = timer(0, 15000)
      .pipe(
        switchMap(() =>
          this.sincronizarConversaciones().pipe(
            catchError((error: HttpErrorResponse) => {
              if (error.status !== 401) {
                console.warn(
                  '[CHAT] No fue posible sincronizar conversaciones:',
                  error
                );
              }

              return EMPTY;
            })
          )
        )
      )
      .subscribe();
  }

  private programarReconexion(): void {
    if (
      this.reconexionTimer !== null ||
      !navigator.onLine ||
      !this.obtenerTokenNoExpirado()
    ) {
      return;
    }

    const base = Math.min(
      1000 * Math.pow(2, this.intentoReconexion),
      30000
    );

    const variacion = Math.floor(
      Math.random() * 800
    );

    const espera = base + variacion;

    this.intentoReconexion = Math.min(
      this.intentoReconexion + 1,
      6
    );

    this.reconexionTimer = window.setTimeout(
      () => {
        this.reconexionTimer = null;
        this.conectarWebSocket();
      },
      espera
    );
  }

  private limpiarReconexion(): void {
    if (this.reconexionTimer !== null) {
      window.clearTimeout(this.reconexionTimer);
      this.reconexionTimer = null;
    }
  }

  private iniciarHeartbeat(): void {
    this.detenerHeartbeat();

    this.heartbeatTimer = window.setInterval(
      () => {
        if (
          this.socket?.readyState === WebSocket.OPEN
        ) {
          this.socket.send('ping');
        }
      },
      25000
    );
  }

  private detenerHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private actualizarResumenDesdeMensaje(
    mensaje: ChatMensaje
  ): void {
    if (!mensaje.id_conversacion) {
      return;
    }

    const conversaciones =
      this.conversacionesSubject.value;

    const indice = conversaciones.findIndex(
      (chat) =>
        String(chat.id) ===
        String(mensaje.id_conversacion)
    );

    if (indice === -1) {
      this.sincronizarConversaciones().subscribe({
        error: () => {
          // El siguiente polling volverá a intentarlo.
        }
      });

      return;
    }

    const chat = conversaciones[indice];

    const incremento =
      this.esMensajeMio(mensaje)
        ? 0
        : 1;

    const actualizado: ChatConversacion = {
      ...chat,

      noLeidos:
        Math.max(
          0,
          Number(chat.noLeidos ?? 0) +
          incremento
        ),

      ultimoMensaje: {
        contenido: mensaje.contenido,
        fecha: mensaje.fecha_envio,
        fecha_envio: mensaje.fecha_envio
      }
    };

    this.establecerConversaciones([
      actualizado,
      ...conversaciones.filter(
        (_, posicion) =>
          posicion !== indice
      )
    ]);
  }

  private establecerConversaciones(
    conversaciones: ChatConversacion[]
  ): void {
    const normalizadas = conversaciones
      .map((chat) => ({
        ...chat,

        id: String(chat.id),

        noLeidos:
          Math.max(
            0,
            Number(chat.noLeidos ?? 0)
          ),

        ultimoMensaje: {
          contenido:
            chat.ultimoMensaje?.contenido ??
            'Sin mensajes',

          fecha: this.normalizarFechaUtc(
            chat.ultimoMensaje?.fecha ??
            chat.ultimoMensaje?.fecha_envio ??
            new Date(0).toISOString()
          ),

          fecha_envio: this.normalizarFechaUtc(
            chat.ultimoMensaje?.fecha_envio ??
            chat.ultimoMensaje?.fecha ??
            new Date(0).toISOString()
          )
        }
      }))
      .sort(
        (a, b) =>
          new Date(
            b.ultimoMensaje.fecha
          ).getTime() -
          new Date(
            a.ultimoMensaje.fecha
          ).getTime()
      );

    this.conversacionesSubject.next(
      normalizadas
    );

    const total = normalizadas.reduce(
      (suma, chat) =>
        suma + chat.noLeidos,
      0
    );

    this.totalNoLeidosSubject.next(total);
  }

  private registrarIdMensaje(
    id: string | null
  ): boolean {
    if (!id) {
      return true;
    }

    if (this.idsMensajesRecientes.has(id)) {
      return false;
    }

    this.idsMensajesRecientes.add(id);
    this.ordenIdsMensajes.push(id);

    if (this.ordenIdsMensajes.length > 500) {
      const idAntiguo =
        this.ordenIdsMensajes.shift();

      if (idAntiguo) {
        this.idsMensajesRecientes.delete(
          idAntiguo
        );
      }
    }

    return true;
  }

  private esMensajeMio(
    mensaje: ChatMensaje
  ): boolean {
    const usuarioStr =
      localStorage.getItem('usuario');

    if (!usuarioStr) {
      return false;
    }

    try {
      const usuario =
        JSON.parse(usuarioStr);

      const miId =
        usuario?.id_usuario ??
        usuario?.id;

      return (
        miId != null &&
        mensaje.id_usuario_remitente != null &&
        String(miId) ===
          String(
            mensaje.id_usuario_remitente
          )
      );
    } catch {
      return false;
    }
  }

  private normalizarFechaUtc(
    valor: unknown
  ): string {
    if (!valor) {
      return new Date().toISOString();
    }

    const texto = String(valor).trim();

    /*
     * PyMongo suele devolver datetime UTC sin tzinfo.
     * "2026-08-01T08:17:00" debe interpretarse como UTC,
     * no como hora local del navegador.
     */
    const tieneZonaHoraria =
      /(?:Z|[+-]\d{2}:\d{2})$/i.test(texto);

    const textoUtc =
      tieneZonaHoraria
        ? texto
        : `${texto}Z`;

    const tiempo = Date.parse(textoUtc);

    return Number.isFinite(tiempo)
      ? new Date(tiempo).toISOString()
      : new Date().toISOString();
  }

  private obtenerTokenNoExpirado(): string | null {
    const token = localStorage.getItem('token');

    if (!token) {
      return null;
    }

    try {
      const partes = token.split('.');

      if (partes.length !== 3) {
        return token;
      }

      const base64 = partes[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const relleno =
        '='.repeat((4 - (base64.length % 4)) % 4);

      const payload = JSON.parse(
        window.atob(base64 + relleno)
      );

      const expiracion = Number(payload?.exp);

      if (
        Number.isFinite(expiracion) &&
        expiracion * 1000 <= Date.now() + 5000
      ) {
        return null;
      }

      return token;
    } catch {
      /*
       * La validez criptográfica la decide el backend.
       * Si no se puede leer el payload, se envía normalmente.
       */
      return token;
    }
  }

  private manejarErrorHttp<T>(
    error: HttpErrorResponse
  ): Observable<T> {
    if (error.status === 401) {
      this.manejarSesionExpirada();
    }

    return throwError(() => error);
  }

  private manejarSesionExpirada(): void {
    if (!this.iniciado && !localStorage.getItem('token')) {
      return;
    }

    this.detener();

    this.ngZone.run(() => {
      this.sesionExpiradaSubject.next();
    });
  }

  private construirWsUrl(): string {
    const api =
      new URL(
        this.apiUrl,
        window.location.origin
      );

    const protocolo =
      api.protocol === 'https:'
        ? 'wss:'
        : 'ws:';

    return `${protocolo}//${api.host}${api.pathname.replace(/\/+$/, '')}`;
  }

  private getHeaders(): HttpHeaders {
    const token =
      this.obtenerTokenNoExpirado();

    return token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`
        })
      : new HttpHeaders();
  }
}