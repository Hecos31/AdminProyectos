// === IMPORTACIONES ===
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
export class TablonActividades implements OnInit {
  // === INYECCIÓN DE DEPENDENCIAS ===
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiServicio);

  // === ESTADO DEL COMPONENTE ===
  proyectoId!: number;
  cargando = true;
  tareaSeleccionada: Tarea | null = null;

  columnas: Record<string, Tarea[]> = {
    'Pendiente por asignar': [],
    'Asignada': [],
    'En progreso': [],
    'Concluida': []
  };
  estados = Object.keys(this.columnas);

  // === CICLO DE VIDA ===
  ngOnInit() {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    this.cargarTareas();
  }

  // === PETICIONES HTTP ===
  cargarTareas() {
    this.apiService.obtenerTareas(this.proyectoId).subscribe({
      next: (data: Tarea[]) => {
        this.estados.forEach(est => this.columnas[est] = []);
        (data || []).forEach(tarea => {
          if (this.columnas[tarea.estado]) {
            this.columnas[tarea.estado].push(tarea);
          }
        });
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  // === GESTIÓN DE MODAL DE DETALLES ===
  abrirDetalle(tarea: Tarea) {
    this.tareaSeleccionada = tarea;
  }

  cerrarDetalle() {
    this.tareaSeleccionada = null;
  }
}