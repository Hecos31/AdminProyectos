// === IMPORTACIONES ===
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ApiServicio } from '../Servicios/api.servicio';
import { DetallesActividades } from '../detalles-actividades/detalles-actividades';

// === INTERFACES ===
export interface Usuario {
  id_usuario: number;
  nombre: string;
  apellido: string;
  correo: string;
}

export interface Tarea {
  id_tarea: number;
  id_proyecto: number;
  titulo: string;
  descripcion?: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  estado: string;
  fecha_inicio?: string;
  fecha_limite?: string;
  usuario_asignado?: Usuario | null;
}

@Component({
  selector: 'app-crearactividades',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DragDropModule, DetallesActividades],
  templateUrl: './crearactividades.html',
  styleUrl: './crearactividades.css',
})
export class Crearactividades implements OnInit {
  // === INYECCIÓN DE DEPENDENCIAS ===
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiServicio);
  private cdr = inject(ChangeDetectorRef);

  // === ESTADO DEL COMPONENTE ===
  proyectoId!: number;
  colaboradores: Usuario[] = [];
  tareaSeleccionada: Tarea | null = null;
  
  columnas: Record<string, Tarea[]> = {
    'Pendiente por asignar': [],
    'Asignada': [],
    'En progreso': [],
    'Concluida': []
  };
  estados = Object.keys(this.columnas);

  cargando = true;
  cargandoIA = false;
  textoIA = '';
  mensajeToast = { texto: '', tipo: '' };
  fechaMinima = '';

  nuevaTarea: Partial<Tarea> & { id_usuario_asignado: number | null } = {
    titulo: '',
    descripcion: '',
    prioridad: 'Media',
    fecha_inicio: '',
    fecha_limite: '',
    id_usuario_asignado: null
  };

  // === CICLO DE VIDA ===
  ngOnInit() {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    this.establecerFechaMinima();
    this.cargarDatosIniciales();
  }

  // === INICIALIZACIÓN ===
  private establecerFechaMinima() {
    const hoy = new Date();
    this.fechaMinima = hoy.toISOString().split('T')[0];
  }

  private cargarDatosIniciales() {
    this.cargando = true;
    
    this.apiService.obtenerColaboradores(this.proyectoId).subscribe({
      next: (data) => this.colaboradores = data,
      error: () => this.mostrarToast('Error cargando colaboradores', 'error')
    });

    this.cargarTareas();
  }

  cargarTareas() {
    this.apiService.obtenerTareas(this.proyectoId).subscribe({
      next: (data: Tarea[]) => {
        this.distribuirTareas(data || []);
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.mostrarToast('Error de conexión al cargar el tablón', 'error');
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  private distribuirTareas(tareas: Tarea[]) {
    this.estados.forEach(est => this.columnas[est as keyof typeof this.columnas] = []);
    
    tareas.forEach(tarea => {
      const estado = tarea.estado as keyof typeof this.columnas;
      if (this.columnas[estado]) {
        this.columnas[estado].push(tarea);
      }
    });
  }

  // === LÓGICA DRAG & DROP KANBAN ===
  onDrop(event: CdkDragDrop<Tarea[]>, estadoDestino: string) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const tareaMovida = event.previousContainer.data[event.previousIndex];
      const estadoAnterior = tareaMovida.estado;
      
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      tareaMovida.estado = estadoDestino;

      this.apiService.cambiarEstadoTarea(tareaMovida.id_tarea, estadoDestino).subscribe({
        next: () => {
          if (estadoDestino === 'Pendiente por asignar' && tareaMovida.usuario_asignado) {
            this.apiService.asignarTarea(tareaMovida.id_tarea, null).subscribe(() => this.cargarTareas());
          }
        },
        error: () => {
          this.mostrarToast('Error al guardar el estado. Revirtiendo...', 'error');
          transferArrayItem(
            event.container.data,
            event.previousContainer.data,
            event.currentIndex,
            event.previousIndex
          );
          tareaMovida.estado = estadoAnterior;
        }
      });
    }
  }

  // === CREACIÓN DE TAREAS ===
  generarConIA() {
    if (!this.textoIA.trim()) return;
    
    this.cargandoIA = true;
    this.apiService.analizarConIA(this.proyectoId, this.textoIA).subscribe({
      next: (datosIA) => {
        this.nuevaTarea = {
          ...this.nuevaTarea,
          titulo: datosIA.titulo || '',
          descripcion: datosIA.descripcion || '',
          prioridad: datosIA.prioridad || 'Media',
          fecha_limite: datosIA.fecha_limite || '',
          id_usuario_asignado: datosIA.id_usuario_asignado || null
        };
        this.mostrarToast('Datos extraídos correctamente', 'exito');
        this.cargandoIA = false;
        this.textoIA = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.mostrarToast('La IA no pudo procesar la solicitud', 'error');
        this.cargandoIA = false;
        this.cdr.detectChanges();
      }
    });
  }

  crearTarea() {
    if (!this.validarFormulario()) return;

    const estadoInicial = this.nuevaTarea.id_usuario_asignado ? 'Asignada' : 'Pendiente por asignar';
    const payload = {
      id_proyecto: this.proyectoId,
      titulo: this.nuevaTarea.titulo,
      descripcion: this.nuevaTarea.descripcion || null,
      prioridad: this.nuevaTarea.prioridad || 'Media',
      estado: estadoInicial,
      fecha_inicio: this.nuevaTarea.fecha_inicio || null,
      fecha_limite: this.nuevaTarea.fecha_limite || null,
      id_usuario_asignado: this.nuevaTarea.id_usuario_asignado || null
    };

    this.apiService.crearTarea(payload).subscribe({
      next: () => {
        this.mostrarToast('Tarea creada con éxito', 'exito');
        this.limpiarFormulario();
        this.cargarTareas();
      },
      error: (err) => this.mostrarToast(err.error?.detail || 'Error al crear la tarea', 'error')
    });
  }

  private validarFormulario(): boolean {
    if (!this.nuevaTarea.titulo?.trim()) {
      this.mostrarToast('El título es obligatorio', 'error');
      return false;
    }
    if (this.nuevaTarea.fecha_inicio && this.nuevaTarea.fecha_inicio < this.fechaMinima) {
      this.mostrarToast('La fecha de inicio no puede ser en el pasado', 'error');
      return false;
    }
    if (this.nuevaTarea.fecha_limite && this.nuevaTarea.fecha_inicio) {
      if (this.nuevaTarea.fecha_limite < this.nuevaTarea.fecha_inicio) {
        this.mostrarToast('La fecha límite debe ser posterior a la de inicio', 'error');
        return false;
      }
    }
    return true;
  }

  private limpiarFormulario() {
    this.nuevaTarea = {
      titulo: '', descripcion: '', prioridad: 'Media',
      fecha_inicio: '', fecha_limite: '', id_usuario_asignado: null
    };
  }

  // === GESTIÓN DE TAREAS EXISTENTES ===
  eliminarTarea(id_tarea: number) {
    if (!confirm('¿Estás seguro de eliminar esta tarea permanentemente?')) return;
    this.apiService.eliminarTarea(id_tarea).subscribe({
      next: () => {
        this.mostrarToast('Tarea eliminada', 'exito');
        this.cargarTareas();
      },
      error: () => this.mostrarToast('Error eliminando la tarea', 'error')
    });
  }

  cambiarResponsable(tarea: Tarea, evento: any) {
    const valorSeleccionado = evento.target.value;
    const id_usuario = valorSeleccionado === 'null' ? null : Number(valorSeleccionado);

    this.apiService.asignarTarea(tarea.id_tarea, id_usuario).subscribe({
      next: () => {
        this.mostrarToast('Responsable actualizado', 'exito');

        if (id_usuario !== null && tarea.estado === 'Pendiente por asignar') {
          this.apiService.cambiarEstadoTarea(tarea.id_tarea, 'Asignada').subscribe(() => this.cargarTareas());
        } 
        else if (id_usuario === null && tarea.estado === 'Asignada') {
          this.apiService.cambiarEstadoTarea(tarea.id_tarea, 'Pendiente por asignar').subscribe(() => this.cargarTareas());
        } 
        else {
          this.cargarTareas();
        }
      },
      error: () => this.mostrarToast('Error al asignar usuario', 'error')
    });
  }

  // === NAVEGACIÓN Y UI ===
  mostrarToast(texto: string, tipo: 'exito' | 'error') {
    this.mensajeToast = { texto, tipo };
    setTimeout(() => this.mensajeToast = { texto: '', tipo: '' }, 4000);
  }

  volverAlProyecto() {
    this.router.navigate(['/proyecto', this.proyectoId]);
  }

  abrirDetalle(tarea: Tarea) {
    this.tareaSeleccionada = tarea;
  }

  cerrarDetalle() {
    this.tareaSeleccionada = null;
  }
}