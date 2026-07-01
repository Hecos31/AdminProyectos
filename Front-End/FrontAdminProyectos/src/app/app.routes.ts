import { Routes } from '@angular/router';
import { LoginComponente } from './login/login';
import { CrearUsuarioComponente } from './Crearusuario/crearusuario';
import { PantallaInicioComponente } from './Pantalla-Inicio/pantallainicio';
import { PantallaPrincipalProyectoComponente } from './Pantalla-PrincipalProyecto/pantallaprincipalproyecto';
import { CrearProyectoComponente } from './CrearProyecto/crearproyecto';
import { PantallaConfiguracionComponente } from './Pantalla-ConfiguracionProyecto/pantallaconfiguracion';
import { CalendarioActividadesComponente } from './CalendarioActividades/calendario';
import { MenuConfiguracionComponente } from './MenuConfiguracion/menuconfiguracion';
import { ChatGlobalProyectoComponente } from './Chatglobalproyecto/chatglobalproyecto';
import { ChatActividadComponente } from './Chatactividades/chatactividades';
import { ChatPersonalComponente } from './Chatpersonal/chatpersonal';
import { ListaChatComponente } from './ListaChat/listachat';


export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponente },
  { path: 'registro', component: CrearUsuarioComponente },
  { path: 'inicio', component: PantallaInicioComponente },
  { path: 'crear-proyecto', component: CrearProyectoComponente },
  { path: 'proyecto/:id', component: PantallaPrincipalProyectoComponente },
  { path: 'proyecto/:id/calendario', component: CalendarioActividadesComponente },
  { path: 'proyecto/:id/configuracion/:opcion', component: PantallaConfiguracionComponente },
  { path: 'integrantes', component: PantallaConfiguracionComponente },
  { path: 'calendario', component: CalendarioActividadesComponente },
  { path: 'configuracion', component: MenuConfiguracionComponente },
  {path: 'chatglobalproyecto', component: ChatGlobalProyectoComponente},
  {path: 'chatactividades', component: ChatActividadComponente},
  {path: 'chatpersonal', component:ChatPersonalComponente},
  {path: 'listaschat', component:ListaChatComponente}

];