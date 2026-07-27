// === IMPORTACIONES ===
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-crear-usuario',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './crearusuario.html',
  styleUrls: ['./crearusuario.css']
})
export class CrearUsuarioComponente {
  // === INYECCIÓN DE DEPENDENCIAS ===
  private apiService = inject(ApiServicio);
  private router = inject(Router);

  // === ESTADO DEL COMPONENTE ===
  usuario = {
    nombre: '',
    apellido: '',
    correo: '',
    password: ''
  };
  
  errorMessage = '';
  successMessage = '';
  cargando = false;

  // === MÉTODOS ===
  onSubmit() {
    this.cargando = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.apiService.registrarUsuario(this.usuario).subscribe({
      next: () => {
        this.successMessage = 'Usuario creado exitosamente';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (error) => {
        this.errorMessage = error.error?.detail || 'Error al crear usuario';
        this.cargando = false;
      }
    });
  }
}