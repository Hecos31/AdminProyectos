// === IMPORTACIONES ===
import { Routes } from '@angular/router';

// =========================================================
// PÁGINA PÚBLICA
// =========================================================

import {
  PaginaPresentacionComponente
} from './pagina-presentacion/pagina-presentacion';


// =========================================================
// AUTENTICACIÓN
// =========================================================

import {
  LoginComponente
} from './login/login';

import {
  CrearUsuarioComponente
} from './Crearusuario/crearusuario';


// =========================================================
// COMPONENTES GLOBALES
// =========================================================

import {
  PantallaInicioComponente
} from './Pantalla-Inicio/pantallainicio';

import {
  CrearProyectoComponente
} from './CrearProyecto/crearproyecto';

import {
  CalendarioComponent
} from './calendario/calendario';


// =========================================================
// COMPONENTES DEL PROYECTO
// =========================================================

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


// =========================================================
// GUARD DE AUTENTICACIÓN
// =========================================================

import {
  authGuard
} from './Guards/auth.guard';


// =========================================================
// DEFINICIÓN DE RUTAS
// =========================================================

export const routes: Routes = [

  // =======================================================
  // ZONA PÚBLICA
  // =======================================================

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


  // =======================================================
  // ZONA PRIVADA
  // =======================================================

  {
    path: '',

    canActivateChild: [
      authGuard
    ],

    children: [

      // ===================================================
      // RUTAS GLOBALES
      // ===================================================

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
        path: 'calendario',
        component: CalendarioComponent,
        title: 'Calendario | Orbita'
      },


      // ===================================================
      // RUTAS DEL PROYECTO
      // ===================================================

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

      /*
       * Esta ruta permite abrir el calendario desde un proyecto
       * conservando el ID en la URL.
       */
      {
        path: 'proyecto/:id/calendario',
        component: CalendarioComponent,
        title: 'Calendario del proyecto | Orbita'
      },


      // ===================================================
      // ADMINISTRACIÓN DEL PROYECTO
      // ===================================================

      {
        path: 'proyecto/:id/crearactividades',
        component: Crearactividades,
        title: 'Administrar actividades | Orbita'
      },

      {
        path: 'proyecto/:id/configuracion',
        component: MenuConfiguracionComponente,
        title: 'Configuración | Orbita'
      },

      {
        path: 'proyecto/:id/configuracion/editar',
        component: EditarProyectoComponente,
        title: 'Editar proyecto | Orbita'
      },

      {
        path: 'proyecto/:id/integrantes',
        component: PantallaConfiguracionComponente,
        title: 'Integrantes | Orbita'
      }
    ]
  },


  // =======================================================
  // RUTA NO ENCONTRADA
  // =======================================================

  {
    path: '**',
    redirectTo: ''
  }
];