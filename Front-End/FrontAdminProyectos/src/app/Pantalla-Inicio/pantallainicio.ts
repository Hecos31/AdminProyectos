import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  proyectos: any[] = [];
  notificaciones: any[] = []; // <-- Nueva lista para las notificaciones
  usuario: any = null;
  cargando = true;

  constructor(
    private apiService: ApiServicio,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      this.usuario = JSON.parse(usuarioStr);
    }
    this.cargarProyectos();
    this.cargarNotificaciones(); // <-- La llamamos al arrancar
  }

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

  // <-- Nuevo método para consumir tu endpoint del Backend
  cargarNotificaciones() {
    this.apiService.obtenerNotificaciones().subscribe({
      next: (data) => {
        this.notificaciones = Array.isArray(data) ? data : [];
        console.log('Notificaciones leídas:', this.notificaciones);
      },
      error: (error) => {
        console.error('Error al cargar notificaciones:', error);
      }
    });
  }

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