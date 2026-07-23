import { Routes } from '@angular/router';
import { LoginComponente } from './login/login';
import { CrearUsuarioComponente } from './Crearusuario/crearusuario';
import { PantallaInicioComponente } from './Pantalla-Inicio/pantallainicio';
import { CrearProyectoComponente } from './CrearProyecto/crearproyecto';
import { PantallaPrincipalProyectoComponente } from './Pantalla-PrincipalProyecto/pantallaprincipalproyecto';
import { CalendarioActividadesComponente } from './CalendarioActividades/calendario';
import { PantallaConfiguracionComponente } from './Pantalla-ConfiguracionProyecto/pantallaconfiguracion';
import { MenuConfiguracionComponente } from './MenuConfiguracion/menuconfiguracion';
import { ChatComponente } from './Chats/chat';
import { TablonActividades } from './tablon-actividades/tablon-actividades';
import { Actividadesusuario } from './actividadesusuario/actividadesusuario';
import { Crearactividades } from './crearactividades/crearactividades';


export const routes: Routes = [
  // --- Rutas Públicas / Autenticación ---
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponente },
  { path: 'registro', component: CrearUsuarioComponente },
  
  // Rutas Globales
  { path: 'inicio', component: PantallaInicioComponente },
  { path: 'crear-proyecto', component: CrearProyectoComponente },
  { path: 'chats', component: ChatComponente },
  
  // Rutas de Proyecto Específico
  { path: 'proyecto/:id', component: PantallaPrincipalProyectoComponente },
  // { path: 'proyecto/:id/calendario', component: CalendarioActividadesComponente },
  
  // 1. Ruta para el menú de configuración general (El grid de opciones)
  { path: 'proyecto/:id/configuracion', component: MenuConfiguracionComponente },
  
  // 2. Ruta directa para la gestión de integrantes (PantallaConfiguracion)
  { path: 'proyecto/:id/integrantes', component: PantallaConfiguracionComponente },
  
  // 3. Ruta comodín para cuando navegas desde el grid de opciones (ej. reportes, etiquetas)
  // Nota: La dejamos al final para que Angular priorice las rutas exactas de arriba
  { path: 'proyecto/:id/configuracion/:opcion', component: PantallaConfiguracionComponente },

  { path: 'proyecto/:id/tablon', component: TablonActividades },
  { path: 'proyecto/:id/mis-actividades', component: Actividadesusuario },
  { path: 'proyecto/:id/crearactividades', component: Crearactividades }
];