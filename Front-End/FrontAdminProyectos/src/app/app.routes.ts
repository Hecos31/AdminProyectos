import { Routes } from '@angular/router';
import { LoginComponente } from './login/login';
import { CrearUsuarioComponente } from './Crearusuario/crearusuario';
import { PantallaInicioComponente } from './Pantalla-Inicio/pantallainicio';
import { PantallaPrincipalProyectoComponente } from './Pantalla-PrincipalProyecto/pantallaprincipalproyecto';
import { PantallaConfiguracionComponente } from './Pantalla-ConfiguracionProyecto/pantallaconfiguracion';
import { CalendarioActividadesComponente } from './CalendarioActividades/calendario';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponente },
  { path: 'registro', component: CrearUsuarioComponente },
  { path: 'inicio', component: PantallaInicioComponente },
  { path: 'proyecto/:id', component: PantallaPrincipalProyectoComponente },
  { path: 'proyecto/:id/calendario', component: CalendarioActividadesComponente },
  { path: 'proyecto/:id/configuracion/:opcion', component: PantallaConfiguracionComponente },
  { path: 'integrantes', component: PantallaConfiguracionComponente },
  { path: 'calendario', component: CalendarioActividadesComponente },
  { path: 'configuracion', component: PantallaConfiguracionComponente }
];