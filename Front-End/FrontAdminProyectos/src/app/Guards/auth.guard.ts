import { inject } from '@angular/core';
import { Router, CanActivateChildFn } from '@angular/router';

// === LÓGICA DEL GUARDIÁN ===
// Se ejecuta automáticamente antes de cargar cualquier componente protegido
export const authGuard: CanActivateChildFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  // Si hay token, lo dejamos pasar. 
  // (La seguridad real de si el token es válido o pirata la hace FastAPI en cada petición).
  if (token) {
    return true; 
  }

  // Si no hay token, lo pateamos de vuelta al login
  router.navigate(['/login']);
  return false;
};