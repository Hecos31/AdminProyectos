import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-calendario-actividades',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendario.html',
  styleUrls: ['./calendario.css']
})
export class CalendarioActividadesComponente implements OnInit {
  proyectoId: number = 0;
  tareas: any[] = [];
  nuevaTarea = {
    id_proyecto: 0,
    titulo: '',
    descripcion: '',
    prioridad: 'Media',
    estado: 'Pendiente por asignar',
    fecha_inicio: '',
    fecha_limite: '',
    id_usuario_asignado: null as number | null
  };
  cargando = true;
  errorMessage = '';
  successMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiServicio,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    console.log('📌 Proyecto ID calendario:', this.proyectoId);
    this.nuevaTarea.id_proyecto = this.proyectoId;
    this.cargarTareas();
  }

  cargarTareas() {
    this.cargando = true;
    console.log('⏳ Cargando tareas...');
    
    this.apiService.obtenerTareas(this.proyectoId).subscribe({
      next: (data) => {
        console.log('📦 Tareas recibidas:', data);
        this.tareas = Array.isArray(data) ? data : [];
        console.log('📊 Cantidad de tareas:', this.tareas.length);
        this.cargando = false;
        this.cdr.detectChanges();  // ← FORZAR ACTUALIZACIÓN
      },
      error: (error) => {
        console.error('❌ Error cargando tareas:', error);
        this.tareas = [];
        this.cargando = false;
        this.cdr.detectChanges();  // ← FORZAR ACTUALIZACIÓN
      }
    });
  }

  crearTarea() {
    if (!this.nuevaTarea.titulo) {
      this.errorMessage = 'El título es obligatorio';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }

    if (this.nuevaTarea.id_usuario_asignado) {
      this.nuevaTarea.estado = 'Asignada';
    } else {
      this.nuevaTarea.estado = 'Pendiente por asignar';
    }

    const data = {
      id_proyecto: this.proyectoId,
      titulo: this.nuevaTarea.titulo,
      descripcion: this.nuevaTarea.descripcion || null,
      prioridad: this.nuevaTarea.prioridad || 'Media',
      estado: this.nuevaTarea.estado || 'Pendiente por asignar',
      fecha_inicio: this.nuevaTarea.fecha_inicio || null,
      fecha_limite: this.nuevaTarea.fecha_limite || null,
      id_usuario_asignado: this.nuevaTarea.id_usuario_asignado || null
    };

    console.log('📤 Enviando tarea:', data);

    this.apiService.crearTarea(data).subscribe({
      next: (response) => {
        console.log('✅ Tarea creada:', response);
        this.successMessage = '✅ Tarea creada exitosamente';
        this.nuevaTarea = {
          id_proyecto: this.proyectoId,
          titulo: '',
          descripcion: '',
          prioridad: 'Media',
          estado: 'Pendiente por asignar',
          fecha_inicio: '',
          fecha_limite: '',
          id_usuario_asignado: null
        };
        this.cargarTareas();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (error) => {
        console.error('❌ Error:', error);
        const mensaje = error.error?.detail || 'Error al crear tarea';
        this.errorMessage = '❌ ' + mensaje;
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  eliminarTarea(id_tarea: number) {
    if (!confirm('¿Eliminar esta tarea?')) return;

    this.apiService.eliminarTarea(id_tarea).subscribe({
      next: () => {
        this.successMessage = '✅ Tarea eliminada';
        this.cargarTareas();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: () => {
        this.errorMessage = '❌ Error al eliminar tarea';
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  volverAlProyecto() {
    this.router.navigate(['/proyecto', this.proyectoId]);
  }

  getPrioridadColor(prioridad: string): string {
    const colores: any = { 'Alta': '#dc3545', 'Media': '#ffc107', 'Baja': '#28a745' };
    return colores[prioridad] || '#6c757d';
  }

  getEstadoColor(estado: string): string {
    const colores: any = {
      'Concluida': '#28a745',
      'Asignada': '#007bff',
      'Pendiente por asignar': '#ffc107'
    };
    return colores[estado] || '#6c757d';
  }
}