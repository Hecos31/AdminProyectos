import {
  ChangeDetectorRef,
  Component,
  inject
} from '@angular/core';

import {
  Router,
  RouterLink
} from '@angular/router';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';

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
  private apiService = inject(ApiServicio);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

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

    const correo = this.credentials.correo.trim();
    const password = this.credentials.password;

    if (!correo || !password) {
      this.errorMessage =
        'Ingresa tu correo y contraseña.';

      return;
    }

    this.cargando = true;
    this.errorMessage = '';

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
           * Actualiza tanto localStorage como el estado global
           * utilizado por el sidebar y otros componentes.
           */
          this.apiService.actualizarSesionUsuario(
            response?.usuario ?? null
          );

          this.router.navigate(['/inicio']);
        },

        error: (error) => {
          this.errorMessage =
            error?.error?.detail ||
            'Error al iniciar sesión';
        }
      });
  }
}