import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  proyectoId: number = 0;
  proyecto: any = null;
  cargando = true;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiServicio,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    console.log('📌 Proyecto ID principal:', this.proyectoId);
    this.cargarProyecto();
  }

  cargarProyecto() {
    this.cargando = true;
    this.apiService.obtenerProyecto(this.proyectoId).subscribe({
      next: (data) => {
        console.log('Proyecto:', data);
        this.proyecto = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error:', error);
        this.errorMessage = 'Error al cargar el proyecto';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  irAConfiguracion() {
    this.router.navigate([`/proyecto/${this.proyectoId}/configuracion/opcion`]);
  }

  irACalendario() {
    this.router.navigate([`/proyecto/${this.proyectoId}/calendario`]);
  }

  volverAInicio() {
    this.router.navigate(['/inicio']);
  }
}