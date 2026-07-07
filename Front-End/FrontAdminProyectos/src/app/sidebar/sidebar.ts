import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
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
  modoProyecto: boolean = false;
  proyectoActivoId: string | null = null;
  proyectosRecientes: any[] = []; 
  
  // Variables para el menú de usuario
  usuario: any = null;
  mostrarMenuUsuario: boolean = false;

  constructor(
    private router: Router,
    private eRef: ElementRef // Necesario para detectar clics fuera del menú
  ) {}

  ngOnInit() {
    // 1. Obtener datos del usuario logueado
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      this.usuario = JSON.parse(usuarioStr);
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

  // Métodos para el menú de usuario
  toggleMenuUsuario() {
    this.mostrarMenuUsuario = !this.mostrarMenuUsuario;
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
    }
  }
}