import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
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
  //         ZONA PÚBLICA (AUTENTICACIÓN)
  // ==========================================
  login(credentials: { correo: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials);
  }

  registrarUsuario(usuario: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/CrearUsuarios`, usuario);
  }

  // ==========================================
  //           MÓDULO DE PROYECTOS
  // ==========================================
  obtenerProyectos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos`);
  }

  obtenerProyecto(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${id}`);
  }

  crearProyecto(proyecto: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/proyectos`, proyecto);
  }

  actualizarProyecto(proyecto: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/proyectos`, proyecto);
  }

  eliminarProyecto(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/proyectos`, { body: { id_proyecto: id } });
  }

  // ==========================================
  //         MÓDULO DE COLABORADORES
  // ==========================================
  obtenerColaboradores(proyectoId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${proyectoId}/colaboradores`);
  }

  agregarColaborador(data: { id_proyecto: number; correo_colaborador: string; id_rol: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/proyectos/colaboradores`, data);
  }

  eliminarColaborador(data: { id_proyecto: number; id_usuario: number }): Observable<any> {
    return this.http.delete(`${this.apiUrl}/proyectos/colaboradores`, { body: data });
  }

  cambiarRolColaborador(data: { id_proyecto: number; id_usuario: number; id_rol_nuevo: number }): Observable<any> {
    return this.http.put(`${this.apiUrl}/proyectos/colaboradores`, data);
  }

  // ==========================================
  //             MÓDULO DE TAREAS
  // ==========================================
  obtenerTareas(proyectoId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${proyectoId}/tareas`);
  }

  crearTarea(tarea: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/tareas`, tarea);
  }

  actualizarTarea(tarea: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/tareas`, tarea);
  }

  eliminarTarea(idTarea: number) {
    return this.http.delete(`${this.apiUrl}/tareas/${idTarea}`);
  }

  cambiarEstadoTarea(id_tarea: number, estado: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/tareas/${id_tarea}/estado`, { estado });
  }

  asignarTarea(id_tarea: number, id_usuario_asignado: number | null): Observable<any> {
    return this.http.patch(`${this.apiUrl}/tareas/${id_tarea}/asignar`, { id_usuario_asignado });
  }

  analizarConIA(id_proyecto: number, texto_libre: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/analizar-tarea`, { id_proyecto, texto_libre });
  }

  // ============ NOTIFICACIONES (Blindadas por Token en el Backend) ============
  obtenerNotificaciones(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/notificaciones/`);
  }

  marcarNotificacionLeida(idNotificacion: number) {
    return this.http.put(`${this.apiUrl}/notificaciones/${idNotificacion}/leer`, {});
  }
}