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
  NavigationEnd,
  Router,
  RouterModule
} from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  Subscription,
  filter,
  interval,
  startWith,
  switchMap
} from 'rxjs';

import { ChatService } from '../Servicios/chats';
import { ApiServicio } from '../Servicios/api.servicio';
import { ThemeService } from '../Servicios/theme.service';

interface ProyectoSidebar {
  id: number;
  nombre: string;
  descripcion?: string;
}

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
export class SidebarComponente implements OnInit, OnDestroy {
  private router = inject(Router);
  private eRef = inject(ElementRef);
  private chatService = inject(ChatService);
  private apiService = inject(ApiServicio);
  private themeService = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);

  private subscriptions = new Subscription();
  private suscripcionNotificaciones: Subscription | null = null;
  private suscripcionProyectos: Subscription | null = null;

  usuario: any = null;

  mostrarMenuUsuario = false;
  mostrarNotificaciones = false;
  viendoHistorial = false;

  notificaciones: any[] = [];
  historialNotificaciones: any[] = [];

  proyectos: ProyectoSidebar[] = [];
  cargandoProyectos = false;
  errorProyectos = '';

  contadorNotificaciones = 0;
  contadorMensajesNoLeidos = 0;

  isDarkMode = false;

  colapsado = localStorage.getItem('orbita_sidebar_colapsado') === 'true';

  @HostBinding('class.sidebar-collapsed')
  get hostColapsado(): boolean {
    return this.colapsado;
  }

  get inicialUsuario(): string {
    return this.usuario?.nombre
      ? String(this.usuario.nombre).charAt(0).toUpperCase()
      : 'U';
  }

  get nombreUsuario(): string {
    return this.usuario?.nombre || 'Usuario';
  }

  get apellidoUsuario(): string {
    return this.usuario?.apellido || '';
  }

  ngOnInit(): void {
    this.aplicarAnchoGlobal();

    this.themeService.initializeTheme();
    this.isDarkMode = this.themeService.isDarkTheme();

    this.subscriptions.add(
      this.chatService.totalNoLeidos$.subscribe((total) => {
        this.contadorMensajesNoLeidos = total;
        this.cdr.detectChanges();
      })
    );

    this.subscriptions.add(
      this.apiService.usuarioActual$.subscribe((usuario) => {
        this.usuario = usuario;

        this.detenerPollingNotificaciones();
        this.detenerCargaProyectos();

        if (this.usuario) {
          this.chatService.iniciar();
          this.iniciarPollingNotificaciones();
          this.cargarProyectos();
        } else {
          this.chatService.detener();

          this.notificaciones = [];
          this.historialNotificaciones = [];
          this.proyectos = [];

          this.contadorNotificaciones = 0;
          this.contadorMensajesNoLeidos = 0;
        }

        this.cdr.detectChanges();
      })
    );

    this.subscriptions.add(
      this.apiService.notificacionesActualizadas$.subscribe(() => {
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

    /*
     * Después de crear, editar o cambiar de proyecto,
     * la lista se vuelve a consultar para mantenerla actualizada.
     */
    this.subscriptions.add(
      this.router.events
        .pipe(
          filter(
            (evento): evento is NavigationEnd =>
              evento instanceof NavigationEnd
          )
        )
        .subscribe(() => {
          if (this.usuario) {
            this.cargarProyectos();
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.detenerPollingNotificaciones();
    this.detenerCargaProyectos();
    this.subscriptions.unsubscribe();
  }

  irAInicio(): void {
    this.router.navigate(['/inicio']);
  }

  toggleSidebar(evento?: Event): void {
    evento?.stopPropagation();

    this.colapsado = !this.colapsado;

    localStorage.setItem(
      'orbita_sidebar_colapsado',
      String(this.colapsado)
    );

    this.mostrarMenuUsuario = false;
    this.mostrarNotificaciones = false;

    this.aplicarAnchoGlobal();

    window.dispatchEvent(
      new CustomEvent('orbita-sidebar-toggle', {
        detail: {
          colapsado: this.colapsado,
          ancho: this.colapsado ? 76 : 260
        }
      })
    );
  }

  abrirChat(): void {
    this.chatService.solicitarAperturaWidget();
  }

  toggleTheme(evento?: Event): void {
    evento?.stopPropagation();

    this.themeService.toggleTheme();
    this.isDarkMode = this.themeService.isDarkTheme();

    this.mostrarMenuUsuario = false;
    this.mostrarNotificaciones = false;

    this.cdr.detectChanges();
  }

  cargarProyectos(): void {
    if (!this.usuario) {
      return;
    }

    this.detenerCargaProyectos();

    this.cargandoProyectos = true;
    this.errorProyectos = '';

    this.suscripcionProyectos = this.apiService
      .obtenerProyectos()
      .subscribe({
        next: (data: any) => {
          this.proyectos = this.normalizarProyectos(data);
          this.cargandoProyectos = false;
          this.cdr.detectChanges();
        },
        error: (error: any) => {
          this.cargandoProyectos = false;

          if (error?.status !== 401) {
            this.errorProyectos = 'No fue posible cargar los proyectos.';
            console.error('Error al cargar proyectos:', error);
          }

          this.cdr.detectChanges();
        }
      });
  }

  trackProyecto(_index: number, proyecto: ProyectoSidebar): number {
    return proyecto.id;
  }

  inicialProyecto(proyecto: ProyectoSidebar): string {
    const nombre = proyecto.nombre.trim();
    return nombre ? nombre.charAt(0).toUpperCase() : 'P';
  }

  toggleNotificaciones(): void {
    this.mostrarNotificaciones = !this.mostrarNotificaciones;

    if (this.mostrarNotificaciones) {
      this.mostrarMenuUsuario = false;
      this.forzarCargaInmediata();
    }
  }

  cambiarVistaHistorial(verHistorial: boolean): void {
    this.viendoHistorial = verHistorial;

    if (this.viendoHistorial) {
      this.forzarCargaInmediata();
    }
  }

  leerNotificacion(notificacion: any, index: number): void {
    this.apiService
      .marcarNotificacionLeida(notificacion.id_notificacion)
      .subscribe({
        next: () => {
          this.notificaciones = this.notificaciones.filter(
            (_, posicion) => posicion !== index
          );

          this.contadorNotificaciones = this.notificaciones.length;

          const encontrada = this.historialNotificaciones.find(
            (item) => item.id_notificacion === notificacion.id_notificacion
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
    this.mostrarMenuUsuario = !this.mostrarMenuUsuario;

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

    this.apiService.actualizarSesionUsuario(null);
    this.router.navigate(['/login']);
  }

  cantidadBadge(cantidad: number): string {
    return cantidad > 99 ? '99+' : String(cantidad);
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event): void {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.mostrarMenuUsuario = false;
      this.mostrarNotificaciones = false;
    }
  }

  private normalizarProyectos(data: unknown): ProyectoSidebar[] {
    const datos = data as { proyectos?: unknown };

    const lista: any[] = Array.isArray(data)
      ? data
      : Array.isArray(datos?.proyectos)
      ? datos.proyectos
      : [];

    const proyectosNormalizados: ProyectoSidebar[] = lista
      .map((proyecto: any): ProyectoSidebar | null => {
        const id = Number(proyecto?.id_proyecto ?? proyecto?.id);

        if (!Number.isInteger(id) || id <= 0) {
          return null;
        }

        const nombre = String(
          proyecto?.nombre ??
          proyecto?.nombre_proyecto ??
          proyecto?.titulo ??
          `Proyecto #${id}`
        ).trim();

        const descripcion =
          proyecto?.descripcion != null
            ? String(proyecto.descripcion)
            : undefined;

        return {
          id,
          nombre: nombre || `Proyecto #${id}`,
          descripcion
        };
      })
      .filter(
        (proyecto): proyecto is ProyectoSidebar => proyecto !== null
      );

    return proyectosNormalizados.sort(
      (a: ProyectoSidebar, b: ProyectoSidebar) =>
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
  }

  private iniciarPollingNotificaciones(): void {
    this.suscripcionNotificaciones = interval(15000)
      .pipe(
        startWith(0),
        switchMap(() => this.apiService.obtenerNotificaciones())
      )
      .subscribe({
        next: (data) => {
          this.aplicarNotificaciones(data);
        },
        error: (error) => {
          if (error?.status !== 401) {
            console.error(
              'Error al sincronizar notificaciones:',
              error
            );
          }
        }
      });
  }

  private detenerPollingNotificaciones(): void {
    this.suscripcionNotificaciones?.unsubscribe();
    this.suscripcionNotificaciones = null;
  }

  private detenerCargaProyectos(): void {
    this.suscripcionProyectos?.unsubscribe();
    this.suscripcionProyectos = null;
  }

  private forzarCargaInmediata(): void {
    this.apiService.obtenerNotificaciones().subscribe({
      next: (data) => {
        this.aplicarNotificaciones(data);
      },
      error: (error) => {
        if (error?.status !== 401) {
          console.error('Error al cargar notificaciones:', error);
        }
      }
    });
  }

  private aplicarNotificaciones(data: any): void {
    const todas = Array.isArray(data) ? data : [];

    this.notificaciones = todas.filter(
      (notificacion) => notificacion.leida === false
    );

    this.contadorNotificaciones = this.notificaciones.length;

    if (this.viendoHistorial) {
      this.historialNotificaciones = todas;
    }

    this.cdr.detectChanges();
  }

  private aplicarAnchoGlobal(): void {
    document.documentElement.style.setProperty(
      '--app-sidebar-width',
      this.colapsado ? '76px' : '260px'
    );
  }
}