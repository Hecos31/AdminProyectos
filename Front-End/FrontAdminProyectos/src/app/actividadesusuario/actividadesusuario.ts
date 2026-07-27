import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiServicio } from '../Servicios/api.servicio';
import { Tarea } from '../crearactividades/crearactividades';

@Component({
  selector: 'app-actividadesusuario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './actividadesusuario.html',
  styleUrl: './actividadesusuario.css',
})
export class Actividadesusuario implements OnInit {
  // Inyección de dependencias
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiServicio);

  // Variables de estado
  proyectoId!: number;
  miIdUsuario!: number;
  cargando = true;
  tareaExpandidaId: number | null = null;

  // Colecciones de datos
  misTareasNuevas: Tarea[] = [];
  misTareasProgreso: Tarea[] = [];
  misTareasTerminadas: Tarea[] = [];

  ngOnInit() {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    this.miIdUsuario = Number(localStorage.getItem('id_usuario')) || 1;
    this.cargarMisTareas();
  }

  // Petición HTTP para obtener y clasificar tareas del usuario
  cargarMisTareas() {
    this.apiService.obtenerTareas(this.proyectoId).subscribe({
      next: (todasLasTareas: Tarea[]) => {
        const misTareas = todasLasTareas.filter(t => t.usuario_asignado?.id_usuario === this.miIdUsuario);

        this.misTareasNuevas = misTareas.filter(t => t.estado === 'Asignada');
        this.misTareasProgreso = misTareas.filter(t => t.estado === 'En progreso');
        this.misTareasTerminadas = misTareas.filter(t => t.estado === 'Concluida');

        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  // Control de estado UI para el acordeón
  toggleDetalles(id_tarea: number) {
    this.tareaExpandidaId = this.tareaExpandidaId === id_tarea ? null : id_tarea;
  }

  // Petición HTTP para actualizar estado con actualización optimista de la UI
  cambiarEstado(tarea: Tarea, nuevoEstado: string, evento: Event) {
    evento.stopPropagation();
    this.tareaExpandidaId = null;

    // Actualización optimista
    this.moverTareaLocalmente(tarea, nuevoEstado);

    this.apiService.cambiarEstadoTarea(tarea.id_tarea, nuevoEstado).subscribe({
      next: () => {},
      error: () => {
        // Rollback en caso de error
        this.cargarMisTareas();
        alert('Error de conexión al actualizar la tarea');
      }
    });
  }

  // Lógica interna para mover tareas en memoria sin recargar peticiones HTTP
  private moverTareaLocalmente(tarea: Tarea, nuevoEstado: string) {
    // Eliminar de la lista actual
    this.misTareasNuevas = this.misTareasNuevas.filter(t => t.id_tarea !== tarea.id_tarea);
    this.misTareasProgreso = this.misTareasProgreso.filter(t => t.id_tarea !== tarea.id_tarea);
    this.misTareasTerminadas = this.misTareasTerminadas.filter(t => t.id_tarea !== tarea.id_tarea);

    // Actualizar propiedad y agregar a la nueva lista
    const tareaActualizada = { ...tarea, estado: nuevoEstado };
    
    switch (nuevoEstado) {
      case 'Asignada':
        this.misTareasNuevas.unshift(tareaActualizada);
        break;
      case 'En progreso':
        this.misTareasProgreso.unshift(tareaActualizada);
        break;
      case 'Concluida':
        this.misTareasTerminadas.unshift(tareaActualizada);
        break;
    }
  }
}