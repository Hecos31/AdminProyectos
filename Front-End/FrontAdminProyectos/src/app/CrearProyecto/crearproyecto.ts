import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-crear-proyecto',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './crearproyecto.html',
  styleUrls: ['./crearproyecto.css']
})
export class CrearProyectoComponente {
  proyecto = {
    nombre: '',
    descripcion: '',
    fecha_inicio: '',
    fecha_fin: '',
    estado: 'Activo'
  };
  errorMessage = '';
  successMessage = '';
  cargando = false;

  constructor(
    private apiService: ApiServicio,
    private router: Router
  ) {}

  onSubmit() {
    if (!this.proyecto.nombre) {
      this.errorMessage = 'El nombre del proyecto es obligatorio';
      return;
    }

    this.cargando = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Construir el objeto para enviar al backend
    const proyectoData: any = {
      nombre: this.proyecto.nombre,
      estado: this.proyecto.estado
    };

    // Solo agregar si tienen valor
    if (this.proyecto.descripcion) {
      proyectoData.descripcion = this.proyecto.descripcion;
    }
    if (this.proyecto.fecha_inicio) {
      proyectoData.fecha_inicio = this.proyecto.fecha_inicio;
    }
    if (this.proyecto.fecha_fin) {
      proyectoData.fecha_fin = this.proyecto.fecha_fin;
    }

    console.log('📤 Enviando proyecto:', proyectoData);

    this.apiService.crearProyecto(proyectoData).subscribe({
      next: (response) => {
        console.log('Proyecto creado:', response);
        this.successMessage = 'Proyecto creado exitosamente';
        this.cargando = false;
        setTimeout(() => {
          this.router.navigate(['/inicio']);
        }, 1500);
      },
      error: (error) => {
        console.error('Error:', error);
        this.errorMessage = error.error?.detail || 'Error al crear proyecto';
        this.cargando = false;
      }
    });
  }

  cancelar() {
    this.router.navigate(['/inicio']);
  }
}