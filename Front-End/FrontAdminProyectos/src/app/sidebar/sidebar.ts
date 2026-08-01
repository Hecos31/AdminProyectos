import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import {
  Router,
  RouterModule
} from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  Subscription,
  interval,
  startWith,
  switchMap
} from 'rxjs';

import { ChatService } from '../Servicios/chats';
import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponente
  implements OnInit, OnDestroy {

  private router = inject(Router);
  private eRef = inject(ElementRef);
  private chatService =
    inject(ChatService);
  private apiService =
    inject(ApiServicio);
  private cdr =
    inject(ChangeDetectorRef);

  private subscriptions =
    new Subscription();

  private suscripcionNotificaciones:
    Subscription | null = null;

  usuario: any = null;

  mostrarMenuUsuario = false;
  mostrarNotificaciones = false;
  viendoHistorial = false;

  notificaciones: any[] = [];
  historialNotificaciones: any[] = [];

  contadorNotificaciones = 0;
  contadorMensajesNoLeidos = 0;

  colapsado =
    localStorage.getItem(
      'orbita_sidebar_colapsado'
    ) === 'true';

  @HostBinding(
    'class.sidebar-collapsed'
  )
  get hostColapsado(): boolean {
    return this.colapsado;
  }

  get inicialUsuario(): string {
    return this.usuario?.nombre
      ? String(
          this.usuario.nombre
        )
          .charAt(0)
          .toUpperCase()
      : 'U';
  }

  get nombreUsuario(): string {
    return (
      this.usuario?.nombre ||
      'Usuario'
    );
  }

  get apellidoUsuario(): string {
    return (
      this.usuario?.apellido ||
      ''
    );
  }

  ngOnInit(): void {
    this.aplicarAnchoGlobal();

    this.subscriptions.add(
      this.chatService
        .totalNoLeidos$
        .subscribe((total) => {
          this.contadorMensajesNoLeidos =
            total;

          this.cdr.detectChanges();
        })
    );

    this.subscriptions.add(
      this.apiService
        .usuarioActual$
        .subscribe((usuario) => {
          this.usuario = usuario;

          this.detenerPollingNotificaciones();

          if (this.usuario) {
            this.chatService.iniciar();
            this.iniciarPollingNotificaciones();
          } else {
            this.chatService.detener();

            this.notificaciones = [];
            this.historialNotificaciones = [];
            this.contadorNotificaciones = 0;
            this.contadorMensajesNoLeidos = 0;
          }

          this.cdr.detectChanges();
        })
    );

    this.subscriptions.add(
      this.apiService
        .notificacionesActualizadas$
        .subscribe(() => {
          if (this.usuario) {
            this.forzarCargaInmediata();
          }
        })
    );


    this.subscriptions.add(
  this.chatService.sesionExpirada$.subscribe(() => {
    this.cerrarSesion();
  })
);
  }

  ngOnDestroy(): void {
    this.detenerPollingNotificaciones();
    this.subscriptions.unsubscribe();
  }

  irAInicio(): void {
    this.router.navigate(['/inicio']);
  }

  toggleSidebar(
    evento?: Event
  ): void {
    evento?.stopPropagation();

    this.colapsado =
      !this.colapsado;

    localStorage.setItem(
      'orbita_sidebar_colapsado',
      String(this.colapsado)
    );

    this.mostrarMenuUsuario = false;
    this.mostrarNotificaciones = false;

    this.aplicarAnchoGlobal();

    window.dispatchEvent(
      new CustomEvent(
        'orbita-sidebar-toggle',
        {
          detail: {
            colapsado:
              this.colapsado,

            ancho:
              this.colapsado
                ? 76
                : 260
          }
        }
      )
    );
  }

  abrirChat(): void {
    this.chatService
      .solicitarAperturaWidget();
  }

  toggleNotificaciones(): void {
    this.mostrarNotificaciones =
      !this.mostrarNotificaciones;

    if (this.mostrarNotificaciones) {
      this.mostrarMenuUsuario = false;
      this.forzarCargaInmediata();
    }
  }

  cambiarVistaHistorial(
    verHistorial: boolean
  ): void {
    this.viendoHistorial =
      verHistorial;

    if (this.viendoHistorial) {
      this.forzarCargaInmediata();
    }
  }

  leerNotificacion(
    notificacion: any,
    index: number
  ): void {
    this.apiService
      .marcarNotificacionLeida(
        notificacion.id_notificacion
      )
      .subscribe({
        next: () => {
          this.notificaciones =
            this.notificaciones.filter(
              (_, posicion) =>
                posicion !== index
            );

          this.contadorNotificaciones =
            this.notificaciones.length;

          const encontrada =
            this.historialNotificaciones.find(
              (item) =>
                item.id_notificacion ===
                notificacion.id_notificacion
            );

          if (encontrada) {
            encontrada.leida = true;
          }

          this.cdr.detectChanges();
        },

        error: (error) => {
          console.error(
            'Error al marcar la notificación como leída:',
            error
          );
        }
      });
  }

  toggleMenuUsuario(): void {
    this.mostrarMenuUsuario =
      !this.mostrarMenuUsuario;

    if (this.mostrarMenuUsuario) {
      this.mostrarNotificaciones = false;
    }
  }

  cerrarSesion(): void {
    this.chatService.detener();

    localStorage.clear();
    sessionStorage.clear();

    this.mostrarMenuUsuario = false;
    this.mostrarNotificaciones = false;
    this.viendoHistorial = false;

    this.apiService
      .actualizarSesionUsuario(null);

    this.router.navigate(['/login']);
  }

  cantidadBadge(
    cantidad: number
  ): string {
    return cantidad > 99
      ? '99+'
      : String(cantidad);
  }

  @HostListener(
    'document:click',
    ['$event']
  )
  clickout(event: Event): void {
    if (
      !this.eRef.nativeElement
        .contains(event.target)
    ) {
      this.mostrarMenuUsuario = false;
      this.mostrarNotificaciones = false;
    }
  }

  private iniciarPollingNotificaciones(): void {
    this.suscripcionNotificaciones =
      interval(15000)
        .pipe(
          startWith(0),
          switchMap(() =>
            this.apiService
              .obtenerNotificaciones()
          )
        )
        .subscribe({
          next: (data) => {
            this.aplicarNotificaciones(
              data
            );
          },

          error: (error) => {
            console.error(
              'Error al sincronizar notificaciones:',
              error
            );
          }
        });
  }

  private detenerPollingNotificaciones(): void {
    this.suscripcionNotificaciones
      ?.unsubscribe();

    this.suscripcionNotificaciones = null;
  }

  private forzarCargaInmediata(): void {
    this.apiService
      .obtenerNotificaciones()
      .subscribe({
        next: (data) => {
          this.aplicarNotificaciones(
            data
          );
        },

        error: (error) => {
          console.error(
            'Error al cargar notificaciones:',
            error
          );
        }
      });
  }

  private aplicarNotificaciones(
    data: any
  ): void {
    const todas =
      Array.isArray(data)
        ? data
        : [];

    this.notificaciones =
      todas.filter(
        (notificacion) =>
          notificacion.leida === false
      );

    this.contadorNotificaciones =
      this.notificaciones.length;

    if (this.viendoHistorial) {
      this.historialNotificaciones =
        todas;
    }

    this.cdr.detectChanges();
  }

  private aplicarAnchoGlobal(): void {
    document.documentElement
      .style
      .setProperty(
        '--app-sidebar-width',
        this.colapsado
          ? '76px'
          : '260px'
      );
  }
}