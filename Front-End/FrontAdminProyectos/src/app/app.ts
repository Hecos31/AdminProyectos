import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponente } from './sidebar/sidebar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponente],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  title = 'FrontAdminProyectos';
  
  constructor() {
    console.log('✅ App componente cargado');
  }
}