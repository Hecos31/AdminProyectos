import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';


export type PrioridadTareaApi = 'Baja' | 'Media' | 'Alta';

export type EstadoTareaApi =
  | 'Pendiente por asignar'
  | 'Asignada'
  | 'En progreso'
  | 'Concluida';


export interface UsuarioTarea {
  id_usuario: number;
  nombre: string;
  apellido: string;
  correo: string;
}


export interface TareaApi {
  id_tarea: number;
  id_proyecto: number;
  titulo: string;
  descripcion: string | null;
  prioridad: PrioridadTareaApi | string | null;
  estado: EstadoTareaApi | string;
  fecha_inicio: string | null;
  fecha_limite: string | null;
  usuario_asignado: UsuarioTarea | null;
}


export interface TareaUpdatePayload {
  titulo?: string;
  descripcion?: string | null;
  prioridad?: PrioridadTareaApi;
  fecha_inicio?: string | null;
  fecha_limite?: string | null;
}


export interface PermisosTarea {
  es_responsable: boolean;
  es_administrador: boolean;
  puede_tomar: boolean;
  puede_comentar: boolean;
  puede_agregar_evidencia: boolean;
  puede_editar_tarea: boolean;
  puede_cambiar_responsable: boolean;
  puede_eliminar_tarea: boolean;
}


export interface ComentarioTarea {
  id_comentario: number;
  id_tarea: number;
  id_usuario: number;
  contenido: string;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
  usuario: UsuarioTarea;
  puede_editar: boolean;
  puede_eliminar: boolean;
}


export interface EvidenciaTarea {
  id_evidencia: number;
  id_tarea: number;
  id_usuario: number;
  tipo: 'archivo' | 'enlace';
  nombre: string;
  descripcion: string | null;
  url: string | null;
  nombre_archivo_original: string | null;
  tipo_mime: string | null;
  tamano_bytes: number | null;
  url_descarga: string | null;
  fecha_creacion: string;
  usuario: UsuarioTarea;
  puede_eliminar: boolean;
}


export interface DetalleTarea {
  tarea: TareaApi;
  comentarios: ComentarioTarea[];
  evidencias: EvidenciaTarea[];
  permisos: PermisosTarea;
}


export interface TomarTareaResponse {
  mensaje: string;
  tarea: TareaApi;
  permisos: PermisosTarea;
}


export interface EvidenciaEnlacePayload {
  nombre: string;
  descripcion?: string | null;
  url: string;
}


@Injectable({
  providedIn: 'root'
})
export class ApiServicio {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // === ESTADO GLOBAL DE SESIÓN (BehaviorSubject) ===
  private usuarioActualSource = new BehaviorSubject<any>(this.obtenerUsuarioInicial());
  usuarioActual$ = this.usuarioActualSource.asObservable();

