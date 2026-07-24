// === IMPORTACIONES ===
import { Routes } from '@angular/router';

// Componentes de Autenticación
import { LoginComponente } from './login/login';
import { CrearUsuarioComponente } from './Crearusuario/crearusuario';

// Componentes Globales
import { PantallaInicioComponente } from './Pantalla-Inicio/pantallainicio';
import { CrearProyectoComponente } from './CrearProyecto/crearproyecto';
import { ChatComponente } from './Chats/chat';

// Componentes de Proyecto
import { PantallaPrincipalProyectoComponente } from './Pantalla-PrincipalProyecto/pantallaprincipalproyecto';
import { PantallaConfiguracionComponente } from './Pantalla-ConfiguracionProyecto/pantallaconfiguracion';
import { MenuConfiguracionComponente } from './MenuConfiguracion/menuconfiguracion';
import { TablonActividades } from './tablon-actividades/tablon-actividades';
import { Actividadesusuario } from './actividadesusuario/actividadesusuario';
import { Crearactividades } from './crearactividades/crearactividades';

// Guardianes de Seguridad (Te paso el código en el siguiente paso)
import { authGuard } from './Guards/auth.guard';

// === DEFINICIÓN DE RUTAS ===
export const routes: Routes = [
  
  // 1. ZONA PÚBLICA (Sin sesión iniciada)
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponente },
  { path: 'registro', component: CrearUsuarioComponente },
  
  // 2. ZONA GLOBAL PRIVADA 
  { 
    path: '', 
    canActivateChild: [authGuard],
    children: [
      { path: 'inicio', component: PantallaInicioComponente },
      { path: 'crear-proyecto', component: CrearProyectoComponente },
      { path: 'chats', component: ChatComponente },
      
      // 3. CONTEXTO DE PROYECTO (Requieren sesión y pertenecer al proyecto)
      { path: 'proyecto/:id', component: PantallaPrincipalProyectoComponente },
      { path: 'proyecto/:id/tablon', component: TablonActividades },
      { path: 'proyecto/:id/mis-actividades', component: Actividadesusuario },
      
      // 4. CONTEXTO DE ADMINISTRACIÓN (Requieren rol de Admin/Manager)
      { path: 'proyecto/:id/crearactividades', component: Crearactividades },
      { path: 'proyecto/:id/configuracion', component: MenuConfiguracionComponente },
      { path: 'proyecto/:id/integrantes', component: PantallaConfiguracionComponente },
    ]
  },

  // 5. RUTA DE ERROR 
  { path: '**', redirectTo: '/inicio' } 
];