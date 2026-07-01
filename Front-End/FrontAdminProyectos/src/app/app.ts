import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators'; // Importante importar esto
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
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Usamos .includes() para que detecte la ruta aunque tenga parámetros (como /proyecto/1)
      const rutasSinSidebar = ['/login', '/registro', '/'];
      this.showSidebar = !rutasSinSidebar.includes(event.urlAfterRedirects);
    });
  }
}