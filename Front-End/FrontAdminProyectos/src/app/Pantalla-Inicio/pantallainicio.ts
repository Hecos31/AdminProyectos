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
    // 1. Obtenemos al usuario de la memoria
const usuarioStr = localStorage.getItem('usuario');
if (usuarioStr) {
  const usuario = JSON.parse(usuarioStr);
  
  // 2. Ahora sí le pasamos el id_usuario a la función
  this.apiService.obtenerNotificaciones(usuario.id_usuario).subscribe({
    next: (data) => {
      console.log('Notificaciones cargadas en inicio:', data);
      // this.notificaciones = data; // (Si tienes una variable para guardarlas aquí)
    },
    error: (err) => console.error('Error al cargar notificaciones en inicio', err)
  });
}
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