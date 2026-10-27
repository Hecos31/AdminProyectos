import { Component, HostListener } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

import { SidebarComponente } from './sidebar/sidebar';
import { NavbarProyecto } from './navbar-proyecto/navbar-proyecto';
import { ChatWidget } from './chat-widget/chat-widget';
import { ThemeService } from './Servicios/theme.service';
import {
  ConfirmacionModalComponent
} from './confirmacion-modal/confirmacion-modal';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SidebarComponente, NavbarProyecto, ChatWidget, ConfirmacionModalComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App {
  showSidebar = false;
  sidebarMobileOpen = false;
  title = 'Orbita';

  constructor(private router: Router, public themeService: ThemeService) {

    this.themeService.initializeTheme();
    this.updateSidebarVisibility(this.router.url);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateSidebarVisibility(event.urlAfterRedirects);
        this.sidebarMobileOpen = false; // Cerrar sidebar al navegar en móvil
      });
  }

  get isDarkMode(): boolean {
    return this.themeService.isDarkTheme();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleSidebarMobile(): void {
    this.sidebarMobileOpen = !this.sidebarMobileOpen;
  }

  cerrarSidebarMobile(): void {
    this.sidebarMobileOpen = false;
  }

  private updateSidebarVisibility(url: string): void {
    const cleanUrl = url.split('?')[0].split('#')[0];

    const routesWithoutSidebar = ['/', '/login', '/registro'];

    this.showSidebar = !routesWithoutSidebar.includes(cleanUrl);
  }
}
