import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiServicio } from '../Servicios/api.servicio';

@Component({
  selector: 'app-pantalla-principal-proyecto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pantallaprincipalproyecto.html',
  styleUrls: ['./pantallaprincipalproyecto.css']
})
export class PantallaPrincipalProyectoComponente implements OnInit {
  proyectoId: string = '';
  proyecto: any = null;
  actividades: any[] = [];
  integrantes: any[] = [];
  hitos: any[] = [];
  actividadReciente: any[] = [];
  estadisticas: any = {};
  
  cargando = true;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiServicio
  ) {}

  ngOnInit() {
    this.proyectoId = this.route.snapshot.params['id'];
    this.cargarTodosLosDatos();
  }

  cargarTodosLosDatos() {
    this.cargando = true;
    
    // Cargar proyecto
    this.apiService.obtenerProyecto(this.proyectoId).subscribe({
      next: (data) => {
        this.proyecto = data;
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar el proyecto';
        console.error(error);
      }
    });

    // Cargar actividades
    this.apiService.obtenerActividades(this.proyectoId).subscribe({
      next: (data) => {
        this.actividades = data;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error cargando actividades:', error);
        this.cargando = false;
      }
    });

    // Cargar integrantes
    this.apiService.obtenerIntegrantes(this.proyectoId).subscribe({
      next: (data) => {
        this.integrantes = data;
      },
      error: (error) => {
        console.error('Error cargando integrantes:', error);
      }
    });

    // Cargar hitos
    this.apiService.obtenerHitos(this.proyectoId).subscribe({
      next: (data) => {
        this.hitos = data;
      },
      error: (error) => {
        console.error('Error cargando hitos:', error);
        // Si no hay endpoint, usar datos vacíos
        this.hitos = [];
      }
    });

    // Cargar actividad reciente
    this.apiService.obtenerActividadReciente(this.proyectoId).subscribe({
      next: (data) => {
        this.actividadReciente = data;
      },
      error: (error) => {
        console.error('Error cargando actividad reciente:', error);
        this.actividadReciente = [];
      }
    });

    // Cargar estadísticas
    this.apiService.obtenerEstadisticas(this.proyectoId).subscribe({
      next: (data) => {
        this.estadisticas = data;
      },
      error: (error) => {
        console.error('Error cargando estadísticas:', error);
        // Calcular estadísticas localmente si falla
        this.calcularEstadisticas();
      }
    });
  }

  calcularEstadisticas() {
    const total = this.actividades.length;
    const completadas = this.actividades.filter(a => a.estado === 'completada').length;
    const pendientes = total - completadas;
    
    this.estadisticas = {
      totalActividades: total,
      actividadesCompletadas: completadas,
      actividadesPendientes: pendientes,
      progreso: total > 0 ? Math.round((completadas / total) * 100) : 0,
      cumplimiento: total > 0 ? Math.round((completadas / total) * 100) : 0
    };
  }

  // ============ MÉTODOS PARA EL HTML ============
  get totalActividades(): number {
    return this.estadisticas.totalActividades || 0;
  }

  get actividadesCompletadas(): number {
    return this.estadisticas.actividadesCompletadas || 0;
  }

  get actividadesPendientes(): number {
    return this.estadisticas.actividadesPendientes || 0;
  }

  get progreso(): number {
    return this.estadisticas.progreso || 0;
  }

  get cumplimiento(): number {
    return this.estadisticas.cumplimiento || 0;
  }

  get tareasPendientes(): any[] {
    return this.actividades.filter(a => a.estado !== 'completada').slice(0, 5);
  }

  // ============ NAVEGACIÓN ============
  irAConfiguracion() {
    this.router.navigate([`/proyecto/${this.proyectoId}/configuracion/opcion`]);
  }

  irACalendario() {
    this.router.navigate([`/proyecto/${this.proyectoId}/calendario`]);
  }

  irAIntegrantes() {
    this.router.navigate([`/proyecto/${this.proyectoId}/configuracion/opcion`]);
  }

  verActividad(id: string) {
    this.router.navigate([`/proyecto/${this.proyectoId}/actividad/${id}`]);
  }

  volverAInicio() {
    this.router.navigate(['/inicio']);
  }

  getPrioridadColor(prioridad: string): string {
    const colores: any = {
      'alta': '#dc3545',
      'media': '#ffc107',
      'baja': '#28a745'
    };
    return colores[prioridad] || '#6c757d';
  }
}