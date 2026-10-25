import {
  Component,
  LOCALE_ID,
  OnInit,
  inject
} from '@angular/core';

import {
  CommonModule,
  registerLocaleData
} from '@angular/common';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import localeEs from '@angular/common/locales/es';

import {
  finalize
} from 'rxjs';

import {
  ApiServicio,
  ProyectoApi,
  TareaApi,
  TareaCalendarioApi
} from '../Servicios/api.servicio';

import {
  DetallesActividades
} from '../detalles-actividades/detalles-actividades';


registerLocaleData(
  localeEs,
  'es-ES'
);


export type TipoFechaCalendario =
  | 'limite'
  | 'inicio';


export interface TareaCalendario {
  id_tarea: number;
  id_proyecto: number;

  titulo: string;
  descripcion: string;

  fecha_calendario: string;
  fecha_inicio: string | null;
  fecha_limite: string | null;
  tipo_fecha: TipoFechaCalendario;

  estado: string;
  prioridad: string;

  nombre_proyecto: string;

  usuario_asignado:
    TareaApi['usuario_asignado'];

  tarea_original: TareaApi;
}


export interface DiaCalendario {
  clave: string;
  fecha: Date;
  numeroDia: number;

  esMesActual: boolean;
  esHoy: boolean;

  tareas: TareaCalendario[];
}


