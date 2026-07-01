import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiServicio {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000';

  // ============ OBTENER HEADERS CON TOKEN ============
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // ============ AUTENTICACIÓN (SIN TOKEN) ============
  login(credentials: { correo: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials);
  }

  registrarUsuario(usuario: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/CrearUsuarios`, usuario);
  }

  // ============ PROYECTOS (CON TOKEN) ============
  obtenerProyectos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos`, { headers: this.getHeaders() });
  }

  obtenerProyecto(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${id}`, { headers: this.getHeaders() });
  }

  crearProyecto(proyecto: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/proyectos`, proyecto, { headers: this.getHeaders() });
  }

  actualizarProyecto(proyecto: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/proyectos`, proyecto, { headers: this.getHeaders() });
  }

  eliminarProyecto(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/proyectos`, { 
      headers: this.getHeaders(),
      body: { id_proyecto: id } 
    });
  }

  // ============ COLABORADORES (CON TOKEN) ============
  obtenerColaboradores(proyectoId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${proyectoId}/colaboradores`, { headers: this.getHeaders() });
  }

  agregarColaborador(data: { id_proyecto: number; correo_colaborador: string; id_rol: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/proyectos/colaboradores`, data, { headers: this.getHeaders() });
  }

  eliminarColaborador(data: { id_proyecto: number; id_usuario: number }): Observable<any> {
    return this.http.delete(`${this.apiUrl}/proyectos/colaboradores`, { 
      headers: this.getHeaders(),
      body: data 
    });
  }

  cambiarRolColaborador(data: { id_proyecto: number; id_usuario: number; id_rol_nuevo: number }): Observable<any> {
    return this.http.put(`${this.apiUrl}/proyectos/colaboradores`, data, { headers: this.getHeaders() });
  }

  // ============ TAREAS (CON TOKEN) ============
  obtenerTareas(proyectoId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${proyectoId}/tareas`, { headers: this.getHeaders() });
  }

  crearTarea(tarea: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/tareas`, tarea, { headers: this.getHeaders() });
  }

  actualizarTarea(tarea: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/tareas`, tarea, { headers: this.getHeaders() });
  }

  eliminarTarea(id_tarea: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/tareas`, { 
      headers: this.getHeaders(),
      body: { id_tarea } 
    });
  }
}