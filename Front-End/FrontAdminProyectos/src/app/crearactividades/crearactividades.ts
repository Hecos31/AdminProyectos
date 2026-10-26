// === IMPORTACIONES ===
import {
  Component,
  OnInit,
  OnDestroy,
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


interface TarjetaBorradorVoz {
  id_temporal: number;
  seleccionada: boolean;
  titulo: string;
  descripcion: string;
  prioridad: PrioridadTareaApi;
  fecha_limite: string;
  id_usuario_asignado: number | null;
}

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
export class Crearactividades implements OnInit, OnDestroy {
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
  // ESTADO VOICE-TO-ACTION (VOZ Y MINUTAS A TAREAS EN LOTE)
  // =========================================================

  modoCreacion: 'individual' | 'voz-lote' = 'individual';

  soportaReconocimientoVoz = false;
  grabandoVoz = false;
  analizandoVozIA = false;
  guardandoLoteVoz = false;

  transcripcionVoz = '';
  textoInterinoVoz = '';
  resumenReunionVoz = '';

  tiempoGrabacionSeg = 0;
  private intervaloTimerVoz: number | null = null;
  private reconocimientoVoz: any = null;

  loteTareasVoz: TarjetaBorradorVoz[] = [];
  publicarMinutaChat = true;


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
    this.inicializarReconocimientoVoz();
    this.verificarModoInicial();
    this.cargarDatosIniciales();

    // =========================================================
    // ESCUCHAR PARÁMETROS DINÁMICAMENTE (REACTIVO)
    // =========================================================
    this.route.queryParamMap.subscribe((params) => {
      const textoMensaje = params.get('tareaTexto');
      if (textoMensaje && textoMensaje.trim()) {
        this.textoIA = textoMensaje;
        this.cdr.detectChanges(); // Refleja el texto inmediatamente en el textarea
      }
    });
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


  ngOnDestroy(): void {
    this.detenerGrabacionVoz();
  }


  // =========================================================
  // VOICE-TO-ACTION: RECONOCIMIENTO DE VOZ Y LOTES CON IA
  // =========================================================

  private verificarModoInicial(): void {
    const modo = this.route.snapshot.queryParamMap.get('modo');

    if (modo === 'voz' || modo === 'voz-lote') {
      this.modoCreacion = 'voz-lote';
    }
  }


  cambiarModoCreacion(modo: 'individual' | 'voz-lote'): void {
    if (this.modoCreacion === modo) {
      return;
    }

    if (this.grabandoVoz) {
      this.detenerGrabacionVoz();
    }

    this.modoCreacion = modo;
  }


  private inicializarReconocimientoVoz(): void {
    if (typeof window === 'undefined') {
      this.soportaReconocimientoVoz = false;
      return;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      this.soportaReconocimientoVoz = false;
      return;
    }

    this.soportaReconocimientoVoz = true;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interino = '';
      let finalAcumulado = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const fragmento = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) {
          finalAcumulado += fragmento + ' ';
        } else {
          interino += fragmento;
        }
      }

      if (finalAcumulado.trim()) {
        const base = this.transcripcionVoz.trim();
        this.transcripcionVoz = base
          ? `${base} ${finalAcumulado.trim()}`
          : finalAcumulado.trim();
      }

      this.textoInterinoVoz = interino;
      this.cdr.detectChanges();
    };

    recognition.onerror = (event: any) => {
      console.warn('Aviso en reconocimiento de voz:', event?.error);
      if (event?.error === 'not-allowed') {
        this.mostrarToast(
          'Permiso de micrófono denegado. Puedes escribir o cargar un ejemplo.',
          'error'
        );
      }
      this.detenerGrabacionVoz();
      this.cdr.detectChanges();
    };

    recognition.onend = () => {
      if (this.grabandoVoz) {
        this.grabandoVoz = false;
        this.detenerTimerVoz();
        this.textoInterinoVoz = '';
        this.cdr.detectChanges();
      }
    };

    this.reconocimientoVoz = recognition;
  }


  alternarGrabacionVoz(): void {
    if (this.grabandoVoz) {
      this.detenerGrabacionVoz();
    } else {
      this.iniciarGrabacionVoz();
    }
  }


  iniciarGrabacionVoz(): void {
    if (!this.soportaReconocimientoVoz || !this.reconocimientoVoz) {
      this.mostrarToast(
        'Tu navegador no soporta dictado directo. Usa el botón de ejemplo o pega los acuerdos.',
        'error'
      );
      return;
    }

    try {
      this.textoInterinoVoz = '';
      this.grabandoVoz = true;
      this.tiempoGrabacionSeg = 0;
      this.iniciarTimerVoz();
      this.reconocimientoVoz.start();
    } catch (error) {
      console.warn('No se pudo iniciar la grabación:', error);
      this.grabandoVoz = false;
      this.detenerTimerVoz();
    }
  }


  detenerGrabacionVoz(): void {
    this.detenerTimerVoz();

    if (this.textoInterinoVoz.trim()) {
      const base = this.transcripcionVoz.trim();
      this.transcripcionVoz = base
        ? `${base} ${this.textoInterinoVoz.trim()}`
        : this.textoInterinoVoz.trim();
      this.textoInterinoVoz = '';
    }

    if (this.reconocimientoVoz && this.grabandoVoz) {
      try {
        this.reconocimientoVoz.stop();
      } catch {
        // Ignorar si ya estaba detenido
      }
    }

    this.grabandoVoz = false;
  }


  private iniciarTimerVoz(): void {
    this.detenerTimerVoz();
    this.intervaloTimerVoz = window.setInterval(() => {
      this.tiempoGrabacionSeg += 1;
      this.cdr.detectChanges();
    }, 1000);
  }


  private detenerTimerVoz(): void {
    if (this.intervaloTimerVoz !== null) {
      window.clearInterval(this.intervaloTimerVoz);
      this.intervaloTimerVoz = null;
    }
  }


  get tiempoGrabacionFormateado(): string {
    const min = Math.floor(this.tiempoGrabacionSeg / 60);
    const seg = this.tiempoGrabacionSeg % 60;
    return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  }


  cargarEjemploReunionVoz(): void {
    const primerColab = this.colaboradores[0]?.nombre || 'Héctor';
    const segundoColab = this.colaboradores[1]?.nombre || primerColab;
    const tercerColab = this.colaboradores[2]?.nombre || primerColab;

    this.transcripcionVoz =
      `Para este sprint necesitamos tres entregas clave: primero, que ${primerColab} optimice los endpoints de seguridad JWT y validación de sesiones para este viernes con prioridad alta; ` +
      `segundo, que ${segundoColab} diseñe los componentes responsivos del panel de métricas y tarjetas móviles para el próximo lunes con prioridad media; ` +
      `y tercero, que ${tercerColab} ejecute las pruebas de integración con MongoDB y documente la colección de mensajes con prioridad alta.`;

    this.mostrarToast(
      'Transcripción de reunión de ejemplo cargada. Presiona "Extraer lote con IA".',
      'exito'
    );
  }


  limpiarTranscripcionVoz(): void {
    if (this.grabandoVoz) {
      this.detenerGrabacionVoz();
    }
    this.transcripcionVoz = '';
    this.textoInterinoVoz = '';
    this.loteTareasVoz = [];
    this.resumenReunionVoz = '';
  }


  analizarAcuerdosVoz(): void {
    if (this.grabandoVoz) {
      this.detenerGrabacionVoz();
    }

    const texto = this.transcripcionVoz.trim();
    if (!texto || this.analizandoVozIA) {
      return;
    }

    this.analizandoVozIA = true;

    this.apiService
      .analizarVozLoteConIA(this.proyectoId, texto)
      .subscribe({
        next: (respuesta) => {
          const tareasDetectadas = Array.isArray(respuesta?.tareas)
            ? respuesta.tareas
            : [];

          this.resumenReunionVoz =
            respuesta?.resumen_reunion?.trim() ||
            `Se identificaron ${tareasDetectadas.length} actividades a partir de los acuerdos dictados.`;

          this.loteTareasVoz = tareasDetectadas.map((item, idx) => ({
            id_temporal: Date.now() + idx,
            seleccionada: true,
            titulo: item.titulo || `Actividad detectada #${idx + 1}`,
            descripcion: item.descripcion || '',
            prioridad: this.normalizarPrioridad(item.prioridad),
            fecha_limite: item.fecha_limite || '',
            id_usuario_asignado: item.id_usuario_asignado ?? null
          }));

          this.analizandoVozIA = false;

          if (this.loteTareasVoz.length > 0) {
            this.mostrarToast(
              `¡IA detectó ${this.loteTareasVoz.length} actividades listas para revisión!`,
              'exito'
            );
          } else {
            this.mostrarToast(
              'No se detectaron actividades claras en el dictado.',
              'error'
            );
          }

          this.cdr.detectChanges();
        },
        error: () => {
          this.analizandoVozIA = false;
          this.mostrarToast(
            'No fue posible analizar los acuerdos con IA en este momento.',
            'error'
          );
          this.cdr.detectChanges();
        }
      });
  }


  agregarTarjetaVozManual(): void {
    this.loteTareasVoz.push({
      id_temporal: Date.now() + this.loteTareasVoz.length,
      seleccionada: true,
      titulo: 'Nueva actividad de reunión',
      descripcion: '',
      prioridad: 'Media',
      fecha_limite: '',
      id_usuario_asignado: null
    });
  }


  eliminarTarjetaVoz(index: number): void {
    this.loteTareasVoz.splice(index, 1);
  }


  get totalTareasVozSeleccionadas(): number {
    return this.loteTareasVoz.filter(
      (item) => item.seleccionada && item.titulo.trim().length > 0
    ).length;
  }


  confirmarLoteTareasVoz(): void {
    const seleccionadas = this.loteTareasVoz.filter(
      (item) => item.seleccionada && item.titulo.trim().length > 0
    );

    if (seleccionadas.length === 0 || this.guardandoLoteVoz) {
      this.mostrarToast(
        'Selecciona al menos una actividad válida para registrar.',
        'error'
      );
      return;
    }

    this.guardandoLoteVoz = true;

    this.apiService
      .crearTareasEnLote({
        id_proyecto: this.proyectoId,
        tareas: seleccionadas.map((t) => ({
          titulo: t.titulo.trim(),
          descripcion: t.descripcion.trim() || null,
          prioridad: t.prioridad,
          fecha_inicio: this.fechaMinima || null,
          fecha_limite: t.fecha_limite || null,
          id_usuario_asignado: t.id_usuario_asignado
        })),
        publicar_minuta_chat: this.publicarMinutaChat,
        resumen_reunion:
          this.resumenReunionVoz ||
          `Acuerdos registrados por voz (${seleccionadas.length} actividades).`
      })
      .subscribe({
        next: (resp) => {
          this.guardandoLoteVoz = false;
          const creadas = resp?.total_creadas ?? seleccionadas.length;
          const msgMinuta = resp?.minuta_publicada
            ? ' y minuta publicada en el chat del proyecto'
            : '';

          this.mostrarToast(
            `¡${creadas} actividades creadas en el tablero${msgMinuta}!`,
            'exito'
          );

          this.loteTareasVoz = [];
          this.transcripcionVoz = '';
          this.resumenReunionVoz = '';

          this.apiService.notificarCambio();
          this.cargarTareas();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.guardandoLoteVoz = false;
          this.mostrarToast(
            err?.error?.detail ||
              'Ocurrió un error al registrar el lote de actividades.',
            'error'
          );
          this.cdr.detectChanges();
        }
      });
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