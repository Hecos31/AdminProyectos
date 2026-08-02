import {
  ChangeDetectorRef,
  Component,
  inject
} from '@angular/core';

import {
  Router,
  RouterLink
} from '@angular/router';

import {
  FormsModule
} from '@angular/forms';

import {
  CommonModule
} from '@angular/common';

import {
  finalize
} from 'rxjs';

import {
  ApiServicio
} from '../Servicios/api.servicio';


@Component({
  selector: 'app-login',
  standalone: true,

  imports: [
    FormsModule,
    CommonModule,
    RouterLink
  ],

  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponente {
  private apiService =
    inject(ApiServicio);

  private router =
    inject(Router);

  private cdr =
    inject(ChangeDetectorRef);


  credentials = {
    correo: '',
    password: ''
  };

  errorMessage = '';
  cargando = false;


  onSubmit(): void {
    if (this.cargando) {
      return;
    }

    const correo =
      this.credentials.correo
        .trim()
        .toLowerCase();

    const password =
      this.credentials.password;

    this.errorMessage = '';

    if (!correo && !password) {
      this.errorMessage =
        'Ingresa tu correo y contraseña.';

      return;
    }

    if (!correo) {
      this.errorMessage =
        'Ingresa tu correo electrónico.';

      return;
    }

    if (!this.esCorreoValido(correo)) {
      this.errorMessage =
        'Ingresa un correo electrónico válido.';

      return;
    }

    if (!password) {
      this.errorMessage =
        'Ingresa tu contraseña.';

      return;
    }

    this.cargando = true;

    const credentials = {
      correo,
      password
    };

    this.apiService
      .login(credentials)
      .pipe(
        finalize(() => {
          this.cargando = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (!response?.access_token) {
            this.errorMessage =
              'El servidor no devolvió un token válido.';

            return;
          }

          localStorage.setItem(
            'token',
            response.access_token
          );

          /*
           * Actualiza localStorage y el estado global
           * usado por el sidebar y otros componentes.
           */
          this.apiService
            .actualizarSesionUsuario(
              response?.usuario ?? null
            );

          this.router.navigate(
            ['/inicio'],
            {
              replaceUrl: true
            }
          );
        },

        error: (error) => {
          this.errorMessage =
            this.obtenerMensajeError(error);
        }
      });
  }


  private esCorreoValido(
    correo: string
  ): boolean {
    /*
     * Comprueba una estructura básica:
     * usuario@dominio.extension
     *
     * Evita casos como:
     * fdg@f.
     * fdg@f
     * @dominio.com
     */
    const expresionCorreo =
      /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

    return expresionCorreo.test(correo);
  }


  private obtenerMensajeError(
    error: any
  ): string {
    const detalle =
      error?.error?.detail;

    /*
     * FastAPI devuelve un arreglo cuando la
     * validación de Pydantic falla con error 422.
     */
    if (Array.isArray(detalle)) {
      const esErrorDeCorreo =
        detalle.some(
          (item: any) => {
            const mensaje = String(
              item?.msg ?? ''
            ).toLowerCase();

            const ubicacion =
              Array.isArray(item?.loc)
                ? item.loc
                    .map(
                      (valor: unknown) =>
                        String(valor)
                          .toLowerCase()
                    )
                : [];

            return (
              mensaje.includes('email') ||
              mensaje.includes(
                'email address'
              ) ||
              ubicacion.includes('correo')
            );
          }
        );

      if (esErrorDeCorreo) {
        return 'Ingresa un correo electrónico válido.';
      }

      const mensajes =
        detalle
          .map(
            (item: any) =>
              this.traducirMensajeValidacion(
                item?.msg
              )
          )
          .filter(
            (mensaje: string) =>
              Boolean(mensaje)
          );

      return (
        mensajes.join('. ') ||
        'Los datos ingresados no son válidos.'
      );
    }

    /*
     * Respuestas normales del backend:
     * detail: "Credenciales incorrectas"
     */
    if (typeof detalle === 'string') {
      return detalle;
    }

    /*
     * Algunos backends pueden devolver:
     * detail: { message: "..." }
     */
    if (
      detalle &&
      typeof detalle === 'object'
    ) {
      if (
        typeof detalle.message ===
        'string'
      ) {
        return detalle.message;
      }

      if (
        typeof detalle.msg ===
        'string'
      ) {
        return this
          .traducirMensajeValidacion(
            detalle.msg
          );
      }
    }

    if (
      typeof error?.error?.message ===
      'string'
    ) {
      return error.error.message;
    }

    if (error?.status === 0) {
      return 'No fue posible conectar con el servidor.';
    }

    if (error?.status === 401) {
      return 'Credenciales incorrectas.';
    }

    if (error?.status === 422) {
      return 'Los datos ingresados no son válidos.';
    }

    if (error?.status >= 500) {
      return 'Ocurrió un error en el servidor. Inténtalo nuevamente.';
    }

    return 'Error al iniciar sesión.';
  }


  private traducirMensajeValidacion(
    mensaje: unknown
  ): string {
    const texto =
      String(mensaje ?? '')
        .trim();

    const textoNormalizado =
      texto.toLowerCase();

    if (!texto) {
      return '';
    }

    if (
      textoNormalizado.includes(
        'email address'
      ) ||
      textoNormalizado.includes(
        'valid email'
      )
    ) {
      return 'Ingresa un correo electrónico válido';
    }

    if (
      textoNormalizado.includes(
        'field required'
      )
    ) {
      return 'Falta completar un campo obligatorio';
    }

    if (
      textoNormalizado.includes(
        'input should be a valid string'
      )
    ) {
      return 'Uno de los datos ingresados no es válido';
    }

    return texto;
  }
}