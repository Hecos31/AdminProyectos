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


@Component({
  selector: 'app-actividadesusuario',
  standalone: true,
  imports: [
    CommonModule
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
          const tareas = misTareas ?? [];

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

          this.cargando = false;
        },

        error: (error) => {
          console.error(
            'Error al obtener las tareas del usuario:',
            error
          );

          this.misTareasNuevas = [];
          this.misTareasProgreso = [];
          this.misTareasTerminadas = [];

          this.errorMessage =
            error?.error?.detail ||
            'No fue posible cargar tus actividades.';

          this.cargando = false;
        }
      });
  }


  // =========================================================
  // EXPANDIR O CONTRAER DETALLES
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
    // Retirar la tarea de todas las listas.
    this.misTareasNuevas =
      this.misTareasNuevas.filter(
        (item) =>
          item.id_tarea !== tarea.id_tarea
      );

    this.misTareasProgreso =
      this.misTareasProgreso.filter(
        (item) =>
          item.id_tarea !== tarea.id_tarea
      );

    this.misTareasTerminadas =
      this.misTareasTerminadas.filter(
        (item) =>
          item.id_tarea !== tarea.id_tarea
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