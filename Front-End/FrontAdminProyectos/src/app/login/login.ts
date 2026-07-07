import { Component, ChangeDetectorRef } from '@angular/core'; // <-- 1. Importar ChangeDetectorRef
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
    private router: Router,
    private cdr: ChangeDetectorRef // <-- 2. Inyectarlo en el constructor
  ) {}

  onSubmit() {
    this.cargando = true;
    this.errorMessage = '';

    this.apiService.login(this.credentials).subscribe({
      next: (response) => {
        // 1. Guardamos el token de seguridad
        localStorage.setItem('token', response.access_token);
        
        // 2. NUEVO: Guardamos los datos del usuario que ahora manda el backend
        if (response.usuario) {
          localStorage.setItem('usuario', JSON.stringify(response.usuario));
        }
        
        this.cargando = false;
        
        // Empujamos la navegación al siguiente ciclo de eventos
        setTimeout(() => {
            this.router.navigate(['/inicio']);
        }, 0);
        
      },
      error: (error) => {
        console.error('Error login:', error);
        this.errorMessage = error.error?.detail || 'Error al iniciar sesión';
        this.cargando = false;
        this.cdr.detectChanges(); 
      }
    });
  }
}