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
  
  // Añadimos esta variable para guardar la fecha actual
  fechaMinima: string = ''; 

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
    this.nuevaTarea.id_proyecto = this.proyectoId;
    
    // Calculamos la fecha de hoy al iniciar el componente
    this.establecerFechaMinima(); 
    
    this.cargarTareas();
  }

  // Método para formatear la fecha actual en YYYY-MM-DD
  establecerFechaMinima() {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = ('0' + (hoy.getMonth() + 1)).slice(-2);
    const day = ('0' + hoy.getDate()).slice(-2);
    this.fechaMinima = `${year}-${month}-${day}`;
  }

  cargarTareas() {
    this.cargando = true;
    this.apiService.obtenerTareas(this.proyectoId).subscribe({
      next: (data) => {
        this.tareas = Array.isArray(data) ? data : [];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.tareas = [];
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  crearTarea() {
    if (!this.nuevaTarea.titulo) {
      this.errorMessage = 'El título es obligatorio';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }

    // --- NUEVAS VALIDACIONES DE FECHAS ---
    if (this.nuevaTarea.fecha_inicio && this.nuevaTarea.fecha_inicio < this.fechaMinima) {
      this.errorMessage = 'La fecha de inicio no puede ser anterior a hoy';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }

    if (this.nuevaTarea.fecha_limite) {
      const fechaComparacion = this.nuevaTarea.fecha_inicio || this.fechaMinima;
      if (this.nuevaTarea.fecha_limite < fechaComparacion) {
        this.errorMessage = 'La fecha límite no puede ser anterior a la de inicio';
        setTimeout(() => this.errorMessage = '', 3000);
        return;
      }
    }
    // ------------------------------------

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

    this.apiService.crearTarea(data).subscribe({
      next: (response) => {
        this.successMessage = 'Tarea creada exitosamente';
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
        const mensaje = error.error?.detail || 'Error al crear tarea';
        this.errorMessage = mensaje;
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  eliminarTarea(id_tarea: number) {
    if (!confirm('¿Eliminar esta tarea?')) return;

    this.apiService.eliminarTarea(id_tarea).subscribe({
      next: () => {
        this.successMessage = 'Tarea eliminada';
        this.cargarTareas();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: () => {
        this.errorMessage = 'Error al eliminar tarea';
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  volverAlProyecto() {
    this.router.navigate(['/proyecto', this.proyectoId]);
  }

  getPrioridadColor(prioridad: string): string {
    const colores: any = { 'Alta': '#d97373', 'Media': '#d9a773', 'Baja': '#73d9a7' };
    return colores[prioridad] || '#a89586';
  }

  getEstadoColor(estado: string): string {
    const colores: any = { 'Concluida': '#a89586', 'Asignada': '#bfaea0', 'Pendiente por asignar': '#e3e0da' };
    return colores[estado] || '#f0eee9';
  }
}