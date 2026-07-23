import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiServicio } from '../Servicios/api.servicio';
import { Tarea } from '../crearactividades/crearactividades';
import { DetallesActividades } from '../detalles-actividades/detalles-actividades';

@Component({
  selector: 'app-tablon-actividades',
  standalone: true,
  imports: [CommonModule, DetallesActividades],
  templateUrl: './tablon-actividades.html',
  styleUrl: './tablon-actividades.css',
})
export class TablonActividades {
  
private route = inject(ActivatedRoute);
  private apiService = inject(ApiServicio);


  proyectoId!: number;
  cargando = true;

  columnas: Record<string, Tarea[]> = {
    'Pendiente por asignar': [],
    'Asignada': [],
    'En progreso': [],
    'Concluida': []
  };
  estados = Object.keys(this.columnas);

  ngOnInit() {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    this.cargarTareas();
  }

  cargarTareas() {
    this.apiService.obtenerTareas(this.proyectoId).subscribe({
      next: (data: Tarea[]) => {
        this.estados.forEach(est => this.columnas[est] = []); // Limpiar
        (data || []).forEach(tarea => {
          if (this.columnas[tarea.estado]) {
            this.columnas[tarea.estado].push(tarea);
          }
        });
        this.cargando = false;
      },
      error: () => this.cargando = false
    });
  }

  tareaSeleccionada: any | null = null;

  abrirDetalle(tarea: any) {
    this.tareaSeleccionada = tarea;
  }

  cerrarDetalle() {
    this.tareaSeleccionada = null;
  }


}
