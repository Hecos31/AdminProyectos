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
  private apiService = inject(ApiServicio);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  credentials = {
    correo: '',
    password: ''
  };
  
  errorMessage = '';
  cargando = false;

  onSubmit() {
    this.cargando = true;
    this.errorMessage = '';

    this.apiService.login(this.credentials).subscribe({
      next: (response) => {
        localStorage.setItem('token', response.access_token);
        
        if (response.usuario) {
          // Publicamos el usuario globalmente para que el Sidebar lo detecte al instante
          this.apiService.actualizarSesionUsuario(response.usuario);
        }
        
        this.cargando = false;
        
        // Navegación limpia de Angular sin recargar la página entera
        this.router.navigate(['/inicio']);
      },
      error: (error) => {
        this.errorMessage = error.error?.detail || 'Error al iniciar sesión';
        this.cargando = false;
        this.cdr.detectChanges(); 
      }
    });
  }
}