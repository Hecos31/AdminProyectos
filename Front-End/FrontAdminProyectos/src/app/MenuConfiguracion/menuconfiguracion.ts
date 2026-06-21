import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu-configuracion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menuconfiguracion.html',
  styleUrls: ['./menuconfiguracion.css']
})
export class MenuConfiguracionComponente {
  @Input() proyectoId: string = '';
  @Input() proyectoNombre: string = '';

  opciones = [
    { 
      icono: '👥', 
      nombre: 'Integrantes', 
      ruta: 'integrantes',
      descripcion: 'Agregar o quitar miembros del proyecto'
    },
    { 
      icono: '📋', 
      nombre: 'Configuración General', 
      ruta: 'configuracion',
      descripcion: 'Configurar opciones del proyecto'
    },
    { 
      icono: '🏷️', 
      nombre: 'Etiquetas y Categorías', 
      ruta: 'etiquetas',
      descripcion: 'Administrar etiquetas del proyecto'
    },
    { 
      icono: '🔔', 
      nombre: 'Notificaciones', 
      ruta: 'notificaciones',
      descripcion: 'Configurar alertas y notificaciones'
    },
    { 
      icono: '📊', 
      nombre: 'Reportes', 
      ruta: 'reportes',
      descripcion: 'Generar reportes del proyecto'
    },
    { 
      icono: '🗑️', 
      nombre: 'Eliminar Proyecto', 
      ruta: 'eliminar',
      descripcion: 'Eliminar proyecto permanentemente',
      peligroso: true
    }
  ];

  constructor(private router: Router) {}

  irAOpcion(opcion: any) {
    if (opcion.peligroso) {
      if (confirm(`¿Estás seguro de eliminar el proyecto "${this.proyectoNombre}"?`)) {
        this.router.navigate([`/proyecto/${this.proyectoId}/configuracion/${opcion.ruta}`]);
      }
    } else {
      this.router.navigate([`/proyecto/${this.proyectoId}/configuracion/${opcion.ruta}`]);
    }
  }
}