@Component({
  selector: 'app-calendario',
  standalone: true,

  imports: [
    CommonModule,
    DetallesActividades
  ],

  providers: [
    {
      provide: LOCALE_ID,
      useValue: 'es-ES'
    }
  ],

  templateUrl: './calendario.html',
  styleUrls: ['./calendario.css']
})
export class CalendarioComponent
  implements OnInit {

  private route =
    inject(ActivatedRoute);

  private router =
    inject(Router);

  private apiService =
    inject(ApiServicio);


  // =========================================================
  // CONTEXTO
  // =========================================================

  proyectoId: number | null = null;
  proyectoActual: ProyectoApi | null = null;

  esVistaProyecto = false;
  esAdmin = false;


  // =========================================================
  // CALENDARIO
  // =========================================================

  fechaActual =
    new Date();

  mesActualNombre = '';
  anioActual = 0;

  diasMatriz: DiaCalendario[] = [];
  todasLasTareas: TareaCalendario[] = [];

  diaSeleccionado: DiaCalendario | null = null;
  tareaSeleccionada: TareaApi | null = null;


  // =========================================================
  // ESTADO DE CARGA
  // =========================================================

  cargando = true;

  errorMessage = '';
  warningMessage = '';

  proyectosConError = 0;


  readonly nombresDias: string[] = [
    'Lun',
    'Mar',
    'Mié',
    'Jue',
    'Vie',
    'Sáb',
    'Dom'
  ];


  // =========================================================
  // TEXTOS SEGÚN EL CONTEXTO
  // =========================================================

  get tituloVista(): string {
    if (!this.esVistaProyecto) {
      return 'Calendario de mis actividades';
    }

    return (
      this.proyectoActual?.nombre
        ? `Calendario de ${this.proyectoActual.nombre}`
        : 'Calendario del proyecto'
    );
  }


  get descripcionVista(): string {
    if (!this.esVistaProyecto) {
      return (
        'Consulta las fechas de tus actividades asignadas ' +
        'en todos tus proyectos.'
      );
    }

    if (this.esAdmin) {
      return (
        'Estás viendo todas las actividades programadas ' +
        'del proyecto.'
      );
    }

    return (
      'Estás viendo únicamente las actividades que tienes ' +
      'asignadas en este proyecto.'
    );
  }


  get etiquetaContexto(): string {
    if (!this.esVistaProyecto) {
      return 'Todos mis proyectos';
    }

    return this.esAdmin
      ? 'Vista administrativa'
      : 'Mis actividades';
  }


  // =========================================================
  // INDICADORES
  // =========================================================

  get tareasMesActual(): TareaCalendario[] {
    const anio =
      this.fechaActual.getFullYear();

    const mes =
      this.fechaActual.getMonth();

    return this.todasLasTareas.filter(
      (tarea) => {
        const fecha =
          this.parsearFecha(
            tarea.fecha_calendario
          );

        return (
          fecha !== null &&
          fecha.getFullYear() === anio &&
          fecha.getMonth() === mes
        );
      }
    );
  }


  get totalMes(): number {
    return this.tareasMesActual.length;
  }


  get concluidasMes(): number {
    return this.tareasMesActual.filter(
      (tarea) =>
        this.esEstadoConcluido(
          tarea.estado
        )
    ).length;
  }


  get altaPrioridadMes(): number {
    return this.tareasMesActual.filter(
      (tarea) =>
        this.normalizarTexto(
          tarea.prioridad
        ) === 'alta'
    ).length;
  }


  get vencidasMes(): number {
    const hoy =
      this.inicioDelDia(
        new Date()
      ).getTime();

    return this.tareasMesActual.filter(
      (tarea) => {
        if (
          tarea.tipo_fecha !== 'limite' ||
          this.esEstadoConcluido(
            tarea.estado
          )
        ) {
          return false;
        }

        const fecha =
          this.parsearFecha(
            tarea.fecha_calendario
          );

        return (
          fecha !== null &&
          fecha.getTime() < hoy
        );
      }
    ).length;
  }


  // =========================================================
  // CICLO DE VIDA
  // =========================================================

  ngOnInit(): void {
    const idRecibido =
      Number(
        this.route.snapshot.paramMap.get(
          'id'
        )
      );

    if (
      Number.isInteger(idRecibido) &&
      idRecibido > 0
    ) {
      this.proyectoId =
        idRecibido;

      this.esVistaProyecto =
        true;
    }

    this.actualizarEncabezadoFecha();

    if (
      this.esVistaProyecto &&
      this.proyectoId
    ) {
      this.cargarCalendarioProyecto();
      return;
    }

    this.cargarCalendarioGlobal();
  }


  // =========================================================
  // CARGA GLOBAL:
  // MIS ACTIVIDADES DE TODOS MIS PROYECTOS
  // =========================================================

  cargarCalendarioGlobal(): void {
    this.prepararCarga();

    this.apiService
      .obtenerCalendarioGlobal()
      .pipe(
        finalize(() => {
          this.cargando = false;
        })
      )
      .subscribe({
        next: (tareas) => {
          const normalizadas = (tareas ?? []).map(
            (tarea) => this.normalizarTarea(tarea)
          );

          this.todasLasTareas =
            this.ordenarTareas(normalizadas);

          this.generarMatrizCalendario(false);
        },

        error: (error) => {
          console.error(
            'Error cargando el calendario global:',
            error
          );

          this.errorMessage =
            error?.error?.detail ||
            'No fue posible cargar tus actividades.';

          this.todasLasTareas = [];
          this.generarMatrizCalendario(false);
        }
      });
  }


  // =========================================================
  // CARGA DE UN PROYECTO:
  // ADMIN = TODAS / COLABORADOR = SOLO LAS SUYAS
  // =========================================================

  cargarCalendarioProyecto(): void {
    if (!this.proyectoId) {
      return;
    }

    this.prepararCarga();

    this.apiService
      .obtenerCalendarioProyecto(this.proyectoId)
      .pipe(
        finalize(() => {
          this.cargando = false;
        })
      )
      .subscribe({
        next: (respuesta) => {
          this.proyectoActual = respuesta.proyecto;
          this.esAdmin = respuesta.es_administrador;

          const normalizadas = (respuesta.tareas ?? []).map(
            (tarea) =>
              this.normalizarTarea(
                tarea,
                respuesta.proyecto
              )
          );

          this.todasLasTareas =
            this.ordenarTareas(normalizadas);

          this.generarMatrizCalendario(false);
        },

        error: (error) => {
          console.error(
            'Error cargando el calendario del proyecto:',
            error
          );

          this.errorMessage =
            error?.error?.detail ||
            'No fue posible cargar el calendario del proyecto.';

          this.todasLasTareas = [];
          this.generarMatrizCalendario(false);
        }
      });
  }


  private prepararCarga(): void {
    this.cargando = true;

    this.errorMessage = '';
    this.warningMessage = '';

    this.proyectosConError = 0;
  }


  // =========================================================
  // NAVEGACIÓN DEL CALENDARIO
  // =========================================================

  mesAnterior(): void {
    this.fechaActual =
      new Date(
        this.fechaActual.getFullYear(),
        this.fechaActual.getMonth() - 1,
        1
      );

    this.actualizarEncabezadoFecha();

    this.generarMatrizCalendario(
      false
    );
  }


  mesSiguiente(): void {
    this.fechaActual =
      new Date(
        this.fechaActual.getFullYear(),
        this.fechaActual.getMonth() + 1,
        1
      );

    this.actualizarEncabezadoFecha();

    this.generarMatrizCalendario(
      false
    );
  }


  irAHoy(): void {
    this.fechaActual =
      new Date();

    this.actualizarEncabezadoFecha();

    this.generarMatrizCalendario(
      false
    );
  }


  volverAlProyecto(): void {
    if (!this.proyectoId) {
      return;
    }

    this.router.navigate([
      '/proyecto',
      this.proyectoId
    ]);
  }


  // =========================================================
  // SELECCIÓN
  // =========================================================

  seleccionarDia(
    dia: DiaCalendario
  ): void {
    this.diaSeleccionado =
      dia;
  }


  esDiaSeleccionado(
    dia: DiaCalendario
  ): boolean {
    return (
      this.diaSeleccionado?.clave ===
      dia.clave
    );
  }


  abrirDetalleTarea(
    tarea: TareaCalendario,
    evento?: Event
  ): void {
    evento?.stopPropagation();

    this.tareaSeleccionada = {
      ...tarea.tarea_original
    };
  }


  cerrarDetalleTarea(): void {
    this.tareaSeleccionada =
      null;
  }


  procesarTareaActualizada(
    tareaActualizada: TareaApi
  ): void {
    const tareaAnterior =
      this.todasLasTareas.find(
        (tarea) =>
          tarea.id_tarea ===
          tareaActualizada.id_tarea
      );

    const proyecto: ProyectoApi = {
      id_proyecto:
        tareaActualizada.id_proyecto,

      nombre:
        tareaAnterior?.nombre_proyecto ||
        this.proyectoActual?.nombre ||
        'Proyecto',

      descripcion:
        this.proyectoActual?.descripcion ??
        null,

      estado:
        this.proyectoActual?.estado ??
        'Activo'
    };

    const normalizada =
      this.normalizarTarea(
        tareaActualizada,
        proyecto
      );

    this.todasLasTareas =
      this.ordenarTareas(
        this.todasLasTareas.map(
          (tarea) =>
            tarea.id_tarea ===
            tareaActualizada.id_tarea
              ? normalizada
              : tarea
        )
      );

    this.tareaSeleccionada = {
      ...tareaActualizada
    };

    this.generarMatrizCalendario(
      true
    );
  }


  procesarTareaEliminada(
    idTarea: number
  ): void {
    this.todasLasTareas =
      this.todasLasTareas.filter(
        (tarea) =>
          tarea.id_tarea !==
          idTarea
      );

    this.tareaSeleccionada =
      null;

    this.generarMatrizCalendario(
      true
    );
  }


  // =========================================================
  // MATRIZ DEL CALENDARIO
  // =========================================================

  private generarMatrizCalendario(
    conservarSeleccion:
      boolean
  ): void {
    const anio =
      this.fechaActual.getFullYear();

    const mes =
      this.fechaActual.getMonth();

    const primerDiaMes =
      new Date(
        anio,
        mes,
        1
      );

    let diaSemanaInicio =
      primerDiaMes.getDay() - 1;

    if (
      diaSemanaInicio === -1
    ) {
      diaSemanaInicio = 6;
    }

    const fechaInicioGrid =
      new Date(
        primerDiaMes
      );

    fechaInicioGrid.setDate(
      primerDiaMes.getDate() -
      diaSemanaInicio
    );

    const hoy =
      this.inicioDelDia(
        new Date()
      );

    const claveSeleccionAnterior =
      conservarSeleccion
        ? this.diaSeleccionado?.clave
        : null;

    const matriz:
      DiaCalendario[] = [];

    for (
      let indice = 0;
      indice < 42;
      indice++
    ) {
      const fechaIteracion =
        new Date(
          fechaInicioGrid
        );

      fechaIteracion.setDate(
        fechaInicioGrid.getDate() +
        indice
      );

      const clave =
        this.crearClaveFecha(
          fechaIteracion
        );

      const tareasDelDia =
        this.todasLasTareas
          .filter(
            (tarea) =>
              this.crearClaveDesdeTexto(
                tarea.fecha_calendario
              ) === clave
          )
          .sort(
            (
              primera,
              segunda
            ) =>
              this.valorPrioridad(
                primera.prioridad
              ) -
              this.valorPrioridad(
                segunda.prioridad
              )
          );

      matriz.push({
        clave,
        fecha:
          new Date(
            fechaIteracion
          ),

        numeroDia:
          fechaIteracion.getDate(),

        esMesActual:
          fechaIteracion.getMonth() ===
          mes,

        esHoy:
          this.crearClaveFecha(
            fechaIteracion
          ) ===
          this.crearClaveFecha(
            hoy
          ),

        tareas:
          tareasDelDia
      });
    }

    this.diasMatriz =
      matriz;

    if (
      claveSeleccionAnterior
    ) {
      const mismoDia =
        matriz.find(
          (dia) =>
            dia.clave ===
            claveSeleccionAnterior
        );

      if (mismoDia) {
        this.diaSeleccionado =
          mismoDia;

        return;
      }
    }

    const diaHoy =
      matriz.find(
        (dia) =>
          dia.esHoy &&
          dia.esMesActual
      );

    const primerDiaActual =
      matriz.find(
        (dia) =>
          dia.esMesActual &&
          dia.numeroDia === 1
      );

    this.diaSeleccionado =
      diaHoy ||
      primerDiaActual ||
      matriz[0] ||
      null;
  }


  // =========================================================
  // NORMALIZACIÓN
  // =========================================================

  private normalizarTarea(
    tarea: TareaCalendarioApi,
    proyecto?: ProyectoApi
  ): TareaCalendario {
    const fechaLimite =
      tarea.fecha_limite ??
      null;

    const fechaInicio =
      tarea.fecha_inicio ??
      null;

    const usaFechaLimite =
      Boolean(
        fechaLimite
      );

    const fechaCalendario =
      fechaLimite ||
      fechaInicio ||
      '';

    return {
      id_tarea:
        Number(
          tarea.id_tarea
        ),

      id_proyecto:
        Number(
          tarea.id_proyecto ??
          proyecto?.id_proyecto
        ),

      titulo:
        String(
          tarea.titulo ||
          'Actividad sin título'
        ),

      descripcion:
        String(
          tarea.descripcion ||
          ''
        ),

      fecha_calendario:
        fechaCalendario,

      fecha_inicio:
        fechaInicio,

      fecha_limite:
        fechaLimite,

      tipo_fecha:
        usaFechaLimite
          ? 'limite'
          : 'inicio',

      estado:
        String(
          tarea.estado ||
          'Pendiente por asignar'
        ),

      prioridad:
        String(
          tarea.prioridad ||
          'Media'
        ),

      nombre_proyecto:
        String(
          tarea.nombre_proyecto ||
          proyecto?.nombre ||
          proyecto?.nombre_proyecto ||
          'Proyecto'
        ),

      usuario_asignado:
        tarea.usuario_asignado ??
        null,

      tarea_original: {
        ...tarea
      }
    };
  }


  private ordenarTareas(
    tareas: TareaCalendario[]
  ): TareaCalendario[] {
    return [...tareas]
      .filter(
        (tarea) =>
          Boolean(
            tarea.fecha_calendario
          )
      )
      .sort(
        (
          primera,
          segunda
        ) => {
          const fechaPrimera =
            this.parsearFecha(
              primera.fecha_calendario
            );

          const fechaSegunda =
            this.parsearFecha(
              segunda.fecha_calendario
            );

          return (
            (
              fechaPrimera?.getTime() ??
              Number.MAX_SAFE_INTEGER
            ) -
            (
              fechaSegunda?.getTime() ??
              Number.MAX_SAFE_INTEGER
            )
          );
        }
      );
  }


  // =========================================================
  // ROL
  // =========================================================

  // =========================================================
  // CLASES VISUALES
  // =========================================================

  obtenerClaseEstado(
    estado: string
  ): string {
    switch (
      this.normalizarTexto(
        estado
      )
    ) {
      case 'concluida':
      case 'completada':
      case 'hecho':
      case 'finalizada':
        return 'estado-concluida';

      case 'en progreso':
        return 'estado-progreso';

      case 'asignada':
        return 'estado-asignada';

      case 'pendiente por asignar':
      case 'pendiente':
      default:
        return 'estado-pendiente';
    }
  }


  obtenerClasePrioridad(
    prioridad: string
  ): string {
    switch (
      this.normalizarTexto(
        prioridad
      )
    ) {
      case 'alta':
      case 'high':
      case 'urgente':
        return 'prioridad-alta';

      case 'media':
      case 'medium':
        return 'prioridad-media';

      case 'baja':
      case 'low':
      default:
        return 'prioridad-baja';
    }
  }


  obtenerInicialesResponsable(
    tarea: TareaCalendario
  ): string {
    const usuario =
      tarea.usuario_asignado;

    if (!usuario) {
      return '?';
    }

    const nombre =
      String(
        usuario.nombre ??
        ''
      ).trim();

    const apellido =
      String(
        usuario.apellido ??
        ''
      ).trim();

    return (
      `${nombre.charAt(0)}${apellido.charAt(0)}`
        .trim()
        .toUpperCase() ||
      '?'
    );
  }


  // =========================================================
  // UTILIDADES DE FECHA
  // =========================================================

  private parsearFecha(
    valor:
      | string
      | null
      | undefined
  ): Date | null {
    if (!valor) {
      return null;
    }

    const texto =
      String(
        valor
      ).trim();

    const coincidencia =
      /^(\d{4})-(\d{2})-(\d{2})/
        .exec(
          texto
        );

    if (coincidencia) {
      const anio =
        Number(
          coincidencia[1]
        );

      const mes =
        Number(
          coincidencia[2]
        ) - 1;

      const dia =
        Number(
          coincidencia[3]
        );

      const fechaLocal =
        new Date(
          anio,
          mes,
          dia
        );

      return Number.isNaN(
        fechaLocal.getTime()
      )
        ? null
        : fechaLocal;
    }

    const fecha =
      new Date(
        texto
      );

    return Number.isNaN(
      fecha.getTime()
    )
      ? null
      : this.inicioDelDia(
          fecha
        );
  }


  private crearClaveDesdeTexto(
    valor:
      | string
      | null
      | undefined
  ): string {
    const fecha =
      this.parsearFecha(
        valor
      );

    return fecha
      ? this.crearClaveFecha(
          fecha
        )
      : '';
  }


  private crearClaveFecha(
    fecha: Date
  ): string {
    const anio =
      fecha.getFullYear();

    const mes =
      String(
        fecha.getMonth() + 1
      ).padStart(
        2,
        '0'
      );

    const dia =
      String(
        fecha.getDate()
      ).padStart(
        2,
        '0'
      );

    return (
      `${anio}-${mes}-${dia}`
    );
  }


  private inicioDelDia(
    fecha: Date
  ): Date {
    const copia =
      new Date(
        fecha
      );

    copia.setHours(
      0,
      0,
      0,
      0
    );

    return copia;
  }


  private actualizarEncabezadoFecha():
    void {
    this.mesActualNombre =
      this.fechaActual
        .toLocaleDateString(
          'es-ES',
          {
            month:
              'long'
          }
        );

    this.anioActual =
      this.fechaActual
        .getFullYear();
  }


  private esEstadoConcluido(
    estado: string
  ): boolean {
    const normalizado =
      this.normalizarTexto(
        estado
      );

    return [
      'concluida',
      'completada',
      'hecho',
      'finalizada'
    ].includes(
      normalizado
    );
  }


  private normalizarTexto(
    valor: string
  ): string {
    return String(
      valor ?? ''
    )
      .trim()
      .toLowerCase();
  }


  private valorPrioridad(
    prioridad: string
  ): number {
    switch (
      this.normalizarTexto(
        prioridad
      )
    ) {
      case 'alta':
        return 1;

      case 'media':
        return 2;

      default:
        return 3;
    }
  }


  // =========================================================
  // TRACK BY
  // =========================================================

  trackDia(
    index: number,
    dia: DiaCalendario
  ): string {
    return dia.clave;
  }


  trackTarea(
    index: number,
    tarea: TareaCalendario
  ): number {
    return tarea.id_tarea;
  }
}