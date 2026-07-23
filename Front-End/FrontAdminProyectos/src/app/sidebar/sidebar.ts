import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
// IMPORTANTE: Ajusta esta ruta a donde realmente esté tu api.servicio.ts
import { ApiServicio } from '../Servicios/api.servicio'; 

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponente implements OnInit {
  modoProyecto: boolean = false;
  proyectoActivoId: string | null = null;
  proyectosRecientes: any[] = []; 
  
  // Variables para el menú de usuario
  usuario: any = null;
  mostrarMenuUsuario: boolean = false;

  // ==========================================
  // NUEVAS VARIABLES PARA NOTIFICACIONES
  // ==========================================
  notificaciones: any[] = [];
  noLeidas: number = 0;
  mostrarNotificaciones: boolean = false;

  constructor(
    private router: Router,
    private eRef: ElementRef, // Necesario para detectar clics fuera del menú
    private apiServicio: ApiServicio // Inyectamos el servicio
  ) {}

  ngOnInit() {
    // 1. Obtener datos del usuario logueado
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      this.usuario = JSON.parse(usuarioStr);
      
      // Llamamos a las notificaciones ahora que sabemos quién es el usuario
      if (this.usuario && this.usuario.id_usuario) {
        this.cargarNotificaciones(this.usuario.id_usuario);
      }
    }

    // 2. Escuchar cambios de ruta
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      
      if (url.includes('/proyecto/')) {
        this.modoProyecto = true;
        const partes = url.split('/');
        const indexProyecto = partes.indexOf('proyecto');
        this.proyectoActivoId = partes[indexProyecto + 1];
      } else {
        this.modoProyecto = false;
        this.proyectoActivoId = null;
      }
    });
  }

  // ==========================================
  // NUEVOS MÉTODOS PARA NOTIFICACIONES
  // ==========================================
  cargarNotificaciones(usuarioId: number) {
    this.apiServicio.obtenerNotificaciones(usuarioId).subscribe({
      next: (data) => {
        this.notificaciones = data;
        // Calculamos cuántas no han sido leídas para la burbuja roja
        this.noLeidas = data.filter(n => !n.leida).length;
      },
      error: (err) => console.error('Error al cargar notificaciones', err)
    });
  }

  toggleNotificaciones() {
    this.mostrarNotificaciones = !this.mostrarNotificaciones;
    // Si abrimos notificaciones, cerramos el menú de usuario para que no se encimen
    if (this.mostrarNotificaciones) {
      this.mostrarMenuUsuario = false;
    }
  }

  leerNotificacion(noti: any) {
    // Solo hacemos la petición si la notificación no ha sido leída antes
    if (!noti.leida) {
      this.apiServicio.marcarNotificacionLeida(noti.id_notificacion).subscribe({
        next: () => {
          noti.leida = true; // Actualizamos visualmente
          this.noLeidas--;   // Restamos uno a la burbuja
        },
        error: (err) => console.error('Error al marcar como leída', err)
      });
    }
  }

  // Métodos para el menú de usuario
  toggleMenuUsuario() {
    this.mostrarMenuUsuario = !this.mostrarMenuUsuario;
    // Si abrimos el menú de usuario, cerramos notificaciones
    if (this.mostrarMenuUsuario) {
      this.mostrarNotificaciones = false;
    }
  }

  cerrarSesion() {
    localStorage.clear();
    this.mostrarMenuUsuario = false;
    this.router.navigate(['/login']);
  }

  // Cierra el menú si se hace clic fuera de él
  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if(!this.eRef.nativeElement.contains(event.target)) {
      this.mostrarMenuUsuario = false;
      this.mostrarNotificaciones = false; // También cerramos las notificaciones al hacer clic afuera
    }
  }
}