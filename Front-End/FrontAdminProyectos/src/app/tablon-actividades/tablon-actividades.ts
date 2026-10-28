// === IMPORTACIONES ===
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import {
  ApiServicio,
  EstadoTareaApi,
  TareaApi
} from '../Servicios/api.servicio';
import { DetallesActividades } from '../detalles-actividades/detalles-actividades';
import { NotificacionesNativasService } from '../Servicios/notificaciones-nativas.service';

export interface ToastNotificacionKanban {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: 'completada' | 'progreso' | 'asignada' | 'nueva' | 'info';
  timestamp: Date;
}

@Component({
  selector: 'app-tablon-actividades',
  standalone: true,
  imports: [CommonModule, DetallesActividades],
  templateUrl: './tablon-actividades.html',
  styleUrl: './tablon-actividades.css',
})
export class TablonActividades implements OnInit, OnDestroy {
  // === INYECCIÓN DE DEPENDENCIAS ===
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiServicio);
  private notificacionesNativas = inject(NotificacionesNativasService);
  private cdr = inject(ChangeDetectorRef);

  // === ESTADO DEL COMPONENTE ===
  proyectoId!: number;
  cargando = true;
  estaSincronizando = false;
  ultimaActualizacion: Date = new Date();
  
  tareaSeleccionada: TareaApi | null = null;
  permisoNotificaciones: NotificationPermission = 'default';

  // Almacén para detectar cambios automáticos de estado entre refrescos
  private mapaTareasPrevias = new Map<number, EstadoTareaApi>();
  private inicializado = false;
  private suscripciones = new Subscription();

  // Notificaciones automáticas toast en vivo en el tablero
  toasts: ToastNotificacionKanban[] = [];

  columnas: Record<EstadoTareaApi, TareaApi[]> = {
    'Pendiente por asignar': [],
    'Asignada': [],
    'En progreso': [],
    'Concluida': []
  };

  estados: EstadoTareaApi[] = [
    'Pendiente por asignar',
    'Asignada',
    'En progreso',
    'Concluida'
  ];

  // === CICLO DE VIDA ===
  ngOnInit() {
    this.proyectoId = Number(this.route.snapshot.params['id']);
    this.permisoNotificaciones = this.notificacionesNativas.permiso;

    // Carga inicial
    this.cargarTareas(false);

    // Auto-solicitar permisos de notificación nativa/push
    this.notificacionesNativas.solicitarPermiso().then(() => {
      this.permisoNotificaciones = this.notificacionesNativas.permiso;
      this.cdr.detectChanges();
    });

    // Escuchar eventos globales de cambios de tareas (ej. modal detalles, chat o acciones locales)
    this.suscripciones.add(
      this.apiService.notificacionesActualizadas$.subscribe(() => {
        this.cargarTareas(true);
      })
    );

    // Sistema de Sincronización Automática en Segundo Plano (Polling cada 8 segundos)
    // Permite que el tablero se actualice en tiempo real y notifique automáticamente
    this.suscripciones.add(
      interval(8000).subscribe(() => {
        if (!this.cargando && this.proyectoId) {
          this.cargarTareas(true);
        }
      })
    );
  }

  ngOnDestroy() {
    this.suscripciones.unsubscribe();
  }

  // === ACCIÓN MANUAL: HABILITAR NOTIFICACIONES ===
  async habilitarNotificaciones(): Promise<void> {
    const concedido = await this.notificacionesNativas.solicitarPermiso();
    this.permisoNotificaciones = this.notificacionesNativas.permiso;
    if (concedido) {
      this.agregarToast(
        'Notificaciones activadas',
        'El Tablero Kanban te alertará en tiempo real sobre avances y actividades completadas.',
        'info'
      );
      this.notificacionesNativas.mostrarNotificacion('Órbita - Tablero Kanban', {
        body: '¡Notificaciones activadas! Te avisaremos cuando una actividad cambie a Concluida.',
        tag: 'kanban-test'
      });
    }
    this.cdr.detectChanges();
  }

  // === PETICIONES HTTP Y DETECCIÓN AUTOMÁTICA DE CAMBIOS ===
  cargarTareas(enSegundoPlano = false): void {
    if (!enSegundoPlano) {
      this.cargando = true;
    } else {
      this.estaSincronizando = true;
    }

    this.apiService.obtenerTareas(this.proyectoId).subscribe({
      next: (data: TareaApi[]) => {
        const tareasNuevas = data ?? [];

        // Detección automática inteligente de transiciones de estado
        if (this.inicializado) {
          this.detectarCambiosYNotificar(tareasNuevas);
        }

        // Limpiar y poblar columnas
        this.estados.forEach((estado) => {
          this.columnas[estado] = [];
        });

        // Actualizar mapa de control previo
        const nuevoMapa = new Map<number, EstadoTareaApi>();
        tareasNuevas.forEach((tarea) => {
          const estado = tarea.estado as EstadoTareaApi;
          if (this.columnas[estado]) {
            this.columnas[estado].push(tarea);
          }
          nuevoMapa.set(tarea.id_tarea, estado);
        });

        this.mapaTareasPrevias = nuevoMapa;
        this.inicializado = true;
        this.ultimaActualizacion = new Date();
        this.cargando = false;
        this.estaSincronizando = false;
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Error al cargar las tareas del tablero:', error);
        this.cargando = false;
        this.estaSincronizando = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Compara el estado anterior de las tareas contra el nuevo estado obtenido automáticamente.
   * Si una actividad es concluida o cambia de estado, dispara notificación nativa PWA/Sistema y Toast visual.
   */
  private detectarCambiosYNotificar(nuevasTareas: TareaApi[]): void {
    nuevasTareas.forEach((tarea) => {
      const estadoPrevio = this.mapaTareasPrevias.get(tarea.id_tarea);
      const estadoActual = tarea.estado as EstadoTareaApi;

      // Si la tarea existía y cambió de estado
      if (estadoPrevio && estadoPrevio !== estadoActual) {
        // CASO ESPECIAL CLAVE: Actividad Completada / Concluida
        if (estadoActual === 'Concluida') {
          const responsable = tarea.usuario_asignado?.nombre || 'El equipo';
          const msg = `La actividad "${tarea.titulo}" ha sido concluida exitosamente por ${responsable}.`;
          
          this.agregarToast('¡Actividad Completada! 🎉', msg, 'completada');

          this.notificacionesNativas.mostrarNotificacion('Actividad Completada ✔️', {
            body: msg,
            tag: `kanban-completada-${tarea.id_tarea}`,
            data: { id_tarea: tarea.id_tarea, estado: estadoActual }
          });
        } else if (estadoActual === 'En progreso') {
          const msg = `La actividad "${tarea.titulo}" ha pasado a En progreso.`;
          this.agregarToast('Actividad en Marcha ⚡', msg, 'progreso');
          this.notificacionesNativas.mostrarNotificacion('Actividad en progreso', {
            body: msg,
            tag: `kanban-progreso-${tarea.id_tarea}`
          });
        } else if (estadoActual === 'Asignada') {
          const asignado = tarea.usuario_asignado?.nombre || 'un colaborador';
          const msg = `"${tarea.titulo}" fue asignada a ${asignado}.`;
          this.agregarToast('Nueva Asignación 📌', msg, 'asignada');
        }
      } 
      // Si es una actividad completamente nueva detectada
      else if (!estadoPrevio && this.mapaTareasPrevias.size > 0) {
        const msg = `Se ha agregado una nueva actividad al tablero: "${tarea.titulo}".`;
        this.agregarToast('Nueva Actividad Creada 📋', msg, 'nueva');
        this.notificacionesNativas.mostrarNotificacion('Nueva Actividad en Tablero', {
          body: msg,
          tag: `kanban-nueva-${tarea.id_tarea}`
        });
      }
    });
  }

  // === TOASTS EN PANTALLA ===
  private agregarToast(titulo: string, mensaje: string, tipo: ToastNotificacionKanban['tipo']): void {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nuevoToast: ToastNotificacionKanban = {
      id,
      titulo,
      mensaje,
      tipo,
      timestamp: new Date()
    };

    this.toasts.unshift(nuevoToast);
    if (this.toasts.length > 5) {
      this.toasts.pop();
    }

    // Auto-cerrar toast tras 6 segundos
    setTimeout(() => {
      this.cerrarToast(id);
    }, 6000);

    this.cdr.detectChanges();
  }

  cerrarToast(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.cdr.detectChanges();
  }

  // === GESTIÓN DE MODAL DE DETALLES ===
  abrirDetalle(tarea: TareaApi) {
    this.tareaSeleccionada = tarea;
  }

  cerrarDetalle() {
    this.tareaSeleccionada = null;
  }

  onTareaActualizada() {
    this.cargarTareas(true);
    this.apiService.notificarCambio();
  }

  onTareaEliminada() {
    this.cargarTareas(true);
    this.apiService.notificarCambio();
  }
}
