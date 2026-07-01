import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiServicio } from '../Servicios/api.servicio';
import { MenuConfiguracionComponente } from '../MenuConfiguracion/menuconfiguracion';

@Component({
  selector: 'app-pantalla-configuracion-proyecto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pantallaconfiguracion.html',
  styleUrls: ['./pantallaconfiguracion.css']
})
export class PantallaConfiguracionComponente implements OnInit {
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

  rolesMap: any = { 'colaborador': 2, 'editor': 3, 'admin': 1 };
  rolesInvertidos: any = { 1: 'admin', 2: 'colaborador', 3: 'editor' };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiServicio,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    console.log('Proyecto ID desde URL:', this.proyectoId);
    this.cargarDatos();
  }

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
        console.log('Colaboradores recibidos:', data);
        this.colaboradores = Array.isArray(data) ? data : [];
        this.colaboradores.forEach(c => {
          c.rol_nombre = this.rolesInvertidos[c.id_rol] || 'colaborador';
        });
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error cargando colaboradores:', error);
        this.colaboradores = [];
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  agregarColaborador() {
    if (!this.nuevoColaborador.correo) {
      this.errorMessage = 'Ingresa un correo válido';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }

    const data = {
      id_proyecto: this.proyectoId,
      correo_colaborador: this.nuevoColaborador.correo,
      id_rol: this.rolesMap[this.nuevoColaborador.rol] || 2
    };

    console.log('📤 Enviando colaborador:', data);

    this.apiService.agregarColaborador(data).subscribe({
      next: (response) => {
        console.log('Colaborador agregado:', response);
        this.successMessage = 'Colaborador agregado exitosamente';
        this.nuevoColaborador = { correo: '', rol: 'colaborador' };
        this.cargarColaboradores();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (error) => {
        console.error(' Error:', error);
        const mensaje = error.error?.detail || 'Error al agregar colaborador';
        this.errorMessage = 'Error ' + mensaje;
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  eliminarColaborador(id_usuario: number) {
  if (!confirm('¿Estás seguro de eliminar este colaborador?')) return;

  this.apiService.eliminarColaborador({ 
    id_proyecto: this.proyectoId, 
    id_usuario: id_usuario 
  }).subscribe({
    next: () => {
      this.successMessage = 'Colaborador eliminado exitosamente';
      this.cargarColaboradores(); // Recargamos la lista
      setTimeout(() => this.successMessage = '', 3000);
    },
    error: (error) => {
      console.error('Error al eliminar:', error);
      this.errorMessage = 'Error al eliminar colaborador';
      setTimeout(() => this.errorMessage = '', 3000);
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
        this.successMessage = 'Rol actualizado';
        this.cargarColaboradores();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: () => {
        this.errorMessage = 'Error al cambiar rol';
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  volverAlProyecto() {
    this.router.navigate(['/proyecto', this.proyectoId]);
  }
}