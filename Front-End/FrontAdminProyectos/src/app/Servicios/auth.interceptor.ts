import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      
      // Solo actuamos si es 401 Y NO estamos intentando iniciar sesión
      if (error.status === 401 && !req.url.includes('/login')) {
        
        localStorage.clear();
        
        // Obtenemos el Router de forma segura solo en el momento que lo necesitamos
        const router = injector.get(Router);
        router.navigate(['/login']);
      }
      
      return throwError(() => error);
    })
  );
};