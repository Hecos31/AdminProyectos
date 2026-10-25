// === IMPORTACIONES ===
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-pantalla-inicio',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pantallainicio.html',
  styleUrls: ['./pantallainicio.css'] 
})
export class PantallaInicioComponente implements OnInit {
  // === INYECCIÓN DE DEPENDENCIAS ===
  private apiService = inject(ApiServicio);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // === ESTADO DEL COMPONENTE ===
  proyectos: any[] = [];
  usuario: any = null;
  cargando = true;
  
  get inicialUsuario(): string {
    if (this.usuario && this.usuario.nombre) {
      return String(this.usuario.nombre).charAt(0).toUpperCase();
    }
    return 'U';
  }

  get nombreUsuario(): string {
    if (this.usuario) {
      return this.usuario.nombre || this.usuario.nombres || this.usuario.correo || 'Usuario';
    }
    return 'Usuario';
  }

  get apellidoUsuario(): string {
    if (this.usuario && this.usuario.apellido) {
      return this.usuario.apellido;
    }
    return '...';
  }
  
  // === CICLO DE VIDA ===
  ngOnInit() {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      try {
        this.usuario = JSON.parse(usuarioStr);
      } catch (e) {}
    }
    this.cargarProyectos();
  }

  // === PETICIONES HTTP ===
  cargarProyectos() {
    this.cargando = true;
    this.apiService.obtenerProyectos().subscribe({
      next: (data) => {
        this.proyectos = Array.isArray(data) ? data : [];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al cargar proyectos:', error);
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  // === NAVEGACIÓN ===
  crearProyecto() {
    this.router.navigate(['/crear-proyecto']);
  }

  irAProyecto(id: number) {
    this.router.navigate(['/proyecto', id]);
  }

  cerrarSesion() {
    localStorage.clear();
    sessionStorage.clear();
    this.router.navigate(['/login']); 
  }
}