import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiServicio {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000'; // ← CAMBIA POR TU URL DE FASTAPI

  // ============ AUTENTICACIÓN ============
  login(credentials: {email: string, password: string}): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, credentials);
  }

  registrarUsuario(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/registro`, userData);
  }

  // ============ PROYECTOS ============
  obtenerProyectos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos`);
  }

  obtenerProyecto(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${id}`);
  }

  crearProyecto(proyecto: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/proyectos`, proyecto);
  }

  actualizarProyecto(id: string, proyecto: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/proyectos/${id}`, proyecto);
  }

  eliminarProyecto(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/proyectos/${id}`);
  }

  // ============ INTEGRANTES ============
  obtenerIntegrantes(proyectoId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${proyectoId}/integrantes`);
  }

  agregarIntegrante(proyectoId: string, integrante: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/proyectos/${proyectoId}/integrantes`, integrante);
  }

  eliminarIntegrante(proyectoId: string, integranteId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/proyectos/${proyectoId}/integrantes/${integranteId}`);
  }

  // ============ ACTIVIDADES ============
  obtenerActividades(proyectoId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${proyectoId}/actividades`);
  }

  obtenerActividad(proyectoId: string, actividadId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${proyectoId}/actividades/${actividadId}`);
  }

  crearActividad(proyectoId: string, actividad: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/proyectos/${proyectoId}/actividades`, actividad);
  }

  actualizarActividad(proyectoId: string, actividadId: string, actividad: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/proyectos/${proyectoId}/actividades/${actividadId}`, actividad);
  }

  eliminarActividad(proyectoId: string, actividadId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/proyectos/${proyectoId}/actividades/${actividadId}`);
  }

  // ============ HITOS ============
  obtenerHitos(proyectoId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${proyectoId}/hitos`);
  }

  crearHito(proyectoId: string, hito: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/proyectos/${proyectoId}/hitos`, hito);
  }

  // ============ ACTIVIDAD RECIENTE ============
  obtenerActividadReciente(proyectoId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${proyectoId}/actividad-reciente`);
  }

  // ============ ESTADÍSTICAS ============
  obtenerEstadisticas(proyectoId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/proyectos/${proyectoId}/estadisticas`);
  }

  // ============ HEADERS CON TOKEN ============
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}