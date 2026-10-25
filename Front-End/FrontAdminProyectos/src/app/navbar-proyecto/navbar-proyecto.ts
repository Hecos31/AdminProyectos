import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';

import {
  NavigationEnd,
  Router,
  RouterModule
} from '@angular/router';

import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { filter } from 'rxjs/operators';

import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-navbar-proyecto',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ],
  templateUrl: './navbar-proyecto.html',
  styleUrls: ['./navbar-proyecto.css']
})
export class NavbarProyecto implements OnInit, OnDestroy {

  private readonly router = inject(Router);
  private readonly apiService = inject(ApiServicio);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly destroy$ = new Subject<void>();

  modoProyecto = false;
  proyectoActivoId: string | null = null;

  rolUsuario: 'admin' | 'editor' | 'colaborador' =
    'colaborador';

  usuarioLogueado: any = null;


  ngOnInit(): void {
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd =>
            event instanceof NavigationEnd
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.procesarUrl(event.urlAfterRedirects);
      });

    this.procesarUrl(this.router.url);
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  private procesarUrl(url: string): void {
    const urlLimpia = url.split(/[?#]/)[0];

    this.leerUsuarioActual();

    const segmentos = urlLimpia
      .split('/')
      .filter(Boolean);

    const indiceProyecto =
      segmentos.indexOf('proyecto');

    const nuevoProyectoId =
      indiceProyecto !== -1
        ? segmentos[indiceProyecto + 1]
        : null;

    if (!nuevoProyectoId) {
      this.salirDelModoProyecto();
      return;
    }

    this.modoProyecto = true;

    if (nuevoProyectoId === this.proyectoActivoId) {
      return;
    }

    /*
     * Reiniciamos el rol antes de consultar el nuevo proyecto.
     * Esto evita mostrar opciones de administrador que
     * correspondían al proyecto anterior.
     */
    this.proyectoActivoId = nuevoProyectoId;
    this.rolUsuario = 'colaborador';

    const idNumerico = Number(nuevoProyectoId);

    if (!Number.isFinite(idNumerico)) {
      this.rolUsuario = 'colaborador';
      this.cdr.detectChanges();
      return;
    }

    this.cdr.detectChanges();

    this.verificarRolEnProyecto(
      idNumerico,
      nuevoProyectoId
    );
  }


  private leerUsuarioActual(): void {
    try {
      const usuarioGuardado =
        localStorage.getItem('usuario');

      this.usuarioLogueado = usuarioGuardado
        ? JSON.parse(usuarioGuardado)
        : null;
    } catch (error) {
      console.error(
        'No fue posible leer el usuario guardado.',
        error
      );

      this.usuarioLogueado = null;
    }
  }


  private verificarRolEnProyecto(
    idProyecto: number,
    idProyectoRuta: string
  ): void {
    if (!this.usuarioLogueado) {
      this.rolUsuario = 'colaborador';
      this.cdr.detectChanges();
      return;
    }

    this.apiService
      .obtenerColaboradores(idProyecto)
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (colaboradores: any[]) => {
          /*
           * Si el usuario cambió de proyecto antes de que
           * respondiera la API, ignoramos la respuesta antigua.
           */
          if (
            this.proyectoActivoId !== idProyectoRuta
          ) {
            return;
          }

          const miPerfil = colaboradores.find(
            (colaborador) =>
              colaborador.id_usuario ===
                this.usuarioLogueado.id_usuario ||
              colaborador.correo ===
                this.usuarioLogueado.correo
          );

          const idRol = Number(miPerfil?.id_rol);

          if (idRol === 1) {
            this.rolUsuario = 'admin';
          } else if (idRol === 3) {
            this.rolUsuario = 'editor';
          } else {
            this.rolUsuario = 'colaborador';
          }

          this.cdr.detectChanges();
        },

        error: (error) => {
          if (
            this.proyectoActivoId !== idProyectoRuta
          ) {
            return;
          }

          console.error(
            'Error al verificar el rol del usuario:',
            error
          );

          this.rolUsuario = 'colaborador';
          this.cdr.detectChanges();
        }
      });
  }


  private salirDelModoProyecto(): void {
    this.modoProyecto = false;
    this.proyectoActivoId = null;
    this.rolUsuario = 'colaborador';

    this.cdr.detectChanges();
  }
}