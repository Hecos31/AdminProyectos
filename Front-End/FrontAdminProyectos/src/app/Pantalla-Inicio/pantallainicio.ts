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

  // === NAVEGACIÓN Y SESIÓN ===
  crearProyecto() {
    this.router.navigate(['/crear-proyecto']);
  }

  irAProyecto(id: number) {
    this.router.navigate(['/proyecto', id]);
  }

  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}