  private obtenerUsuarioInicial() {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      try { return JSON.parse(usuarioStr); } catch (e) { return null; }
    }
    return null;
  }

  actualizarSesionUsuario(usuario: any) {
    if (usuario) {
      localStorage.setItem('usuario', JSON.stringify(usuario));
    } else {
      localStorage.removeItem('usuario');
    }
    this.usuarioActualSource.next(usuario);
  }

  // === COMUNICADOR PARA NOTIFICACIONES ===
  private notificacionesSource = new Subject<void>();
  notificacionesActualizadas$ = this.notificacionesSource.asObservable();

  notificarCambio() {
    this.notificacionesSource.next();
  }

  // ==========================================
  //         ZONA PÚBLICA
  // ==========================================

  login(credentials: {
    correo: string;
    password: string;
  }): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/login`,
      credentials
    );
  }


  registrarUsuario(usuario: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/CrearUsuarios`,
      usuario
    );
  }


  // ==========================================
  //         MÓDULO DE PROYECTOS
  // ==========================================

  obtenerProyectos(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/proyectos`
    );
  }


  obtenerProyecto(id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/proyectos/${id}`
    );
  }


  crearProyecto(proyecto: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/proyectos`,
      proyecto
    );
  }


  actualizarProyecto(proyecto: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/proyectos`,
      proyecto
    );
  }


  eliminarProyecto(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/proyectos`,
      {
        body: {
          id_proyecto: id
        }
      }
    );
  }


  // ==========================================
  //         MÓDULO DE COLABORADORES
  // ==========================================

  obtenerColaboradores(
    proyectoId: number
  ): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/proyectos/${proyectoId}/colaboradores`
    );
  }


  agregarColaborador(data: {
    id_proyecto: number;
    correo_colaborador: string;
    id_rol: number;
  }): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/proyectos/colaboradores`,
      data
    );
  }


  eliminarColaborador(data: {
    id_proyecto: number;
    id_usuario: number;
  }): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/proyectos/colaboradores`,
      {
        body: data
      }
    );
  }


  cambiarRolColaborador(data: {
    id_proyecto: number;
    id_usuario: number;
    id_rol_nuevo: number;
  }): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/proyectos/colaboradores`,
      data
    );
  }


  // ==========================================
  //         MÓDULO DE TAREAS
  // ==========================================

  obtenerTareas(
    proyectoId: number
  ): Observable<TareaApi[]> {
    return this.http.get<TareaApi[]>(
      `${this.apiUrl}/proyectos/${proyectoId}/tareas`
    );
  }


  obtenerMisTareasProyecto(
    idProyecto: number
  ): Observable<TareaApi[]> {
    return this.http.get<TareaApi[]>(
      `${this.apiUrl}/proyectos/${idProyecto}/mis-tareas`
    );
  }


  crearTarea(
    tarea: any
  ): Observable<TareaApi> {
    return this.http.post<TareaApi>(
      `${this.apiUrl}/tareas`,
      tarea
    );
  }


  obtenerDetalleTarea(
    idTarea: number
  ): Observable<DetalleTarea> {
    return this.http.get<DetalleTarea>(
      `${this.apiUrl}/tareas/${idTarea}/detalle`
    );
  }


  editarTarea(
    idTarea: number,
    datos: TareaUpdatePayload
  ): Observable<TareaApi> {
    return this.http.put<TareaApi>(
      `${this.apiUrl}/tareas/${idTarea}`,
      datos
    );
  }


  /**
   * Se conserva para no romper componentes antiguos.
   * Extrae el ID y envía únicamente los campos editables.
   */
  actualizarTarea(
    tarea: any
  ): Observable<TareaApi> {
    const idTarea = Number(tarea?.id_tarea);

    if (!Number.isInteger(idTarea) || idTarea <= 0) {
      return throwError(
        () => new Error('La tarea no contiene un ID válido.')
      );
    }

    const datos: TareaUpdatePayload = {
      titulo: tarea.titulo,
      descripcion: tarea.descripcion,
      prioridad: tarea.prioridad,
      fecha_inicio: tarea.fecha_inicio,
      fecha_limite: tarea.fecha_limite
    };

    return this.editarTarea(
      idTarea,
      datos
    );
  }


  eliminarTarea(
    idTarea: number
  ): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/tareas/${idTarea}`
    );
  }


  cambiarEstadoTarea(
    idTarea: number,
    estado: EstadoTareaApi
  ): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/tareas/${idTarea}/estado`,
      {
        estado
      }
    );
  }


  asignarTarea(
    idTarea: number,
    idUsuarioAsignado: number | null
  ): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/tareas/${idTarea}/asignar`,
      {
        id_usuario_asignado: idUsuarioAsignado
      }
    );
  }


  tomarTarea(
    idTarea: number
  ): Observable<TomarTareaResponse> {
    return this.http.patch<TomarTareaResponse>(
      `${this.apiUrl}/tareas/${idTarea}/tomar`,
      {}
    );
  }


  // ==========================================
  //         COMENTARIOS DE TAREA
  // ==========================================

  crearComentario(
    idTarea: number,
    contenido: string
  ): Observable<ComentarioTarea> {
    return this.http.post<ComentarioTarea>(
      `${this.apiUrl}/tareas/${idTarea}/comentarios`,
      {
        contenido
      }
    );
  }


  editarComentario(
    idComentario: number,
    contenido: string
  ): Observable<ComentarioTarea> {
    return this.http.put<ComentarioTarea>(
      `${this.apiUrl}/tareas/comentarios/${idComentario}`,
      {
        contenido
      }
    );
  }


  eliminarComentario(
    idComentario: number
  ): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/tareas/comentarios/${idComentario}`
    );
  }


  // ==========================================
  //         EVIDENCIAS DE TAREA
  // ==========================================

  agregarEvidenciaEnlace(
    idTarea: number,
    datos: EvidenciaEnlacePayload
  ): Observable<EvidenciaTarea> {
    return this.http.post<EvidenciaTarea>(
      `${this.apiUrl}/tareas/${idTarea}/evidencias/enlace`,
      datos
    );
  }


  subirEvidenciaArchivo(
    idTarea: number,
    datos: FormData
  ): Observable<EvidenciaTarea> {
    return this.http.post<EvidenciaTarea>(
      `${this.apiUrl}/tareas/${idTarea}/evidencias/archivo`,
      datos
    );
  }


  descargarEvidencia(
    idEvidencia: number
  ): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/tareas/evidencias/${idEvidencia}/descargar`,
      {
        responseType: 'blob'
      }
    );
  }


  eliminarEvidencia(
    idEvidencia: number
  ): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/tareas/evidencias/${idEvidencia}`
    );
  }


  // ==========================================
  //         MÓDULO DE IA
  // ==========================================

  analizarConIA(
    idProyecto: number,
    textoLibre: string
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/ai/analizar-tarea`,
      {
        id_proyecto: idProyecto,
        texto_libre: textoLibre
      }
    );
  }

  // ============ NOTIFICACIONES (Blindadas por Token en el Backend) ============
  obtenerNotificaciones(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/notificaciones/`);
  }

  marcarNotificacionLeida(idNotificacion: number) {
    return this.http.put(`${this.apiUrl}/notificaciones/${idNotificacion}/leer`, {});
  }
}