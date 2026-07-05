import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ListaChatComponente } from '../ListaChat/listachat';
import { ChatPersonalComponente } from '../Chatpersonal/chatpersonal';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ListaChatComponente, ChatPersonalComponente],
  templateUrl: './chat.html',
  styleUrls: ['./chat.css']
})
export class ChatComponente {
  chatSeleccionado: any = null;

  onAbrirChat(chat: any): void {
    this.chatSeleccionado = chat;
  }
}