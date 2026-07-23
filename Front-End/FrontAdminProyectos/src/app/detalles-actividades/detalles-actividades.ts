import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Tarea } from '../crearactividades/crearactividades';
@Component({
  selector: 'app-detalles-actividades',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './detalles-actividades.html',
  styleUrl: './detalles-actividades.css',
})
export class DetallesActividades {

  @Input() tarea: Tarea | null = null;
  @Output() cerrar = new EventEmitter<void>();

  cerrarModal() {
    this.cerrar.emit();
  }
}

