import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormsModule,
  NgForm
} from '@angular/forms';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import {
  finalize
} from 'rxjs';

import {
  ApiServicio,
  EstadoProyectoApi,
  ProyectoUpdatePayload
} from '../Servicios/api.servicio';


interface FormularioProyecto {
  nombre: string;
  descripcion: string;
  estado: EstadoProyectoApi;
}


@Component({
  selector: 'app-editar-proyecto',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './editarproyecto.html',
  styleUrls: ['./editarproyecto.css']
})
export class EditarProyectoComponente
  implements OnInit {

  private route =
    inject(ActivatedRoute);

  private router =
    inject(Router);

  private apiService =
    inject(ApiServicio);


  proyectoId: number | null = null;

  formulario: FormularioProyecto = {
    nombre: '',
    descripcion: '',
    estado: 'Activo'
  };

  private valoresIniciales = '';

  cargando = true;
  guardando = false;

  errorMessage = '';
  successMessage = '';


  get caracteresDescripcion(): number {
    return this.formulario.descripcion.length;
  }


  get tieneCambios(): boolean {
    return (
      this.obtenerFirmaFormulario() !==
      this.valoresIniciales
    );
  }


  ngOnInit(): void {
    const idRecibido = Number(
      this.route.snapshot.paramMap.get('id')
    );

    if (
      !Number.isInteger(idRecibido) ||
      idRecibido <= 0
    ) {
      this.cargando = false;

      this.errorMessage =
        'No fue posible identificar el proyecto.';

      return;
    }

    this.proyectoId = idRecibido;

    this.cargarProyecto();
  }


  cargarProyecto(): void {
    if (!this.proyectoId) {
      return;
    }

    this.cargando = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.apiService
      .obtenerProyecto(this.proyectoId)
      .pipe(
        finalize(() => {
          this.cargando = false;
        })
      )
      .subscribe({
        next: (proyecto) => {
          const estadoRecibido =
            String(
              proyecto?.estado ?? 'Activo'
            ).trim();

          this.formulario = {
            nombre:
              String(
                proyecto?.nombre ??
                proyecto?.nombre_proyecto ??
                ''
              ).trim(),

            descripcion:
              String(
                proyecto?.descripcion ?? ''
              ),

            estado:
              estadoRecibido === 'Inactivo'
                ? 'Inactivo'
                : 'Activo'
          };

          this.valoresIniciales =
            this.obtenerFirmaFormulario();
        },

        error: (error) => {
          console.error(
            'Error cargando el proyecto:',
            error
          );

          this.errorMessage =
            this.obtenerMensajeError(
              error,
              'No fue posible cargar la información del proyecto.'
            );
        }
      });
  }


  guardarCambios(
    formularioProyecto: NgForm
  ): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (
      formularioProyecto.invalid ||
      !this.proyectoId ||
      this.guardando
    ) {
      formularioProyecto.control
        .markAllAsTouched();

      if (!this.proyectoId) {
        this.errorMessage =
          'No fue posible identificar el proyecto.';
      }

      return;
    }

    const nombre =
      this.formulario.nombre.trim();

    const descripcion =
      this.formulario.descripcion.trim();

    if (nombre.length < 3) {
      this.errorMessage =
        'El nombre debe contener al menos 3 caracteres.';

      return;
    }

    if (!this.tieneCambios) {
      this.successMessage =
        'No hay cambios pendientes por guardar.';

      return;
    }

    const datos: ProyectoUpdatePayload = {
      nombre,
      descripcion:
        descripcion.length > 0
          ? descripcion
          : null,
      estado:
        this.formulario.estado
    };

    this.guardando = true;

    this.apiService
      .editarProyecto(
        this.proyectoId,
        datos
      )
      .pipe(
        finalize(() => {
          this.guardando = false;
        })
      )
      .subscribe({
        next: (proyectoActualizado) => {
          this.formulario = {
            nombre:
              String(
                proyectoActualizado?.nombre ??
                nombre
              ).trim(),

            descripcion:
              String(
                proyectoActualizado?.descripcion ??
                descripcion
              ),

            estado:
              proyectoActualizado?.estado ===
              'Inactivo'
                ? 'Inactivo'
                : 'Activo'
          };

          this.valoresIniciales =
            this.obtenerFirmaFormulario();

          this.successMessage =
            'Los datos del proyecto se actualizaron correctamente.';

          this.apiService.notificarCambio();
        },

        error: (error) => {
          console.error(
            'Error actualizando el proyecto:',
            error
          );

          this.errorMessage =
            this.obtenerMensajeError(
              error,
              'No fue posible guardar los cambios del proyecto.'
            );
        }
      });
  }


  seleccionarEstado(
    estado: EstadoProyectoApi
  ): void {
    if (this.guardando) {
      return;
    }

    this.formulario.estado = estado;
    this.successMessage = '';
  }


  cancelar(): void {
    if (!this.proyectoId) {
      this.router.navigate(['/inicio']);
      return;
    }

    this.router.navigate([
      '/proyecto',
      this.proyectoId,
      'configuracion'
    ]);
  }


  private obtenerFirmaFormulario(): string {
    return JSON.stringify({
      nombre:
        this.formulario.nombre.trim(),

      descripcion:
        this.formulario.descripcion.trim(),

      estado:
        this.formulario.estado
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
