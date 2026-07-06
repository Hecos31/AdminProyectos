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
        console.error('Error:', error);
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Método añadido para la navegación
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