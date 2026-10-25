import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  Subscription
} from 'rxjs';

import {
  ConfiguracionConfirmacion,
  ConfirmacionService
} from '../Servicios/confirmacion.service';


@Component({
  selector:
    'app-confirmacion-modal',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl:
    './confirmacion-modal.html',

  styleUrls: [
    './confirmacion-modal.css'
  ]
})
export class ConfirmacionModalComponent
  implements OnInit, OnDestroy {

  private confirmacionService =
    inject(ConfirmacionService);

  private cdr =
    inject(ChangeDetectorRef);

  private subscription =
    new Subscription();

  @ViewChild(
    'campoConfirmacion'
  )
  private campoConfirmacion?:
    ElementRef<HTMLInputElement>;

  configuracion:
    ConfiguracionConfirmacion |
    null = null;

  textoIngresado = '';


  get requiereTexto(): boolean {
    return Boolean(
      this.configuracion
        ?.textoConfirmacion
    );
  }


  get puedeConfirmar(): boolean {
    if (!this.configuracion) {
      return false;
    }

    const textoEsperado =
      this.configuracion
        .textoConfirmacion;

    if (!textoEsperado) {
      return true;
    }

    const ingresado =
      this.textoIngresado.trim();

    const esperado =
      textoEsperado.trim();

    if (
      this.configuracion
        .ignorarMayusculas
    ) {
      return (
        ingresado.toLocaleLowerCase() ===
        esperado.toLocaleLowerCase()
      );
    }

    return ingresado === esperado;
  }


  ngOnInit(): void {
    this.subscription.add(
      this.confirmacionService
        .configuracion$
        .subscribe(
          (configuracion) => {
            this.configuracion =
              configuracion;

            this.textoIngresado = '';

            document.body.style.overflow =
              configuracion
                ? 'hidden'
                : '';

            this.cdr.detectChanges();

            if (
              configuracion
                ?.textoConfirmacion
            ) {
              window.requestAnimationFrame(
                () => {
                  this.campoConfirmacion
                    ?.nativeElement
                    .focus();
                }
              );
            }
          }
        )
    );
  }


  ngOnDestroy(): void {
    this.subscription.unsubscribe();

    document.body.style.overflow = '';
  }


  confirmar(): void {
    if (!this.puedeConfirmar) {
      return;
    }

    this.confirmacionService.aceptar();
  }


  cancelar(): void {
    this.confirmacionService.cancelar();
  }


  confirmarConEnter(): void {
    if (this.puedeConfirmar) {
      this.confirmar();
    }
  }


  cerrarDesdeFondo(
    event: MouseEvent
  ): void {
    if (
      event.target ===
      event.currentTarget
    ) {
      this.cancelar();
    }
  }


  @HostListener(
    'document:keydown.escape'
  )
  cerrarConEscape(): void {
    if (this.configuracion) {
      this.cancelar();
    }
  }
}