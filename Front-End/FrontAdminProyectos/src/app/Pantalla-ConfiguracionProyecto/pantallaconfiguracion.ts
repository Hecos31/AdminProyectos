import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiServicio } from '../Servicios/api.servicio';
import { MenuConfiguracionComponente } from '../MenuConfiguracion/menuconfiguracion';

@Component({
  selector: 'app-pantalla-configuracion-proyecto',
  standalone: true,
  imports: [CommonModule, FormsModule, MenuConfiguracionComponente],
  templateUrl: './pantallaconfiguracion.html',
  styleUrls: ['./pantallaconfiguracion.css']
})
export class PantallaConfiguracionComponente implements OnInit {
  proyectoId: string = '';
  proyecto: any = null;
  integrantes: any[] = [];
  nuevoIntegrante = {
    email: '',
    rol: 'colaborador'
  };
  cargando = true;
  errorMessage = '';
  successMessage = '';

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiServicio
  ) {}

  ngOnInit() {
    this.proyectoId = this.route.snapshot.params['id'];
    this.cargarDatos();
  }

  cargarDatos() {
    this.apiService.obtenerProyecto(this.proyectoId).subscribe({
      next: (proyecto) => {
        this.proyecto = proyecto;
        this.cargarIntegrantes();
      },
      error: (error) => {
        console.error('Error cargando proyecto:', error);
        this.cargando = false;
      }
    });
  }

  cargarIntegrantes() {
    this.apiService.obtenerIntegrantes(this.proyectoId).subscribe({
      next: (data) => {
        this.integrantes = data;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error cargando integrantes:', error);
        this.cargando = false;
      }
    });
  }

  agregarIntegrante() {
    if (!this.nuevoIntegrante.email) {
      this.errorMessage = 'Ingresa un email válido';
      return;
    }

    this.apiService.agregarIntegrante(this.proyectoId, this.nuevoIntegrante).subscribe({
      next: () => {
        this.successMessage = 'Integrante agregado exitosamente';
        this.nuevoIntegrante = { email: '', rol: 'colaborador' };
        this.cargarIntegrantes();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (error) => {
        this.errorMessage = error.error?.mensaje || 'Error al agregar integrante';
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  eliminarIntegrante(integranteId: string) {
    if (confirm('¿Estás seguro de eliminar este integrante?')) {
      this.apiService.eliminarIntegrante(this.proyectoId, integranteId).subscribe({
        next: () => {
          this.successMessage = 'Integrante eliminado';
          this.cargarIntegrantes();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (error) => {
          this.errorMessage = 'Error al eliminar integrante';
          setTimeout(() => this.errorMessage = '', 3000);
        }
      });
    }
  }
}