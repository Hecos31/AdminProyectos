import { Component, OnInit } from '@angular/core';
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
  usuario: any = null;
  cargando = true;

  constructor(
    private apiService: ApiServicio,
    private router: Router
  ) {}

  ngOnInit() {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      this.usuario = JSON.parse(usuarioStr);
    }
    this.cargarProyectos();
  }

  cargarProyectos() {
    this.apiService.obtenerProyectos().subscribe({
      next: (data) => {
        this.proyectos = data;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error cargando proyectos:', error);
        this.cargando = false;
      }
    });
  }

  irAProyecto(id: string) {
    this.router.navigate(['/proyecto', id]);
  }

  // ✅ NUEVO MÉTODO
  crearNuevoProyecto() {
    // Opción 1: Redirigir a una página de creación
    this.router.navigate(['/proyecto/nuevo']);
    
    // Opción 2: Si no tienes la ruta, muestra un mensaje
    // alert('Funcionalidad en desarrollo - Crear nuevo proyecto');
    
    // Opción 3: Abrir un modal (requiere más configuración)
  }

  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}