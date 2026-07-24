// === IMPORTACIONES ===
import { Component, ChangeDetectorRef, inject } from '@angular/core'; 
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
  // === INYECCIÓN DE DEPENDENCIAS ===
  private apiService = inject(ApiServicio);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // === ESTADO DEL COMPONENTE ===
  credentials = {
    correo: '',
    password: ''
  };
  
  errorMessage = '';
  cargando = false;

  // === MÉTODOS ===
  onSubmit() {
    this.cargando = true;
    this.errorMessage = '';

    this.apiService.login(this.credentials).subscribe({
      next: (response) => {
        localStorage.setItem('token', response.access_token);
        
        if (response.usuario) {
          localStorage.setItem('usuario', JSON.stringify(response.usuario));
        }
        
        this.cargando = false;
        
        setTimeout(() => {
            this.router.navigate(['/inicio']);
        }, 0);
        
      },
      error: (error) => {
        this.errorMessage = error.error?.detail || 'Error al iniciar sesión';
        this.cargando = false;
        this.cdr.detectChanges(); 
      }
    });
  }
}