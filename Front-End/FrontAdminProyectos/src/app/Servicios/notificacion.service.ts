import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificacionService {
  private apiUrl = 'http://localhost:8000/notificaciones';

  constructor(private http: HttpClient) {}

  obtenerNotificaciones(): Observable<any[]> {
    // Nota: Asegúrate de tener un interceptor que adjunte el Bearer Token en las cabeceras
    return this.http.get<any[]>(this.apiUrl);
  }
}