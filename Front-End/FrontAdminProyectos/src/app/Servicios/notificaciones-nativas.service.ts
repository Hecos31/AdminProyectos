import { Injectable } from '@angular/core';

export interface OpcionesNotificacionNativa {
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  vibrate?: number[];
  silent?: boolean;
  requireInteraction?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificacionesNativasService {
  private readonly defaultIcon = '/icons/192.png';
  private readonly defaultBadge = '/icons/192.png';
  private listenerClickInstalado = false;

  constructor() {
    this.instalarListenerDeInteraccion();
  }

  /**
   * Indica si el navegador y sistema operativo soportan notificaciones del sistema
   */
  get soportado(): boolean {
    return (
      typeof window !== 'undefined' &&
      ('Notification' in window || 'serviceWorker' in navigator)
    );
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
   * Instala un listener en el primer gesto del usuario (click/keydown/touchstart)
   * para que navegadores modernos en PC y PWA permitan el diálogo de permiso sin bloqueo.
   */
  private instalarListenerDeInteraccion(): void {
    if (typeof window === 'undefined' || this.listenerClickInstalado) {
      return;
    }
    this.listenerClickInstalado = true;

    const handler = () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void this.solicitarPermiso();
      }
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('touchstart', handler);
    };

    window.addEventListener('click', handler, { once: true, passive: true });
    window.addEventListener('keydown', handler, { once: true, passive: true });
    window.addEventListener('touchstart', handler, { once: true, passive: true });
  }

  /**
   * Calcula los puntos de experiencia (XP) que otorga una tarea al concluirse
   */
  calcularPuntosEntrega(tarea: {
    prioridad?: string | null;
    fecha_limite?: string | null;
  }): { xpTotal: number; xpBase: number; bonusTiempo: number; aTiempo: boolean } {
    const prio = String(tarea?.prioridad ?? 'Media').toLowerCase();
    const xpBase = prio === 'alta' ? 100 : prio === 'media' ? 70 : 45;

    let aTiempo = true;
    let bonusTiempo = 20;

    if (tarea?.fecha_limite) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const limite = new Date(tarea.fecha_limite);
      limite.setHours(0, 0, 0, 0);

      if (Number.isFinite(limite.getTime())) {
        if (hoy.getTime() <= limite.getTime()) {
          aTiempo = true;
          bonusTiempo = 30;
        } else {
          aTiempo = false;
          bonusTiempo = 0;
        }
      }
    }

