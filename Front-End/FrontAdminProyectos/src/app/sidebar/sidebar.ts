import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponente implements OnInit {
  usuario: any = null;
  
  menuItems = [
    { 
      icono: '🏠', 
      nombre: 'Inicio', 
      ruta: '/inicio'
    },
    { 
      icono: '📋', 
      nombre: 'Proyectos', 
      ruta: '/inicio'
    },
    { 
      icono: '👥', 
      nombre: 'Integrantes', 
      ruta: '/integrantes'
    },
    { 
      icono: '📅', 
      nombre: 'Calendario', 
      ruta: '/calendario'
    },
    { 
      icono: '⚙️', 
      nombre: 'Configuración', 
      ruta: '/configuracion'
    }
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      this.usuario = JSON.parse(usuarioStr);
    } else {
      this.usuario = { nombre: 'Usuario', email: 'usuario@email.com' };
    }
  }

  cerrarSesion() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
      localStorage.clear();
      this.router.navigate(['/login']);
    }
  }

  estaActivo(ruta: string): boolean {
    return this.router.url === ruta;
  }
}