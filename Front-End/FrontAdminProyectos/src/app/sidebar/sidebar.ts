// === IMPORTACIONES ===
import { Component, OnInit, HostListener, ElementRef, inject } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponente implements OnInit {
  // === INYECCIÓN DE DEPENDENCIAS ===
  private router = inject(Router);
  private eRef = inject(ElementRef);

  // === ESTADO DEL MENÚ ===
  modoProyecto: boolean = false;
  proyectoActivoId: string | null = null;
  proyectosRecientes: any[] = []; 
  
  // === ESTADO DEL USUARIO ===
  usuario: any = null;
  mostrarMenuUsuario: boolean = false;

  // === CICLO DE VIDA ===
  ngOnInit() {
    this.obtenerUsuario();
    this.escucharRutas();
  }

  // === MÉTODOS DE INICIALIZACIÓN ===
  private obtenerUsuario() {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      try {
        this.usuario = JSON.parse(usuarioStr);
      } catch (e) {}
    }
  }

  private escucharRutas() {
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

  // === ACCIONES DE UI ===
  toggleMenuUsuario() {
    this.mostrarMenuUsuario = !this.mostrarMenuUsuario;
  }

  cerrarSesion() {
    localStorage.clear();
    this.mostrarMenuUsuario = false;
    this.router.navigate(['/login']);
  }

  // Cierra el menú de usuario si se hace clic fuera de él
  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.mostrarMenuUsuario = false;
    }
  }
}