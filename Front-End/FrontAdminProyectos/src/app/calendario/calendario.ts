import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import localeEs from '@angular/common/locales/es';
import { ApiServicio } from '../Servicios/api.servicio';
import { ChatService as ProyectosService } from '../Servicios/chats';

// Registrar localización en Español para Angular DatePipe
registerLocaleData(localeEs, 'es-ES');

export interface TareaCalendario {
  id_tarea: number;
  titulo: string;
  descripcion?: string;
  fecha_vencimiento: string;
  estado: string;
  prioridad: string; // <-- Alta, Media, Baja
  id_proyecto: number;
  nombre_proyecto?: string;
  usuario_asignado?: {
    id_usuario: number;
    nombre: string;
    apellido: string;
    correo: string;
  };
}

export interface DiaCalendario {
  fecha: Date;
  numeroDia: number;
  esMesActual: boolean;
  esHoy: boolean;
  tareas: TareaCalendario[];
}

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './calendario.html',
  styleUrls: ['./calendario.css']
})
export class CalendarioComponent implements OnInit {
  private apiService = inject(ApiServicio, { optional: true });
  private proyectosService = inject(ProyectosService, { optional: true });

  fechaActual: Date = new Date();
  mesActualNombre: string = '';
  anioActual: number = 0;

  diasMatriz: DiaCalendario[] = [];
  todasLasTareas: TareaCalendario[] = [];

  diaSeleccionado: DiaCalendario | null = null;
  cargando: boolean = false;

