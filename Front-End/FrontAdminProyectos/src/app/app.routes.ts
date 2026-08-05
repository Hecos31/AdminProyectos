// === IMPORTACIONES ===
import { Routes } from '@angular/router';

import {
  PaginaPresentacionComponente
} from './pagina-presentacion/pagina-presentacion';

import { LoginComponente } from './login/login';
import { CrearUsuarioComponente } from './Crearusuario/crearusuario';

import { PantallaInicioComponente } from './Pantalla-Inicio/pantallainicio';
import { CrearProyectoComponente } from './CrearProyecto/crearproyecto';

import {
  PantallaPrincipalProyectoComponente
} from './Pantalla-PrincipalProyecto/pantallaprincipalproyecto';

import {
  PantallaConfiguracionComponente
} from './Pantalla-ConfiguracionProyecto/pantallaconfiguracion';

import {
  MenuConfiguracionComponente
} from './MenuConfiguracion/menuconfiguracion';

import {
  EditarProyectoComponente
} from './EditarProyecto/editarproyecto';

import {
  TablonActividades
} from './tablon-actividades/tablon-actividades';

import {
  Actividadesusuario
} from './actividadesusuario/actividadesusuario';

import {
  Crearactividades
} from './crearactividades/crearactividades';

import {
  authGuard
} from './Guards/auth.guard';


export const routes: Routes = [
  {
    path: '',
    component: PaginaPresentacionComponente,
    pathMatch: 'full',
    title: 'Orbita | Gestión de proyectos'
  },

  {
    path: 'login',
    component: LoginComponente,
    title: 'Iniciar sesión | Orbita'
  },

  {
    path: 'registro',
    component: CrearUsuarioComponente,
    title: 'Crear cuenta | Orbita'
  },

  {
    path: '',
    canActivateChild: [
      authGuard
    ],

    children: [
      {
        path: 'inicio',
        component: PantallaInicioComponente,
        title: 'Mis proyectos | Orbita'
      },

      {
        path: 'crear-proyecto',
        component: CrearProyectoComponente,
        title: 'Crear proyecto | Orbita'
      },

      {
        path: 'proyecto/:id',
        component: PantallaPrincipalProyectoComponente,
        title: 'Proyecto | Orbita'
      },

      {
        path: 'proyecto/:id/tablon',
        component: TablonActividades,
        title: 'Tablón | Orbita'
      },

      {
        path: 'proyecto/:id/mis-actividades',
        component: Actividadesusuario,
        title: 'Mis actividades | Orbita'
      },

      {
        path: 'proyecto/:id/crearactividades',
        component: Crearactividades,
        title: 'Administrar actividades | Orbita'
      },

      {
        path: 'proyecto/:id/configuracion/editar',
        component: EditarProyectoComponente,
        title: 'Editar proyecto | Orbita'
      },

      {
        path: 'proyecto/:id/configuracion',
        component: MenuConfiguracionComponente,
        title: 'Configuración | Orbita'
      },

      {
        path: 'proyecto/:id/integrantes',
        component: PantallaConfiguracionComponente,
        title: 'Integrantes | Orbita'
      }
    ]
  },

  {
    path: '**',
    redirectTo: ''
  }
];