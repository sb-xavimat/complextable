import { Injectable, signal, computed } from '@angular/core';
import { CellClasses, GradebookConfig, StudentGroup, GradebookApiResponse } from '../models/gradebook.models';
import { ViewContext } from './gradebook-view.service';

/**
 * Servicio centralizado para el estado del gradebook.
 *
 * Responsabilidades:
 * - Guardar datos crudos (rawData) — caché del API
 * - Guardar contexto de visualización (viewContext) — dónde estamos + cómo lo vemos
 * - Guardar datos procesados — tabla visible
 * - Manejo de estado UI (loading, error)
 * - Toggles de grupos (collapse/expand)
 */
@Injectable({ providedIn: 'root' })
export class GradebookStateService {

  readonly config: GradebookConfig = {
    topRows: [{ lines: 2 }],
    fixedRightCols: 2,
  };

  // ---- Signals de datos RAW (caché del API) ----
  /**
   * Datos crudos del API — se guardan UNA SOLA VEZ.
   * No se re-piden cuando cambia la ruta o vista.
   *
   * Estructura desconocida — será transformada por GradebookCookerService
   * en CookedGradebookData.
   */
  readonly rawData = signal<GradebookApiResponse | null>(null);

  /**
   * Contexto actual de visualización (combinación de route + view params).
   * Se actualiza cuando:
   * - Cambia la URL (parámetros de ruta)
   * - Se activa/desactiva un switch en el footer (parámetros de visualización)
   */
  readonly viewContext = signal<ViewContext>({});

  /**
   * Datos cocinados (después de transformar rawData).
   * Se actualiza cuando rawData o viewContext cambian.
   */
  readonly cookedData = signal<any | null>(null);

  // ---- Signals de datos procesados (tabla visible) ----
  readonly headerRows   = signal<string[][]>([]);
  readonly groups       = signal<StudentGroup[]>([]);
  readonly cellClasses  = signal<CellClasses>({});
  readonly totalCols    = signal(0);
  readonly studentCount = signal(0);

  // ---- Signals de UI ----
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  // ---- Computed ----
  readonly footerText = computed(() =>
    `${this.studentCount()} alumnos · ${this.totalCols()} columnas`
  );

  // ---- Acciones ----
  toggleGroup(index: number): void {
    this.groups.update(gs =>
      gs.map((g, i) => i === index ? { ...g, collapsed: !g.collapsed } : g)
    );
  }

  /**
   * Actualiza los datos procesados que se renderizan en la tabla.
   * Se llama desde el componente después de transformar datos cocinados.
   */
  updateProcessedData(data: {
    headerRows: string[][];
    groups: StudentGroup[];
    cellClasses: CellClasses;
    totalCols: number;
    studentCount: number;
  }): void {
    this.headerRows.set(data.headerRows);
    this.groups.set(data.groups);
    this.cellClasses.set(data.cellClasses);
    this.totalCols.set(data.totalCols);
    this.studentCount.set(data.studentCount);
  }
}
