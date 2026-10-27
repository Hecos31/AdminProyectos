import { Injectable } from '@angular/core';

export interface OpcionesNotificacionNativa {
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  vibrate?: number[];
  silent?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificacionesNativasService {
  private readonly defaultIcon = '/icons/192.png';
  private readonly defaultBadge = '/icons/192.png';

  /**
   * Indica si el navegador y sistema operativo soportan notificaciones del sistema
   */
  get soportado(): boolean {
    return typeof window !== 'undefined' && ('Notification' in window || 'serviceWorker' in navigator);
  }

  /**
   * Estado actual del permiso ('default', 'granted', 'denied')
   */
  get permiso(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Solicita permiso al usuario para mostrar notificaciones nativas en PC, Web y Móvil
   */
  async solicitarPermiso(): Promise<boolean> {
    if (!this.soportado) {
      return false;
    }

    try {
      if (Notification.permission === 'granted') {
        return true;
      }

      if (Notification.permission !== 'denied') {
        const resultado = await Notification.requestPermission();
        return resultado === 'granted';
      }

      return false;
    } catch (e) {
      console.warn('[NOTIFICACIONES NATIVAS] Error al solicitar permisos:', e);
      return false;
    }
  }

  /**
   * Dispara una notificación nativa visible en el sistema operativo
   * (Centro de notificaciones de Windows, macOS, Android e iOS mediante Service Worker)
   */
  async mostrarNotificacion(titulo: string, opciones: OpcionesNotificacionNativa): Promise<void> {
    if (!this.soportado) {
      return;
    }

    if (Notification.permission !== 'granted') {
      const concedido = await this.solicitarPermiso();
      if (!concedido) {
        return;
      }
    }

    const config: any = {
      body: opciones.body,
      icon: opciones.icon || this.defaultIcon,
      badge: opciones.badge || this.defaultBadge,
      tag: opciones.tag || 'orbita-general',
      vibrate: opciones.vibrate || [100, 50, 100],
      data: opciones.data,
      silent: false
    };

    // 1. En entornos móviles y PWA instalada, usar Service Worker Registration (obligatorio en Android / iOS)
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && 'showNotification' in reg) {
          await reg.showNotification(titulo, config);
          return;
        }
      }
    } catch (err) {
      console.warn('[NOTIFICACIONES NATIVAS] Intento por ServiceWorker falló, intentando API directa:', err);
    }

    // 2. En escritorio / navegadores convencionales, usar la API Notification estándar
    try {
      const notif = new Notification(titulo, config);
      notif.onclick = (e) => {
        window.focus();
        notif.close();
      };
    } catch (err) {
      console.warn('[NOTIFICACIONES NATIVAS] No se pudo lanzar la notificación nativa:', err);
    }
  }
}
