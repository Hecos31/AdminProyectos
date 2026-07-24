import { Component, OnInit, HostListener, ElementRef, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ChatService } from '../Servicios/chats';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
})
export class SidebarComponente implements OnInit {
  private router = inject(Router);
  private eRef = inject(ElementRef);
  private chatService = inject(ChatService);
  
  usuario: any = null;
  mostrarMenuUsuario: boolean = false;

  get inicialUsuario(): string {
    if (this.usuario && this.usuario.nombre) {
      return String(this.usuario.nombre).charAt(0).toUpperCase();
    }
    return 'U';
  }
  
  get nombreUsuario(): string {
    if (this.usuario && this.usuario.nombre) {
      return this.usuario.nombre;
    }
    return 'Usuario';
  }

  ngOnInit() {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      try {
        this.usuario = JSON.parse(usuarioStr);
      } catch (e) {}
    }
  }

  abrirChat() {
    this.chatService.solicitarAperturaWidget();
  }

  toggleMenuUsuario() {
    this.mostrarMenuUsuario = !this.mostrarMenuUsuario;
  }

  cerrarSesion() {
    localStorage.clear();
    sessionStorage.clear();
    this.mostrarMenuUsuario = false;
    window.location.href = '/login';
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.mostrarMenuUsuario = false;
    }
  }
}