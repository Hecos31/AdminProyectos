import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import {
  CommonModule
} from '@angular/common';

import {
  catchError,
  finalize,
  forkJoin,
  of
} from 'rxjs';

import {
  ApiServicio,
  EstadoTareaApi,
  TareaApi
} from '../Servicios/api.servicio';

import {
  DetallesActividades
} from '../detalles-actividades/detalles-actividades';


type FiltroEstadoDashboard =
  | 'Todas'
  | EstadoTareaApi;


@Component({
  selector: 'app-pantalla-principal-proyecto',
  standalone: true,

  imports: [
    CommonModule,
    DetallesActividades
  ],

  templateUrl:
    './pantallaprincipalproyecto.html',

  styleUrls: [
    './pantallaprincipalproyecto.css'
  ]
})
export class PantallaPrincipalProyectoComponente
  implements OnInit {

  private route =
    inject(ActivatedRoute);

  private router =
    inject(Router);

  private apiService =
    inject(ApiServicio);


  proyectoId = 0;

  proyecto: any = null;

  tareas: TareaApi[] = [];
  colaboradores: any[] = [];

  tareaSeleccionada: TareaApi | null = null;

  filtroEstado: FiltroEstadoDashboard =
    'Todas';

  cargando = true;
  esAdmin = false;

  errorMessage = '';
  warningMessage = '';


  // =========================================================
  // DATOS CALCULADOS DEL DASHBOARD
  // =========================================================

  get totalTareas(): number {
    return this.tareas.length;
  }


  get totalColaboradores(): number {
    return this.colaboradores.length;
  }


  get tareasPendientesAsignacion(): number {
    return this.contarEstado(
      'Pendiente por asignar'
    );
  }


  get tareasAsignadas(): number {
    return this.contarEstado(
      'Asignada'
    );
  }


  get tareasEnProgreso(): number {
    return this.contarEstado(
      'En progreso'
    );
  }


  get tareasConcluidas(): number {
    return this.contarEstado(
      'Concluida'
    );
  }


  get porcentajeAvance(): number {
    if (this.totalTareas === 0) {
      return 0;
    }

    return Math.round(
      (
        this.tareasConcluidas /
        this.totalTareas
      ) * 100
    );
  }


  get tareasVencidas(): TareaApi[] {
    const hoy =
      this.obtenerInicioDelDia(
        new Date()
      ).getTime();

    return this.tareas
      .filter((tarea) => {
        if (
          tarea.estado === 'Concluida' ||
          !tarea.fecha_limite
        ) {
          return false;
        }

        const fechaLimite =
          new Date(
            tarea.fecha_limite
          ).getTime();

        return (
          Number.isFinite(fechaLimite) &&
          fechaLimite < hoy
        );
      })
      .sort(
        (a, b) =>
          this.obtenerTiempoFecha(
            a.fecha_limite
          ) -
          this.obtenerTiempoFecha(
            b.fecha_limite
          )
      );
  }


  get tareasPorVencer(): TareaApi[] {
    const hoy =
      this.obtenerInicioDelDia(
        new Date()
      );

    const limite =
      new Date(hoy);

    limite.setDate(
      limite.getDate() + 7
    );

    return this.tareas
      .filter((tarea) => {
        if (
          tarea.estado === 'Concluida' ||
          !tarea.fecha_limite
        ) {
          return false;
        }

        const fecha =
          new Date(
            tarea.fecha_limite
          );

        return (
          fecha >= hoy &&
          fecha <= limite
        );
      })
      .sort(
        (a, b) =>
          this.obtenerTiempoFecha(
            a.fecha_limite
          ) -
          this.obtenerTiempoFecha(
            b.fecha_limite
          )
      );
  }


  get proximasFechas(): TareaApi[] {
    const hoy =
      this.obtenerInicioDelDia(
        new Date()
      ).getTime();

    return this.tareas
      .filter((tarea) => {
        if (
          tarea.estado === 'Concluida' ||
          !tarea.fecha_limite
        ) {
          return false;
        }

        return (
          this.obtenerTiempoFecha(
            tarea.fecha_limite
          ) >= hoy
        );
      })
      .sort(
        (a, b) =>
          this.obtenerTiempoFecha(
            a.fecha_limite
          ) -
          this.obtenerTiempoFecha(
            b.fecha_limite
          )
      )
      .slice(0, 5);
  }


  get tareasFiltradas(): TareaApi[] {
    const tareas =
      this.filtroEstado === 'Todas'
        ? [...this.tareas]
        : this.tareas.filter(
            (tarea) =>
              tarea.estado ===
              this.filtroEstado
          );

    return tareas.sort(
      (a, b) => {
        const aConcluida =
          a.estado === 'Concluida';

        const bConcluida =
          b.estado === 'Concluida';

        if (
          aConcluida !==
          bConcluida
        ) {
          return aConcluida
            ? 1
            : -1;
        }

        return (
          this.obtenerTiempoFecha(
            a.fecha_limite
          ) -
          this.obtenerTiempoFecha(
            b.fecha_limite
          )
        );
      }
    );
  }


  get colaboradoresVisibles(): any[] {
    return this.colaboradores
      .slice(0, 6);
  }


  // =========================================================
  // CICLO DE VIDA
  // =========================================================

  ngOnInit(): void {
    const idRecibido = Number(
      this.route.snapshot.paramMap.get(
        'id'
      )
    );

    if (
      !Number.isInteger(idRecibido) ||
      idRecibido <= 0
    ) {
      this.errorMessage =
        'No se pudo identificar el proyecto.';

      this.cargando = false;
      return;
    }

    this.proyectoId =
      idRecibido;

    this.cargarDashboard();
  }


  // =========================================================
  // CARGA DE DATOS
  // =========================================================

  cargarDashboard(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.warningMessage = '';

    forkJoin({
      proyecto:
        this.apiService
          .obtenerProyecto(
            this.proyectoId
          ),

      tareas:
        this.apiService
          .obtenerTareas(
            this.proyectoId
          )
          .pipe(
            catchError((error) => {
              console.error(
                'Error cargando tareas:',
                error
              );

              this.warningMessage =
                'El proyecto se cargó, pero no fue posible obtener todas las actividades.';

              return of(
                [] as TareaApi[]
              );
            })
          ),

      colaboradores:
        this.apiService
          .obtenerColaboradores(
            this.proyectoId
          )
          .pipe(
            catchError((error) => {
              console.error(
                'Error cargando colaboradores:',
                error
              );

              if (
                !this.warningMessage
              ) {
                this.warningMessage =
                  'El proyecto se cargó, pero no fue posible obtener el equipo.';
              }

              return of(
                [] as any[]
              );
            })
          )
    })
      .pipe(
        finalize(() => {
          this.cargando = false;
        })
      )
      .subscribe({
        next: ({
          proyecto,
          tareas,
          colaboradores
        }) => {
          this.proyecto =
            proyecto;

          this.tareas =
            tareas ?? [];

          this.colaboradores =
            colaboradores ?? [];

          this.verificarSiEsAdmin();
        },

        error: (error) => {
          console.error(
            'Error cargando dashboard:',
            error
          );

          this.errorMessage =
            error?.error?.detail ||
            'No se pudo cargar la información del proyecto.';
        }
      });
  }


  private verificarSiEsAdmin(): void {
    const usuarioStr =
      localStorage.getItem(
        'usuario'
      );

    if (!usuarioStr) {
      this.esAdmin = false;
      return;
    }

    try {
      const usuario =
        JSON.parse(
          usuarioStr
        );

      const idUsuario =
        Number(
          usuario?.id_usuario
        );

      const miPerfil =
        this.colaboradores.find(
          (colaborador) =>
            Number(
              colaborador?.id_usuario
            ) === idUsuario
        );

      this.esAdmin =
        Number(
          miPerfil?.id_rol
        ) === 1;
    } catch {
      this.esAdmin = false;
    }
  }


  // =========================================================
  // INTERACCIÓN DEL DASHBOARD
  // =========================================================

  seleccionarFiltro(
    filtro: FiltroEstadoDashboard
  ): void {
    this.filtroEstado =
      filtro;
  }


  abrirDetalleTarea(
    tarea: TareaApi
  ): void {
    this.tareaSeleccionada =
      tarea;
  }


  cerrarDetalleTarea(): void {
    this.tareaSeleccionada =
      null;
  }


  procesarTareaActualizada(
    tareaActualizada: TareaApi
  ): void {
    this.tareas =
      this.tareas.map(
        (tarea) =>
          tarea.id_tarea ===
          tareaActualizada.id_tarea
            ? {
                ...tarea,
                ...tareaActualizada
              }
            : tarea
      );

    this.tareaSeleccionada = {
      ...tareaActualizada
    };
  }


  procesarTareaEliminada(
    idTarea: number
  ): void {
    this.tareas =
      this.tareas.filter(
        (tarea) =>
          tarea.id_tarea !== idTarea
      );

    this.tareaSeleccionada =
      null;
  }


  contarEstado(
    estado: EstadoTareaApi
  ): number {
    return this.tareas.filter(
      (tarea) =>
        tarea.estado === estado
    ).length;
  }


  porcentajeEstado(
    estado: EstadoTareaApi
  ): number {
    if (this.totalTareas === 0) {
      return 0;
    }

    return Math.round(
      (
        this.contarEstado(
          estado
        ) /
        this.totalTareas
      ) * 100
    );
  }


  contarPrioridad(
    prioridad: string
  ): number {
    return this.tareas.filter(
      (tarea) =>
        String(
          tarea.prioridad ?? ''
        ).toLowerCase() ===
        prioridad.toLowerCase()
    ).length;
  }


  porcentajePrioridad(
    prioridad: string
  ): number {
    if (this.totalTareas === 0) {
      return 0;
    }

    return Math.round(
      (
        this.contarPrioridad(
          prioridad
        ) /
        this.totalTareas
      ) * 100
    );
  }


  obtenerIniciales(
    colaborador: any
  ): string {
    const nombre =
      String(
        colaborador?.nombre ?? ''
      ).trim();

    const apellido =
      String(
        colaborador?.apellido ?? ''
      ).trim();

    const iniciales =
      `${nombre.charAt(0)}${apellido.charAt(0)}`
        .trim()
        .toUpperCase();

    if (iniciales) {
      return iniciales;
    }

    return String(
      colaborador?.correo ??
      '?'
    )
      .charAt(0)
      .toUpperCase();
  }


  obtenerNombreColaborador(
    colaborador: any
  ): string {
    const nombreCompleto =
      `${colaborador?.nombre ?? ''} ${colaborador?.apellido ?? ''}`
        .trim();

    return (
      nombreCompleto ||
      colaborador?.correo ||
      'Integrante'
    );
  }


  obtenerRolColaborador(
    colaborador: any
  ): string {
    return (
      colaborador?.nombre_rol ||
      colaborador?.rol ||
      (
        Number(
          colaborador?.id_rol
        ) === 1
          ? 'Administrador'
          : 'Colaborador'
      )
    );
  }


  // =========================================================
  // NAVEGACIÓN
  // =========================================================

  irAConfiguracion(): void {
    this.router.navigate([
      '/proyecto',
      this.proyectoId,
      'configuracion'
    ]);
  }


  irATablon(): void {
    this.router.navigate([
      '/proyecto',
      this.proyectoId,
      'tablon'
    ]);
  }


  irAMisActividades(): void {
    this.router.navigate([
      '/proyecto',
      this.proyectoId,
      'mis-actividades'
    ]);
  }


  irACrearActividades(): void {
    this.router.navigate([
      '/proyecto',
      this.proyectoId,
      'crearactividades'
    ]);
  }


  volverAInicio(): void {
    this.router.navigate([
      '/inicio'
    ]);
  }


  // =========================================================
  // UTILIDADES
  // =========================================================

  trackTarea(
    index: number,
    tarea: TareaApi
  ): number {
    return tarea.id_tarea;
  }


  trackColaborador(
    index: number,
    colaborador: any
  ): number | string {
    return (
      colaborador?.id_usuario ??
      colaborador?.correo ??
      index
    );
  }


  private obtenerTiempoFecha(
    fecha:
      | string
      | null
      | undefined
  ): number {
    if (!fecha) {
      return Number.MAX_SAFE_INTEGER;
    }

    const tiempo =
      new Date(
        fecha
      ).getTime();

    return Number.isFinite(tiempo)
      ? tiempo
      : Number.MAX_SAFE_INTEGER;
  }


  private obtenerInicioDelDia(
    fecha: Date
  ): Date {
    const inicio =
      new Date(
        fecha
      );

    inicio.setHours(
      0,
      0,
      0,
      0
    );

    return inicio;
  }
}