import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponente {
  credentials = {
    correo: '',
    password: ''
  };
  errorMessage = '';
  cargando = false;

  constructor(
    private apiService: ApiServicio,
    private router: Router
  ) {}

  onSubmit() {
    this.cargando = true;
    this.errorMessage = '';


    this.apiService.login(this.credentials).subscribe({
      next: (response) => {
        localStorage.setItem('token', response.access_token);

        this.router.navigate(['/inicio']);
      },
      error: (error) => {
        this.errorMessage = error.error?.detail || 'Error al iniciar sesión';
        this.cargando = false;
      }
    });
  }
}