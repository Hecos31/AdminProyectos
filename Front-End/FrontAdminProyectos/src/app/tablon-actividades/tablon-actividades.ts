// === IMPORTACIONES ===
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  ApiServicio,
  EstadoTareaApi,
  TareaApi
} from '../Servicios/api.servicio';
import { DetallesActividades } from '../detalles-actividades/detalles-actividades';

@Component({
  selector: 'app-tablon-actividades',
  standalone: true,
  imports: [CommonModule, DetallesActividades],
  templateUrl: './tablon-actividades.html',
  styleUrl: './tablon-actividades.css',
})
export class TablonActividades implements OnInit {
  // === INYECCIÓN DE DEPENDENCIAS ===
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiServicio);

  // === ESTADO DEL COMPONENTE ===
  proyectoId!: number;
  cargando = true;
  
tareaSeleccionada: TareaApi | null = null;

  columnas: Record<EstadoTareaApi, TareaApi[]> = {
  'Pendiente por asignar': [],
  'Asignada': [],
  'En progreso': [],
  'Concluida': []
};

estados: EstadoTareaApi[] = [
  'Pendiente por asignar',
  'Asignada',
  'En progreso',
  'Concluida'
];

  // === CICLO DE VIDA ===
  ngOnInit() {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    this.cargarTareas();
  }

  // === PETICIONES HTTP ===
  cargarTareas(): void {
  this.cargando = true;

  this.apiService.obtenerTareas(this.proyectoId).subscribe({
    next: (data: TareaApi[]) => {
      this.estados.forEach((estado) => {
        this.columnas[estado] = [];
      });

      (data ?? []).forEach((tarea) => {
        const estado = tarea.estado as EstadoTareaApi;

        if (this.columnas[estado]) {
          this.columnas[estado].push(tarea);
        }
      });

      this.cargando = false;
    },

    error: (error) => {
      console.error('Error al cargar las tareas:', error);
      this.cargando = false;
    }
  });
}

  // === GESTIÓN DE MODAL DE DETALLES ===
  abrirDetalle(tarea: TareaApi) {
    this.tareaSeleccionada = tarea;
  }

  cerrarDetalle() {
    this.tareaSeleccionada = null;
  }
}