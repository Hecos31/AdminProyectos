import { Component, OnInit, OnDestroy, HostListener, ElementRef, inject, ChangeDetectorRef } from '@angular/core'; 
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ChatService } from '../Servicios/chats';
import { ApiServicio } from '../Servicios/api.servicio'; 
import { Subscription, interval, startWith, switchMap } from 'rxjs'; // === IMPORTADO: Operadores de tiempo real seguro ===

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
})
export class SidebarComponente implements OnInit, OnDestroy { 
  private router = inject(Router);
  private eRef = inject(ElementRef);
  private chatService = inject(ChatService);
  private apiService = inject(ApiServicio);
  private cdr = inject(ChangeDetectorRef);
  
  usuario: any = null;
  mostrarMenuUsuario: boolean = false;

  notificaciones: any[] = [];
  contadorNotificaciones: number = 0; 
  mostrarNotificaciones: boolean = false;
  
  viendoHistorial: boolean = false;
  historialNotificaciones: any[] = [];

  private suscripcionNotificaciones!: Subscription;
  private suscripcionSesion!: Subscription; 

  get inicialUsuario(): string {
    if (this.usuario && this.usuario.nombre) {
      return String(this.usuario.nombre).charAt(0).toUpperCase();
    }
    return 'U';
  }
  
  get nombreUsuario(): string {
    if (this.usuario && this.usuario.nombre) {
      return this.usuario.nombre;
    }
    return 'Usuario';
  }

  ngOnInit() {
    // Sincronización de sesión en tiempo real
    this.suscripcionSesion = this.apiService.usuarioActual$.subscribe(user => {
      this.usuario = user;
      
      // Reiniciamos o limpiamos el ciclo de notificaciones al cambiar de usuario
      if (this.suscripcionNotificaciones) {
        this.suscripcionNotificaciones.unsubscribe();
      }

      if (this.usuario) {
        // === POLLING SILENCIOSO CADA 15 SEGUNDOS ===
        // startWith(0) carga inmediatamente al iniciar; switchMap evita cuellos de botella en la red.
        this.suscripcionNotificaciones = interval(15000).pipe(
          startWith(0),
          switchMap(() => this.apiService.obtenerNotificaciones())
        ).subscribe({
          next: (data) => {
            const todasNotificaciones = Array.isArray(data) ? data : [];
            this.notificaciones = todasNotificaciones.filter(n => n.leida === false);
            this.contadorNotificaciones = this.notificaciones.length;
            
            if (this.viendoHistorial) {
              this.historialNotificaciones = todasNotificaciones;
            }

            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error al sincronizar notificaciones:', error);
          }
        });
      } else {
        this.notificaciones = [];
        this.historialNotificaciones = [];
        this.contadorNotificaciones = 0;
        this.cdr.detectChanges();
      }
    });

    // Canal local por si un componente quiere forzar una actualización instantánea
    this.apiService.notificacionesActualizadas$.subscribe(() => {
      if (this.usuario) {
        this.forzarCargaInmediata();
      }
    });
  }

  ngOnDestroy() {
    if (this.suscripcionNotificaciones) this.suscripcionNotificaciones.unsubscribe();
    if (this.suscripcionSesion) this.suscripcionSesion.unsubscribe();
  }

  // Método auxiliar para llamadas instantáneas manuales
  private forzarCargaInmediata() {
    this.apiService.obtenerNotificaciones().subscribe({
      next: (data) => {
        const todasNotificaciones = Array.isArray(data) ? data : [];
        this.notificaciones = todasNotificaciones.filter(n => n.leida === false);
        this.contadorNotificaciones = this.notificaciones.length;
        if (this.viendoHistorial) {
          this.historialNotificaciones = todasNotificaciones;
        }
        this.cdr.detectChanges();
      }
    });
  }

  cambiarVistaHistorial(verHistorial: boolean) {
    this.viendoHistorial = verHistorial;
    if (this.viendoHistorial) {
      this.forzarCargaInmediata();
    }
  }

  leerNotificacion(notificacion: any, index: number) {
    this.apiService.marcarNotificacionLeida(notificacion.id_notificacion).subscribe({
      next: () => {
        this.notificaciones.splice(index, 1);
        if (this.contadorNotificaciones > 0) {
          this.contadorNotificaciones--;
        }
        
        const encontrada = this.historialNotificaciones.find(n => n.id_notificacion === notificacion.id_notificacion);
        if (encontrada) {
          encontrada.leida = true;
        }

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al marcar la notificación como leída:', error);
      }
    });
  }

  toggleNotificaciones() {
    this.mostrarNotificaciones = !this.mostrarNotificaciones;
    if (this.mostrarNotificaciones) {
      this.mostrarMenuUsuario = false;
      this.forzarCargaInmediata();
    }
  }

  abrirChat() {
    this.chatService.solicitarAperturaWidget();
  }

  toggleMenuUsuario() {
    this.mostrarMenuUsuario = !this.mostrarMenuUsuario;
    if (this.mostrarMenuUsuario) {
      this.mostrarNotificaciones = false;
    }
  }

  cerrarSesion() {
    localStorage.clear();
    sessionStorage.clear();
    this.mostrarMenuUsuario = false;
    this.viendoHistorial = false;
    
    this.apiService.actualizarSesionUsuario(null);
    
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.mostrarMenuUsuario = false;
      this.mostrarNotificaciones = false; 
    }
  }
}