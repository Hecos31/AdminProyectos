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
  finalize
} from 'rxjs';

import {
  ApiServicio
} from '../Servicios/api.servicio';

import {
  ConfirmacionService
} from '../Servicios/confirmacion.service';


interface OpcionConfiguracion {
  id: 'integrantes' | 'eliminar';
  nombre: string;
  descripcion: string;
  peligroso: boolean;
}


@Component({
  selector: 'app-menu-configuracion',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './menuconfiguracion.html',
  styleUrls: ['./menuconfiguracion.css']
})
export class MenuConfiguracionComponente
  implements OnInit {

  private route =
    inject(ActivatedRoute);

  private router =
    inject(Router);

  private apiService =
    inject(ApiServicio);

  private confirmacionService =
    inject(ConfirmacionService);


  proyectoId: number | null = null;
  proyectoNombre = '';

  cargandoProyecto = false;
  eliminandoProyecto = false;

  errorMessage = '';


  opciones: OpcionConfiguracion[] = [
    {
      id: 'integrantes',
      nombre: 'Gestión de Integrantes',
      descripcion:
        'Agregar, remover o cambiar el rol de los colaboradores del proyecto.',
      peligroso: false
    },
    {
      id: 'eliminar',
      nombre: 'Eliminar Proyecto',
      descripcion:
        'Borrar permanentemente este proyecto y todas sus tareas asociadas.',
      peligroso: true
    }
  ];


  ngOnInit(): void {
    const idRecibido = Number(
      this.route.snapshot.paramMap.get('id')
    );

    if (
      !Number.isInteger(idRecibido) ||
      idRecibido <= 0
    ) {
      this.errorMessage =
        'No fue posible identificar el proyecto.';

      return;
    }

    this.proyectoId = idRecibido;

    this.cargarNombreProyecto();
  }


  cargarNombreProyecto(): void {
    if (!this.proyectoId) {
      return;
    }

    this.cargandoProyecto = true;
    this.errorMessage = '';

    this.apiService
      .obtenerProyecto(this.proyectoId)
      .pipe(
        finalize(() => {
          this.cargandoProyecto = false;
        })
      )
      .subscribe({
        next: (proyecto: any) => {
          this.proyectoNombre = String(
            proyecto?.nombre ??
            proyecto?.nombre_proyecto ??
            ''
          ).trim();

          if (!this.proyectoNombre) {
            this.proyectoNombre =
              `Proyecto #${this.proyectoId}`;
          }
        },

        error: (error) => {
          console.error(
            'Error cargando el proyecto:',
            error
          );

          this.errorMessage =
            'No fue posible cargar la información del proyecto.';
        }
      });
  }


  async irAOpcion(
    opcion: OpcionConfiguracion
  ): Promise<void> {
    if (opcion.id === 'integrantes') {
      this.irAIntegrantes();
      return;
    }

    if (opcion.id === 'eliminar') {
      await this.solicitarEliminarProyecto();
    }
  }


  private irAIntegrantes(): void {
    if (!this.proyectoId) {
      return;
    }

    this.router.navigate([
      '/proyecto',
      this.proyectoId,
      'integrantes'
    ]);
  }


  private async solicitarEliminarProyecto():
    Promise<void> {

    if (
      !this.proyectoId ||
      !this.proyectoNombre ||
      this.eliminandoProyecto
    ) {
      return;
    }

    const nombreProyecto =
      this.proyectoNombre.trim();

    const confirmado =
      await this.confirmacionService
        .solicitar({
          titulo:
            'Eliminar proyecto',

          mensaje:
            `Estás a punto de eliminar permanentemente el proyecto "${nombreProyecto}".`,

          detalle:
            'También se eliminarán sus actividades, comentarios, evidencias, integrantes y demás información relacionada. Esta acción no se puede deshacer.',

          tipo:
            'danger',

          textoConfirmacion:
            nombreProyecto,

          placeholderConfirmacion:
            nombreProyecto,

          textoBotonConfirmar:
            'Eliminar proyecto',

          textoBotonCancelar:
            'Conservar proyecto',

          ignorarMayusculas:
            false
        });

    if (!confirmado) {
      return;
    }

    this.ejecutarEliminacionProyecto();
  }


  private ejecutarEliminacionProyecto(): void {
    if (
      !this.proyectoId ||
      this.eliminandoProyecto
    ) {
      return;
    }

    const idProyecto = this.proyectoId;

    this.eliminandoProyecto = true;
    this.errorMessage = '';

    this.apiService
      .eliminarProyecto(idProyecto)
      .pipe(
        finalize(() => {
          this.eliminandoProyecto = false;
        })
      )
      .subscribe({
        next: () => {
          this.apiService.notificarCambio();

          this.router.navigate(
            ['/inicio'],
            {
              replaceUrl: true
            }
          );
        },

        error: (error) => {
          console.error(
            'Error eliminando el proyecto:',
            error
          );

          this.errorMessage =
            this.obtenerMensajeError(
              error,
              'No fue posible eliminar el proyecto.'
            );
        }
      });
  }


  private obtenerMensajeError(
    error: any,
    mensajePredeterminado: string
  ): string {
    const detalle =
      error?.error?.detail;

    if (typeof detalle === 'string') {
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
}