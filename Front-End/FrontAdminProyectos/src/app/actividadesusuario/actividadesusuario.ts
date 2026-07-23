import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiServicio } from '../Servicios/api.servicio';
import { Tarea } from '../crearactividades/crearactividades';
import { DetallesActividades } from '../detalles-actividades/detalles-actividades';

@Component({
  selector: 'app-actividadesusuario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './actividadesusuario.html',
  styleUrl: './actividadesusuario.css',
})
export class Actividadesusuario implements OnInit{
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiServicio);

  proyectoId!: number;
  miIdUsuario!: number;
  cargando = true;

  misTareasNuevas: Tarea[] = []; 
  misTareasProgreso: Tarea[] = []; 
  misTareasTerminadas: Tarea[] = []; 

  // Variable para controlar qué tarea está desplegada (abierta)
  tareaExpandidaId: number | null = null;

  ngOnInit() {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    this.miIdUsuario = Number(localStorage.getItem('id_usuario')) || 1; 
    this.cargarMisTareas();
  }

  cargarMisTareas() {
    this.apiService.obtenerTareas(this.proyectoId).subscribe({
      next: (todasLasTareas: Tarea[]) => {
        const misTareas = todasLasTareas.filter(t => t.usuario_asignado?.id_usuario === this.miIdUsuario);

        this.misTareasNuevas = misTareas.filter(t => t.estado === 'Asignada');
        this.misTareasProgreso = misTareas.filter(t => t.estado === 'En progreso');
        this.misTareasTerminadas = misTareas.filter(t => t.estado === 'Concluida');
        
        this.cargando = false;
      },
      error: () => this.cargando = false
    });
  }

  // Abre y cierra los detalles de la tarea sin usar modal
  toggleDetalles(id_tarea: number) {
    if (this.tareaExpandidaId === id_tarea) {
      this.tareaExpandidaId = null; // Si ya estaba abierta, la cierra
    } else {
      this.tareaExpandidaId = id_tarea; // Abre la nueva
    }
  }

  cambiarEstado(tarea: Tarea, nuevoEstado: string, evento: Event) {
    evento.stopPropagation(); // Evita que se cierre/abra el acordeón al dar clic al botón
    this.tareaExpandidaId = null; // Cerramos los detalles al moverla
    
    this.apiService.cambiarEstadoTarea(tarea.id_tarea, nuevoEstado).subscribe({
      next: () => this.cargarMisTareas(),
      error: () => alert('Error al actualizar la tarea')
    });
  }
}
