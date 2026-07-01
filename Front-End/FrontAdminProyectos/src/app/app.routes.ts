import { Routes } from '@angular/router';
import { LoginComponente } from './login/login';
import { CrearUsuarioComponente } from './Crearusuario/crearusuario';
import { PantallaInicioComponente } from './Pantalla-Inicio/pantallainicio';
import { CrearProyectoComponente } from './CrearProyecto/crearproyecto';
import { PantallaPrincipalProyectoComponente } from './Pantalla-PrincipalProyecto/pantallaprincipalproyecto';
import { CalendarioActividadesComponente } from './CalendarioActividades/calendario';
import { PantallaConfiguracionComponente } from './Pantalla-ConfiguracionProyecto/pantallaconfiguracion';
import { MenuConfiguracionComponente } from './MenuConfiguracion/menuconfiguracion';

export const routes: Routes = [
  // --- Rutas Públicas / Autenticación ---
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponente },
  { path: 'registro', component: CrearUsuarioComponente },

  // --- Rutas Globales (Contexto de Usuario) ---
  { path: 'inicio', component: PantallaInicioComponente },
  { path: 'crear-proyecto', component: CrearProyectoComponente },

  // --- Rutas Anidadas (Contexto de Proyecto Específico estilo GitHub) ---
  { 
    path: 'proyecto/:id', 
    children: [
      // /proyecto/1 -> Abre el dashboard del proyecto
      { path: '', component: PantallaPrincipalProyectoComponente },
      
      // /proyecto/1/calendario -> Abre el calendario de ese proyecto
      { path: 'calendario', component: CalendarioActividadesComponente },
      
      // /proyecto/1/integrantes -> Abre la gestión de usuarios
      { path: 'integrantes', component: PantallaConfiguracionComponente },
      
      // /proyecto/1/configuracion -> Abre configuraciones generales
      { path: 'configuracion', component: MenuConfiguracionComponente },
      
      // /proyecto/1/configuracion/permisos -> (Ejemplo de sub-opción)
      { path: 'configuracion/:opcion', component: PantallaConfiguracionComponente }
    ]
  },

  // Ruta comodín para manejar URLs no encontradas
  { path: '**', redirectTo: '/inicio' }
];