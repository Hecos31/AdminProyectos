import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
  proyectoId: string = '';
  actividades: any[] = [];
  nuevaActividad = {
    titulo: '',
    descripcion: '',
    fecha: '',
    hora: '',
    prioridad: 'media'
  };
  cargando = true;
  errorMessage = '';
  successMessage = '';

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiServicio
  ) {}

  ngOnInit() {
    this.proyectoId = this.route.snapshot.params['id'];
    this.cargarActividades();
  }

  cargarActividades() {
    this.apiService.obtenerActividades(this.proyectoId).subscribe({
      next: (data) => {
        this.actividades = data;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error cargando actividades:', error);
        this.cargando = false;
      }
    });
  }

  crearActividad() {
    if (!this.nuevaActividad.titulo || !this.nuevaActividad.fecha) {
      this.errorMessage = 'Título y fecha son obligatorios';
      return;
    }

    this.apiService.crearActividad(this.proyectoId, this.nuevaActividad).subscribe({
      next: () => {
        this.successMessage = 'Actividad creada exitosamente';
        this.nuevaActividad = { titulo: '', descripcion: '', fecha: '', hora: '', prioridad: 'media' };
        this.cargarActividades();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (error) => {
        this.errorMessage = error.error?.mensaje || 'Error al crear actividad';
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  eliminarActividad(id: string) {
    if (confirm('¿Eliminar esta actividad?')) {
      this.apiService.eliminarActividad(this.proyectoId, id).subscribe({
        next: () => {
          this.successMessage = 'Actividad eliminada';
          this.cargarActividades();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (error) => {
          this.errorMessage = 'Error al eliminar actividad';
          setTimeout(() => this.errorMessage = '', 3000);
        }
      });
    }
  }

  getPrioridadColor(prioridad: string): string {
    const colores: any = {
      'alta': '#dc3545',
      'media': '#ffc107',
      'baja': '#28a745'
    };
    return colores[prioridad] || '#6c757d';
  }
}