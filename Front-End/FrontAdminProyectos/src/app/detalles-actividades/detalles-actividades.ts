import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { finalize, Observable, of, switchMap } from 'rxjs';

import {
  ApiServicio,
  ComentarioTarea,
  DetalleTarea,
  EstadoTareaApi,
  EvidenciaTarea,
  PrioridadTareaApi,
  TareaApi,
  TareaUpdatePayload,
  UsuarioTarea,
} from '../Servicios/api.servicio';

import {
  ConfirmacionService
} from '../Servicios/confirmacion.service';


interface FormularioEdicionTarea {
  titulo: string;
  descripcion: string;
  prioridad: PrioridadTareaApi;
  estado: EstadoTareaApi;
  fecha_inicio: string;
  fecha_limite: string;
  id_usuario_asignado: number | null;
}

@Component({
  selector: 'app-detalles-actividades',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './detalles-actividades.html',
  styleUrl: './detalles-actividades.css',
})
export class DetallesActividades implements OnChanges {
  private apiServicio = inject(ApiServicio);

  private confirmacionService =
  inject(ConfirmacionService);

  @Input() tarea: TareaApi | null = null;

  @Output() cerrar = new EventEmitter<void>();

  @Output()
  tareaActualizada = new EventEmitter<TareaApi>();

  @Output()
  tareaEliminada = new EventEmitter<number>();

  detalle: DetalleTarea | null = null;

  colaboradores: UsuarioTarea[] = [];

  cargandoDetalle = false;
  cargandoColaboradores = false;
  tomandoActividad = false;
  guardandoTarea = false;
  eliminandoTarea = false;

  errorMessage = '';
  successMessage = '';

  modoEdicion = false;

  formularioEdicion: FormularioEdicionTarea = {
    titulo: '',
    descripcion: '',
    prioridad: 'Media',
    estado: 'Pendiente por asignar',
    fecha_inicio: '',
    fecha_limite: '',
    id_usuario_asignado: null,
  };

  // Comentarios
  nuevoComentario = '';
  enviandoComentario = false;

  comentarioEditandoId: number | null = null;
  contenidoComentarioEditado = '';
  guardandoComentario = false;
  eliminandoComentarioId: number | null = null;

  // Evidencias
  tipoEvidencia: 'archivo' | 'enlace' = 'archivo';

  nombreEvidencia = '';
  descripcionEvidencia = '';
  urlEvidencia = '';

  archivoSeleccionado: File | null = null;