  readonly nombresDias: string[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  ngOnInit(): void {
    this.actualizarEncabezadoFecha();
    this.cargarTareasUsuario();
  }

  mesAnterior(): void {
    this.fechaActual = new Date(this.fechaActual.getFullYear(), this.fechaActual.getMonth() - 1, 1);
    this.actualizarEncabezadoFecha();
    this.generarMatrizCalendario();
  }

  mesSiguiente(): void {
    this.fechaActual = new Date(this.fechaActual.getFullYear(), this.fechaActual.getMonth() + 1, 1);
    this.actualizarEncabezadoFecha();
    this.generarMatrizCalendario();
  }

  irAHoy(): void {
    this.fechaActual = new Date();
    this.actualizarEncabezadoFecha();
    this.generarMatrizCalendario();
  }

  seleccionarDia(dia: DiaCalendario): void {
    this.diaSeleccionado = dia;
  }

  cargarTareasUsuario(): void {
    this.cargando = true;
    const servicio = (this.apiService || this.proyectosService) as any;

    if (!servicio) {
      this.cargando = false;
      this.generarMatrizCalendario();
      return;
    }

    if (typeof servicio.obtenerProyectos === 'function') {
      servicio.obtenerProyectos().subscribe({
        next: (proyectos: any[]) => {
          const listaProyectos = Array.isArray(proyectos)
            ? proyectos
            : (proyectos as any)?.proyectos || [];

          if (!Array.isArray(listaProyectos) || listaProyectos.length === 0) {
            this.todasLasTareas = [];
            this.generarMatrizCalendario();
            this.cargando = false;
            return;
          }

          let proyectosCompletados = 0;
          const tareasAcumuladas: TareaCalendario[] = [];

          listaProyectos.forEach((proyecto: any) => {
            const idProyecto = proyecto.id_proyecto ?? proyecto.id;
            const obtenerTareasObs = typeof servicio.obtenerMisTareasProyecto === 'function'
              ? servicio.obtenerMisTareasProyecto(idProyecto)
              : servicio.obtenerTareasProyecto?.(idProyecto);

            if (!obtenerTareasObs || typeof obtenerTareasObs.subscribe !== 'function') {
              proyectosCompletados++;
              if (proyectosCompletados === listaProyectos.length) {
                this.todasLasTareas = tareasAcumuladas;
                this.generarMatrizCalendario();
                this.cargando = false;
              }
              return;
            }

            obtenerTareasObs.subscribe({
              next: (tareas: any[]) => {
                if (Array.isArray(tareas)) {
                  const normalizadas: TareaCalendario[] = tareas.map((t) => ({
                    id_tarea: t.id_tarea ?? t.id,
                    titulo: t.nombre || t.titulo || 'Tarea sin título',
                    descripcion: t.descripcion || '',
                    fecha_vencimiento: t.fecha_limite || t.fecha_vencimiento || t.fecha_fin || t.fecha_inicio,
                    estado: t.estado || 'Pendiente',
                    prioridad: t.prioridad || 'Media', // <-- Mapeo de prioridad
                    id_proyecto: idProyecto,
                    nombre_proyecto: proyecto.nombre || 'Proyecto',
                    usuario_asignado: t.usuario_asignado
                  }));

                  tareasAcumuladas.push(...normalizadas);
                }

                proyectosCompletados++;
                if (proyectosCompletados === listaProyectos.length) {
                  this.todasLasTareas = tareasAcumuladas;
                  this.generarMatrizCalendario();
                  this.cargando = false;
                }
              },
              error: () => {
                proyectosCompletados++;
                if (proyectosCompletados === listaProyectos.length) {
                  this.todasLasTareas = tareasAcumuladas;
                  this.generarMatrizCalendario();
                  this.cargando = false;
                }
              }
            });
          });
        },
        error: () => {
          this.cargando = false;
          this.generarMatrizCalendario();
        }
      });
    }
  }

  private generarMatrizCalendario(): void {
    const año = this.fechaActual.getFullYear();
    const mes = this.fechaActual.getMonth();
    const primerDiaMes = new Date(año, mes, 1);

    let diaSemanaInicio = primerDiaMes.getDay() - 1;
    if (diaSemanaInicio === -1) diaSemanaInicio = 6;

    const fechaInicioGrid = new Date(primerDiaMes);
    fechaInicioGrid.setDate(primerDiaMes.getDate() - diaSemanaInicio);

    const hoy = new Date();
    const matriz: DiaCalendario[] = [];

    for (let i = 0; i < 42; i++) {
      const fechaIteracion = new Date(fechaInicioGrid);
      fechaIteracion.setDate(fechaInicioGrid.getDate() + i);

      const esMesActual = fechaIteracion.getMonth() === mes;
      const esHoy =
        fechaIteracion.getDate() === hoy.getDate() &&
        fechaIteracion.getMonth() === hoy.getMonth() &&
        fechaIteracion.getFullYear() === hoy.getFullYear();

      const tareasDelDia = this.todasLasTareas.filter((t) =>
        this.coincideFecha(t.fecha_vencimiento, fechaIteracion)
      );

      matriz.push({
        fecha: new Date(fechaIteracion),
        numeroDia: fechaIteracion.getDate(),
        esMesActual,
        esHoy,
        tareas: tareasDelDia
      });
    }

    this.diasMatriz = matriz;

    if (this.diaSeleccionado) {
      const reEncontrado = this.diasMatriz.find(
        (d) =>
          d.fecha.getDate() === this.diaSeleccionado!.fecha.getDate() &&
          d.fecha.getMonth() === this.diaSeleccionado!.fecha.getMonth() &&
          d.fecha.getFullYear() === this.diaSeleccionado!.fecha.getFullYear()
      );
      this.diaSeleccionado = reEncontrado || this.diasMatriz.find((d) => d.esHoy) || this.diasMatriz[0];
    } else {
      this.diaSeleccionado = this.diasMatriz.find((d) => d.esHoy) || this.diasMatriz[0];
    }
  }

  private coincideFecha(fechaStr: string | null | undefined, fechaComparar: Date): boolean {
    if (!fechaStr) return false;
    const f = new Date(fechaStr);
    if (isNaN(f.getTime())) return false;

    return (
      f.getDate() === fechaComparar.getDate() &&
      f.getMonth() === fechaComparar.getMonth() &&
      f.getFullYear() === fechaComparar.getFullYear()
    );
  }

  private actualizarEncabezadoFecha(): void {
    this.mesActualNombre = this.fechaActual.toLocaleDateString('es-ES', { month: 'long' });
    this.anioActual = this.fechaActual.getFullYear();
  }

  obtenerClaseEstado(estado: string): string {
    switch (estado?.toLowerCase()) {
      case 'completada':
      case 'hecho':
      case 'finalizada':
        return 'completada';
      case 'en proceso':
      case 'en progreso':
      case 'asignada':
        return 'progreso';
      case 'pendiente':
      default:
        return 'pendiente';
    }
  }

  /** Devuelve la clase CSS según el nivel de prioridad para pintar los colores */
  obtenerClasePrioridad(prioridad: string): string {
    switch (prioridad?.toLowerCase()) {
      case 'alta':
      case 'high':
      case 'urgente':
        return 'prio-alta';
      case 'media':
      case 'medium':
        return 'prio-media';
      case 'baja':
      case 'low':
      default:
        return 'prio-baja';
    }
  }
}