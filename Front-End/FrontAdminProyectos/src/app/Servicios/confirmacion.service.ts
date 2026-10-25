import {
  Injectable
} from '@angular/core';

import {
  BehaviorSubject
} from 'rxjs';


export type TipoConfirmacion =
  | 'danger'
  | 'warning'
  | 'info';


export interface ConfiguracionConfirmacion {
  titulo: string;
  mensaje: string;

  detalle?: string;

  tipo?: TipoConfirmacion;

  textoBotonConfirmar?: string;
  textoBotonCancelar?: string;

  /*
   * Cuando existe, el usuario debe escribir
   * exactamente este texto para continuar.
   */
  textoConfirmacion?: string;

  placeholderConfirmacion?: string;

  ignorarMayusculas?: boolean;
}


@Injectable({
  providedIn: 'root'
})
export class ConfirmacionService {

  private configuracionSubject =
    new BehaviorSubject<
      ConfiguracionConfirmacion | null
    >(null);

  readonly configuracion$ =
    this.configuracionSubject.asObservable();

  private resolver:
    ((respuesta: boolean) => void) |
    null = null;


  solicitar(
    configuracion:
      ConfiguracionConfirmacion
  ): Promise<boolean> {

    /*
     * Evita dejar una confirmación anterior
     * esperando una respuesta.
     */
    if (this.resolver) {
      this.resolver(false);
      this.resolver = null;
    }

    const configuracionCompleta:
      ConfiguracionConfirmacion = {

      tipo: 'warning',

      textoBotonConfirmar:
        'Confirmar',

      textoBotonCancelar:
        'Cancelar',

      ignorarMayusculas:
        false,

      ...configuracion
    };

    return new Promise<boolean>(
      (resolve) => {
        this.resolver = resolve;

        this.configuracionSubject.next(
          configuracionCompleta
        );
      }
    );
  }


  aceptar(): void {
    this.cerrar(true);
  }


  cancelar(): void {
    this.cerrar(false);
  }


  private cerrar(
    respuesta: boolean
  ): void {
    const resolverActual =
      this.resolver;

    this.resolver = null;

    this.configuracionSubject.next(
      null
    );

    resolverActual?.(
      respuesta
    );
  }
}