  subiendoEvidencia = false;
  eliminandoEvidenciaId: number | null = null;
  descargandoEvidenciaId: number | null = null;
  abriendoEvidenciaId: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['tarea']) {
      return;
    }

    this.reiniciarEstadoModal();

    if (this.tarea?.id_tarea) {
      this.cargarDetalle();
    }
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    if (this.tarea) {
      this.cerrarModal();
    }
  }

  cerrarModal(): void {
    this.cerrar.emit();
  }

  cargarDetalle(emitirActualizacion = false): void {
    const idTarea = Number(this.tarea?.id_tarea);

    if (!Number.isInteger(idTarea) || idTarea <= 0) {
      this.errorMessage = 'No se pudo identificar la actividad.';
      return;
    }

    this.cargandoDetalle = true;
    this.errorMessage = '';

    this.apiServicio
      .obtenerDetalleTarea(idTarea)
      .pipe(
        finalize(() => {
          this.cargandoDetalle = false;
        })
      )
      .subscribe({
        next: (detalle) => {
          this.detalle = detalle;
          this.prepararFormularioEdicion();

          if (detalle.permisos.es_administrador) {
            this.cargarColaboradores(detalle.tarea.id_proyecto);
          }

          if (emitirActualizacion) {
            this.tareaActualizada.emit(detalle.tarea);
          }
        },
        error: (error) => {
          this.errorMessage = this.obtenerMensajeError(
            error,
            'No fue posible cargar el detalle de la actividad.'
          );
        },
      });
  }

  reintentarCarga(): void {
    this.cargarDetalle();
  }

  // =========================================================
  // EDICIÓN DE LA TAREA
  // =========================================================

  activarEdicion(): void {
    if (!this.detalle?.permisos.puede_editar_tarea) {
      return;
    }

    this.limpiarMensajes();
    this.prepararFormularioEdicion();
    this.modoEdicion = true;
  }

  cancelarEdicion(): void {
    this.prepararFormularioEdicion();
    this.modoEdicion = false;
  }

  guardarCambios(): void {
    if (!this.detalle) {
      return;
    }

    const titulo = this.formularioEdicion.titulo.trim();

    if (!titulo) {
      this.errorMessage = 'El título de la actividad es obligatorio.';
      return;
    }

    if (
      this.formularioEdicion.fecha_inicio &&
      this.formularioEdicion.fecha_limite &&
      new Date(this.formularioEdicion.fecha_limite) < new Date(this.formularioEdicion.fecha_inicio)
    ) {
      this.errorMessage = 'La fecha límite no puede ser anterior a la fecha de inicio.';

      return;
    }

    const tareaActual = this.detalle.tarea;
    const idTarea = tareaActual.id_tarea;

    const responsableOriginal = tareaActual.usuario_asignado?.id_usuario ?? null;

    const cambioEstado = this.formularioEdicion.estado !== tareaActual.estado;

    const cambioResponsable = this.formularioEdicion.id_usuario_asignado !== responsableOriginal;

    const datos: TareaUpdatePayload = {
      titulo,
      descripcion: this.formularioEdicion.descripcion.trim() || null,
      prioridad: this.formularioEdicion.prioridad,
      fecha_inicio: this.formularioEdicion.fecha_inicio || null,
      fecha_limite: this.formularioEdicion.fecha_limite || null,
    };

    this.guardandoTarea = true;
    this.limpiarMensajes();

    let solicitud: Observable<unknown> = this.apiServicio.editarTarea(idTarea, datos);

    solicitud = solicitud.pipe(
      switchMap(() => {
        if (!cambioEstado) {
          return of(null);
        }

        return this.apiServicio.cambiarEstadoTarea(idTarea, this.formularioEdicion.estado);
      }),

      switchMap(() => {
        if (!cambioResponsable) {
          return of(null);
        }

        return this.apiServicio.asignarTarea(idTarea, this.formularioEdicion.id_usuario_asignado);
      }),

      finalize(() => {
        this.guardandoTarea = false;
      })
    );

    solicitud.subscribe({
      next: () => {
        this.modoEdicion = false;
        this.successMessage = 'La actividad fue actualizada correctamente.';

        this.apiServicio.notificarCambio();
        this.cargarDetalle(true);
      },
      error: (error) => {
        this.errorMessage = this.obtenerMensajeError(error, 'No fue posible guardar los cambios.');
      },
    });
  }

  async eliminarActividad(): Promise<void> {
    if (
      !this.detalle?.permisos.puede_eliminar_tarea ||
      this.eliminandoTarea
    ) {
      return;
    }

    const tarea = this.detalle.tarea;
    const titulo =
      tarea.titulo?.trim() ||
      'esta actividad';

    const confirmado =
      await this.confirmacionService.solicitar({
        titulo: 'Eliminar actividad',
        mensaje:
          `¿Deseas eliminar la actividad "${titulo}"?`,
        detalle:
          'También se eliminarán permanentemente sus comentarios y evidencias. Esta acción no se puede deshacer.',
        tipo: 'danger',
        textoBotonConfirmar:
          'Eliminar actividad',
      });

    if (!confirmado) {
      return;
    }

    const idTarea = tarea.id_tarea;

    this.eliminandoTarea = true;
    this.limpiarMensajes();

    this.apiServicio
      .eliminarTarea(idTarea)
      .pipe(
        finalize(() => {
          this.eliminandoTarea = false;
        })
      )
      .subscribe({
        next: () => {
          this.apiServicio.notificarCambio();
          this.tareaEliminada.emit(idTarea);
          this.cerrarModal();
        },
        error: (error) => {
          this.errorMessage =
            this.obtenerMensajeError(
              error,
              'No fue posible eliminar la actividad.'
            );
        },
      });
  }

  // =========================================================
  // TOMAR ACTIVIDAD
  // =========================================================

  tomarActividad(): void {
    if (!this.detalle?.permisos.puede_tomar || this.tomandoActividad) {
      return;
    }

    this.tomandoActividad = true;
    this.limpiarMensajes();

    this.apiServicio
      .tomarTarea(this.detalle.tarea.id_tarea)
      .pipe(
        finalize(() => {
          this.tomandoActividad = false;
        })
      )
      .subscribe({
        next: (respuesta) => {
          this.successMessage = respuesta.mensaje;

          this.apiServicio.notificarCambio();
          this.cargarDetalle(true);
        },
        error: (error) => {
          this.errorMessage = this.obtenerMensajeError(error, 'No fue posible tomar la actividad.');

          if (error?.status === 409) {
            this.cargarDetalle();
          }
        },
      });
  }

  // =========================================================
  // COMENTARIOS
  // =========================================================

  enviarComentario(): void {
    if (!this.detalle?.permisos.puede_comentar || this.enviandoComentario) {
      return;
    }

    const contenido = this.nuevoComentario.trim();

    if (!contenido) {
      return;
    }

    this.enviandoComentario = true;
    this.errorMessage = '';

    this.apiServicio
      .crearComentario(this.detalle.tarea.id_tarea, contenido)
      .pipe(
        finalize(() => {
          this.enviandoComentario = false;
        })
      )
      .subscribe({
        next: (comentario) => {
          this.detalle?.comentarios.push(comentario);
          this.nuevoComentario = '';
        },
        error: (error) => {
          this.errorMessage = this.obtenerMensajeError(
            error,
            'No fue posible publicar el comentario.'
          );
        },
      });
  }

  iniciarEdicionComentario(comentario: ComentarioTarea): void {
    if (!comentario.puede_editar) {
      return;
    }

    this.comentarioEditandoId = comentario.id_comentario;

    this.contenidoComentarioEditado = comentario.contenido;
  }

  cancelarEdicionComentario(): void {
    this.comentarioEditandoId = null;
    this.contenidoComentarioEditado = '';
  }

  guardarComentario(comentario: ComentarioTarea): void {
    if (this.guardandoComentario || !comentario.puede_editar) {
      return;
    }

    const contenido = this.contenidoComentarioEditado.trim();

    if (!contenido) {
      this.errorMessage = 'El comentario no puede estar vacío.';

      return;
    }

    this.guardandoComentario = true;
    this.errorMessage = '';

    this.apiServicio
      .editarComentario(comentario.id_comentario, contenido)
      .pipe(
        finalize(() => {
          this.guardandoComentario = false;
        })
      )
      .subscribe({
        next: (comentarioActualizado) => {
          if (!this.detalle) {
            return;
          }

          const indice = this.detalle.comentarios.findIndex(
            (item) => item.id_comentario === comentarioActualizado.id_comentario
          );

          if (indice !== -1) {
            this.detalle.comentarios[indice] = comentarioActualizado;
          }

          this.cancelarEdicionComentario();
        },
        error: (error) => {
          this.errorMessage = this.obtenerMensajeError(
            error,
            'No fue posible editar el comentario.'
          );
        },
      });
  }

  async eliminarComentario(
    comentario: ComentarioTarea
  ): Promise<void> {
    if (
      !comentario.puede_eliminar ||
      this.eliminandoComentarioId !== null
    ) {
      return;
    }

    const contenido =
      comentario.contenido?.trim() ||
      'Comentario sin contenido';

    const resumen =
      contenido.length > 220
        ? `${contenido.slice(0, 220)}…`
        : contenido;

    const confirmado =
      await this.confirmacionService.solicitar({
        titulo: 'Eliminar comentario',
        mensaje:
          '¿Deseas eliminar este comentario?',
        detalle: resumen,
        tipo: 'danger',
        textoBotonConfirmar:
          'Eliminar comentario',
      });

    if (!confirmado) {
      return;
    }

    this.eliminandoComentarioId =
      comentario.id_comentario;

    this.errorMessage = '';

    this.apiServicio
      .eliminarComentario(
        comentario.id_comentario
      )
      .pipe(
        finalize(() => {
          this.eliminandoComentarioId = null;
        })
      )
      .subscribe({
        next: () => {
          if (!this.detalle) {
            return;
          }

          this.detalle.comentarios =
            this.detalle.comentarios.filter(
              (item) =>
                item.id_comentario !==
                comentario.id_comentario
            );
        },
        error: (error) => {
          this.errorMessage =
            this.obtenerMensajeError(
              error,
              'No fue posible eliminar el comentario.'
            );
        },
      });
  }

  // =========================================================
  // EVIDENCIAS
  // =========================================================

  cambiarTipoEvidencia(tipo: 'archivo' | 'enlace'): void {
    this.tipoEvidencia = tipo;
    this.errorMessage = '';
  }

  seleccionarArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;

    const archivo = input.files?.[0] ?? null;

    if (!archivo) {
      this.archivoSeleccionado = null;
      return;
    }

    const maximoBytes = 10 * 1024 * 1024;

    if (archivo.size > maximoBytes) {
      this.archivoSeleccionado = null;
      input.value = '';

      this.errorMessage = 'El archivo no puede superar los 10 MB.';

      return;
    }

    this.archivoSeleccionado = archivo;

    if (!this.nombreEvidencia.trim()) {
      this.nombreEvidencia = archivo.name;
    }
  }

  subirArchivo(): void {
    if (!this.detalle || !this.archivoSeleccionado || this.subiendoEvidencia) {
      return;
    }

    const formData = new FormData();

    formData.append('archivo', this.archivoSeleccionado);

    if (this.nombreEvidencia.trim()) {
      formData.append('nombre', this.nombreEvidencia.trim());
    }

    if (this.descripcionEvidencia.trim()) {
      formData.append('descripcion', this.descripcionEvidencia.trim());
    }

    this.subiendoEvidencia = true;
    this.errorMessage = '';

    this.apiServicio
      .subirEvidenciaArchivo(this.detalle.tarea.id_tarea, formData)
      .pipe(
        finalize(() => {
          this.subiendoEvidencia = false;
        })
      )
      .subscribe({
        next: (evidencia) => {
          this.detalle?.evidencias.unshift(evidencia);
          this.limpiarFormularioEvidencia();
        },
        error: (error) => {
          this.errorMessage = this.obtenerMensajeError(error, 'No fue posible subir el archivo.');
        },
      });
  }

  agregarEnlace(): void {
    if (!this.detalle || this.subiendoEvidencia) {
      return;
    }

    const nombre = this.nombreEvidencia.trim();

    const url = this.urlEvidencia.trim();

    if (!nombre) {
      this.errorMessage = 'Escribe un nombre para el enlace.';

      return;
    }

    if (!this.esUrlValida(url)) {
      this.errorMessage = 'Escribe un enlace válido que comience con http:// o https://.';

      return;
    }

    this.subiendoEvidencia = true;
    this.errorMessage = '';

    this.apiServicio
      .agregarEvidenciaEnlace(this.detalle.tarea.id_tarea, {
        nombre,
        descripcion: this.descripcionEvidencia.trim() || null,
        url,
      })
      .pipe(
        finalize(() => {
          this.subiendoEvidencia = false;
        })
      )
      .subscribe({
        next: (evidencia) => {
          this.detalle?.evidencias.unshift(evidencia);
          this.limpiarFormularioEvidencia();
        },
        error: (error) => {
          this.errorMessage = this.obtenerMensajeError(error, 'No fue posible agregar el enlace.');
        },
      });
  }
  puedePrevisualizar(evidencia: EvidenciaTarea): boolean {
    if (evidencia.tipo !== 'archivo') {
      return false;
    }

    const tipoMime = (evidencia.tipo_mime ?? '').toLowerCase();

    if (tipoMime === 'application/pdf' || tipoMime.startsWith('image/')) {
      return true;
    }

    const nombreArchivo = (
      evidencia.nombre_archivo_original ||
      evidencia.nombre ||
      ''
    ).toLowerCase();

    return /\.(pdf|png|jpg|jpeg|webp|gif)$/.test(nombreArchivo);
  }
  abrirEvidencia(evidencia: EvidenciaTarea): void {
    if (!this.puedePrevisualizar(evidencia) || this.abriendoEvidenciaId !== null) {
      return;
    }

    /*
     * La pestaña debe abrirse inmediatamente desde el clic.
     * De lo contrario, el navegador podría bloquearla
     * como una ventana emergente.
     */
    const nuevaPestana = window.open('about:blank', '_blank');

    if (!nuevaPestana) {
      this.errorMessage =
        'El navegador bloqueó la nueva pestaña. Permite las ventanas emergentes para este sitio.';

      return;
    }

    nuevaPestana.opener = null;

    nuevaPestana.document.title = 'Cargando evidencia...';

    nuevaPestana.document.body.innerHTML = `
    <div style="
      font-family: Arial, sans-serif;
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      margin: 0;
      color: #374151;
      background: #f9fafb;
    ">
      Cargando evidencia...
    </div>
  `;

    this.abriendoEvidenciaId = evidencia.id_evidencia;

    this.errorMessage = '';

    this.apiServicio
      .descargarEvidencia(evidencia.id_evidencia)
      .pipe(
        finalize(() => {
          this.abriendoEvidenciaId = null;
        })
      )
      .subscribe({
        next: (archivo: Blob) => {
          const tipoMime = evidencia.tipo_mime || archivo.type || 'application/octet-stream';

          /*
           * Conservamos el MIME correcto para que el navegador
           * sepa si debe mostrar un PDF o una imagen.
           */
          const archivoVisualizable = archivo.type
            ? archivo
            : new Blob([archivo], {
                type: tipoMime,
              });

          const urlTemporal = URL.createObjectURL(archivoVisualizable);

          nuevaPestana.location.href = urlTemporal;

          /*
           * La URL solamente existe temporalmente.
           * Se libera después de unos minutos para evitar
           * mantener memoria ocupada indefinidamente.
           */
          window.setTimeout(() => {
            URL.revokeObjectURL(urlTemporal);
          }, 5 * 60 * 1000);
        },

        error: (error) => {
          nuevaPestana.close();

          this.errorMessage = this.obtenerMensajeError(error, 'No fue posible abrir la evidencia.');
        },
      });
  }
  descargarEvidencia(evidencia: EvidenciaTarea): void {
    if (evidencia.tipo !== 'archivo' || this.descargandoEvidenciaId !== null) {
      return;
    }

    this.descargandoEvidenciaId = evidencia.id_evidencia;

    this.errorMessage = '';

    this.apiServicio
      .descargarEvidencia(evidencia.id_evidencia)
      .pipe(
        finalize(() => {
          this.descargandoEvidenciaId = null;
        })
      )
      .subscribe({
        next: (archivo) => {
          const urlTemporal = URL.createObjectURL(archivo);

          const enlace = document.createElement('a');

          enlace.href = urlTemporal;

          enlace.download = evidencia.nombre_archivo_original || evidencia.nombre || 'evidencia';

          document.body.appendChild(enlace);
          enlace.click();
          enlace.remove();

          URL.revokeObjectURL(urlTemporal);
        },
        error: (error) => {
          this.errorMessage = this.obtenerMensajeError(
            error,
            'No fue posible descargar el archivo.'
          );
        },
      });
  }

  async eliminarEvidencia(
    evidencia: EvidenciaTarea
  ): Promise<void> {
    if (
      !evidencia.puede_eliminar ||
      this.eliminandoEvidenciaId !== null
    ) {
      return;
    }

    const nombre =
      evidencia.nombre?.trim() ||
      evidencia.nombre_archivo_original?.trim() ||
      'esta evidencia';

    const tipoContenido =
      evidencia.tipo === 'archivo'
        ? 'El archivo dejará de estar disponible para los integrantes del proyecto.'
        : 'El enlace dejará de estar disponible para los integrantes del proyecto.';

    const confirmado =
      await this.confirmacionService.solicitar({
        titulo: 'Eliminar evidencia',
        mensaje:
          `¿Deseas eliminar la evidencia "${nombre}"?`,
        detalle:
          `${tipoContenido} Esta acción no se puede deshacer.`,
        tipo: 'danger',
        textoBotonConfirmar:
          'Eliminar evidencia',
      });

    if (!confirmado) {
      return;
    }

    this.eliminandoEvidenciaId =
      evidencia.id_evidencia;

    this.errorMessage = '';

    this.apiServicio
      .eliminarEvidencia(
        evidencia.id_evidencia
      )
      .pipe(
        finalize(() => {
          this.eliminandoEvidenciaId = null;
        })
      )
      .subscribe({
        next: () => {
          if (!this.detalle) {
            return;
          }

          this.detalle.evidencias =
            this.detalle.evidencias.filter(
              (item) =>
                item.id_evidencia !==
                evidencia.id_evidencia
            );
        },
        error: (error) => {
          this.errorMessage =
            this.obtenerMensajeError(
              error,
              'No fue posible eliminar la evidencia.'
            );
        },
      });
  }

  // =========================================================
  // COLABORADORES
  // =========================================================

  private cargarColaboradores(idProyecto: number): void {
    this.cargandoColaboradores = true;

    this.apiServicio
      .obtenerColaboradores(idProyecto)
      .pipe(
        finalize(() => {
          this.cargandoColaboradores = false;
        })
      )
      .subscribe({
        next: (respuesta) => {
          const lista = Array.isArray(respuesta) ? respuesta : respuesta?.colaboradores ?? [];

          this.colaboradores = lista
            .map((item: any) => {
              const usuario = item?.usuario ?? item;

              return {
                id_usuario: Number(usuario?.id_usuario),
                nombre: usuario?.nombre ?? '',
                apellido: usuario?.apellido ?? '',
                correo: usuario?.correo ?? '',
              };
            })
            .filter(
              (usuario: UsuarioTarea) =>
                Number.isInteger(usuario.id_usuario) && usuario.id_usuario > 0
            );
        },
        error: () => {
          this.colaboradores = [];
        },
      });
  }

  // =========================================================
  // UTILIDADES
  // =========================================================

  private prepararFormularioEdicion(): void {
    if (!this.detalle) {
      return;
    }

    const tarea = this.detalle.tarea;

    this.formularioEdicion = {
      titulo: tarea.titulo ?? '',
      descripcion: tarea.descripcion ?? '',
      prioridad: (tarea.prioridad as PrioridadTareaApi) ?? 'Media',
      estado: tarea.estado as EstadoTareaApi,
      fecha_inicio: this.convertirFechaParaInput(tarea.fecha_inicio),
      fecha_limite: this.convertirFechaParaInput(tarea.fecha_limite),
      id_usuario_asignado: tarea.usuario_asignado?.id_usuario ?? null,
    };
  }

  private convertirFechaParaInput(valor: string | null): string {
    if (!valor) {
      return '';
    }

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
      return valor.slice(0, 16);
    }

    const desplazamiento = fecha.getTimezoneOffset() * 60000;

    return new Date(fecha.getTime() - desplazamiento).toISOString().slice(0, 16);
  }

  private esUrlValida(valor: string): boolean {
    try {
      const url = new URL(valor);

      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private limpiarFormularioEvidencia(): void {
    this.nombreEvidencia = '';
    this.descripcionEvidencia = '';
    this.urlEvidencia = '';
    this.archivoSeleccionado = null;
  }

  private reiniciarEstadoModal(): void {
    this.detalle = null;
    this.colaboradores = [];

    this.modoEdicion = false;

    this.errorMessage = '';
    this.successMessage = '';

    this.nuevoComentario = '';
    this.cancelarEdicionComentario();

    this.tipoEvidencia = 'archivo';
    this.limpiarFormularioEvidencia();
  }

  private limpiarMensajes(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private obtenerMensajeError(error: any, mensajePredeterminado: string): string {
    const detalle = error?.error?.detail;

    if (typeof detalle === 'string') {
      return detalle;
    }

    if (Array.isArray(detalle)) {
      return detalle.map((item: any) => item?.msg ?? 'Dato no válido').join('. ');
    }

    if (typeof error?.message === 'string') {
      return error.message;
    }

    return mensajePredeterminado;
  }

  iniciales(usuario: UsuarioTarea | null | undefined): string {
    if (!usuario) {
      return '?';
    }

    const nombre = usuario.nombre?.charAt(0) ?? '';

    const apellido = usuario.apellido?.charAt(0) ?? '';

    return `${nombre}${apellido}`.toUpperCase() || '?';
  }

  formatearTamano(bytes: number | null): string {
    if (bytes === null || bytes === undefined) {
      return '';
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  trackComentario(index: number, comentario: ComentarioTarea): number {
    return comentario.id_comentario;
  }

  trackEvidencia(index: number, evidencia: EvidenciaTarea): number {
    return evidencia.id_evidencia;
  }

  trackColaborador(index: number, usuario: UsuarioTarea): number {
    return usuario.id_usuario;
  }
}