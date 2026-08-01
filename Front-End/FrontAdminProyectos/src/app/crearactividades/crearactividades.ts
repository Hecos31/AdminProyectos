// === IMPORTACIONES ===
import {
  Component,
  OnInit,
  ChangeDetectorRef,
  inject
} from '@angular/core';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import { CommonModule } from '@angular/common';

import {
  FormsModule,
  ReactiveFormsModule
} from '@angular/forms';

import {
  finalize
} from 'rxjs';

import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';

import {
  ApiServicio,
  EstadoTareaApi,
  PrioridadTareaApi,
  TareaApi,
  UsuarioTarea
} from '../Servicios/api.servicio';

import {
  DetallesActividades
} from '../detalles-actividades/detalles-actividades';

import {
  ConfirmacionService
} from '../Servicios/confirmacion.service';


interface FormularioNuevaTarea {
  titulo: string;
  descripcion: string;
  prioridad: PrioridadTareaApi;
  fecha_inicio: string;
  fecha_limite: string;
  id_usuario_asignado: number | null;
}


@Component({
  selector: 'app-crearactividades',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    DetallesActividades
  ],

  templateUrl: './crearactividades.html',
  styleUrl: './crearactividades.css'
})
export class Crearactividades implements OnInit {
  // =========================================================
  // INYECCIÓN DE DEPENDENCIAS
  // =========================================================

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiServicio);
  private confirmacionService = inject(ConfirmacionService);
  private cdr = inject(ChangeDetectorRef);


  // =========================================================
  // ESTADO DEL COMPONENTE
  // =========================================================

  proyectoId!: number;

  colaboradores: UsuarioTarea[] = [];

  tareaSeleccionada: TareaApi | null = null;


  estados: EstadoTareaApi[] = [
    'Pendiente por asignar',
    'Asignada',
    'En progreso',
    'Concluida'
  ];


  columnas: Record<EstadoTareaApi, TareaApi[]> = {
    'Pendiente por asignar': [],
    'Asignada': [],
    'En progreso': [],
    'Concluida': []
  };


  cargando = true;
  cargandoIA = false;
  eliminandoTareaId: number | null = null;

  textoIA = '';

  mensajeToast = {
    texto: '',
    tipo: ''
  };

  fechaMinima = '';


  nuevaTarea: FormularioNuevaTarea = {
    titulo: '',
    descripcion: '',
    prioridad: 'Media',
    fecha_inicio: '',
    fecha_limite: '',
    id_usuario_asignado: null
  };


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
      this.mostrarToast(
        'No se pudo identificar el proyecto.',
        'error'
      );

      this.cargando = false;
      return;
    }

    this.establecerFechaMinima();
    this.cargarDatosIniciales();
  }


  // =========================================================
  // INICIALIZACIÓN
  // =========================================================

  private establecerFechaMinima(): void {
    const hoy = new Date();

    this.fechaMinima = hoy
      .toISOString()
      .split('T')[0];
  }


  private cargarDatosIniciales(): void {
    this.cargando = true;

    this.apiService
      .obtenerColaboradores(this.proyectoId)
      .subscribe({
        next: (respuesta: any) => {
          const lista = Array.isArray(respuesta)
            ? respuesta
            : respuesta?.colaboradores ?? [];

          this.colaboradores = lista
            .map((item: any) => {
              const usuario =
                item?.usuario ?? item;

              return {
                id_usuario: Number(
                  usuario?.id_usuario
                ),
                nombre:
                  usuario?.nombre ?? '',
                apellido:
                  usuario?.apellido ?? '',
                correo:
                  usuario?.correo ?? ''
              };
            })
            .filter(
              (usuario: UsuarioTarea) =>
                Number.isInteger(usuario.id_usuario) &&
                usuario.id_usuario > 0
            );
        },

        error: () => {
          this.colaboradores = [];

          this.mostrarToast(
            'Error cargando colaboradores',
            'error'
          );
        }
      });

    this.cargarTareas();
  }


  cargarTareas(): void {
    this.cargando = true;

    this.apiService
      .obtenerTareas(this.proyectoId)
      .subscribe({
        next: (data) => {
          this.distribuirTareas(data ?? []);
          this.cargando = false;
        },

        error: (error) => {
          console.error(
            'Error al cargar las tareas:',
            error
          );

          this.cargando = false;

          this.mostrarToast(
            'No fue posible cargar las actividades.',
            'error'
          );
        }
      });
  }


  private distribuirTareas(
    tareas: TareaApi[]
  ): void {
    this.estados.forEach((estado) => {
      this.columnas[estado] = [];
    });

    tareas.forEach((tarea) => {
      const estado =
        tarea.estado as EstadoTareaApi;

      if (this.columnas[estado]) {
        this.columnas[estado].push(tarea);
      }
    });
  }


  // =========================================================
  // DRAG & DROP
  // =========================================================

  onDrop(
    event: CdkDragDrop<TareaApi[]>,
    estadoDestino: EstadoTareaApi
  ): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      return;
    }

    const tareaMovida =
      event.previousContainer.data[event.previousIndex];

    const estadoAnterior =
      tareaMovida.estado as EstadoTareaApi;

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    tareaMovida.estado = estadoDestino;

    this.apiService
      .cambiarEstadoTarea(
        tareaMovida.id_tarea,
        estadoDestino
      )
      .subscribe({
        next: () => {
          if (
            estadoDestino === 'Pendiente por asignar' &&
            tareaMovida.usuario_asignado
          ) {
            this.apiService
              .asignarTarea(
                tareaMovida.id_tarea,
                null
              )
              .subscribe({
                next: () => {
                  this.apiService.notificarCambio();
                  this.cargarTareas();
                },
                error: () => {
                  this.mostrarToast(
                    'El estado cambió, pero no fue posible retirar al responsable.',
                    'error'
                  );

                  this.apiService.notificarCambio();
                  this.cargarTareas();
                }
              });

            return;
          }

          this.apiService.notificarCambio();
          this.cargarTareas();
        },

        error: () => {
          this.mostrarToast(
            'Error al guardar el estado. Revirtiendo...',
            'error'
          );

          transferArrayItem(
            event.container.data,
            event.previousContainer.data,
            event.currentIndex,
            event.previousIndex
          );

          tareaMovida.estado = estadoAnterior;
        }
      });
  }


  // =========================================================
  // CREACIÓN DE TAREAS
  // =========================================================

  generarConIA(): void {
    const instruccion =
      this.textoIA.trim();

    if (!instruccion || this.cargandoIA) {
      return;
    }

    this.cargandoIA = true;

    this.apiService
      .analizarConIA(
        this.proyectoId,
        instruccion
      )
      .subscribe({
        next: (datosIA) => {
          this.nuevaTarea = {
            ...this.nuevaTarea,

            titulo:
              datosIA?.titulo ?? '',

            descripcion:
              datosIA?.descripcion ?? '',

            prioridad:
              this.normalizarPrioridad(
                datosIA?.prioridad
              ),

            fecha_limite:
              datosIA?.fecha_limite ?? '',

            id_usuario_asignado:
              datosIA?.id_usuario_asignado ??
              null
          };

          this.mostrarToast(
            'Datos extraídos correctamente',
            'exito'
          );

          this.cargandoIA = false;
          this.textoIA = '';

          this.cdr.detectChanges();
        },

        error: () => {
          this.mostrarToast(
            'La IA no pudo procesar la solicitud',
            'error'
          );

          this.cargandoIA = false;

          this.cdr.detectChanges();
        }
      });
  }


  crearTarea(): void {
    if (!this.validarFormulario()) {
      return;
    }

    const payload = {
      id_proyecto: this.proyectoId,

      titulo:
        this.nuevaTarea.titulo.trim(),

      descripcion:
        this.nuevaTarea.descripcion.trim() ||
        null,

      prioridad:
        this.nuevaTarea.prioridad,

      fecha_inicio:
        this.nuevaTarea.fecha_inicio ||
        null,

      fecha_limite:
        this.nuevaTarea.fecha_limite ||
        null,

      id_usuario_asignado:
        this.nuevaTarea.id_usuario_asignado
    };

    this.apiService
      .crearTarea(payload)
      .subscribe({
        next: () => {
          this.mostrarToast(
            'Tarea creada con éxito',
            'exito'
          );

          this.limpiarFormulario();
          this.apiService.notificarCambio();
          this.cargarTareas();
        },

        error: (error) => {
          this.mostrarToast(
            error?.error?.detail ||
              'Error al crear la tarea',
            'error'
          );
        }
      });
  }


  private validarFormulario(): boolean {
    if (!this.nuevaTarea.titulo.trim()) {
      this.mostrarToast(
        'El título es obligatorio',
        'error'
      );

      return false;
    }

    if (
      this.nuevaTarea.fecha_inicio &&
      this.nuevaTarea.fecha_inicio <
        this.fechaMinima
    ) {
      this.mostrarToast(
        'La fecha de inicio no puede ser en el pasado',
        'error'
      );

      return false;
    }

    if (
      this.nuevaTarea.fecha_limite &&
      this.nuevaTarea.fecha_inicio &&
      this.nuevaTarea.fecha_limite <
        this.nuevaTarea.fecha_inicio
    ) {
      this.mostrarToast(
        'La fecha límite debe ser posterior a la fecha de inicio',
        'error'
      );

      return false;
    }

    return true;
  }


  private limpiarFormulario(): void {
    this.nuevaTarea = {
      titulo: '',
      descripcion: '',
      prioridad: 'Media',
      fecha_inicio: '',
      fecha_limite: '',
      id_usuario_asignado: null
    };
  }


  // =========================================================
  // GESTIÓN DE TAREAS
  // =========================================================

  async eliminarTarea(
    idTarea: number
  ): Promise<void> {
    if (
      this.eliminandoTareaId !== null ||
      !Number.isInteger(idTarea) ||
      idTarea <= 0
    ) {
      return;
    }

    const tarea = this.buscarTareaPorId(idTarea);

    const tituloTarea =
      tarea?.titulo?.trim() ||
      'esta actividad';

    const confirmado =
      await this.confirmacionService
        .solicitar({
          titulo:
            'Eliminar actividad',

          mensaje:
            `¿Deseas eliminar "${tituloTarea}"?`,

          detalle:
            'También se eliminarán sus comentarios y evidencias. Esta acción no se puede deshacer.',

          tipo:
            'danger',

          textoBotonConfirmar:
            'Eliminar actividad',

          textoBotonCancelar:
            'Conservar actividad'
        });

    if (!confirmado) {
      return;
    }

    this.ejecutarEliminacionTarea(idTarea);
  }


  private ejecutarEliminacionTarea(
    idTarea: number
  ): void {
    this.eliminandoTareaId = idTarea;

    this.apiService
      .eliminarTarea(idTarea)
      .pipe(
        finalize(() => {
          this.eliminandoTareaId = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.mostrarToast(
            'Actividad eliminada correctamente.',
            'exito'
          );

          if (
            this.tareaSeleccionada?.id_tarea ===
            idTarea
          ) {
            this.tareaSeleccionada = null;
          }

          this.apiService.notificarCambio();
          this.cargarTareas();
        },

        error: (error) => {
          console.error(
            'Error eliminando la actividad:',
            error
          );

          this.mostrarToast(
            error?.error?.detail ||
              'No fue posible eliminar la actividad.',
            'error'
          );
        }
      });
  }


  private buscarTareaPorId(
    idTarea: number
  ): TareaApi | undefined {
    for (const estado of this.estados) {
      const tarea = this.columnas[estado]
        .find(
          (item) =>
            item.id_tarea === idTarea
        );

      if (tarea) {
        return tarea;
      }
    }

    return undefined;
  }


  cambiarResponsable(
    tarea: TareaApi,
    evento: Event
  ): void {
    const select =
      evento.target as HTMLSelectElement;

    const valorSeleccionado =
      select.value;

    const idUsuario =
      valorSeleccionado === 'null' ||
      valorSeleccionado === ''
        ? null
        : Number(valorSeleccionado);

    this.apiService
      .asignarTarea(
        tarea.id_tarea,
        idUsuario
      )
      .subscribe({
        next: () => {
          this.mostrarToast(
            'Responsable actualizado',
            'exito'
          );

          /*
           * El backend actual actualiza automáticamente el estado:
           * - sin responsable: "Pendiente por asignar"
           * - con responsable: "Asignada", cuando estaba pendiente
           */
          this.apiService.notificarCambio();
          this.cargarTareas();
        },

        error: () => {
          this.mostrarToast(
            'Error al asignar usuario',
            'error'
          );

          this.cargarTareas();
        }
      });
  }


  // =========================================================
  // MODAL
  // =========================================================

  abrirDetalle(
    tarea: TareaApi
  ): void {
    this.tareaSeleccionada = tarea;
  }


  cerrarDetalle(): void {
    this.tareaSeleccionada = null;
  }


  actualizarDesdeModal(): void {
    this.cargarTareas();
  }


  eliminarDesdeModal(): void {
    this.tareaSeleccionada = null;
    this.cargarTareas();
  }


  // =========================================================
  // NAVEGACIÓN Y UI
  // =========================================================

  mostrarToast(
    texto: string,
    tipo: 'exito' | 'error'
  ): void {
    this.mensajeToast = {
      texto,
      tipo
    };

    window.setTimeout(() => {
      this.mensajeToast = {
        texto: '',
        tipo: ''
      };
    }, 4000);
  }


  volverAlProyecto(): void {
    this.router.navigate([
      '/proyecto',
      this.proyectoId
    ]);
  }


  private normalizarPrioridad(
    valor: unknown
  ): PrioridadTareaApi {
    const prioridad =
      String(valor ?? '').toLowerCase();

    if (prioridad === 'alta') {
      return 'Alta';
    }

    if (prioridad === 'baja') {
      return 'Baja';
    }

    return 'Media';
  }
}