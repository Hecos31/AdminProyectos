import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { ApiServicio } from '../Servicios/api.servicio'; 

@Component({
  selector: 'app-navbar-proyecto',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar-proyecto.html',
  styleUrls: ['./navbar-proyecto.css']
})
export class NavbarProyecto implements OnInit {
  private router = inject(Router);
  private apiService = inject(ApiServicio);
  private cdr = inject(ChangeDetectorRef);

  modoProyecto: boolean = false;
  proyectoActivoId: string | null = null;
  rolUsuario: string = 'colaborador'; 
  usuarioLogueado: any = null;

  ngOnInit() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.procesarUrl(event.urlAfterRedirects);
    });

    this.procesarUrl(this.router.url);
  }

  private procesarUrl(url: string) {
    const urlLimpia = url.split('?')[0]; 

    // === SOLUCIÓN: Leer SIEMPRE el usuario actual de localStorage al navegar ===
    // Así nos aseguramos de tenerlo incluso si el componente se inicializó en el login
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      try {
        this.usuarioLogueado = JSON.parse(usuarioStr);
      } catch (e) {
        this.usuarioLogueado = null;
      }
    }

    if (urlLimpia.includes('/proyecto/')) {
      this.modoProyecto = true;
      const segmentos = urlLimpia.split('/');
      const indexProyecto = segmentos.indexOf('proyecto');
      
      if (indexProyecto !== -1 && segmentos[indexProyecto + 1]) {
        const nuevoId = segmentos[indexProyecto + 1];

        if (nuevoId !== this.proyectoActivoId) {
          this.proyectoActivoId = nuevoId;
          // Mostramos la barra base al instante
          this.cdr.detectChanges(); 
          // Disparamos la validación de rol
          this.verificarRolEnProyecto(Number(this.proyectoActivoId));
        }
      }
    } else {
      // Si salimos del proyecto (ej. regresamos a Inicio) ocultamos la barra al instante
      this.modoProyecto = false;
      this.proyectoActivoId = null;
      this.cdr.detectChanges(); 
    }
  }

  private verificarRolEnProyecto(idProyecto: number) {
    if (!this.usuarioLogueado) return;

    this.apiService.obtenerColaboradores(idProyecto).subscribe({
      next: (colaboradores: any[]) => {
        const miPerfil = colaboradores.find(c => 
          c.id_usuario === this.usuarioLogueado.id_usuario || 
          c.correo === this.usuarioLogueado.correo
        );

        if (miPerfil) {
          if (miPerfil.id_rol === 1) {
            this.rolUsuario = 'admin';
          } else if (miPerfil.id_rol === 3) {
            this.rolUsuario = 'editor';
          } else {
            this.rolUsuario = 'colaborador';
          }
        } else {
          this.rolUsuario = 'colaborador';
        }
        
        // Forzar actualización visual con las nuevas pestañas
        this.cdr.detectChanges(); 
      },
      error: (err) => {
        console.error('Error al verificar el rol del usuario:', err);
        this.rolUsuario = 'colaborador'; 
        this.cdr.detectChanges();
      }
    });
  }
}