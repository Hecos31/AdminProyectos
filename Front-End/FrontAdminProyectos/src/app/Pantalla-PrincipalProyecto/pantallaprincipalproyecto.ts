// === IMPORTACIONES ===
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-pantalla-principal-proyecto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pantallaprincipalproyecto.html',
  styleUrls: ['./pantallaprincipalproyecto.css']
})
export class PantallaPrincipalProyectoComponente implements OnInit {
  // === INYECCIÓN DE DEPENDENCIAS ===
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiServicio);
  private cdr = inject(ChangeDetectorRef);

  // === ESTADO DEL COMPONENTE ===
  proyectoId: number = 0;
  proyecto: any = null;
  cargando = true;
  errorMessage = '';

  // === CICLO DE VIDA ===
  ngOnInit() {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    this.cargarProyecto();
  }

  // === PETICIONES HTTP ===
  cargarProyecto() {
    this.cargando = true;
    this.apiService.obtenerProyecto(this.proyectoId).subscribe({
      next: (data) => {
        this.proyecto = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar la información del proyecto.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  // === NAVEGACIÓN ===
  irAConfiguracion() {
    this.router.navigate([`/proyecto/${this.proyectoId}/configuracion`]);
  }

  irACalendario() {
    this.router.navigate([`/proyecto/${this.proyectoId}/calendario`]);
  }

  volverAInicio() {
    this.router.navigate(['/inicio']);
  }
}