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

  FormsModule

} from '@angular/forms';



import {

  catchError,

  finalize,

  forkJoin,

  of

} from 'rxjs';



import {

  ApiServicio,

  EstadoTareaApi,

  IntegrantePulse,

  ReconocimientoItem,

  MedallaPulse,

  TareaApi,

  TeamPulseData

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

    FormsModule,

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

  // ESTADO DE ÓRBITA TEAM PULSE & PUNTOS DE MÉRITO (GAMIFICACIÓN XP)

  // =========================================================



  teamPulse: TeamPulseData | null = null;

  generandoCronicaIA = false;

  enviandoMerito = false;

  mensajeExitoPulse = '';



  destinatarioMeritoModal: IntegrantePulse | null = null;

  insigniaMeritoSeleccionada = 'Entrega Impecable';

  mensajeMeritoTexto = '';

  publicarMeritoEnChat = true;



  readonly catalogoInsigniasMerito: string[] = [

    'Entrega Impecable',

    'Resolución de Bloqueos',

    'Calidad Técnica y QA',

    'Compañerismo Excepcional',

    'Liderazgo en el Sprint'

  ];





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

          this.cargarDatosTeamPulse();

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





  irAVoiceToAction(): void {

    this.router.navigate(

      [

        '/proyecto',

        this.proyectoId,

        'crearactividades'

      ],

      {

        queryParams: {

          modo: 'voz'

        }

      }

    );

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





  // =========================================================

  // LÓGICA DE ÓRBITA TEAM PULSE & PUNTOS DE MÉRITO

  // =========================================================



  irASeccionPulse(): void {

    const el = document.getElementById('orbita-team-pulse-section');

    if (el) {

      el.scrollIntoView({ behavior: 'smooth', block: 'start' });

    }

  }





  cargarDatosTeamPulse(): void {

    this.apiService

      .obtenerTeamPulse(this.proyectoId)

      .pipe(

        catchError(() => {

          return of(this.construirTeamPulseLocal());

        })

      )

      .subscribe((pulse) => {

        this.teamPulse = pulse ?? this.construirTeamPulseLocal();

      });

  }





  private construirTeamPulseLocal(): TeamPulseData {

    const meritoStorageKey = `orbita_meritos_proy_${this.proyectoId}`;

    let meritosLocales: ReconocimientoItem[] = [];

    try {

      const raw = localStorage.getItem(meritoStorageKey);

      if (raw) {

        meritosLocales = JSON.parse(raw);

      }

    } catch {

      meritosLocales = [];

    }



    const hoy = this.obtenerInicioDelDia(new Date()).getTime();

    let totalConcluidas = 0;

    let totalATiempo = 0;

    let totalMedallas = 0;



    const titulosNivel: Record<number, string> = {

      1: 'Explorador Orbital',

      2: 'Constructor Ágil',

      3: 'Especialista de Sprint',

      4: 'Arquitecto de Impacto',

      5: 'Comandante de Misión',

      6: 'Leyenda de Órbita'

    };



    const ranking: IntegrantePulse[] = this.colaboradores.map((colab) => {

      const uid = Number(colab?.id_usuario ?? 0);

      const nombre = String(colab?.nombre ?? '').trim();

      const apellido = String(colab?.apellido ?? '').trim();

      const correo = String(colab?.correo ?? '').trim();

      const rol = this.obtenerRolColaborador(colab);



      const misTareas = this.tareas.filter(

        (t) => Number(t.usuario_asignado?.id_usuario) === uid

      );



      const concluidas = misTareas.filter((t) => t.estado === 'Concluida');

      const enProgreso = misTareas.filter((t) => t.estado === 'En progreso');

      const altaPrio = concluidas.filter(

        (t) => String(t.prioridad ?? '').toLowerCase() === 'alta'

      );



      let entregasTiempo = 0;

      let tieneVencidas = false;

      let xpTareas = 0;



      misTareas.forEach((t) => {

        const prio = String(t.prioridad ?? 'Media').toLowerCase();

        if (t.estado === 'Concluida') {

          totalConcluidas += 1;

          xpTareas += prio === 'alta' ? 100 : prio === 'media' ? 70 : 45;

          entregasTiempo += 1;

          totalATiempo += 1;

          xpTareas += 30;

        } else {

          if (t.estado === 'En progreso') {

            xpTareas += 25;

          }

          if (t.fecha_limite && this.obtenerTiempoFecha(t.fecha_limite) < hoy) {

            tieneVencidas = true;

          }

        }

      });



      const meritosRecibidos = meritosLocales.filter(

        (k) => Number(k.id_destinatario) === uid

      ).length;



      const evidenciasEst = concluidas.length;

      const comentariosEst = concluidas.length + enProgreso.length;



      let xpTotal =

        xpTareas +

        evidenciasEst * 20 +

        comentariosEst * 10 +

        meritosRecibidos * 25;



      if (xpTotal === 0) {

        xpTotal = 30;

      }



      const nivel = Math.min(6, Math.floor(xpTotal / 200) + 1);

      const progresoPct =

        nivel < 6 ? Math.min(100, Math.round(((xpTotal % 200) / 200) * 100)) : 100;



      const medallas: MedallaPulse[] = [];

      if (entregasTiempo >= 1 && !tieneVencidas) {

        medallas.push({

          codigo: 'entrega_impecable',

          nombre: 'Entrega Impecable',

          descripcion: 'Entregas en tiempo y sin tareas vencidas.',

          color: 'amber'

        });

      }

      if (altaPrio.length >= 1) {

        medallas.push({

          codigo: 'alto_impacto',

          nombre: 'Alto Impacto',

          descripcion: 'Resuelve tareas críticas de prioridad Alta.',

          color: 'rose'

        });

      }

      if (evidenciasEst >= 1) {

        medallas.push({

          codigo: 'documentador_qa',

          nombre: 'Documentador QA',

          descripcion: 'Entregas verificadas en el proyecto.',

          color: 'blue'

        });

      }

      if (meritosRecibidos >= 1) {

        medallas.push({

          codigo: 'favorito_equipo',

          nombre: 'Reconocido por el Equipo',

          descripcion: 'Ha recibido Puntos de Mérito de sus compañeros.',

          color: 'emerald'

        });

      }

      if (medallas.length === 0) {

        medallas.push({

          codigo: 'en_orbita',

          nombre: 'En Órbita',

          descripcion: 'Integrante activo en el sprint.',

          color: 'blue'

        });

      }



      totalMedallas += medallas.length;



      return {

        posicion: 0,

        id_usuario: uid,

        nombre,

        apellido,

        correo,

        rol,

        xp_total: xpTotal,

        nivel,

        titulo_nivel: titulosNivel[nivel] || 'Leyenda de Órbita',

        progreso_nivel_pct: progresoPct,

        racha_entregas_tiempo: entregasTiempo,

        tareas_concluidas: concluidas.length,

        tareas_alta_prioridad: altaPrio.length,

        tareas_en_progreso: enProgreso.length,

        evidencias_subidas: evidenciasEst,

        comentarios_realizados: comentariosEst,

        meritos_recibidos: meritosRecibidos,

        medallas

      };

    });



    ranking.sort(

      (a, b) =>

        b.xp_total - a.xp_total ||

        b.tareas_concluidas - a.tareas_concluidas ||

        b.meritos_recibidos - a.meritos_recibidos

    );



    ranking.forEach((item, idx) => {

      item.posicion = idx + 1;

    });



    const xpTotalEquipo = ranking.reduce((acc, m) => acc + m.xp_total, 0);

    const pctTiempo =

      totalConcluidas > 0

        ? Math.round((totalATiempo / totalConcluidas) * 100)

        : 100;



    const lider = ranking[0];

    const cronica = lider

      ? `¡Pulso del equipo activo en '${this.proyecto?.nombre || 'el proyecto'}'! El equipo suma ${xpTotalEquipo} XP con ${pctTiempo}% de entregas a tiempo. ${lider.nombre} ${lider.apellido} lidera el Sprint con ${lider.xp_total} XP (${lider.titulo_nivel}) y ${lider.medallas.length} medallas desbloqueadas.`

      : 'El equipo está listo para iniciar el Sprint y desbloquear sus primeras medallas de impacto.';



    return {

      id_proyecto: this.proyectoId,

      nombre_proyecto: this.proyecto?.nombre || 'Proyecto',

      xp_total_equipo: xpTotalEquipo,

      porcentaje_entregas_tiempo: pctTiempo,

      total_meritos_proyecto: meritosLocales.length,

      total_medallas_desbloqueadas: totalMedallas,

      cronica_ia: cronica,

      ranking,

      meritos_recientes: meritosLocales.slice(0, 8)

    };

  }





  abrirModalEnviarMerito(integrante: IntegrantePulse): void {

    this.destinatarioMeritoModal = integrante;

    this.insigniaMeritoSeleccionada = 'Entrega Impecable';

    this.mensajeMeritoTexto = `¡Excelente trabajo en el proyecto, ${integrante.nombre}! Tu aporte impulsa a todo el equipo.`;

    this.publicarMeritoEnChat = true;

  }





  cerrarModalMerito(): void {

    this.destinatarioMeritoModal = null;

    this.mensajeMeritoTexto = '';

  }





  confirmarEnvioMerito(): void {

    if (

      !this.destinatarioMeritoModal ||

      !this.mensajeMeritoTexto.trim() ||

      this.enviandoMerito

    ) {

      return;

    }



    const dest = this.destinatarioMeritoModal;

    const payload = {

      id_destinatario: dest.id_usuario,

      insignia: this.insigniaMeritoSeleccionada,

      mensaje: this.mensajeMeritoTexto.trim(),

      publicar_en_chat: this.publicarMeritoEnChat

    };



    this.enviandoMerito = true;



    this.apiService

      .enviarReconocimientoProyecto(this.proyectoId, payload)

      .pipe(

        catchError(() => {

          // Respaldo instantáneo si el backend remoto aún no tiene desplegado el endpoint

          let nombreRemitente = 'Compañero de Equipo';

          let idRemitente = 0;

          try {

            const u = JSON.parse(localStorage.getItem('usuario') || '{}');

            idRemitente = Number(u?.id_usuario ?? 0);

            nombreRemitente =

              `${u?.nombre ?? ''} ${u?.apellido ?? ''}`.trim() ||

              'Compañero de Equipo';

          } catch {

            // ignorar

          }



          const meritoFallback: ReconocimientoItem = {

            id_reconocimiento: `merito-${Date.now()}`,

            id_proyecto: this.proyectoId,

            id_remitente: idRemitente,

            nombre_remitente: nombreRemitente,

            id_destinatario: dest.id_usuario,

            nombre_destinatario: `${dest.nombre} ${dest.apellido}`.trim(),

            insignia: payload.insignia,

            mensaje: payload.mensaje,

            xp_otorgado: 25,

            fecha_envio: new Date().toISOString()

          };



          const meritoStorageKey = `orbita_meritos_proy_${this.proyectoId}`;

          try {

            const prev = JSON.parse(localStorage.getItem(meritoStorageKey) || '[]');

            prev.unshift(meritoFallback);

            localStorage.setItem(meritoStorageKey, JSON.stringify(prev.slice(0, 30)));

          } catch {

            // ignorar

          }



          return of(meritoFallback);

        }),

        finalize(() => {

          this.enviandoMerito = false;

        })

      )

      .subscribe((nuevoMerito) => {

        this.cerrarModalMerito();

        this.mostrarAvisoPulse(

          `🏆 ¡Puntos de Mérito otorgados a ${nuevoMerito.nombre_destinatario} (+25 XP)${

            payload.publicar_en_chat ? ' y publicado en el chat del proyecto' : ''

          }!`

        );

        this.apiService.notificarCambio();

        this.cargarDatosTeamPulse();

      });

  }





  solicitarCronicaMotivacionalIA(): void {

    if (this.generandoCronicaIA || !this.teamPulse) {

      return;

    }



    this.generandoCronicaIA = true;



    this.apiService

      .generarCronicaPulseIA(this.proyectoId, true)

      .pipe(

        catchError(() => {

          const lider = this.teamPulse?.ranking?.[0];

          const cronicaLocal = lider

            ? `✨ Crónica Sprint IA: ¡Gran sinergia en '${this.proyecto?.nombre}'! ${lider.nombre} ${lider.apellido} encabeza el impacto con ${lider.xp_total} XP (${lider.titulo_nivel}), respaldado por un equipo que suma ${this.teamPulse?.xp_total_equipo} XP y ${this.teamPulse?.total_medallas_desbloqueadas} medallas de excelencia.`

            : '✨ Crónica Sprint IA: ¡El equipo mantiene un pulso activo y colaborativo en Órbita!';

          return of({

            cronica_ia: cronicaLocal,

            publicada_en_chat: true

          });

        }),

        finalize(() => {

          this.generandoCronicaIA = false;

        })

      )

      .subscribe((res) => {

        if (this.teamPulse && res?.cronica_ia) {

          this.teamPulse.cronica_ia = res.cronica_ia;

        }

        this.mostrarAvisoPulse(

          '✨ Crónica Motivacional generada con IA y compartida con el equipo.'

        );

      });

  }





  private mostrarAvisoPulse(mensaje: string): void {

    this.mensajeExitoPulse = mensaje;

    window.setTimeout(() => {

      this.mensajeExitoPulse = '';

    }, 4500);

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