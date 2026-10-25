import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpResponse
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

const CACHE_PREFIX = 'orbita_http_cache:';

function obtenerScopeUsuario(): string {
  try {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      const usuario = JSON.parse(usuarioStr);
      const id = usuario?.id_usuario ?? usuario?.id ?? usuario?.correo;
      if (id != null) {
        return String(id);
      }
    }
  } catch {
    // Ignorar error de parseo
  }
  return 'anon';
}

function construirClaveCache(url: string): string {
  return `${CACHE_PREFIX}${obtenerScopeUsuario()}:${url}`;
}

function guardarEnCacheLocal(url: string, body: unknown): void {
  if (body === undefined || body instanceof Blob) {
    return;
  }

  try {
    const payload = JSON.stringify({
      timestamp: Date.now(),
      data: body
    });
    localStorage.setItem(construirClaveCache(url), payload);
  } catch {
    // Si localStorage se llena, limpiamos entradas antiguas del caché HTTP
    try {
      const clavesAEliminar: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const clave = localStorage.key(i);
        if (clave && clave.startsWith(CACHE_PREFIX)) {
          clavesAEliminar.push(clave);
        }
      }
      clavesAEliminar.forEach((clave) => localStorage.removeItem(clave));
      localStorage.setItem(
        construirClaveCache(url),
        JSON.stringify({ timestamp: Date.now(), data: body })
      );
    } catch {
      // Ignorar si aún no hay espacio
    }
  }
}

function leerDeCacheLocal(url: string): { found: boolean; data: unknown } {
  try {
    const raw = localStorage.getItem(construirClaveCache(url));
    if (!raw) {
      return { found: false, data: null };
    }
    const parsed = JSON.parse(raw);
    return { found: true, data: parsed.data };
  } catch {
    return { found: false, data: null };
  }
}

function buscarProyectoEnListaCacheada(idProyecto: number): unknown | null {
  try {
    const scope = obtenerScopeUsuario();
    const prefijoScope = `${CACHE_PREFIX}${scope}:`;

    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (
        clave &&
        clave.startsWith(prefijoScope) &&
        /\/proyectos\/?$/.test(clave)
      ) {
        const raw = localStorage.getItem(clave);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.data)) {
          const encontrado = parsed.data.find(
            (p: any) => Number(p?.id_proyecto ?? p?.id) === idProyecto
          );
          if (encontrado) {
            return encontrado;
          }
        }
      }
    }
  } catch {
    // Ignorar error de lectura
  }
  return null;
}

function buscarTareasProyectoEnCache(idProyecto: number): any[] {
  try {
    const scope = obtenerScopeUsuario();
    const prefijoScope = `${CACHE_PREFIX}${scope}:`;

    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (
        clave &&
        clave.startsWith(prefijoScope) &&
        new RegExp(`\\/proyectos\\/${idProyecto}\\/tareas\\/?$`).test(clave)
      ) {
        const raw = localStorage.getItem(clave);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.data)) {
          return parsed.data;
        }
      }
    }
  } catch {
    // Ignorar error de lectura
  }
  return [];
}

function buscarTareaPorIdEnCache(idTarea: number): any | null {
  try {
    const scope = obtenerScopeUsuario();
    const prefijoScope = `${CACHE_PREFIX}${scope}:`;

    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (
        clave &&
        clave.startsWith(prefijoScope) &&
        /\/(tareas|mis-tareas|todas-mis-tareas)\/?$/.test(clave)
      ) {
        const raw = localStorage.getItem(clave);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.data)) {
          const encontrada = parsed.data.find(
            (t: any) => Number(t?.id_tarea) === idTarea
          );
          if (encontrada) {
            return encontrada;
          }
        }
      }
    }
  } catch {
    // Ignorar error de lectura
  }
  return null;
}

