import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponente implements OnInit {
  usuario: any = null;
  proyectoId: number | null = null;

  constructor(
    private router: Router,
    private apiService: ApiServicio
  ) {}

  ngOnInit() {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      this.usuario = JSON.parse(usuarioStr);
    } else {
      this.usuario = { nombre: 'Usuario', correo: 'usuario@email.com' };
    }


  }

  irAIntegrantes() {
    if (this.proyectoId) {
      this.router.navigate(['/proyecto', this.proyectoId, 'configuracion', 'opcion']);
    } else {
      console.error('❌ No hay proyecto ID disponible');
    }
  }

  irACalendario() {
    if (this.proyectoId) {
      this.router.navigate(['/proyecto', this.proyectoId, 'calendario']);
    } else {
      console.error('❌ No hay proyecto ID disponible');
    }
  }

  irAConfiguracion() {
    if (this.proyectoId) {
      this.router.navigate(['/proyecto', this.proyectoId, 'configuracion', 'opcion']);
    } else {
      console.error('❌ No hay proyecto ID disponible');
    }
  }

  cerrarSesion() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
      localStorage.clear();
      this.router.navigate(['/login']);
    }
  }
}