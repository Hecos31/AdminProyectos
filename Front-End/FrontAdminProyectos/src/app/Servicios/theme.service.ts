import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  private readonly storageKey = 'orbita-theme';
  private initialized = false;

  currentTheme: AppTheme = 'light';

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  /**
   * Inicializa el tema al abrir la aplicación.
   *
   * Orden de prioridad:
   * 1. Tema guardado por el usuario.
   * 2. Tema configurado en el sistema operativo.
   * 3. Tema claro como respaldo.
   */
  initializeTheme(): void {
    if (this.initialized || !isPlatformBrowser(this.platformId)) {
      return;
    }

    const savedTheme = this.getSavedTheme();
    const initialTheme = savedTheme ?? this.getSystemTheme();

    this.applyTheme(initialTheme, false);
    this.initialized = true;
  }

  /**
   * Cambia entre modo claro y oscuro.
   */
  toggleTheme(): void {
    const nextTheme: AppTheme =
      this.currentTheme === 'dark'
        ? 'light'
        : 'dark';

    this.setTheme(nextTheme);
  }

  /**
   * Permite aplicar directamente un tema.
   */
  setTheme(theme: AppTheme): void {
    this.applyTheme(theme, true);
  }

  /**
   * Devuelve true cuando el modo oscuro está activo.
   */
  isDarkTheme(): boolean {
    return this.currentTheme === 'dark';
  }

  private applyTheme(
    theme: AppTheme,
    persist: boolean
  ): void {
    this.currentTheme = theme;

    this.document.documentElement.setAttribute(
      'data-theme',
      theme
    );

    if (
      persist &&
      isPlatformBrowser(this.platformId)
    ) {
      try {
        localStorage.setItem(
          this.storageKey,
          theme
        );
      } catch (error) {
        console.warn(
          'No fue posible guardar la preferencia del tema.',
          error
        );
      }
    }
  }

  private getSavedTheme(): AppTheme | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const savedTheme = localStorage.getItem(
        this.storageKey
      );

      if (
        savedTheme === 'light' ||
        savedTheme === 'dark'
      ) {
        return savedTheme;
      }

      return null;
    } catch {
      return null;
    }
  }

  private getSystemTheme(): AppTheme {
    if (
      isPlatformBrowser(this.platformId) &&
      window.matchMedia
    ) {
      return window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches
        ? 'dark'
        : 'light';
    }

    return 'light';
  }
}