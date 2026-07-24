// === IMPORTACIONES ===
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-pantalla-configuracion-proyecto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pantallaconfiguracion.html',
  styleUrls: ['./pantallaconfiguracion.css']
})
export class PantallaConfiguracionComponente implements OnInit {
  // === INYECCIÓN DE DEPENDENCIAS ===
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiServicio);
  private cdr = inject(ChangeDetectorRef);

  // === ESTADO DEL COMPONENTE ===
  proyectoId: number = 0;
  proyecto: any = null;
  colaboradores: any[] = [];
  
  nuevoColaborador = {
    correo: '',
    rol: 'colaborador'
  };
  
  cargando = true;
  errorMessage = '';
  successMessage = '';

  // Mapeo de roles basado en IDs del backend
  rolesMap: any = { 'colaborador': 2, 'editor': 3, 'admin': 1 };
  rolesInvertidos: any = { 1: 'admin', 2: 'colaborador', 3: 'editor' };

  // === CICLO DE VIDA ===
  ngOnInit() {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    this.cargarDatos();
  }

  // === PETICIONES HTTP (LECTURA) ===
  cargarDatos() {
    this.apiService.obtenerProyecto(this.proyectoId).subscribe({
      next: (proyecto) => {
        this.proyecto = proyecto;
        this.cargarColaboradores();
      },
      error: () => { 
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  cargarColaboradores() {
    this.apiService.obtenerColaboradores(this.proyectoId).subscribe({
      next: (data) => {
        this.colaboradores = Array.isArray(data) ? data : [];
        this.colaboradores.forEach(c => {
          c.rol_nombre = this.rolesInvertidos[c.id_rol] || 'colaborador';
        });
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.colaboradores = [];
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  // === PETICIONES HTTP (ESCRITURA) ===
  agregarColaborador() {
    if (!this.nuevoColaborador.correo.trim()) {
      this.mostrarError('Ingresa un correo válido');
      return;
    }

    const data = {
      id_proyecto: this.proyectoId,
      correo_colaborador: this.nuevoColaborador.correo,
      id_rol: this.rolesMap[this.nuevoColaborador.rol] || 2
    };

    this.apiService.agregarColaborador(data).subscribe({
      next: () => {
        this.mostrarExito('Colaborador agregado exitosamente');
        this.nuevoColaborador = { correo: '', rol: 'colaborador' };
        this.cargarColaboradores();
      },
      error: (error) => {
        const mensaje = error.error?.detail || 'Error al agregar colaborador';
        this.mostrarError('Error: ' + mensaje);
      }
    });
  }

  eliminarColaborador(id_usuario: number) {
    if (!confirm('¿Estás seguro de eliminar este colaborador del proyecto?')) return;

    this.apiService.eliminarColaborador({ 
      id_proyecto: this.proyectoId, 
      id_usuario: id_usuario 
    }).subscribe({
      next: () => {
        this.mostrarExito('Colaborador eliminado exitosamente');
        this.cargarColaboradores();
      },
      error: () => {
        this.mostrarError('Error al eliminar colaborador');
      }
    });
  }

  cambiarRol(id_usuario: number, nuevoRol: string) {
    this.apiService.cambiarRolColaborador({
      id_proyecto: this.proyectoId,
      id_usuario,
      id_rol_nuevo: this.rolesMap[nuevoRol] || 2
    }).subscribe({
      next: () => {
        this.mostrarExito('Rol actualizado correctamente');
        this.cargarColaboradores();
      },
      error: () => {
        this.mostrarError('Error al cambiar el rol del colaborador');
      }
    });
  }

  // === UTILIDADES ===
  mostrarError(mensaje: string) {
    this.errorMessage = mensaje;
    setTimeout(() => this.errorMessage = '', 4000);
  }

  mostrarExito(mensaje: string) {
    this.successMessage = mensaje;
    setTimeout(() => this.successMessage = '', 4000);
  }

  volverAlProyecto() {
    this.router.navigate(['/proyecto', this.proyectoId]);
  }
}