// === IMPORTACIONES ===
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-menu-configuracion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menuconfiguracion.html',
  styleUrls: ['./menuconfiguracion.css']
})
export class MenuConfiguracionComponente implements OnInit {
  // === INYECCIÓN DE DEPENDENCIAS ===
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiServicio);

  // === ESTADO ===
  proyectoId: string = '';
  proyectoNombre: string = '';

  opciones = [
    { 
      id: 'integrantes',
      nombre: 'Gestión de Integrantes', 
      descripcion: 'Agregar, remover o cambiar el rol de los colaboradores del proyecto.',
      peligroso: false
    },
    { 
      id: 'eliminar',
      nombre: 'Eliminar Proyecto', 
      descripcion: 'Borrar permanentemente este proyecto y todas sus tareas asociadas.',
      peligroso: true
    }
  ];

  // === CICLO DE VIDA ===
  ngOnInit() {
    this.proyectoId = this.route.snapshot.params['id'];
    this.cargarNombreProyecto();
  }

  // === PETICIONES HTTP ===
  cargarNombreProyecto() {
    this.apiService.obtenerProyecto(Number(this.proyectoId)).subscribe({
      next: (proyecto: any) => this.proyectoNombre = proyecto.nombre,
      error: () => { /* opcional: manejar error */ }
    });
  }

  // === MÉTODOS ===
  irAOpcion(opcion: any) {
    if (opcion.peligroso && opcion.id === 'eliminar') {
      const confirmacion = confirm(`¿Estás seguro de eliminar el proyecto "${this.proyectoNombre}"? Esta acción no se puede deshacer.`);
      
      if (confirmacion) {
        this.apiService.eliminarProyecto(Number(this.proyectoId)).subscribe({
          next: () => this.router.navigate(['/inicio']),
          error: () => alert('Error de conexión al intentar eliminar el proyecto.')
        });
      }
    } else if (opcion.id === 'integrantes') {
      this.router.navigate([`/proyecto/${this.proyectoId}/integrantes`]);
    }
  }
}