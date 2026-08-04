import {
  Component
} from '@angular/core';

import {
  RouterModule
} from '@angular/router';


@Component({
  selector: 'app-pagina-presentacion',
  standalone: true,

  imports: [
    RouterModule
  ],

  templateUrl:
    './pagina-presentacion.html',

  styleUrls: [
    './pagina-presentacion.css'
  ]
})
export class PaginaPresentacionComponente {
  readonly anioActual =
    new Date().getFullYear();
}