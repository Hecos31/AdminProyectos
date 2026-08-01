import {
  ChangeDetectorRef,
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
  finalize
} from 'rxjs';

import {
  ApiServicio
} from '../Servicios/api.servicio';

import {
  ConfirmacionService
} from '../Servicios/confirmacion.service';


interface ColaboradorProyecto {
  id_usuario: number;
  id_rol: number;

  nombre?: string;
  apellido?: string;
  correo?: string;

  rol_nombre?: string;

  usuario?: {
    id_usuario?: number;
    nombre?: string;
    apellido?: string;
    correo?: string;
  };
}


@Component({
  selector:
    'app-pantalla-configuracion-proyecto',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl:
    './pantallaconfiguracion.html',

  styleUrls: [
    './pantallaconfiguracion.css'
  ]
})
export class PantallaConfiguracionComponente
  implements OnInit {

  private route =
    inject(ActivatedRoute);

  private router =
    inject(Router);

  private apiService =
    inject(ApiServicio);

  private confirmacionService =
    inject(ConfirmacionService);

  private cdr =
    inject(ChangeDetectorRef);


  proyectoId = 0;

  proyecto: any = null;

  colaboradores:
    ColaboradorProyecto[] = [];


  nuevoColaborador = {
    correo: '',
    rol: 'colaborador'
  };


  cargando = true;

  agregandoColaborador = false;

  eliminandoColaboradorId:
    number | null = null;

  cambiandoRolUsuarioId:
    number | null = null;


  errorMessage = '';
  successMessage = '';


  readonly rolesMap: Record<
    string,
    number
  > = {
    colaborador: 2,
    admin: 1
  };


  readonly rolesInvertidos: Record<
    number,
    string
  > = {
    1: 'admin',
    2: 'colaborador'
  };


  ngOnInit(): void {
    const idProyecto = Number(
      this.route.snapshot.paramMap.get('id')
    );

    if (
      !Number.isInteger(idProyecto) ||
      idProyecto <= 0
    ) {
      this.cargando = false;

      this.mostrarError(
        'No fue posible identificar el proyecto.'
      );

      return;
    }

    this.proyectoId = idProyecto;

    this.cargarDatos();
  }


  // =========================================================
  // LECTURA
  // =========================================================

  cargarDatos(): void {
    this.cargando = true;
    this.errorMessage = '';

    this.apiService
      .obtenerProyecto(
        this.proyectoId
      )
      .subscribe({
        next: (proyecto) => {
          this.proyecto = proyecto;

          this.cargarColaboradores();
        },

        error: (error) => {
          this.cargando = false;

          this.mostrarError(
            this.obtenerMensajeError(
              error,
              'No fue posible cargar el proyecto.'
            )
          );

          this.cdr.detectChanges();
        }
      });
  }


  cargarColaboradores(): void {
    this.apiService
      .obtenerColaboradores(
        this.proyectoId
      )
      .subscribe({
        next: (data) => {
          const lista =
            Array.isArray(data)
              ? data
              : Array.isArray(
                    (data as any)?.colaboradores
                  )
                ? (data as any).colaboradores
                : [];

          this.colaboradores = lista
  .map(
    (
      colaborador: any
    ): ColaboradorProyecto => {
      const usuario =
        colaborador?.usuario ??
        colaborador;

      const idUsuario = Number(
        colaborador?.id_usuario ??
        usuario?.id_usuario
      );

      const idRol = Number(
        colaborador?.id_rol ??
        colaborador?.rol?.id_rol ??
        2
      );

      return {
        id_usuario: idUsuario,
        id_rol: idRol,

        nombre:
          usuario?.nombre ??
          colaborador?.nombre ??
          '',

        apellido:
          usuario?.apellido ??
          colaborador?.apellido ??
          '',

        correo:
          usuario?.correo ??
          colaborador?.correo ??
          '',

        rol_nombre:
          this.rolesInvertidos[idRol] ??
          'colaborador',

        usuario:
          colaborador?.usuario
      };
    }
  )
  .filter(
    (
      colaborador: ColaboradorProyecto
    ): boolean =>
      Number.isInteger(
        colaborador.id_usuario
      ) &&
      colaborador.id_usuario > 0
  );

          this.cargando = false;
          this.cdr.detectChanges();
        },

        error: (error) => {
          this.colaboradores = [];
          this.cargando = false;

          this.mostrarError(
            this.obtenerMensajeError(
              error,
              'No fue posible cargar los integrantes.'
            )
          );

          this.cdr.detectChanges();
        }
      });
  }


  // =========================================================
  // AGREGAR COLABORADOR
  // =========================================================

  agregarColaborador(): void {
    const correo =
      this.nuevoColaborador
        .correo
        .trim();

    if (!correo) {
      this.mostrarError(
        'Ingresa un correo válido.'
      );

      return;
    }

    if (this.agregandoColaborador) {
      return;
    }

    const datos = {
      id_proyecto:
        this.proyectoId,

      correo_colaborador:
        correo,

      id_rol:
        this.rolesMap[
          this.nuevoColaborador.rol
        ] ?? 2
    };

    this.agregandoColaborador = true;
    this.limpiarMensajes();

    this.apiService
      .agregarColaborador(datos)
      .pipe(
        finalize(() => {
          this.agregandoColaborador =
            false;

          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.mostrarExito(
            'Colaborador agregado exitosamente.'
          );

          this.nuevoColaborador = {
            correo: '',
            rol: 'colaborador'
          };

          this.cargarColaboradores();
        },

        error: (error) => {
          this.mostrarError(
            this.obtenerMensajeError(
              error,
              'No fue posible agregar al colaborador.'
            )
          );
        }
      });
  }


  // =========================================================
  // ELIMINAR COLABORADOR
  // =========================================================

  async eliminarColaborador(
    idUsuario: number
  ): Promise<void> {
    if (
      this.eliminandoColaboradorId !==
        null ||
      !Number.isInteger(idUsuario) ||
      idUsuario <= 0
    ) {
      return;
    }

    const colaborador =
      this.colaboradores.find(
        (item) =>
          item.id_usuario ===
          idUsuario
      );

    const nombre =
      this.obtenerNombreColaborador(
        colaborador
      );

    const correo =
      colaborador?.correo ??
      colaborador?.usuario?.correo ??
      '';

    const confirmado =
      await this.confirmacionService
        .solicitar({
          titulo:
            'Eliminar integrante',

          mensaje:
            `¿Deseas eliminar a ${nombre} del proyecto?`,

          detalle:
            correo
              ? `${correo} dejará de tener acceso al proyecto y a sus actividades.`
              : 'El usuario dejará de tener acceso al proyecto y a sus actividades.',

          tipo:
            'danger',

          textoBotonConfirmar:
            'Eliminar integrante',

          textoBotonCancelar:
            'Conservar integrante'
        });

    if (!confirmado) {
      return;
    }

    this.ejecutarEliminacionColaborador(
      idUsuario
    );
  }


  private ejecutarEliminacionColaborador(
    idUsuario: number
  ): void {
    this.eliminandoColaboradorId =
      idUsuario;

    this.limpiarMensajes();

    this.apiService
      .eliminarColaborador({
        id_proyecto:
          this.proyectoId,

        id_usuario:
          idUsuario
      })
      .pipe(
        finalize(() => {
          this.eliminandoColaboradorId =
            null;

          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.colaboradores =
            this.colaboradores.filter(
              (colaborador) =>
                colaborador.id_usuario !==
                idUsuario
            );

          this.mostrarExito(
            'Colaborador eliminado exitosamente.'
          );

          this.apiService
            .notificarCambio();

          this.cdr.detectChanges();
        },

        error: (error) => {
          this.mostrarError(
            this.obtenerMensajeError(
              error,
              'No fue posible eliminar al colaborador.'
            )
          );
        }
      });
  }


  // =========================================================
  // CAMBIAR ROL
  // =========================================================

  cambiarRol(
    idUsuario: number,
    nuevoRol: string
  ): void {
    if (
      this.cambiandoRolUsuarioId !==
        null ||
      !Number.isInteger(idUsuario) ||
      idUsuario <= 0
    ) {
      return;
    }

    const idRolNuevo =
      this.rolesMap[nuevoRol];

    if (!idRolNuevo) {
      this.mostrarError(
        'El rol seleccionado no es válido.'
      );

      return;
    }

    this.cambiandoRolUsuarioId =
      idUsuario;

    this.limpiarMensajes();

    this.apiService
      .cambiarRolColaborador({
        id_proyecto:
          this.proyectoId,

        id_usuario:
          idUsuario,

        id_rol_nuevo:
          idRolNuevo
      })
      .pipe(
        finalize(() => {
          this.cambiandoRolUsuarioId =
            null;

          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          const colaborador =
            this.colaboradores.find(
              (item) =>
                item.id_usuario ===
                idUsuario
            );

          if (colaborador) {
            colaborador.id_rol =
              idRolNuevo;

            colaborador.rol_nombre =
              nuevoRol;
          }

          this.mostrarExito(
            'Rol actualizado correctamente.'
          );

          this.apiService
            .notificarCambio();

          this.cdr.detectChanges();
        },

        error: (error) => {
          this.mostrarError(
            this.obtenerMensajeError(
              error,
              'No fue posible cambiar el rol del colaborador.'
            )
          );

          /*
           * Recupera el rol real del backend si el
           * select ya cambió visualmente.
           */
          this.cargarColaboradores();
        }
      });
  }


  // =========================================================
  // UTILIDADES
  // =========================================================

  private obtenerNombreColaborador(
    colaborador:
      ColaboradorProyecto |
      undefined
  ): string {
    if (!colaborador) {
      return 'este integrante';
    }

    const nombre =
      colaborador.nombre ??
      colaborador.usuario?.nombre ??
      '';

    const apellido =
      colaborador.apellido ??
      colaborador.usuario?.apellido ??
      '';

    const nombreCompleto =
      `${nombre} ${apellido}`.trim();

    return (
      nombreCompleto ||
      colaborador.correo ||
      colaborador.usuario?.correo ||
      'este integrante'
    );
  }


  private limpiarMensajes(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }


  mostrarError(
    mensaje: string
  ): void {
    this.errorMessage = mensaje;
    this.successMessage = '';

    window.setTimeout(() => {
      if (
        this.errorMessage === mensaje
      ) {
        this.errorMessage = '';
        this.cdr.detectChanges();
      }
    }, 4000);
  }


  mostrarExito(
    mensaje: string
  ): void {
    this.successMessage = mensaje;
    this.errorMessage = '';

    window.setTimeout(() => {
      if (
        this.successMessage === mensaje
      ) {
        this.successMessage = '';
        this.cdr.detectChanges();
      }
    }, 4000);
  }


  private obtenerMensajeError(
    error: any,
    mensajePredeterminado: string
  ): string {
    const detalle =
      error?.error?.detail;

    if (
      typeof detalle === 'string'
    ) {
      return detalle;
    }

    if (Array.isArray(detalle)) {
      return detalle
        .map(
          (item: any) =>
            item?.msg ??
            'Dato no válido'
        )
        .join('. ');
    }

    return mensajePredeterminado;
  }


  volverAlProyecto(): void {
    this.router.navigate([
      '/proyecto',
      this.proyectoId
    ]);
  }


  trackColaborador(
    _index: number,
    colaborador:
      ColaboradorProyecto
  ): number {
    return colaborador.id_usuario;
  }
}