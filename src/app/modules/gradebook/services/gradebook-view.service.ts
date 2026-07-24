import { Injectable, signal } from '@angular/core';

/**
 * Contexto de visualización.
 * Combina:
 * - routeParams: parámetros de ruta (classid, unidid, lessonid, etc.)
 * - viewParams: parámetros de visualización (viewMode, sortBy, etc.)
 *
 * Representa "dónde estamos" en la navegación y "cómo queremos verlo".
 */
export interface ViewContext {
  // Parámetros de ruta (vienen de URL path: /gradebook/123/456/789)
  classid?: string;
  unidid?: string;
  lessonid?: string;
  activid?: string;
  segmentid?: string;

  // Parámetros de visualización (vienen de query params: ?viewMode=schedule&sortBy=name)
  [key: string]: string | boolean | undefined;
}

/**
 * Servicio que gestiona el contexto de visualización (dónde estamos + cómo lo vemos).
 *
 * Unifica routeParams y viewParams en un único objeto ViewContext.
 * Simplifica las responsabilidades: un solo lugar que dice "estado actual de la vista".
 */
@Injectable({ providedIn: 'root' })
export class GradebookViewService {

  /**
   * Contexto actual de visualización.
   * Incluye tanto parámetros de ruta como de visualización.
   *
   * Ejemplos:
   * - { classid: '123' }
   * - { classid: '123', unidid: '456', viewMode: 'grades' }
   * - { classid: '123', viewMode: 'schedule', sortBy: 'name' }
   */
  readonly viewContext = signal<ViewContext>({});

  /**
   * Actualiza el contexto de visualización completo.
   */
  setViewContext(context: ViewContext): void {
    this.viewContext.set(context);
  }

  /**
   * Actualiza un parámetro específico sin afectar los demás.
   */
  updateViewContextParam(key: string, value: string | boolean | undefined): void {
    this.viewContext.update(current => ({
      ...current,
      [key]: value,
    }));
  }

  /**
   * Limpia el contexto a su estado por defecto.
   */
  reset(): void {
    this.viewContext.set({});  }
}