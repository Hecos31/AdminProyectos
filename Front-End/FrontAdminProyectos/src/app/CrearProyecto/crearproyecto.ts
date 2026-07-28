import { Component, inject } from '@angular/core';
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
  private apiService = inject(ApiServicio);
  private router = inject(Router);

  // === ESTADO DEL PROYECTO ===
  proyecto = {
    nombre: '',
    descripcion: ''
  };

  // === GESTIÓN DE COLABORADORES INICIALES ===
  nuevoColaborador = { correo: '', rol: 'colaborador' };
  colaboradoresPendientes: { correo: string, rol: string }[] = [];
  rolesMap: any = { colaborador: 2, admin: 1 };

  errorMessage = '';
  successMessage = '';
  cargando = false;

  // Agregar a la lista temporal
  agregarColaboradorLista() {
    if (this.nuevoColaborador.correo.trim()) {
      this.colaboradoresPendientes.push({ ...this.nuevoColaborador });
      this.nuevoColaborador = { correo: '', rol: 'colaborador' };
    }
  }

  // Quitar de la lista temporal
  removerColaboradorLista(index: number) {
    this.colaboradoresPendientes.splice(index, 1);
  }

  onSubmit() {
    if (!this.proyecto.nombre.trim()) {
      this.errorMessage = 'El nombre del proyecto es obligatorio';
      return;
    }

    this.cargando = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Estado quemado siempre como "Activo"
    const proyectoData: any = {
      nombre: this.proyecto.nombre,
      estado: 'Activo' 
    };

    if (this.proyecto.descripcion) {
      proyectoData.descripcion = this.proyecto.descripcion;
    }

    this.apiService.crearProyecto(proyectoData).subscribe({
      next: (response: any) => {
        // Obtenemos el ID generado por tu backend (asegúrate de que el backend retorne el id del proyecto creado)
        const idProyectoNuevo = response?.id_proyecto || response?.id;

        // Si hay colaboradores en la lista y tenemos el ID, los vinculamos en ráfaga
        if (idProyectoNuevo && this.colaboradoresPendientes.length > 0) {
          this.colaboradoresPendientes.forEach(colab => {
            this.apiService.agregarColaborador({
              id_proyecto: idProyectoNuevo,
              correo_colaborador: colab.correo,
              id_rol: this.rolesMap[colab.rol] || 2
            }).subscribe(); // Se envían asíncronamente en segundo plano
          });
        }

        this.successMessage = 'Proyecto creado exitosamente';
        this.cargando = false;
        setTimeout(() => this.router.navigate(['/inicio']), 1500);
      },
      error: (error) => {
        this.errorMessage = error.error?.detail || 'Error al crear proyecto';
        this.cargando = false;
      }
    });
  }

  cancelar() {
    this.router.navigate(['/inicio']);
  }
}