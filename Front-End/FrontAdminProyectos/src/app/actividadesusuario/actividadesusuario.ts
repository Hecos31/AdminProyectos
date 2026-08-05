import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  ActivatedRoute
} from '@angular/router';

import {
  CommonModule
} from '@angular/common';

import {
  ApiServicio,
  EstadoTareaApi,
  TareaApi
} from '../Servicios/api.servicio';

import {
  DetallesActividades
} from '../detalles-actividades/detalles-actividades';


@Component({
  selector: 'app-actividadesusuario',
  standalone: true,

  imports: [
    CommonModule,
    DetallesActividades
  ],

  templateUrl: './actividadesusuario.html',
  styleUrl: './actividadesusuario.css'
})
export class Actividadesusuario implements OnInit {
  // =========================================================
  // INYECCIÓN DE DEPENDENCIAS
  // =========================================================

  private route = inject(ActivatedRoute);
  private apiService = inject(ApiServicio);


  // =========================================================
  // ESTADO DEL COMPONENTE
  // =========================================================

  proyectoId = 0;

  cargando = true;

  tareaExpandidaId: number | null = null;

  /**
   * Tarea que se mostrará en el componente de detalles.
   * Cuando es null, el modal permanece cerrado.
   */
  tareaSeleccionada: TareaApi | null = null;

  errorMessage = '';


  // =========================================================
  // COLECCIONES DE TAREAS
  // =========================================================

  misTareasNuevas: TareaApi[] = [];

  misTareasProgreso: TareaApi[] = [];

  misTareasTerminadas: TareaApi[] = [];


  // =========================================================
  // CICLO DE VIDA
  // =========================================================

  ngOnInit(): void {
    this.proyectoId = Number(
      this.route.snapshot.params['id']
    );

    if (
      !Number.isInteger(this.proyectoId) ||
      this.proyectoId <= 0
    ) {
      this.errorMessage =
        'No se pudo identificar el proyecto.';

      this.cargando = false;
      return;
    }

    this.cargarMisTareas();
  }


  // =========================================================
  // CARGAR TAREAS DEL USUARIO
  // =========================================================

  cargarMisTareas(): void {
    this.cargando = true;
    this.errorMessage = '';

    this.apiService
      .obtenerMisTareasProyecto(this.proyectoId)
      .subscribe({
        next: (misTareas: TareaApi[]) => {
          this.organizarTareas(
            misTareas ?? []
          );

          this.cargando = false;
        },

        error: (error) => {
          console.error(
            'Error al obtener las tareas del usuario:',
            error
          );

          this.limpiarListas();

          this.errorMessage =
            error?.error?.detail ||
            'No fue posible cargar tus actividades.';

          this.cargando = false;
        }
      });
  }


  private organizarTareas(
    tareas: TareaApi[]
  ): void {
    this.misTareasNuevas = tareas.filter(
      (tarea) =>
        tarea.estado === 'Asignada'
    );

    this.misTareasProgreso = tareas.filter(
      (tarea) =>
        tarea.estado === 'En progreso'
    );

    this.misTareasTerminadas = tareas.filter(
      (tarea) =>
        tarea.estado === 'Concluida'
    );
  }


  private limpiarListas(): void {
    this.misTareasNuevas = [];
    this.misTareasProgreso = [];
    this.misTareasTerminadas = [];
  }


  // =========================================================
  // DETALLES COMPLETOS DE LA ACTIVIDAD
  // =========================================================

  abrirDetalles(
    tarea: TareaApi,
    evento?: Event
  ): void {
    evento?.stopPropagation();

    this.tareaExpandidaId = null;
    this.tareaSeleccionada = tarea;
  }


  cerrarDetalles(): void {
    this.tareaSeleccionada = null;
  }


  procesarTareaActualizada(
    tareaActualizada: TareaApi
  ): void {
    /*
     * El componente de detalles puede modificar título,
     * descripción, prioridad, fechas, estado o responsable.
     * Se actualiza la vista local sin buscar la actividad
     * nuevamente en el tablón.
     */
    this.moverTareaLocalmente(
      tareaActualizada,
      tareaActualizada.estado as EstadoTareaApi
    );

    /*
     * Mantiene abierta la misma actividad con sus datos nuevos.
     */
    this.tareaSeleccionada = {
      ...tareaActualizada
    };
  }


  procesarTareaEliminada(
    idTarea: number
  ): void {
    this.retirarTareaDeListas(idTarea);
    this.tareaSeleccionada = null;
  }


  // =========================================================
  // EXPANDIR O CONTRAER RESUMEN
  // =========================================================

  toggleDetalles(idTarea: number): void {
    this.tareaExpandidaId =
      this.tareaExpandidaId === idTarea
        ? null
        : idTarea;
  }


  // =========================================================
  // CAMBIAR ESTADO
  // =========================================================

  cambiarEstado(
    tarea: TareaApi,
    nuevoEstado: EstadoTareaApi,
    evento: Event
  ): void {
    evento.stopPropagation();

    this.tareaExpandidaId = null;
    this.errorMessage = '';

    const estadoAnterior =
      tarea.estado as EstadoTareaApi;

    // Actualización optimista
    this.moverTareaLocalmente(
      tarea,
      nuevoEstado
    );

    this.apiService
      .cambiarEstadoTarea(
        tarea.id_tarea,
        nuevoEstado
      )
      .subscribe({
        next: () => {
          // La tarea ya fue actualizada localmente.
        },

        error: (error) => {
          console.error(
            'Error al actualizar la tarea:',
            error
          );

          // Restablecer visualmente la tarea.
          this.moverTareaLocalmente(
            tarea,
            estadoAnterior
          );

          this.errorMessage =
            error?.error?.detail ||
            'No fue posible actualizar la actividad.';
        }
      });
  }


  // =========================================================
  // MOVER TAREA LOCALMENTE
  // =========================================================

  private moverTareaLocalmente(
    tarea: TareaApi,
    nuevoEstado: EstadoTareaApi
  ): void {
    this.retirarTareaDeListas(
      tarea.id_tarea
    );

    const tareaActualizada: TareaApi = {
      ...tarea,
      estado: nuevoEstado
    };

    switch (nuevoEstado) {
      case 'Asignada':
        this.misTareasNuevas.unshift(
          tareaActualizada
        );
        break;

      case 'En progreso':
        this.misTareasProgreso.unshift(
          tareaActualizada
        );
        break;

      case 'Concluida':
        this.misTareasTerminadas.unshift(
          tareaActualizada
        );
        break;

      case 'Pendiente por asignar':
        /*
         * Esta vista muestra las tareas asignadas al usuario.
         * Una tarea pendiente no debe aparecer en ninguna lista.
         */
        break;
    }
  }


  private retirarTareaDeListas(
    idTarea: number
  ): void {
    this.misTareasNuevas =
      this.misTareasNuevas.filter(
        (item) =>
          item.id_tarea !== idTarea
      );

    this.misTareasProgreso =
      this.misTareasProgreso.filter(
        (item) =>
          item.id_tarea !== idTarea
      );

    this.misTareasTerminadas =
      this.misTareasTerminadas.filter(
        (item) =>
          item.id_tarea !== idTarea
      );
  }


  // =========================================================
  // TRACK BY
  // =========================================================

  trackTarea(
    index: number,
    tarea: TareaApi
  ): number {
    return tarea.id_tarea;
  }
}