function inferirFallbackOffline(url: string): { match: boolean; data: unknown } {
  try {
    const path = new URL(url, window.location.origin).pathname;

    // GET /proyectos/:id -> intentar reconstruir desde la lista de proyectos cacheada
    const matchProyecto = path.match(/^\/proyectos\/(\d+)\/?$/);
    if (matchProyecto) {
      const idProyecto = Number(matchProyecto[1]);
      const proyectoCacheado = buscarProyectoEnListaCacheada(idProyecto);
      if (proyectoCacheado) {
        return { match: true, data: proyectoCacheado };
      }
      return {
        match: true,
        data: {
          id_proyecto: idProyecto,
          nombre: `Proyecto #${idProyecto}`,
          descripcion: 'Vista en modo sin conexión.',
          estado: 'Activo'
        }
      };
    }

    // GET /proyectos/:id/calendario -> reconstruir desde proyecto + tareas cacheadas
    const matchCalendarioProyecto = path.match(
      /^\/proyectos\/(\d+)\/calendario\/?$/
    );
    if (matchCalendarioProyecto) {
      const idProyecto = Number(matchCalendarioProyecto[1]);
      const proyecto = buscarProyectoEnListaCacheada(idProyecto) ?? {
        id_proyecto: idProyecto,
        nombre: `Proyecto #${idProyecto}`,
        descripcion: null,
        estado: 'Activo'
      };
      const tareas = buscarTareasProyectoEnCache(idProyecto);
      return {
        match: true,
        data: {
          proyecto,
          id_rol: 2,
          es_administrador: false,
          tareas
        }
      };
    }

    // GET /tareas/:id/detalle -> reconstruir desde tareas cacheadas si existe
    const matchDetalleTarea = path.match(/^\/tareas\/(\d+)\/detalle\/?$/);
    if (matchDetalleTarea) {
      const idTarea = Number(matchDetalleTarea[1]);
      const tareaCacheada = buscarTareaPorIdEnCache(idTarea);
      if (tareaCacheada) {
        return {
          match: true,
          data: {
            tarea: tareaCacheada,
            comentarios: [],
            evidencias: [],
            permisos: {
              es_responsable: false,
              es_administrador: false,
              puede_tomar: false,
              puede_comentar: false,
              puede_agregar_evidencia: false,
              puede_editar_tarea: false,
              puede_cambiar_responsable: false,
              puede_eliminar_tarea: false
            }
          }
        };
      }
    }

    // Endpoints que devuelven arreglos
    if (
      /^\/proyectos\/?$/.test(path) ||
      /^\/proyectos\/calendario\/todas-mis-tareas\/?$/.test(path) ||
      /^\/proyectos\/\d+\/(tareas|mis-tareas|colaboradores)\/?$/.test(path) ||
      /^\/notificaciones\/?$/.test(path) ||
      /^\/mensajes\/conversaciones\/?$/.test(path) ||
      /^\/mensajes\/historial\/conversaciones\/[^/]+\/?$/.test(path)
    ) {
      return { match: true, data: [] };
    }
  } catch {
    // Ignorar URL inválida
  }

  return { match: false, data: null };
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');

  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req;

  const esGetCacheable =
    authReq.method === 'GET' && authReq.responseType === 'json';

  // Si el navegador reporta que está completamente offline y es una petición GET,
  // podemos responder de inmediato desde el respaldo local sin esperar timeouts.
  if (esGetCacheable && typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = leerDeCacheLocal(authReq.urlWithParams);
    if (cached.found) {
      return of(
        new HttpResponse({
          status: 200,
          body: cached.data,
          url: authReq.urlWithParams
        })
      );
    }

    const fallback = inferirFallbackOffline(authReq.urlWithParams);
    if (fallback.match) {
      return of(
        new HttpResponse({
          status: 200,
          body: fallback.data,
          url: authReq.urlWithParams
        })
      );
    }
  }

  return next(authReq).pipe(
    tap((event) => {
      if (esGetCacheable && event instanceof HttpResponse && event.ok) {
        guardarEnCacheLocal(authReq.urlWithParams, event.body);
      }
    }),
    catchError((error: HttpErrorResponse) => {
      const esFalloRed =
        error.status === 0 ||
        error.status === 504 ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (esGetCacheable && esFalloRed) {
        const cached = leerDeCacheLocal(authReq.urlWithParams);
        if (cached.found) {
          return of(
            new HttpResponse({
              status: 200,
              body: cached.data,
              url: authReq.urlWithParams
            })
          );
        }

        const fallback = inferirFallbackOffline(authReq.urlWithParams);
        if (fallback.match) {
          return of(
            new HttpResponse({
              status: 200,
              body: fallback.data,
              url: authReq.urlWithParams
            })
          );
        }
      }

      return throwError(() => error);
    })
  );
};