    return {
      xpTotal: xpBase + bonusTiempo,
      xpBase,
      bonusTiempo,
      aTiempo
    };
  }

  /**
   * Notificación especializada cuando se otorgan puntos por entrega de actividad
   */
  async notificarPuntosPorEntrega(
    tarea: {
      id_tarea?: number;
      titulo?: string | null;
      prioridad?: string | null;
      fecha_limite?: string | null;
    },
    nombreReceptor?: string
  ): Promise<void> {
    const calculo = this.calcularPuntosEntrega(tarea);
    const tituloTarea = tarea?.titulo?.trim() || 'la actividad';
    const detalleTiempo = calculo.aTiempo
      ? `(+${calculo.xpBase} XP prioridad + ${calculo.bonusTiempo} XP entrega puntual)`
      : `(+${calculo.xpBase} XP por prioridad ${tarea?.prioridad || 'Media'})`;

    const prefijoUsuario = nombreReceptor ? `${nombreReceptor}: ` : '';

    await this.mostrarNotificacion(
      `🏆 ¡+${calculo.xpTotal} XP por Entrega de Actividad!`,
      {
        body: `${prefijoUsuario}Has sumado ${calculo.xpTotal} XP en Team Pulse al concluir "${tituloTarea}" ${detalleTiempo}.`,
        tag: `xp-entrega-${tarea?.id_tarea ?? Date.now()}-${Date.now()}`,
        vibrate: [120, 60, 180]
      }
    );
  }

  /**
   * Notificación especializada cuando se genera una Crónica de Reconocimientos con IA
   */
  async notificarCronicaReconocimientosIA(
    nombreProyecto: string,
    cronicaTexto: string
  ): Promise<void> {
    const extracto =
      cronicaTexto.length > 150
        ? `${cronicaTexto.slice(0, 147)}...`
        : cronicaTexto;

    await this.mostrarNotificacion(
      `✨ Crónica de Reconocimientos IA — ${nombreProyecto || 'Órbita'}`,
      {
        body: extracto,
        tag: `cronica-ia-${Date.now()}`,
        vibrate: [100, 50, 120]
      }
    );
  }

  /**
   * Dispara una notificación nativa visible en el sistema operativo:
   * - En navegador de escritorio y PWA instalada en PC (Windows/macOS/Linux):
   *   Prioriza `new Notification()` para garantizar el banner inmediato en el Centro de Notificaciones
   *   de Windows/macOS incluso con la ventana en primer plano, con respaldo en Service Worker.
   * - En dispositivos móviles (Android/iOS):
   *   Usa `ServiceWorkerRegistration.showNotification()` con vibración háptica.
   */
  async mostrarNotificacion(
    titulo: string,
    opciones: OpcionesNotificacionNativa
  ): Promise<void> {
    if (!this.soportado) {
      return;
    }

    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const concedido = await this.solicitarPermiso();
      if (!concedido) {
        return;
      }
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const iconUrl = opciones.icon
      ? opciones.icon.startsWith('http')
        ? opciones.icon
        : `${origin}${opciones.icon.startsWith('/') ? '' : '/'}${opciones.icon}`
      : `${origin}${this.defaultIcon}`;

    const badgeUrl = opciones.badge
      ? opciones.badge.startsWith('http')
        ? opciones.badge
        : `${origin}${opciones.badge.startsWith('/') ? '' : '/'}${opciones.badge}`
      : `${origin}${this.defaultBadge}`;

    const tagUnico = opciones.tag || `orbita-${Date.now()}`;

    const configSw: any = {
      body: opciones.body,
      icon: iconUrl,
      badge: badgeUrl,
      tag: tagUnico,
      renotify: true,
      requireInteraction: opciones.requireInteraction ?? false,
      vibrate: opciones.vibrate || [100, 50, 100],
      data: opciones.data,
      silent: opciones.silent ?? false
    };

    const esMovil =
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    // 1. En PC / Navegador de Escritorio y PWA Instalada en PC:
    // Intentar primero new Notification() para asegurar que Windows Action Center y macOS muestren el toast siempre
    if (!esMovil && typeof Notification !== 'undefined') {
      try {
        const notif = new Notification(titulo, {
          body: opciones.body,
          icon: iconUrl,
          badge: badgeUrl,
          tag: tagUnico,
          silent: opciones.silent ?? false,
          data: opciones.data
        });

        notif.onclick = () => {
          try {
            window.focus();
          } catch {
            // ignorar
          }
          notif.close();
        };

        // Activar vibración si el dispositivo la soporta
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(opciones.vibrate || [100, 50, 100]);
          } catch {
            // ignorar
          }
        }
        return;
      } catch (errPc) {
        console.warn(
          '[NOTIFICACIONES NATIVAS] Constructora directa no disponible, usando ServiceWorker:',
          errPc
        );
      }
    }

    // 2. En Móviles (Android/iOS) o como respaldo en PWA instalada: usar Service Worker Registration
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        let reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1500))
          ]);
        }

        if (reg && 'showNotification' in reg) {
          if ('vibrate' in navigator) {
            try {
              navigator.vibrate(opciones.vibrate || [100, 50, 100]);
            } catch {
              // ignorar
            }
          }
          await reg.showNotification(titulo, configSw);
          return;
        }
      }
    } catch (errSw) {
      console.warn(
        '[NOTIFICACIONES NATIVAS] Error en ServiceWorker showNotification, intentando fallback:',
        errSw
      );
    }

    // 3. Último fallback universal
    try {
      if (typeof Notification !== 'undefined') {
        const notif = new Notification(titulo, {
          body: opciones.body,
          icon: iconUrl,
          tag: tagUnico
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
    } catch (errFinal) {
      console.warn('[NOTIFICACIONES NATIVAS] No se pudo mostrar la notificación:', errFinal);
    }
  }
}
