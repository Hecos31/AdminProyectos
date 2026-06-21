import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponente {
  credentials = {
    email: '',
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
        localStorage.setItem('token', response.token);
        localStorage.setItem('usuario', JSON.stringify(response.usuario));
        this.router.navigate(['/inicio']);
      },
      error: (error) => {
        this.errorMessage = error.error?.mensaje || 'Error al iniciar sesión';
        this.cargando = false;
      }
    });
  }
}