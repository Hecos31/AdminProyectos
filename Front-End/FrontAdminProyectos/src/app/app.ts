import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponente } from './sidebar/sidebar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SidebarComponente],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  showSidebar = false;

  constructor(private router: Router) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        // Rutas donde NO se muestra el sidebar
        const rutasSinSidebar = ['/login', '/registro'];
        this.showSidebar = !rutasSinSidebar.includes(event.url);
        console.log('📍 Ruta:', event.url, '| Mostrar sidebar:', this.showSidebar);
      }
    });
  }
}